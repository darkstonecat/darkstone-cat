"use server";

import { headers } from "next/headers";
import { createAdminClient } from "./admin";
import { sendMagicLinkOtp } from "./magic-link";
import { getClientIp } from "@/lib/client-ip";
import { allowRequestShared } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

const PER_IP_LIMIT = 10;
const PER_EMAIL_LIMIT = 3;
const WINDOW_MS = 10 * 60 * 1000;

/**
 * Magic-link request for the login form.
 *
 * The link is only sent when the email belongs to an account that already
 * confirmed it. For an UNCONFIRMED account GoTrue would send a sign-up
 * confirmation mail whose link confirms the account and signs the person in, so
 * someone who pre-registered a victim's email with their own password would
 * end up with a confirmed account they can enter with that password.
 *
 * The answer never depends on the email: unknown, unconfirmed, throttled and
 * sent all return `{ error: null }`, so the form cannot be used to find out
 * who is a member. Only a failure unrelated to the email asks the person to
 * retry.
 */
export async function requestMagicLink(email: string): Promise<{ error: "failed" | null }> {
  // Server actions receive whatever the client posts, not what the type says.
  if (typeof email !== "string") return { error: "failed" };
  const clean = email.trim().toLowerCase();
  if (!clean || clean.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(clean)) return { error: "failed" };

  try {
    const ip = getClientIp(await headers());
    // The throttle is checked before anything else, and a throttled request looks sent.
    if (!(await allowRequestShared("magic-link-ip", ip, PER_IP_LIMIT, WINDOW_MS))) return { error: null };
    // Also per address, so the form cannot be used to flood someone's inbox.
    if (!(await allowRequestShared("magic-link-email", clean, PER_EMAIL_LIMIT, WINDOW_MS))) return { error: null };

    const { data: confirmed, error: lookupError } = await createAdminClient().rpc("is_email_confirmed", {
      p_email: clean,
    });
    if (lookupError) {
      console.error("[magic-link] account lookup failed code=%s", lookupError.code ?? "unknown");
      return { error: "failed" };
    }
    if (confirmed !== true) return { error: null };

    const sent = await sendMagicLinkOtp(clean);

    // Rate limits on the GoTrue side (and a race with a deleted account) look sent too.
    if (!sent.ok && !sent.throttled && sent.code !== "otp_disabled") {
      console.error("[magic-link] send failed code=%s status=%s", sent.code ?? "unknown", sent.status ?? "unknown");
      return { error: "failed" };
    }
    return { error: null };
  } catch {
    console.error("[magic-link] unexpected error");
    return { error: "failed" };
  }
}
