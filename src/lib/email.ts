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


async function sendEmailWithNodemailer(payload: EmailPayload): Promise<boolean> {
  try {
    const importer = new Function("return import('nodemailer')") as () => Promise<unknown>;
    const nodemailerModule = await importer();
    const nodemailer = (nodemailerModule as { default?: unknown }).default as {
      createTransport: (config: unknown) => { sendMail: (message: unknown) => Promise<unknown> };
      createTestAccount: () => Promise<{ user: string; pass: string }>;
      getTestMessageUrl?: (info: unknown) => string | false;
    };

    if (!nodemailer?.createTransport) {
      return false;
    }

    const from = payload.from ?? process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM_EMAIL;
    const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];

    const smtpUrl = process.env.SMTP_URL;
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT ?? '587');
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    const transport = smtpUrl
      ? nodemailer.createTransport(smtpUrl)
      : smtpHost
        ? nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
          })
        : null;

    if (transport) {
      await transport.sendMail({
        from,
        to: recipients.join(', '),
        subject: payload.subject,
        html: payload.html,
        text: payload.text?.trim() || stripHtml(payload.html),
        replyTo: payload.replyTo,
      });
      return true;
    }

    const testAccount = await nodemailer.createTestAccount();
    const testTransport = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    const info = await testTransport.sendMail({
      from,
      to: recipients.join(', '),
      subject: payload.subject,
      html: payload.html,
      text: payload.text?.trim() || stripHtml(payload.html),
      replyTo: payload.replyTo,
    });

    const previewUrl = nodemailer.getTestMessageUrl?.(info);
    if (previewUrl) {
      console.warn('Correo enviado a bandeja de prueba de nodemailer:', previewUrl);
    }

    return true;
  } catch (error) {
    console.warn('Fallo al enviar correo con nodemailer fallback:', error);
    return false;
  }
}

async function sendEmailWithFallback(payload: EmailPayload): Promise<void> {
  const sentByNodemailer = await sendEmailWithNodemailer(payload);
  if (sentByNodemailer) {
    return;
  }

  await sendEmailWithSendmail(payload);
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
    console.warn('RESEND_API_KEY no configurada. Intentando fallback con nodemailer/sendmail.');
    await sendEmailWithFallback(payload);
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
      console.warn(`Error de Resend (${response.status}). Activando fallback nodemailer/sendmail.`);
      if (errorBody) {
        console.warn('Detalle resumido de Resend:', errorBody.slice(0, 300));
      }
      await sendEmailWithFallback(payload);
    }
  } catch (error) {
    console.warn('Fallo al enviar correo con Resend. Activando fallback sendmail:', error);
    await sendEmailWithFallback(payload);
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

export async function sendAccountDeactivatedEmail(params: {
  to: string;
  locale: 'es' | 'en';
  appName: string;
  deactivatedAtIso: string;
  scheduledDeletionAtIso: string;
}): Promise<void> {
  const subject =
    params.locale === 'es'
      ? `Tu cuenta en ${params.appName} fue desactivada por inactividad`
      : `Your ${params.appName} account was deactivated due to inactivity`;

  const bodyEs = `
    <p>Tu cuenta fue desactivada por inactividad.</p>
    <p><strong>Desactivación (UTC):</strong> ${params.deactivatedAtIso}</p>
    <p><strong>Eliminación automática prevista (UTC):</strong> ${params.scheduledDeletionAtIso}</p>
    <p>Durante los próximos 3 meses conservaremos tus datos sin borrarlos. Una vez transcurrido ese período, eliminaremos automáticamente tus datos, archivos e historial asociado.</p>
  `;

  const bodyEn = `
    <p>Your account was deactivated due to inactivity.</p>
    <p><strong>Deactivated at (UTC):</strong> ${params.deactivatedAtIso}</p>
    <p><strong>Scheduled automatic deletion (UTC):</strong> ${params.scheduledDeletionAtIso}</p>
    <p>We will preserve your data for the next 3 months without deleting it. Once that grace period ends, we will automatically delete your data, files, and related history.</p>
  `;

  const intro =
    params.locale === 'es'
      ? `Cuenta desactivada: ${params.deactivatedAtIso}. Eliminación automática prevista: ${params.scheduledDeletionAtIso}.`
      : `Account deactivated: ${params.deactivatedAtIso}. Scheduled automatic deletion: ${params.scheduledDeletionAtIso}.`;

  await sendEmailWithResend({
    to: params.to,
    subject,
    html: params.locale === 'es' ? bodyEs : bodyEn,
    text: intro,
  });
}
