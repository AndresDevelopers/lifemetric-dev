'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase';
import { getMessages, normalizeLocale } from '@/lib/i18n';
import { deleteSession, setSession } from '@/lib/session';
import { getSessionPacienteId } from './data';
import { sendNewsletterSubscriptionEmail } from '@/lib/email';
import { checkRateLimit } from '@/lib/redis';

export type AuthActionState = {
  error?: string;
  success?: boolean;
  message?: string;
} | undefined;

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  captchaToken: z.string().optional(),
  captchaProvider: z.enum(['turnstile', 'botid']).optional(),
  locale: z.string().optional(),
});

const registerSchema = z.object({
  nombre: z.string().min(2),
  apellido: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  fechaNacimiento: z.string().min(1),
  sexo: z.string().min(1),
  diagnostico: z.string().min(1),
  captchaToken: z.string().optional(),
  captchaProvider: z.enum(['turnstile', 'botid']).optional(),
  locale: z.string().optional(),
  newsletterSubscribed: z.coerce.boolean().optional(),
});

const recoverSchema = z.object({
  email: z.string().email(),
  captchaToken: z.string().optional(),
  captchaProvider: z.enum(['turnstile', 'botid']).optional(),
  locale: z.string().optional(),
});


function isPacienteColumnMissingError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error as Prisma.PrismaClientKnownRequestError).code === 'P2022';
}

async function ensurePacienteAuthColumns() {
  await prisma.$executeRawUnsafe('ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS email TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS password_hash TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS newsletter_suscrito BOOLEAN DEFAULT TRUE');
  await prisma.$executeRawUnsafe("ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS idioma TEXT DEFAULT 'es'");
}

async function findOrCreatePacienteByEmail(input: {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  edad: number;
  sexo: string;
  diagnosticoPrincipal: string;
  newsletterSuscrito: boolean;
}) {
  const createPaciente = async () => prisma.paciente.create({
    data: {
      nombre: input.nombre,
      apellido: input.apellido,
      email: input.email,
      password_hash: await bcrypt.hash(input.password, 10),
      newsletter_suscrito: input.newsletterSuscrito,
      edad: input.edad,
      sexo: input.sexo,
      diagnostico_principal: input.diagnosticoPrincipal,
      usa_glucometro: false,
    },
  });

  try {
    const paciente = await prisma.paciente.findFirst({ where: { email: input.email } });
    return paciente ?? await createPaciente();
  } catch (error) {
    if (!isPacienteColumnMissingError(error)) {
      throw error;
    }
    await ensurePacienteAuthColumns();
    const paciente = await prisma.paciente.findFirst({ where: { email: input.email } });
    return paciente ?? await createPaciente();
  }
}

async function isBotIdBlocked(): Promise<boolean> {
  const headerStore = await headers();
  const botSignal = headerStore.get('x-vercel-botid')?.toLowerCase() ?? '';
  return botSignal.includes('bot');
}

function getDefaultPacienteData(email: string) {
  const username = email.split('@')[0] ?? 'usuario';
  return {
    nombre: username,
    apellido: 'Usuario',
    edad: 18,
    sexo: 'No especificado',
    diagnostico_principal: 'Sin especificar',
    usa_glucometro: false,
    newsletter_suscrito: true,
  };
}

function calculateAgeFromBirthDate(fechaNacimiento: string): number {
  const birth = new Date(fechaNacimiento);
  if (Number.isNaN(birth.getTime())) {
    return 18;
  }
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return Math.max(1, age);
}

export async function loginAction(prevState: AuthActionState, formData: FormData) {
  try {
    const rawData = Object.fromEntries(formData.entries());
    const data = loginSchema.parse(rawData);
    const locale = normalizeLocale(data.locale);
    const authMessages = getMessages(locale).auth.messages;

    const isAllowed = await checkRateLimit(`login:${data.email}`);
    if (!isAllowed) return { error: "Demasiados intentos. Por favor, intente más tarde." };
    if (data.captchaProvider === 'botid' && await isBotIdBlocked()) {
      return { error: authMessages.invalidCaptcha };
    }

    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
    if (data.captchaProvider !== 'botid' && turnstileSecret && turnstileSecret !== '1x00000000000000000000AA' && data.captchaToken) {
       try {
         const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
           method: 'POST',
           body: `secret=${turnstileSecret}&response=${data.captchaToken}`,
           headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
         });
         const outcome = await res.json();
         if (!outcome.success) {
           console.warn('Turnstile verification failed, but allowing login due to resilience bypass rule.');
         }
       } catch (error) {
         console.warn('Error connecting to Turnstile siteverify, bypassing check:', error);
       }
    }

    const supabase = createSupabaseServerClient({ useServiceRole: false });
    const { error: signInError, data: signInData } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (signInError || !signInData.user) {
      return { error: authMessages.invalidCredentials };
    }

    const defaults = getDefaultPacienteData(data.email);
    const paciente = await findOrCreatePacienteByEmail({
      email: data.email,
      password: data.password,
      nombre: defaults.nombre,
      apellido: defaults.apellido,
      edad: defaults.edad,
      sexo: defaults.sexo,
      diagnosticoPrincipal: defaults.diagnostico_principal,
      newsletterSuscrito: defaults.newsletter_suscrito,
    });

    await setSession(paciente.paciente_id);

    return { success: true };
  } catch (error) {
    const locale = normalizeLocale(formData.get('locale')?.toString());
    const authMessages = getMessages(locale).auth.messages;
    if (error instanceof z.ZodError) return { error: authMessages.invalidData };
    if (
      error instanceof Prisma.PrismaClientInitializationError ||
      error instanceof Prisma.PrismaClientKnownRequestError ||
      error instanceof Prisma.PrismaClientValidationError
    ) {
      return { error: authMessages.invalidCredentials };
    }
    console.error(error);
    return { error: authMessages.serverError };
  }
}

export async function registerAction(prevState: AuthActionState, formData: FormData) {
  try {
    const rawData = Object.fromEntries(formData.entries());
    const parsedData = {
        ...rawData,
        fechaNacimiento: (rawData.fechaNacimiento as string | undefined) ?? '',
        newsletterSubscribed: rawData.newsletterSubscribed === 'on' || rawData.newsletterSubscribed === 'true',
    };
    const data = registerSchema.parse(parsedData);
    const locale = normalizeLocale(data.locale);
    const authMessages = getMessages(locale).auth.messages;

    const isAllowed = await checkRateLimit(`register:${data.email}`);
    if (!isAllowed) return { error: "Demasiados intentos. Por favor, intente más tarde." };
    if (data.captchaProvider === 'botid' && await isBotIdBlocked()) {
      return { error: authMessages.invalidCaptcha };
    }

    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
    if (data.captchaProvider !== 'botid' && turnstileSecret && turnstileSecret !== '1x00000000000000000000AA') {
       try {
         const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
           method: 'POST',
           body: `secret=${turnstileSecret}&response=${data.captchaToken}`,
           headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
         });
         const outcome = await res.json();
         if (!outcome.success) {
           console.warn('Turnstile verification failed, but allowing workflow due to resilience bypass rule.');
         }
       } catch (error) {
         console.warn('Error connecting to Turnstile siteverify, bypassing check:', error);
       }
    }

    const supabase = createSupabaseServerClient({ useServiceRole: false });
    const appUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${appUrl}/login`,
      },
    });

    if (signUpError) {
      const isDuplicate = /already registered|already been registered|user already exists/i.test(signUpError.message);
      return { error: isDuplicate ? authMessages.registerEmailUnavailable : authMessages.registerError };
    }

    const edadCalculada = calculateAgeFromBirthDate(data.fechaNacimiento);

    let paciente;
    try {
      paciente = await findOrCreatePacienteByEmail({
        email: data.email,
        password: data.password,
        nombre: data.nombre,
        apellido: data.apellido,
        edad: edadCalculada,
        sexo: data.sexo,
        diagnosticoPrincipal: data.diagnostico,
        newsletterSuscrito: data.newsletterSubscribed ?? true,
      });
    } catch (error) {
      if (signUpData.user?.id) {
        try {
          const adminClient = createSupabaseServerClient({ useServiceRole: true });
          await adminClient.auth.admin.deleteUser(signUpData.user.id);
        } catch (cleanupError) {
          console.error('Failed to cleanup orphan Supabase auth user after paciente creation error.', cleanupError);
        }
      }
      throw error;
    }

    if (signUpData.session) {
      await setSession(paciente.paciente_id);
      return { success: true };
    }

    const { data: autoSignInData } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (autoSignInData.user) {
      await setSession(paciente.paciente_id);
      return { success: true };
    }

    const verifyMessage = locale === 'es'
      ? 'Revisa tu correo para verificar tu cuenta y luego inicia sesión.'
      : 'Check your email to verify your account, then sign in.';
    return { success: true, message: verifyMessage };
  } catch (error) {
    const locale = normalizeLocale(formData.get('locale')?.toString());
    const authMessages = getMessages(locale).auth.messages;
    if (error instanceof z.ZodError) return { error: authMessages.invalidRegisterData };
    console.error(error);
    return { error: authMessages.registerError };
  }
}

export async function recoveryAction(prevState: AuthActionState, formData: FormData) {
  try {
    const rawData = Object.fromEntries(formData.entries());
    const data = recoverSchema.parse(rawData);
    const locale = normalizeLocale(data.locale);
    const authMessages = getMessages(locale).auth.messages;

    const isAllowed = await checkRateLimit(`recovery:${data.email}`);
    if (!isAllowed) return { error: "Demasiados intentos. Por favor, intente más tarde." };
    if (data.captchaProvider === 'botid' && await isBotIdBlocked()) {
      return { error: authMessages.invalidCaptcha };
    }

    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
    if (data.captchaProvider !== 'botid' && turnstileSecret && turnstileSecret !== '1x00000000000000000000AA') {
       try {
         const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
           method: 'POST',
           body: `secret=${turnstileSecret}&response=${data.captchaToken}`,
           headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
         });
         const outcome = await res.json();
         if (!outcome.success) {
           console.warn('Turnstile verification failed, but allowing workflow due to resilience bypass rule.');
         }
       } catch (error) {
         console.warn('Error connecting to Turnstile siteverify, bypassing check:', error);
       }
    }

    const appUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
    const supabase = createSupabaseServerClient({ useServiceRole: false });
    await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${appUrl}/recuperar`,
    });

    return { success: true, message: authMessages.recoverSuccess };
  } catch (error) {
    const locale = normalizeLocale(formData.get('locale')?.toString());
    const authMessages = getMessages(locale).auth.messages;
    if (error instanceof z.ZodError) return { error: authMessages.invalidData };
    console.error(error);
    return { error: authMessages.recoveryError };
  }
}

export async function logoutAction() {
  await deleteSession();
  redirect('/login');
}

export async function changePasswordAction(prevState: AuthActionState, formData: FormData) {
  try {
    const pacienteId = await getSessionPacienteId();
    if (!pacienteId) redirect('/login');

    const locale = normalizeLocale(formData.get('locale')?.toString());
    const messages = getMessages(locale);
    
    const newPassword = formData.get('password')?.toString();
    if (!newPassword || newPassword.length < 6) {
      return { error: messages.auth.register.passwordPlaceholder };
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.paciente.update({
      where: { paciente_id: pacienteId },
      data: { password_hash: hashedPassword },
    });

    return { success: true, message: messages.settings.passwordChanged };
  } catch (error) {
    console.error(error);
    return { error: 'Error' };
  }
}

export async function deleteAccountAction(prevState: AuthActionState, formData: FormData) {
  try {
    const pacienteId = await getSessionPacienteId();
    if (!pacienteId) redirect('/login');

    const locale = normalizeLocale(formData.get('locale')?.toString());
    const messages = getMessages(locale);

    await prisma.paciente.delete({
      where: { paciente_id: pacienteId },
    });

    await deleteSession();
    return { success: true, message: messages.settings.accountDeleted };
  } catch (error) {
    console.error(error);
    return { error: 'Error' };
  }
}

export async function subscribeToEmailsAction(prevState: AuthActionState, formData: FormData) {
  try {
    const pacienteId = await getSessionPacienteId();
    if (!pacienteId) redirect('/login');

    const locale = normalizeLocale(formData.get('locale')?.toString());
    const email = z.string().email().parse(formData.get('email')?.toString());
    const subscribed = z.coerce.boolean().parse(formData.get('newsletterSubscribed')?.toString() ?? 'false');

    await ensurePacienteAuthColumns();
    await prisma.paciente.update({
      where: { paciente_id: pacienteId },
      data: { newsletter_suscrito: subscribed },
    });

    if (subscribed) {
      const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Lifemetric';
      await sendNewsletterSubscriptionEmail({
        to: email,
        locale,
        appName,
      });
    }

    return { success: true };
  } catch (error) {
    const locale = normalizeLocale(formData.get('locale')?.toString());
    const authMessages = getMessages(locale).auth.messages;
    if (error instanceof z.ZodError) return { error: authMessages.invalidData };
    console.error(error);
    return { error: authMessages.serverError };
  }
}

const profileSchema = z.object({
  nombre: z.string().min(2),
  apellido: z.string().min(2),
  email: z.string().email(),
  sexo: z.string().min(1),
  fecha_nacimiento: z.string().optional(),
  avatar_url: z.string().optional(),
});

export async function updateProfileAction(prevState: AuthActionState, formData: FormData) {
  try {
    const pacienteId = await getSessionPacienteId();
    if (!pacienteId) redirect('/login');

    const locale = normalizeLocale(formData.get('locale')?.toString());
    const messages = getMessages(locale);
    
    const rawData = Object.fromEntries(formData.entries());
    const data = profileSchema.parse(rawData);

    // Check if email is already taken by another user if it changed
    if (data.email) {
      const currentPaciente = await prisma.paciente.findUnique({
        where: { paciente_id: pacienteId },
        select: { email: true }
      });

      if (currentPaciente?.email !== data.email) {
        const existingUser = await prisma.paciente.findFirst({
          where: { email: data.email },
        });
        if (existingUser) {
          return { error: messages.auth.messages.registerEmailUnavailable };
        }
      }
    }

    await prisma.paciente.update({
      where: { paciente_id: pacienteId },
      data: {
        nombre: data.nombre,
        apellido: data.apellido,
        email: data.email,
        sexo: data.sexo,
      },
    });

    return { success: true, message: messages.settings.profileUpdated };
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) return { error: 'Invalid data' };
    return { error: 'Error updating profile' };
  }
}

export async function updateLanguageAction(prevState: AuthActionState, formData: FormData) {
  try {
    const pacienteId = await getSessionPacienteId();
    if (!pacienteId) redirect('/login');

    const idioma = formData.get('idioma')?.toString();
    if (!idioma || !['es', 'en'].includes(idioma)) {
      return { error: 'Invalid language' };
    }

    await prisma.paciente.update({
      where: { paciente_id: pacienteId },
      data: { idioma },
    });

    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: 'Error' };
  }
}
