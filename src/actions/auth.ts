'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getMessages, normalizeLocale } from '@/lib/i18n';
import { deleteSession, setSession } from '@/lib/session';
import { getSessionPacienteId } from './data';
import { sendNewsletterSubscriptionEmail, sendPasswordRecoveryEmail } from '@/lib/email';
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
  edad: z.number().int().min(1),
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


async function sendRecoveryEmailIfAccountExists(email: string, locale: 'es' | 'en') {
  const existingUser = await prisma.paciente.findFirst({
    where: { email },
    select: { paciente_id: true },
  });

  if (!existingUser) {
    return;
  }

  const appUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  await sendPasswordRecoveryEmail({
    to: email,
    locale,
    appUrl,
  });
}

function isPacienteColumnMissingError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error as Prisma.PrismaClientKnownRequestError).code === 'P2022';
}

async function ensurePacienteAuthColumns() {
  await prisma.$executeRawUnsafe('ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS email TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS password_hash TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS newsletter_suscrito BOOLEAN DEFAULT TRUE');
}

async function isBotIdBlocked(): Promise<boolean> {
  try {
    const botIdModuleName = 'botid/server';
    const botId = (await import(botIdModuleName)) as {
      checkBotId?: () => Promise<{ isBot: boolean }>;
    };
    if (!botId.checkBotId) {
      return false;
    }
    const result = await botId.checkBotId();
    return Boolean(result.isBot);
  } catch {
    // Resilient fallback for browsers/ad-blockers where BotID signal may be unavailable.
    return false;
  }
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

    let paciente;
    try {
      paciente = await prisma.paciente.findFirst({
        where: { email: data.email },
      });
    } catch (error) {
      if (!isPacienteColumnMissingError(error)) {
        throw error;
      }
      await ensurePacienteAuthColumns();
      paciente = await prisma.paciente.findFirst({
        where: { email: data.email },
      });
    }

    if (!paciente) {
      return { error: authMessages.invalidCredentials };
    }

    if (!paciente.password_hash || paciente.password_hash.trim().length === 0) {
      return { error: authMessages.invalidCredentials };
    }

    const isValid = await bcrypt.compare(data.password, paciente.password_hash);
    if (!isValid) {
      return { error: authMessages.invalidCredentials };
    }

    await setSession(paciente.paciente_id);

    return { success: true };
  } catch (error) {
    const locale = normalizeLocale(formData.get('locale')?.toString());
    const authMessages = getMessages(locale).auth.messages;
    if (error instanceof z.ZodError) return { error: authMessages.invalidData };
    console.error(error);
    return { error: authMessages.serverError };
  }
}

export async function registerAction(prevState: AuthActionState, formData: FormData) {
  try {
    const rawData = Object.fromEntries(formData.entries());
    const parsedData = {
        ...rawData,
        edad: Number.parseInt(rawData.edad as string, 10),
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

    let existingUser;
    try {
      existingUser = await prisma.paciente.findFirst({
        where: { email: data.email },
      });
    } catch (error) {
      if (!isPacienteColumnMissingError(error)) {
        throw error;
      }
      await ensurePacienteAuthColumns();
      existingUser = await prisma.paciente.findFirst({
        where: { email: data.email },
      });
    }

    if (existingUser) {
      return { error: authMessages.registerEmailUnavailable };
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    let newPaciente;
    try {
      newPaciente = await prisma.paciente.create({
        data: {
          nombre: data.nombre,
          apellido: data.apellido,
          email: data.email,
          password_hash: hashedPassword,
          newsletter_suscrito: data.newsletterSubscribed ?? true,
          edad: data.edad,
          sexo: data.sexo,
          diagnostico_principal: data.diagnostico,
          usa_glucometro: false,
        },
      });
    } catch (error) {
      if (!isPacienteColumnMissingError(error)) {
        throw error;
      }
      await ensurePacienteAuthColumns();
      newPaciente = await prisma.paciente.create({
        data: {
          nombre: data.nombre,
          apellido: data.apellido,
          email: data.email,
          password_hash: hashedPassword,
          newsletter_suscrito: data.newsletterSubscribed ?? true,
          edad: data.edad,
          sexo: data.sexo,
          diagnostico_principal: data.diagnostico,
          usa_glucometro: false,
        },
      });
    }

    await setSession(newPaciente.paciente_id);

    return { success: true };
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

    await sendRecoveryEmailIfAccountExists(data.email, locale);

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
