import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

const CONTACT_EMAIL = "darkstone.cat@gmail.com";

// --- Rate limiting (in-memory, resets on cold start) ---
const WINDOW_MS = 3_600_000; // 1 hour
const MAX_REQUESTS = 5;
const rateLimitMap = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(ip) ?? []).filter(
    (t) => now - t < WINDOW_MS
  );
  rateLimitMap.set(ip, timestamps);
  if (timestamps.length >= MAX_REQUESTS) return true;
  timestamps.push(now);
  return false;
}

// --- Cache headers for all responses ---
const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
} as const;

export async function POST(request: Request) {
  // Rate limiting by IP
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0].trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const body = await request.json();
    const { name, email, subject, message } = body;

    // Validation
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "name_required" },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "email_invalid" },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }
    if (!subject || typeof subject !== "string" || subject.trim().length === 0) {
      return NextResponse.json(
        { error: "subject_required" },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { error: "message_required" },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    // Send email with timeout
    const sendPromise = resend.emails.send({
      from: "Web [darkstone.cat] <onboarding@resend.dev>",
      to: CONTACT_EMAIL,
      replyTo: email,
      subject: `[Formulari Web] ${subject.trim()}`,
      html: `
        <h2>Nou missatge de contacte</h2>
        <p><strong>Nom:</strong> ${escapeHtml(name.trim())}</p>
        <p><strong>Email:</strong> ${escapeHtml(email.trim())}</p>
        <p><strong>Assumpte:</strong> ${escapeHtml(subject.trim())}</p>
        <hr />
        <p>${escapeHtml(message.trim()).replace(/\n/g, "<br />")}</p>
      `,
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Resend timeout")), 15_000)
    );

    const { error: resendError } = await Promise.race([sendPromise, timeoutPromise]);

    if (resendError) {
      console.error("Resend error:", resendError);
      return NextResponse.json(
        { error: "send_failed", details: resendError.message },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      { success: true },
      { headers: NO_CACHE_HEADERS }
    );
  } catch {
    return NextResponse.json(
      { error: "server_error" },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
