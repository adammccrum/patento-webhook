/**
 * Transactional email.
 *
 * Provider-agnostic, for the same reason the collaborator is: the product asks
 * for "send this person a reset link" and does not know or care what carries it.
 *
 * Before this existed, registration and password reset both minted a token and
 * then only wrote a log line. Nothing was ever delivered, so a locked-out
 * learner could not recover their account.
 *
 * With nothing configured it logs the link and says so loudly, rather than
 * pretending to have sent it.
 */

import nodemailer from 'nodemailer';

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain text. Always provided — some clients never render the HTML. */
  text: string;
  html: string;
}

export interface EmailTransport {
  readonly id: string;
  send(message: EmailMessage): Promise<void>;
}

export class EmailNotConfigured extends Error {
  constructor() {
    super('No email transport is configured');
    this.name = 'EmailNotConfigured';
  }
}

/* ----------------------------------------------------------------- adapters */

/** Resend, Postmark and similar accept a simple JSON POST. */
export class HttpEmailTransport implements EmailTransport {
  readonly id = 'http';

  constructor(
    private readonly endpoint: string,
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetcher: typeof fetch = fetch
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const response = await this.fetcher(this.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Email provider returned ${response.status}: ${detail.slice(0, 300)}`);
    }
  }
}

export class SmtpEmailTransport implements EmailTransport {
  readonly id = 'smtp';
  private readonly transport: nodemailer.Transporter;

  constructor(
    url: string,
    private readonly from: string
  ) {
    this.transport = nodemailer.createTransport(url);
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transport.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}

/**
 * Development fallback. Writes the message where an engineer can find it and
 * makes the absence of a real transport impossible to miss.
 */
export class ConsoleEmailTransport implements EmailTransport {
  readonly id = 'console';

  async send(message: EmailMessage): Promise<void> {
    console.warn(
      `\n[email] NO TRANSPORT CONFIGURED — nothing was delivered.\n` +
        `  to:      ${message.to}\n` +
        `  subject: ${message.subject}\n` +
        `  ${message.text.replace(/\n/g, '\n  ')}\n`
    );
  }
}

/* ----------------------------------------------------------------- registry */

let cached: { transport: EmailTransport; configured: boolean } | null = null;

export function getEmailTransport(): { transport: EmailTransport; configured: boolean } {
  if (cached) return cached;

  const from = process.env.EMAIL_FROM || 'LAO Academy <noreply@lao.academy>';

  if (process.env.EMAIL_API_KEY && process.env.EMAIL_API_URL) {
    cached = {
      transport: new HttpEmailTransport(
        process.env.EMAIL_API_URL,
        process.env.EMAIL_API_KEY,
        from
      ),
      configured: true,
    };
  } else if (process.env.SMTP_URL) {
    cached = { transport: new SmtpEmailTransport(process.env.SMTP_URL, from), configured: true };
  } else {
    console.warn(
      '[email] No transport configured. Password reset links will be logged, ' +
        'not delivered. Set EMAIL_API_URL + EMAIL_API_KEY, or SMTP_URL.'
    );
    cached = { transport: new ConsoleEmailTransport(), configured: false };
  }

  return cached;
}

/** Tests reset between cases. */
export function resetEmailTransport(): void {
  cached = null;
}

/* ------------------------------------------------------------------ senders */

function baseUrl(): string {
  return (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
}

/**
 * Plain, quiet, and it says what to do. No marketing, no exclamation marks —
 * see /brand/typography/typography.md.
 */
function wrap(heading: string, body: string, action: { label: string; url: string }): string {
  return `<!doctype html>
<html lang="en"><body style="margin:0;padding:32px;background:#ffffff;font-family:Inter,-apple-system,Segoe UI,sans-serif;color:#2C3660;">
  <div style="max-width:520px;margin:0 auto;">
    <p style="font-size:20px;font-weight:600;color:#12225C;margin:0 0 16px;">${heading}</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">${body}</p>
    <a href="${action.url}" style="display:inline-block;background:#1E6FEB;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:16px;font-weight:500;">${action.label}</a>
    <p style="font-size:14px;color:#6B7495;line-height:1.6;margin:24px 0 0;">
      If the button does not work, paste this into your browser:<br>
      <span style="color:#6B7495;">${action.url}</span>
    </p>
  </div>
</body></html>`;
}

export async function sendPasswordReset(to: string, token: string): Promise<void> {
  const url = `${baseUrl()}/auth/reset-password?token=${encodeURIComponent(token)}`;
  const { transport } = getEmailTransport();

  await transport.send({
    to,
    subject: 'Reset your LAO Academy password',
    text: `Someone asked to reset the password for this account.\n\nUse this link within the next hour:\n${url}\n\nIf that was not you, you can ignore this — nothing has changed.`,
    html: wrap(
      'Reset your password',
      'Someone asked to reset the password for this account. This link works for the next hour. If that was not you, you can ignore this — nothing has changed.',
      { label: 'Choose a new password', url }
    ),
  });
}

export async function sendEmailVerification(to: string, token: string): Promise<void> {
  const url = `${baseUrl()}/auth/verify-email?token=${encodeURIComponent(token)}`;
  const { transport } = getEmailTransport();

  await transport.send({
    to,
    subject: 'Confirm your email for LAO Academy',
    text: `Confirm this email address to finish setting up your account:\n${url}\n\nThe link works for 24 hours.`,
    html: wrap(
      'Confirm your email',
      'Confirm this email address to finish setting up your account. The link works for 24 hours.',
      { label: 'Confirm email', url }
    ),
  });
}
