import { spawn } from 'node:child_process';

const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM_EMAIL = 'Lifemetric <no-reply@lifemetric.app>';

export type EmailPayload = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
};

function getResendKey(): string | null {
  const key = process.env.RESEND_API_KEY;
  if (!key || key === 're_placeholder') {
    return null;
  }

  return key;
}


function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function sendEmailWithSendmail(payload: EmailPayload): Promise<boolean> {
  try {
    const from = payload.from ?? process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM_EMAIL;
    const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];
    const textBody = payload.text?.trim() || stripHtml(payload.html);

    const message = [
      `From: ${from}`,
      `To: ${recipients.join(', ')}`,
      `Subject: ${payload.subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      '',
      textBody,
      '',
    ].join('\n');

    await new Promise<void>((resolve, reject) => {
      const child = spawn('sendmail', ['-t', '-i']);
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(`sendmail exited with code ${code}`));
      });
      child.stdin.write(message);
      child.stdin.end();
    });
    return true;
  } catch (error) {
    console.warn('Fallo al enviar correo con sendmail del sistema:', error);
    return false;
  }
}

export async function sendEmailWithResend(payload: EmailPayload): Promise<void> {
  const apiKey = getResendKey();
  
  if (!apiKey) {
    console.warn('RESEND_API_KEY no configurada. Intentando fallback con sendmail del sistema.');
    await sendEmailWithSendmail(payload);
    return;
  }

  try {
    const from = payload.from ?? process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM_EMAIL;

    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        reply_to: payload.replyTo,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.warn(`Error de Resend (${response.status}). Activando fallback sendmail.`);
      if (errorBody) {
        console.warn('Detalle resumido de Resend:', errorBody.slice(0, 300));
      }
      await sendEmailWithSendmail(payload);
    }
  } catch (error) {
    console.warn('Fallo al enviar correo con Resend. Activando fallback sendmail:', error);
    await sendEmailWithSendmail(payload);
  }
}

export async function sendPasswordRecoveryEmail(params: {
  to: string;
  locale: 'es' | 'en';
  appUrl: string;
}): Promise<void> {
  const recoverPath = params.locale === 'es' ? '/recuperar' : '/recover';
  const recoverUrl = new URL(recoverPath, params.appUrl).toString();

  const subject =
    params.locale === 'es' ? 'Recuperación de contraseña - Lifemetric' : 'Password recovery - Lifemetric';

  const cta = params.locale === 'es' ? 'Ir a recuperación' : 'Go to recovery';
  const intro =
    params.locale === 'es'
      ? 'Recibimos una solicitud para recuperar tu contraseña.'
      : 'We received a request to recover your password.';

  await sendEmailWithResend({
    to: params.to,
    subject,
    html: `<p>${intro}</p><p><a href="${recoverUrl}">${cta}</a></p>`,
    text: `${intro} ${recoverUrl}`,
  });
}

export async function sendNewsletterSubscriptionEmail(params: {
  to: string;
  locale: 'es' | 'en';
  appName: string;
}): Promise<void> {
  const subject =
    params.locale === 'es'
      ? `Suscripción confirmada en ${params.appName}`
      : `Subscription confirmed on ${params.appName}`;

  const message =
    params.locale === 'es'
      ? 'Ya estás suscrito a las novedades por correo.'
      : 'You are now subscribed to email updates.';

  await sendEmailWithResend({
    to: params.to,
    subject,
    html: `<p>${message}</p>`,
    text: message,
  });
}


export async function sendLoginAccessEmail(params: {
  to: string;
  locale: 'es' | 'en';
  appName: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  loggedAtIso: string;
}): Promise<void> {
  const subject =
    params.locale === 'es'
      ? `Nuevo inicio de sesión en ${params.appName}`
      : `New sign-in on ${params.appName}`;

  const ipText = params.ipAddress ?? (params.locale === 'es' ? 'No disponible' : 'Not available');
  const agentText = params.userAgent ?? (params.locale === 'es' ? 'No disponible' : 'Not available');
  const intro =
    params.locale === 'es'
      ? 'Detectamos un inicio de sesión reciente en tu cuenta.'
      : 'We detected a recent sign-in to your account.';

  const bodyEs = `
    <p>${intro}</p>
    <p><strong>Fecha y hora (UTC):</strong> ${params.loggedAtIso}</p>
    <p><strong>IP:</strong> ${ipText}</p>
    <p><strong>Dispositivo:</strong> ${agentText}</p>
    <p>Si no reconoces esta actividad, cambia tu contraseña de inmediato.</p>
  `;

  const bodyEn = `
    <p>${intro}</p>
    <p><strong>Date & time (UTC):</strong> ${params.loggedAtIso}</p>
    <p><strong>IP:</strong> ${ipText}</p>
    <p><strong>Device:</strong> ${agentText}</p>
    <p>If you do not recognize this activity, change your password immediately.</p>
  `;

  await sendEmailWithResend({
    to: params.to,
    subject,
    html: params.locale === 'es' ? bodyEs : bodyEn,
    text: `${intro} | ${params.loggedAtIso} | IP: ${ipText} | Device: ${agentText}`,
  });
}
