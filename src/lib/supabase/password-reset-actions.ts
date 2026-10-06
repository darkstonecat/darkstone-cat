"use server";

import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "./admin";
import { getClientIp } from "@/lib/client-ip";
import { allowRequestShared } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

const PER_IP_LIMIT = 10;
const PER_EMAIL_LIMIT = 3;
const WINDOW_MS = 10 * 60 * 1000;

/** The recovery link opens /auth/callback, which only accepts `type=recovery` (see CLAUDE.md). */
const CALLBACK_PATH = "/auth/callback";

/** `https://host[:port]` of the page that posted the action, or null when it cannot be told. */
function requestOrigin(h: Headers): string | null {
  const origin = h.get("origin");
  if (origin) {
    try {
      const url = new URL(origin);
      if (url.protocol === "https:" || url.protocol === "http:") return url.origin;
    } catch {
      // fall through to the host header
    }
  }
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host || !/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return null;
  const proto = h.get("x-forwarded-proto") === "http" ? "http" : "https";
  return `${proto}://${host}`;
}

/**
 * "He oblidat la contrasenya" and "Canvia la contrasenya" (spec §4.4, V-7).
 *
 * GoTrue mails a recovery link to any existing account, a banned one included (the link then
 * fails), and to an unconfirmed one. So the recovery mail is only sent when the address belongs
 * to a CONFIRMED and ACTIVE account: `is_email_confirmed` already answers false for a former
 * member (T1). The answer never depends on the address: unknown, unconfirmed, former,
 * throttled and sent all return `{ error: null }`. Only a failure unrelated to the address asks
 * the person to retry. The address is never logged.
 */
export async function requestPasswordReset(email: string): Promise<{ error: "failed" | null }> {
  // Server actions receive whatever the client posts, not what the type says.
  if (typeof email !== "string") return { error: "failed" };
  const clean = email.trim().toLowerCase();
  if (!clean || clean.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(clean)) return { error: "failed" };

  try {
    const h = await headers();
    const ip = getClientIp(h);
    // Throttles first, and a throttled request looks sent.
    if (!(await allowRequestShared("password-reset-ip", ip, PER_IP_LIMIT, WINDOW_MS))) return { error: null };
    // Also per address, so the form cannot be used to flood someone's inbox.
    if (!(await allowRequestShared("password-reset-email", clean, PER_EMAIL_LIMIT, WINDOW_MS))) {
      return { error: null };
    }

    const { data: confirmed, error: lookupError } = await createAdminClient().rpc("is_email_confirmed", {
      p_email: clean,
    });
    if (lookupError) {
      console.error("[password-reset] account lookup failed code=%s", lookupError.code ?? "unknown");
      return { error: "failed" };
    }
    if (confirmed !== true) return { error: null };

    const origin = requestOrigin(h);
    // Cookie-less client: nothing to persist on the server, the member continues from the link.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
    );
    const { error } = await supabase.auth.resetPasswordForEmail(
      clean,
      origin ? { redirectTo: `${origin}${CALLBACK_PATH}` } : undefined
    );
    // GoTrue's own rate limits look sent too.
    if (error && error.status !== 429 && error.code !== "over_email_send_rate_limit") {
      console.error("[password-reset] send failed code=%s status=%s", error.code ?? "unknown", error.status ?? "unknown");
      return { error: "failed" };
    }
    return { error: null };
  } catch {
    console.error("[password-reset] unexpected error");
    return { error: "failed" };
  }
}
