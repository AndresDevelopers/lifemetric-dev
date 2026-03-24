'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { Redis } from '@upstash/redis';
import { cookies } from 'next/headers';

// Optional: Upstash Redis for idempotency and rate-limiting
const redis = Redis.fromEnv(); // Require UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN

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

export type AuthActionState =
  | {
      success?: boolean;
      error?: string;
      message?: string;
    }
  | undefined;

export async function loginAction(prevState: AuthActionState, formData: FormData) {
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

    const paciente = await prisma.paciente.findUnique({
      where: { email: data.email },
    });

    if (!paciente) {
      return { error: 'Credenciales inválidas' }; // Privacy by design: generic response
    }

    const isValid = await bcrypt.compare(data.password, paciente.password_hash);
    if (!isValid) {
      return { error: 'Credenciales inválidas' }; // Privacy by design: generic response
    }

    // Success! Setup session cookies
    cookies().set('lifemetric_session', paciente.paciente_id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 86400, // 1 day
    });

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { error: 'Datos no válidos' };
    console.error(error);
    return { error: 'Ocurrió un error en el servidor.' };
  }
}

export async function registerAction(prevState: AuthActionState, formData: FormData) {
  try {
    const rawData = Object.fromEntries(formData.entries());
    // Parse number because FormData is string
    const parsedData = { 
        ...rawData, 
        edad: parseInt(rawData.edad as string, 10) 
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

    const existingUser = await prisma.paciente.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return { error: 'Este correo electrónico no está disponible.' };
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const newPaciente = await prisma.paciente.create({
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

    // Auto-login after registration
    cookies().set('lifemetric_session', newPaciente.paciente_id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 86400,
    });

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { error: 'Datos de registro no válidos' };
    console.error(error);
    return { error: 'Error al registrar al paciente.' };
  }
}

export async function recoveryAction(prevState: AuthActionState, formData: FormData) {
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
    return { error: 'Datos no válidos' };
  }
}
