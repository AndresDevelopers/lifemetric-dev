'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { deleteSession, setSession } from '@/lib/session';

// Optional: Upstash Redis for idempotency and rate-limiting
// const redis = Redis.fromEnv(); // Require UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  captchaToken: z.string().min(1, 'Captcha requerido'),
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
});

const recoverSchema = z.object({
  email: z.string().email(),
  captchaToken: z.string().min(1, 'Captcha requerido'),
});

function isPacienteColumnMissingError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2022';
}

async function ensurePacienteAuthColumns() {
  await prisma.$executeRawUnsafe('ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS email TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS password_hash TEXT');
}

export async function loginAction(prevState: unknown, formData: FormData) {
  try {
    const rawData = Object.fromEntries(formData.entries());
    const data = loginSchema.parse(rawData);

    // Rate Limiting could be added here using Upstash Redis
    // Verify Turnstile (Mock verification if no secret key)
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
    if (turnstileSecret && turnstileSecret !== '1x00000000000000000000AA') {
       const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
         method: 'POST',
         body: `secret=${turnstileSecret}&response=${data.captchaToken}`,
         headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
       });
       const outcome = await res.json();
       if (!outcome.success) return { error: 'Captcha inválido' };
    }

    let paciente;
    try {
      paciente = await prisma.paciente.findUnique({
        where: { email: data.email },
      });
    } catch (error) {
      if (!isPacienteColumnMissingError(error)) {
        throw error;
      }
      await ensurePacienteAuthColumns();
      paciente = await prisma.paciente.findUnique({
        where: { email: data.email },
      });
    }

    if (!paciente) {
      return { error: 'Credenciales inválidas' }; // Privacy by design: generic response
    }

    const isValid = await bcrypt.compare(data.password, paciente.password_hash);
    if (!isValid) {
      return { error: 'Credenciales inválidas' }; // Privacy by design: generic response
    }

    // Success! Setup signed session cookies
    await setSession(paciente.paciente_id);

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { error: 'Datos no válidos' };
    console.error(error);
    return { error: 'Ocurrió un error en el servidor.' };
  }
}

export async function registerAction(prevState: unknown, formData: FormData) {
  try {
    const rawData = Object.fromEntries(formData.entries());
    // Parse number because FormData is string
    const parsedData = { 
        ...rawData, 
        edad: Number.parseInt(rawData.edad as string, 10) 
    };
    const data = registerSchema.parse(parsedData);

    // Verify Turnstile
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
    if (turnstileSecret && turnstileSecret !== '1x00000000000000000000AA') {
       const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
         method: 'POST',
         body: `secret=${turnstileSecret}&response=${data.captchaToken}`,
         headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
       });
       const outcome = await res.json();
       if (!outcome.success) return { error: 'Captcha inválido' };
    }

    let existingUser;
    try {
      existingUser = await prisma.paciente.findUnique({
        where: { email: data.email },
      });
    } catch (error) {
      if (!isPacienteColumnMissingError(error)) {
        throw error;
      }
      await ensurePacienteAuthColumns();
      existingUser = await prisma.paciente.findUnique({
        where: { email: data.email },
      });
    }

    if (existingUser) {
      return { error: 'Este correo electrónico no está disponible.' };
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

    // Auto-login after registration with signed session
    await setSession(newPaciente.paciente_id);

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { error: 'Datos de registro no válidos' };
    console.error(error);
    return { error: 'Error al registrar al paciente.' };
  }
}

export async function recoveryAction(prevState: unknown, formData: FormData) {
  try {
    const rawData = Object.fromEntries(formData.entries());
    const data = recoverSchema.parse(rawData);

    // Verify Turnstile
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
    if (turnstileSecret && turnstileSecret !== '1x00000000000000000000AA') {
       const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
         method: 'POST',
         body: `secret=${turnstileSecret}&response=${data.captchaToken}`,
         headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
       });
       const outcome = await res.json();
       if (!outcome.success) return { error: 'Captcha inválido' };
    }

    // Process recovery conceptually
    // Usually, we'd send an email with a reset link
    
    // Privacy by design: always return success generically
    return { success: true, message: 'Si el correo existe, recibirás instrucciones para recuperar tu contraseña.' };
  } catch (error) {
    if (error instanceof z.ZodError) return { error: 'Datos no válidos' };
    console.error(error);
    return { error: 'Ocurrió un error al procesar la solicitud.' };
  }
}

export async function logoutAction() {
  await deleteSession();
  redirect('/login');
}
