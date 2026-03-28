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

export async function sendEmailWithResend(payload: EmailPayload): Promise<void> {
  const apiKey = getResendKey();
  
  if (!apiKey) {
    console.warn('RESEND_API_KEY no configurada. El correo no ha sido enviado.');
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
      console.warn(`Error de Resend (${response.status}): ${errorBody}`);
    }
  } catch (error) {
    console.warn('Fallo al enviar correo con Resend:', error);
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
