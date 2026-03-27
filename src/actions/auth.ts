'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getMessages, normalizeLocale } from '@/lib/i18n';
import { deleteSession, setSession } from '@/lib/session';
import { getSessionPacienteId } from './data';

export type AuthActionState = {
  error?: string;
  success?: boolean;
  message?: string;
} | undefined;

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  captchaToken: z.string().min(1, 'Captcha requerido'),
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
  captchaToken: z.string().min(1, 'Captcha requerido'),
  locale: z.string().optional(),
});

const recoverSchema = z.object({
  email: z.string().email(),
  captchaToken: z.string().min(1, 'Captcha requerido'),
  locale: z.string().optional(),
});

function isPacienteColumnMissingError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2022';
}

async function ensurePacienteAuthColumns() {
  await prisma.$executeRawUnsafe('ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS email TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS password_hash TEXT');
}

export async function loginAction(prevState: AuthActionState, formData: FormData) {
  try {
    const rawData = Object.fromEntries(formData.entries());
    const data = loginSchema.parse(rawData);
    const locale = normalizeLocale(data.locale);
    const authMessages = getMessages(locale).auth.messages;

    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
    if (turnstileSecret && turnstileSecret !== '1x00000000000000000000AA') {
       const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
         method: 'POST',
         body: `secret=${turnstileSecret}&response=${data.captchaToken}`,
         headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
       });
       const outcome = await res.json();
       if (!outcome.success) return { error: authMessages.invalidCaptcha };
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
        edad: Number.parseInt(rawData.edad as string, 10)
    };
    const data = registerSchema.parse(parsedData);
    const locale = normalizeLocale(data.locale);
    const authMessages = getMessages(locale).auth.messages;

    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
    if (turnstileSecret && turnstileSecret !== '1x00000000000000000000AA') {
       const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
         method: 'POST',
         body: `secret=${turnstileSecret}&response=${data.captchaToken}`,
         headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
       });
       const outcome = await res.json();
       if (!outcome.success) return { error: authMessages.invalidCaptcha };
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

    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
    if (turnstileSecret && turnstileSecret !== '1x00000000000000000000AA') {
       const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
         method: 'POST',
         body: `secret=${turnstileSecret}&response=${data.captchaToken}`,
         headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
       });
       const outcome = await res.json();
       if (!outcome.success) return { error: authMessages.invalidCaptcha };
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
