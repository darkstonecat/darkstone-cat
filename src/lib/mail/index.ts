import "server-only";

import nodemailer from "nodemailer";

export { escapeHtml } from "./html";

/*
 * Outgoing e-mail through Google Workspace SMTP. SMTP_PASSWORD is an app password of
 * SMTP_USER. Used by the contact form and the membership e-mails (leave, rejoin).
 */

export const SENDER_EMAIL = "no-reply@darkstone.cat";
export const CONTACT_EMAIL = "hola@darkstone.cat";
const DEFAULT_SENDER_NAME = "Darkstone Catalunya";

// Timeouts keep a stalled SMTP server from holding the function open: connect and
// greeting must finish quickly, and the socket may stay idle for at most 15 s.
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
  connectionTimeout: 5_000,
  greetingTimeout: 5_000,
  socketTimeout: 15_000,
});

type MailBase = {
  to: string;
  subject: string;
  replyTo?: string;
  /** Display name of the no-reply sender; "Darkstone Catalunya" by default. */
  fromName?: string;
};

/** A message needs a plain-text or an HTML body (or both). */
export type MailMessage = MailBase & ({ text: string; html?: string } | { html: string; text?: string });

export type SendMailResult = { ok: true } | { ok: false; code: string | null };

export type SendMailOptions = {
  /** Log prefix, e.g. `contact` → `[contact] SMTP error`. */
  logTag: string;
};

/**
 * Sends one message from `no-reply@darkstone.cat`. Never throws: an SMTP failure is logged
 * with its diagnostic fields only (the error object can carry the recipient, the sender's
 * address and the full SMTP transcript) and returned as `{ ok: false, code }`.
 */
export async function sendMail(message: MailMessage, { logTag }: SendMailOptions): Promise<SendMailResult> {
  const { to, subject, text, html, replyTo, fromName = DEFAULT_SENDER_NAME } = message;
  try {
    await transporter.sendMail({
      from: `"${fromName}" <${SENDER_EMAIL}>`,
      to,
      ...(replyTo !== undefined && { replyTo }),
      subject,
      ...(text !== undefined && { text }),
      ...(html !== undefined && { html }),
    });
    return { ok: true };
  } catch (smtpError) {
    const { code, responseCode, command } = (
      smtpError !== null && typeof smtpError === "object" ? smtpError : {}
    ) as { code?: unknown; responseCode?: unknown; command?: unknown };
    console.error(`[${logTag}] SMTP error`, { code, responseCode, command });
    return { ok: false, code: typeof code === "string" ? code : null };
  }
}
