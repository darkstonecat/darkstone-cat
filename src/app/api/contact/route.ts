import nodemailer from "nodemailer";
import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/client-ip";
import { isAllowedOrigin } from "@/lib/http/origin";
import { allowRequestShared } from "@/lib/rate-limit";

// Google Workspace SMTP. SMTP_PASSWORD is an app password of SMTP_USER.
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

const SENDER_EMAIL = "no-reply@darkstone.cat";
const CONTACT_EMAIL = "hola@darkstone.cat";

// --- Limits ---
const MAX_NAME = 100;
const MAX_EMAIL = 254;
const MAX_SUBJECT = 150;
const MAX_MESSAGE = 5_000;
/** Four fields at their limits (message can be all 4-byte characters) fit well under this. */
const MAX_BODY_BYTES = 32 * 1024;
/** Bots that post faster than this after the form mounted are dropped silently. */
const MIN_FILL_MS = 3_000;

const RATE_WINDOW_MS = 3_600_000; // 1 hour
const RATE_MAX_REQUESTS = 5;
/** Whole-site ceiling per day, so a botnet of distinct IPs cannot flood the inbox or burn the SMTP quota. */
const GLOBAL_WINDOW_MS = 86_400_000; // 1 day
const GLOBAL_MAX_REQUESTS = 50;

// --- Cache headers for all responses ---
const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
} as const;

/**
 * CSRF guard (src/lib/http/origin.ts): the production origins, and http://localhost:3000
 * outside production, or when CONTACT_ALLOW_LOCALHOST=1 is set (testing the form against a
 * local production build). Never set it in Vercel.
 */
const CONTACT_ORIGIN_OPTIONS = {
  localhostPorts: [3000],
  allowLocalhostEnv: "CONTACT_ALLOW_LOCALHOST",
} as const;

const EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_CACHE_HEADERS });
}

function succeed() {
  return NextResponse.json({ success: true }, { headers: NO_CACHE_HEADERS });
}

/** Reads and parses the JSON body, refusing oversized payloads before and after reading. */
async function readJsonObject(
  request: Request
): Promise<{ body: Record<string, unknown> } | { response: Response }> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return { response: fail("payload_too_large", 413) };
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return { response: fail("invalid_request", 400) };
  }
  if (raw.length > MAX_BODY_BYTES) {
    return { response: fail("payload_too_large", 413) };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { response: fail("invalid_request", 400) };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { response: fail("invalid_request", 400) };
  }
  return { body: parsed as Record<string, unknown> };
}

/** Required text field: trimmed, non-empty, within the limit. */
function readField(
  value: unknown,
  max: number,
  prefix: string
): { value: string } | { error: string } {
  if (typeof value !== "string" || value.trim().length === 0) {
    return { error: `${prefix}_required` };
  }
  const trimmed = value.trim();
  if (trimmed.length > max) return { error: `${prefix}_too_long` };
  return { value: trimmed };
}

export async function POST(request: Request) {
  // CSRF protection: validate Origin header
  if (!isAllowedOrigin(request.headers.get("origin"), CONTACT_ORIGIN_OPTIONS)) {
    return fail("forbidden", 403);
  }

  const parsed = await readJsonObject(request);
  if ("response" in parsed) return parsed.response;
  const { body } = parsed;

  // Bot traps: a filled honeypot or a submit faster than a person can type gets the
  // normal success answer, so scripts get no signal to adapt to. Nothing is sent.
  // A missing elapsedMs is let through: a tab opened before this check shipped
  // would otherwise lose a real message silently. Rate limits still apply.
  const elapsedMs = body.elapsedMs;
  const honeypotFilled =
    typeof body.website === "string" && body.website.trim().length > 0;
  const tooFast =
    elapsedMs !== undefined &&
    (typeof elapsedMs !== "number" ||
      !Number.isFinite(elapsedMs) ||
      elapsedMs < MIN_FILL_MS);
  if (honeypotFilled || tooFast) {
    console.warn(`[contact] dropped: ${honeypotFilled ? "honeypot" : "too_fast"}`);
    return succeed();
  }

  // Validate before spending a rate-limit slot, so malformed requests cost nothing.
  const name = readField(body.name, MAX_NAME, "name");
  if ("error" in name) return fail(name.error, 400);

  const email = readField(body.email, MAX_EMAIL, "email");
  if ("error" in email) {
    return fail(email.error === "email_required" ? "email_invalid" : email.error, 400);
  }
  if (!EMAIL_PATTERN.test(email.value)) return fail("email_invalid", 400);

  const subject = readField(body.subject, MAX_SUBJECT, "subject");
  if ("error" in subject) return fail(subject.error, 400);

  const message = readField(body.message, MAX_MESSAGE, "message");
  if ("error" in message) return fail(message.error, 400);

  // Rate limiting: per IP first, then the whole-site daily cap. Shared across instances.
  const ip = getClientIp(request.headers);
  if (!(await allowRequestShared("contact", ip, RATE_MAX_REQUESTS, RATE_WINDOW_MS))) {
    return fail("rate_limited", 429);
  }
  if (!(await allowRequestShared("contact:global", null, GLOBAL_MAX_REQUESTS, GLOBAL_WINDOW_MS))) {
    return fail("rate_limited", 429);
  }

  try {
    await transporter.sendMail({
      from: `"Web [darkstone.cat]" <${SENDER_EMAIL}>`,
      to: CONTACT_EMAIL,
      replyTo: email.value,
      subject: `[Formulari Web] ${subject.value}`,
      html: `
        <h2>Nou missatge de contacte</h2>
        <p><strong>Nom:</strong> ${escapeHtml(name.value)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email.value)}</p>
        <p><strong>Assumpte:</strong> ${escapeHtml(subject.value)}</p>
        <hr />
        <p>${escapeHtml(message.value).replace(/\n/g, "<br />")}</p>
      `,
    });
  } catch (smtpError) {
    // Log only the diagnostic fields: the error object can carry the recipient, the
    // sender's address and the full SMTP transcript.
    const { code, responseCode, command } = smtpError as {
      code?: unknown;
      responseCode?: unknown;
      command?: unknown;
    };
    console.error("[contact] SMTP error", { code, responseCode, command });
    return fail("send_failed", 500);
  }

  return succeed();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
