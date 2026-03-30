'use server';

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSessionPaciente } from '@/actions/data';
import { getMessages, normalizeLocale } from '@/lib/i18n';
import { sendEmailWithResend } from '@/lib/email';

export type FeedbackActionState = {
  success?: boolean;
  message?: string;
  error?: string;
} | undefined;

const feedbackSchema = z.object({
  locale: z.string().optional(),
  type: z.enum(['error', 'suggestion']),
  subject: z.string().min(4).max(120),
  message: z.string().min(12).max(2000),
});

async function ensureFeedbackTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS feedback_entries (
      feedback_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      paciente_id UUID REFERENCES pacientes(paciente_id) ON DELETE SET NULL,
      paciente_email TEXT,
      tipo TEXT NOT NULL CHECK (tipo IN ('error', 'suggestion')),
      asunto TEXT NOT NULL,
      mensaje TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function submitFeedbackAction(prevState: FeedbackActionState, formData: FormData): Promise<FeedbackActionState> {
  try {
    const session = await getSessionPaciente();
    if (!session) {
      return { error: 'No autorizado.' };
    }

    const rawData = Object.fromEntries(formData.entries());
    const parsed = feedbackSchema.parse(rawData);
    const locale = normalizeLocale(parsed.locale);
    const messages = getMessages(locale);

    await ensureFeedbackTable();
    await prisma.$executeRaw`
      INSERT INTO feedback_entries (paciente_id, paciente_email, tipo, asunto, mensaje)
      VALUES (${session.paciente_id}::uuid, ${session.email}, ${parsed.type}, ${parsed.subject}, ${parsed.message})
    `;

    const to = process.env.FEEDBACK_RECEIVER_EMAIL?.trim();
    if (to) {
      const typeLabel = parsed.type === 'error'
        ? (locale === 'es' ? 'Reporte de error' : 'Error report')
        : (locale === 'es' ? 'Sugerencia' : 'Suggestion');

      await sendEmailWithResend({
        to,
        subject: `[Lifemetric Feedback] ${typeLabel}: ${parsed.subject}`,
        html: `<p><strong>Tipo:</strong> ${typeLabel}</p>
<p><strong>Paciente:</strong> ${session.nombre} ${session.apellido}</p>
<p><strong>Email:</strong> ${session.email}</p>
<p><strong>Mensaje:</strong></p>
<p>${parsed.message.replaceAll('\n', '<br/>')}</p>`,
        text: `Tipo: ${typeLabel}\nPaciente: ${session.nombre} ${session.apellido}\nEmail: ${session.email}\n\n${parsed.message}`,
        replyTo: session.email || undefined,
      });
    }

    return { success: true, message: messages.feedback.success };
  } catch (error) {
    const locale = normalizeLocale(formData.get('locale')?.toString());
    const messages = getMessages(locale);
    if (error instanceof z.ZodError) {
      return { error: messages.feedback.invalid };
    }
    console.error('Feedback action error:', error);
    return { error: messages.feedback.error };
  }
}
