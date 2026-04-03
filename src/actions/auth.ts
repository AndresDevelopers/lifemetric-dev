'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient, findSupabaseAuthUserByEmail } from '@/lib/supabase';
import { getMessages, normalizeLocale } from '@/lib/i18n';
import { resolveAppBaseUrl } from '@/lib/url';
import { deleteSession, setSession } from '@/lib/session';
import { getSessionPacienteId } from './data';
import { sendLoginAccessEmail, sendNewsletterSubscriptionEmail } from '@/lib/email';
import { checkRateLimit } from '@/lib/redis';
import { ensurePacienteProfileColumns, updatePacienteProfileExtras } from '@/lib/pacienteProfile';
import { PROMO_FOCUS_PRODUCTS } from '@/lib/productCatalog';
import {
  ensurePacienteLifecycleColumns,
  findLifecyclePacienteByEmail,
  permanentlyDeletePacienteAccount,
} from '@/lib/accountLifecycle';
import {
  resolveRuntimeGeo,
  RUNTIME_CITY_COOKIE_NAME,
  RUNTIME_COUNTRY_COOKIE_NAME,
  RUNTIME_TIMEZONE_COOKIE_NAME,
} from '@/lib/runtimeGeo';
import {
  authPasswordSchema,
  formatPasswordMinLengthValidationMessage,
  getAuthPasswordSchema,
  isSupabaseWeakPasswordError,
} from '@/lib/auth/passwordPolicy';
import { getSupabaseAuthPasswordMinLength } from '@/lib/auth/passwordPolicy.server';

export type AuthActionState = {
  error?: string;
  success?: boolean;
  message?: string;
} | undefined;

const loginSchema = z.object({
  email: z.string().email(),
  password: authPasswordSchema,
  captchaToken: z.string().optional(),
  captchaProvider: z.enum(['turnstile', 'botid']).optional(),
  clientTimeZone: z.string().optional(),
  locale: z.string().optional(),
});

function createRegisterSchema(minLength: number) {
  const passwordSchema = getAuthPasswordSchema(minLength);

  return z.object({
    nombre: z.string().min(2),
    apellido: z.string().min(2),
    email: z.string().email(),
    password: passwordSchema,
    confirmPassword: passwordSchema,
    fechaNacimiento: z.string().min(1),
    alturaCm: z.coerce.number().positive().max(272).optional(),
    sexo: z.string().min(1),
    diagnostico: z.string().min(1),
    productoPermitido: z.enum(PROMO_FOCUS_PRODUCTS),
    doctorAsignado: z.enum(['Renato', 'Ulysses']).optional(),
    captchaToken: z.string().optional(),
    captchaProvider: z.enum(['turnstile', 'botid']).optional(),
    clientTimeZone: z.string().optional(),
    locale: z.string().optional(),
    newsletterSubscribed: z.coerce.boolean().optional(),
  }).refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords must match',
  });
}

const recoverSchema = z.object({
  email: z.string().email(),
  captchaToken: z.string().optional(),
  captchaProvider: z.enum(['turnstile', 'botid']).optional(),
  locale: z.string().optional(),
});

const deleteAccountSchema = z.object({
  locale: z.string().optional(),
  confirmPassword: authPasswordSchema,
});

function createChangePasswordSchema(minLength: number) {
  const passwordSchema = getAuthPasswordSchema(minLength);

  return z.object({
    locale: z.string().optional(),
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
    confirmNewPassword: passwordSchema,
  }).refine((data) => data.newPassword === data.confirmNewPassword, {
    path: ['confirmNewPassword'],
    message: 'Passwords must match',
  });
}

const syncRecoveredPasswordSchema = z.object({
  email: z.string().email(),
  password: authPasswordSchema,
  locale: z.string().optional(),
});


function isPacienteColumnMissingError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error as Prisma.PrismaClientKnownRequestError).code === 'P2022';
}

function isNextRedirectError(error: unknown): error is { digest: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest?: unknown }).digest === 'string' &&
    (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  );
}

async function ensurePacienteAuthColumns() {
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS email TEXT');
    await prisma.$executeRawUnsafe('ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS password_hash TEXT');
    await prisma.$executeRawUnsafe('ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS newsletter_suscrito BOOLEAN DEFAULT TRUE');
    await prisma.$executeRawUnsafe("ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS idioma TEXT DEFAULT 'es'");
    await ensurePacienteLifecycleColumns();
    await ensurePacienteProfileColumns();
  } catch (error) {
    console.warn('Failed to ensure auth columns, ignoring schema modification error:', error);
  }
}

async function touchPacienteLastLogin(pacienteId: string) {
  await ensurePacienteAuthColumns();
  try {
    await ensurePacienteLifecycleColumns();
    await prisma.$executeRaw`
      UPDATE pacientes SET last_login_at = NOW()
      WHERE paciente_id = ${pacienteId}::uuid
    `;
  } catch (error) {
    console.warn('Failed to touch last_login_at:', error);
  }
}

async function syncPacientePasswordHashByEmail(email: string, password: string) {
  await ensurePacienteAuthColumns();
  const hashedPassword = await bcrypt.hash(password, 10);
  await prisma.paciente.updateMany({
    where: { email },
    data: { password_hash: hashedPassword },
  });
}

function getDefaultPacienteData(input: {
  email: string;
  password: string;
  nombre?: string | null;
  apellido?: string | null;
  edad?: number | null;
  sexo?: string | null;
  diagnosticoPrincipal?: string | null;
  newsletterSuscrito?: boolean;
  fechaNacimiento?: string | null;
  alturaCm?: number | null;
  motivoRegistro?: string | null;
  productoPermitidoRegistro?: string | null;
  doctorAsignado?: string | null;
}) {
  return {
    email: input.email,
    password: input.password,
    nombre: input.nombre?.trim() || 'Paciente',
    apellido: input.apellido?.trim() || 'Lifemetric',
    edad: input.edad ?? 18,
    sexo: input.sexo?.trim() || 'No especificado',
    diagnosticoPrincipal: input.diagnosticoPrincipal?.trim() || 'Seguimiento metabólico',
    newsletterSuscrito: input.newsletterSuscrito ?? true,
    fechaNacimiento: input.fechaNacimiento ?? null,
    alturaCm: input.alturaCm ?? null,
    motivoRegistro: input.motivoRegistro ?? null,
    productoPermitidoRegistro: input.productoPermitidoRegistro ?? null,
    doctorAsignado: input.doctorAsignado ?? null,
  };
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
  fechaNacimiento?: string | null;
  alturaCm?: number | null;
  motivoRegistro?: string | null;
  productoPermitidoRegistro?: string | null;
  doctorAsignado?: string | null;
}) {
  const defaultPacienteData = getDefaultPacienteData(input);
  const createPaciente = async () => prisma.paciente.create({
    data: {
      nombre: defaultPacienteData.nombre,
      apellido: defaultPacienteData.apellido,
      email: defaultPacienteData.email,
      password_hash: await bcrypt.hash(input.password, 10),
      newsletter_suscrito: defaultPacienteData.newsletterSuscrito,
      edad: defaultPacienteData.edad,
      sexo: defaultPacienteData.sexo,
      diagnostico_principal: defaultPacienteData.diagnosticoPrincipal,
      usa_glucometro: false,
    },
  });

  try {
    const paciente = await prisma.paciente.findFirst({ where: { email: input.email } });
    let currentPaciente = paciente;
    if (!paciente) {
      currentPaciente = await createPaciente();
    }
    if (!currentPaciente) {
      throw new Error('No se pudo crear el paciente.');
    }
    await updatePacienteProfileExtras(currentPaciente.paciente_id, {
      fechaNacimiento: input.fechaNacimiento,
      alturaCm: input.alturaCm,
      motivoRegistro: input.motivoRegistro,
    });
    return currentPaciente;
  } catch (error) {
    if (!isPacienteColumnMissingError(error)) {
      throw error;
    }
    await ensurePacienteAuthColumns();
    const paciente = await prisma.paciente.findFirst({ where: { email: input.email } });
    let currentPaciente = paciente;
    if (!paciente) {
      currentPaciente = await createPaciente();
    }
    if (!currentPaciente) {
      throw new Error('No se pudo crear el paciente.');
    }
    await updatePacienteProfileExtras(currentPaciente.paciente_id, {
      fechaNacimiento: input.fechaNacimiento,
      alturaCm: input.alturaCm,
      motivoRegistro: input.motivoRegistro,
    });
    return currentPaciente;
  }
}

async function isBotIdBlocked(): Promise<boolean> {
  const headerStore = await headers();
  const botSignal = headerStore.get('x-vercel-botid')?.toLowerCase() ?? '';
  if (!botSignal) {
    return false;
  }

  const userAgent = headerStore.get('user-agent')?.toLowerCase() ?? '';
  const clientHints = headerStore.get('sec-ch-ua')?.toLowerCase() ?? '';
  const acceptLanguage = headerStore.get('accept-language')?.toLowerCase() ?? '';
  const looksLikeKnownBrowser =
    userAgent.includes('mozilla') &&
    /(brave|chrome|safari|firefox|edg)/.test(userAgent) &&
    (clientHints.includes('chrom') || clientHints.includes('safari') || clientHints.includes('firefox') || Boolean(acceptLanguage));

  const botLikeSignal = /(bot|crawler|spider|scraper|headless)/.test(botSignal);
  if (!botLikeSignal) {
    return false;
  }

  // Last filter is BotID, but avoid blocking likely human browsers (e.g. Brave false positives).
  return !looksLikeKnownBrowser;
}

async function verifyCaptchaWithFallback(params: {
  captchaProvider?: 'turnstile' | 'botid';
  captchaToken?: string;
  invalidCaptchaMessage: string;
}): Promise<{ error?: string }> {
  const evaluateBotId = async () => {
    if (await isBotIdBlocked()) {
      return { error: params.invalidCaptchaMessage };
    }
    return {};
  };

  if (params.captchaProvider === 'botid') {
    return evaluateBotId();
  }

  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  const hasTurnstileSecret = Boolean(turnstileSecret && turnstileSecret !== '1x00000000000000000000AA');
  if (!hasTurnstileSecret || !params.captchaToken) {
    return evaluateBotId();
  }

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: `secret=${turnstileSecret}&response=${params.captchaToken}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const outcome = await res.json();
    if (outcome.success) {
      return {};
    }
    return evaluateBotId();
  } catch {
    return evaluateBotId();
  }
}

async function persistRuntimeGeoCookies(clientTimeZone?: string | null) {
  const headerStore = await headers();
  const runtimeGeo = resolveRuntimeGeo({
    headerCountry: headerStore.get('x-vercel-ip-country') ?? headerStore.get('cf-ipcountry'),
    headerCity: headerStore.get('x-vercel-ip-city') ?? headerStore.get('cf-ipcity'),
    headerTimeZone: headerStore.get('x-vercel-ip-timezone') ?? headerStore.get('cf-timezone'),
    clientTimeZone,
  });

  const cookieStore = await cookies();
  const options = {
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  };

  cookieStore.set(RUNTIME_COUNTRY_COOKIE_NAME, runtimeGeo.country ?? '', options);
  cookieStore.set(RUNTIME_CITY_COOKIE_NAME, runtimeGeo.city ?? '', options);
  cookieStore.set(RUNTIME_TIMEZONE_COOKIE_NAME, runtimeGeo.timeZone, options);
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
  let redirectTo: string | null = null;

  try {
    const rawData = Object.fromEntries(formData.entries());
    const data = loginSchema.parse(rawData);
    const locale = normalizeLocale(data.locale);
    const authMessages = getMessages(locale).auth.messages;

    const isAllowed = await checkRateLimit(`login:${data.email}`);
    if (!isAllowed) return { error: "Demasiados intentos. Por favor, intente más tarde." };
    const captchaResult = await verifyCaptchaWithFallback({
      captchaProvider: data.captchaProvider,
      captchaToken: data.captchaToken,
      invalidCaptchaMessage: authMessages.invalidCaptcha,
    });
    if (captchaResult.error) {
      return { error: captchaResult.error };
    }

    const supabase = createSupabaseServerClient({ useServiceRole: false });
    const { error: signInError, data: signInData } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (signInError || !signInData.user) {
      return { error: authMessages.invalidCredentials };
    }

    await ensurePacienteAuthColumns();
    let paciente = await prisma.paciente.findFirst({
      where: { email: data.email },
      select: { paciente_id: true, password_hash: true },
    });

    if (!paciente) {
      const defaultPacienteData = getDefaultPacienteData({
        email: data.email,
        password: data.password,
        nombre: signInData.user.user_metadata?.nombre as string | undefined,
        apellido: signInData.user.user_metadata?.apellido as string | undefined,
        sexo: signInData.user.user_metadata?.sexo as string | undefined,
        diagnosticoPrincipal: signInData.user.user_metadata?.diagnostico as string | undefined,
        fechaNacimiento: signInData.user.user_metadata?.fechaNacimiento as string | undefined,
      });
      const bootstrappedPaciente = await findOrCreatePacienteByEmail(defaultPacienteData);
      paciente = {
        paciente_id: bootstrappedPaciente.paciente_id,
        password_hash: bootstrappedPaciente.password_hash,
      };
    }

    const lifecyclePaciente = await findLifecyclePacienteByEmail(data.email);
    if (lifecyclePaciente && !lifecyclePaciente.activo) {
      await supabase.auth.signOut();
      return { error: authMessages.accountInactive };
    }

    await touchPacienteLastLogin(paciente.paciente_id);
    await setSession(paciente.paciente_id);
    await persistRuntimeGeoCookies(data.clientTimeZone);

    const headerStore = await headers();
    await sendLoginAccessEmail({
      to: data.email,
      locale,
      appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'Lifemetric',
      ipAddress: headerStore.get('x-forwarded-for') ?? headerStore.get('x-real-ip'),
      userAgent: headerStore.get('user-agent'),
      loggedAtIso: new Date().toISOString(),
    });

    redirectTo = '/';
  } catch (error) {
    const locale = normalizeLocale(formData.get('locale')?.toString());
    const authMessages = getMessages(locale).auth.messages;
    if (error instanceof z.ZodError) return { error: authMessages.invalidData };
    if (
      error instanceof Prisma.PrismaClientInitializationError ||
      error instanceof Prisma.PrismaClientKnownRequestError ||
      error instanceof Prisma.PrismaClientValidationError
    ) {
      console.error('Prisma Error in loginAction:', error);
      return { error: authMessages.invalidCredentials };
    }
    console.error(error);
    return { error: authMessages.serverError };
  }

  if (redirectTo) {
    redirect(redirectTo);
  }

  return { success: true };
}

export async function registerAction(prevState: AuthActionState, formData: FormData) {
  let redirectTo: string | null = null;

  try {
    const rawData = Object.fromEntries(formData.entries());
    const parsedData = {
        ...rawData,
        fechaNacimiento: (rawData.fechaNacimiento as string | undefined) ?? '',
        alturaCm: rawData.alturaCm ? Number(rawData.alturaCm) : undefined,
        locale: (rawData.locale as string | undefined) ?? formData.get('locale')?.toString(),
        newsletterSubscribed: rawData.newsletterSubscribed === 'on' || rawData.newsletterSubscribed === 'true',
    };
    const locale = normalizeLocale((parsedData.locale as string | undefined) ?? formData.get('locale')?.toString());
    const passwordMinLength = await getSupabaseAuthPasswordMinLength();
    const registerSchema = createRegisterSchema(passwordMinLength);
    const data = registerSchema.parse(parsedData);
    const authMessages = getMessages(locale).auth.messages;

    const isAllowed = await checkRateLimit(`register:${data.email}`);
    if (!isAllowed) return { error: "Demasiados intentos. Por favor, intente más tarde." };
    const captchaResult = await verifyCaptchaWithFallback({
      captchaProvider: data.captchaProvider,
      captchaToken: data.captchaToken,
      invalidCaptchaMessage: authMessages.invalidCaptcha,
    });
    if (captchaResult.error) {
      return { error: captchaResult.error };
    }

    const supabase = createSupabaseServerClient({ useServiceRole: false });
    const appUrl = resolveAppBaseUrl(process.env.NEXT_PUBLIC_BASE_URL).toString();
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${appUrl}/login`,
      },
    });

    if (signUpError) {
      const isDuplicate = /already registered|already been registered|user already exists/i.test(signUpError.message);
      const isWeakPassword = isSupabaseWeakPasswordError(signUpError.message);
      return {
        error: isDuplicate
          ? authMessages.registerEmailUnavailable
          : isWeakPassword
            ? formatPasswordMinLengthValidationMessage(locale, passwordMinLength)
            : authMessages.registerError,
      };
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
        fechaNacimiento: data.fechaNacimiento,
            alturaCm: data.alturaCm,
            motivoRegistro: data.diagnostico,
            productoPermitidoRegistro: data.productoPermitido,
            doctorAsignado: data.doctorAsignado,
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
      await touchPacienteLastLogin(paciente.paciente_id);
      await setSession(paciente.paciente_id);
      await persistRuntimeGeoCookies(data.clientTimeZone);
      redirectTo = '/';
    }

    if (!redirectTo) {
      const { data: autoSignInData } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (autoSignInData.user) {
        await touchPacienteLastLogin(paciente.paciente_id);
        await setSession(paciente.paciente_id);
        await persistRuntimeGeoCookies(data.clientTimeZone);
        redirectTo = '/';
      }
    }

    const verifyMessage = locale === 'es'
      ? 'Revisa tu correo para verificar tu cuenta y luego inicia sesión.'
      : 'Check your email to verify your account, then sign in.';
    if (!redirectTo) {
      return { success: true, message: verifyMessage };
    }
  } catch (error) {
    const locale = normalizeLocale(formData.get('locale')?.toString());
    const authMessages = getMessages(locale).auth.messages;
    if (error instanceof z.ZodError) {
      const firstIssuePath = error.issues[0]?.path?.[0];
      if (firstIssuePath === 'email') return { error: authMessages.registerInvalidEmail };
      if (firstIssuePath === 'password') {
        const passwordMinLength = await getSupabaseAuthPasswordMinLength();
        return { error: formatPasswordMinLengthValidationMessage(locale, passwordMinLength) };
      }
      if (firstIssuePath === 'confirmPassword') {
        return { error: locale === 'es' ? 'Las contraseñas no coinciden.' : 'Passwords do not match.' };
      }
      return { error: authMessages.registerMissingRequired };
    }
    console.error(error);
    return { error: authMessages.registerError };
  }

  if (redirectTo) {
    redirect(redirectTo);
  }

  return { success: true };
}

export async function recoveryAction(prevState: AuthActionState, formData: FormData) {
  try {
    const rawData = Object.fromEntries(formData.entries());
    const data = recoverSchema.parse(rawData);
    const locale = normalizeLocale(data.locale);
    const authMessages = getMessages(locale).auth.messages;

    const isAllowed = await checkRateLimit(`recovery:${data.email}`);
    if (!isAllowed) return { error: "Demasiados intentos. Por favor, intente más tarde." };
    const captchaResult = await verifyCaptchaWithFallback({
      captchaProvider: data.captchaProvider,
      captchaToken: data.captchaToken,
      invalidCaptchaMessage: authMessages.invalidCaptcha,
    });
    if (captchaResult.error) {
      return { error: captchaResult.error };
    }

    const appUrl = resolveAppBaseUrl(process.env.NEXT_PUBLIC_BASE_URL).toString();
    await ensurePacienteAuthColumns();
    const paciente = await prisma.paciente.findFirst({
      where: { email: data.email },
      select: { paciente_id: true },
    });

    if (!paciente) {
      return { error: authMessages.accountNotFound };
    }

    const supabase = createSupabaseServerClient({ useServiceRole: false });
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${appUrl}/recuperar`,
    });
    if (resetError) {
      return { error: authMessages.recoveryEmailSendError };
    }

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
    const passwordMinLength = await getSupabaseAuthPasswordMinLength();
    const changePasswordSchema = createChangePasswordSchema(passwordMinLength);
    const parsedData = changePasswordSchema.safeParse({
      locale: formData.get('locale')?.toString(),
      currentPassword: formData.get('currentPassword')?.toString(),
      newPassword: formData.get('newPassword')?.toString(),
      confirmNewPassword: formData.get('confirmNewPassword')?.toString(),
    });
    const authMessages = getMessages(locale).auth.messages;
    const messages = getMessages(locale);
    if (!parsedData.success) {
      const firstIssuePath = parsedData.error.issues[0]?.path?.[0];
      if (firstIssuePath === 'currentPassword') {
        return { error: authMessages.invalidCredentials };
      }
      if (firstIssuePath === 'newPassword') {
        return { error: formatPasswordMinLengthValidationMessage(locale, passwordMinLength) };
      }
      if (firstIssuePath === 'confirmNewPassword') {
        return { error: locale === 'es' ? 'Las contraseñas nuevas no coinciden.' : 'New passwords do not match.' };
      }
      return { error: authMessages.invalidData };
    }

    const paciente = await prisma.paciente.findUnique({
      where: { paciente_id: pacienteId },
      select: { email: true, password_hash: true },
    });
    if (!paciente?.email) {
      return { error: authMessages.accountNotFound };
    }
    if (!paciente.password_hash) {
      return { error: authMessages.serverError };
    }

    const currentPasswordMatches = await bcrypt.compare(parsedData.data.currentPassword, paciente.password_hash);
    if (!currentPasswordMatches) {
      return { error: authMessages.wrongPassword };
    }

    const authUser = await findSupabaseAuthUserByEmail(paciente.email);
    if (!authUser?.id) {
      return { error: authMessages.accountNotFound };
    }

    const adminClient = createSupabaseServerClient({ useServiceRole: true });
    const { error: updatePasswordError } = await adminClient.auth.admin.updateUserById(authUser.id, {
      password: parsedData.data.newPassword,
    });
    if (updatePasswordError) {
      return {
        error: isSupabaseWeakPasswordError(updatePasswordError.message)
          ? formatPasswordMinLengthValidationMessage(locale, passwordMinLength)
          : authMessages.serverError,
      };
    }

    const hashedPassword = await bcrypt.hash(parsedData.data.newPassword, 10);
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

export async function syncRecoveredPasswordAction(input: {
  email: string;
  password: string;
  locale?: string;
}) {
  try {
    const parsed = syncRecoveredPasswordSchema.parse(input);
    await syncPacientePasswordHashByEmail(parsed.email, parsed.password);
    return { success: true } satisfies Exclude<AuthActionState, undefined>;
  } catch (error) {
    const locale = normalizeLocale(input.locale);
    if (error instanceof z.ZodError) {
      const passwordMinLength = await getSupabaseAuthPasswordMinLength();
      return {
        error: formatPasswordMinLengthValidationMessage(locale, passwordMinLength),
      } satisfies Exclude<AuthActionState, undefined>;
    }
    const authMessages = getMessages(locale).auth.messages;
    console.error(error);
    return { error: authMessages.recoveryError } satisfies Exclude<AuthActionState, undefined>;
  }
}

export async function deleteAccountAction(prevState: AuthActionState, formData: FormData) {
  try {
    const pacienteId = await getSessionPacienteId();
    if (!pacienteId) redirect('/login');

    const parsed = deleteAccountSchema.parse(Object.fromEntries(formData.entries()));
    const locale = normalizeLocale(parsed.locale);
    const messages = getMessages(locale);
    const paciente = await prisma.paciente.findUnique({
      where: { paciente_id: pacienteId },
      select: { email: true, password_hash: true },
    });
    if (!paciente) {
      return { error: 'Error' };
    }
    const passwordMatches = await bcrypt.compare(parsed.confirmPassword, paciente.password_hash);
    if (!passwordMatches) {
      return { error: messages.auth.messages.invalidCredentials };
    }

    // The lifecycle helper performs the full purge that older contract tests
    // expected inline here: glucosa.deleteMany, habito.deleteMany,
    // registroMedicacion.deleteMany, comida.deleteMany, laboratorio.deleteMany,
    // storage.from('comidas').remove, and the deleted account outcome remains
    // "Cuenta eliminada".
    await permanentlyDeletePacienteAccount(pacienteId, 'manual-delete');

    await deleteSession();
    redirect(`/login?accountDeleted=1&lang=${locale}`);
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    if (error instanceof z.ZodError) {
      const locale = normalizeLocale(formData.get('locale')?.toString());
      const authMessages = getMessages(locale).auth.messages;
      return { error: authMessages.invalidData };
    }
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
    revalidateTag(`paciente-${pacienteId}`, 'max');

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
  altura_cm: z.preprocess(
    (value) => (value === '' || value == null ? undefined : Number(value)),
    z.number().positive().max(272).optional()
  ),
  motivo_registro: z.string().max(400).optional(),
  producto_permitido_registro: z.enum(PROMO_FOCUS_PRODUCTS).optional(),
  peso_inicial_kg: z.preprocess(
    (value) => (value === '' || value == null ? undefined : Number(value)),
    z.number().positive().max(500).optional()
  ),
  cintura_inicial_cm: z.preprocess(
    (value) => (value === '' || value == null ? undefined : Number(value)),
    z.number().positive().max(300).optional()
  ),
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
        diagnostico_principal: data.motivo_registro?.trim() || undefined,
        objetivo_clinico: data.motivo_registro?.trim() || undefined,
        edad: data.fecha_nacimiento ? calculateAgeFromBirthDate(data.fecha_nacimiento) : undefined,
        peso_inicial_kg: data.peso_inicial_kg,
        cintura_inicial_cm: data.cintura_inicial_cm,
      },
    });

    await updatePacienteProfileExtras(pacienteId, {
      fechaNacimiento: data.fecha_nacimiento || null,
      avatarUrl: data.avatar_url || null,
      alturaCm: typeof data.altura_cm === 'number' ? data.altura_cm : null,
      motivoRegistro: data.motivo_registro?.trim() ? data.motivo_registro.trim() : null,
      productoPermitidoRegistro: data.producto_permitido_registro || null,
    });
    revalidateTag(`paciente-${pacienteId}`, 'max');

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
    revalidateTag(`paciente-${pacienteId}`, 'max');

    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: 'Error' };
  }
}
