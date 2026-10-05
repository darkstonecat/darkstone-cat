import "server-only";

import { createClient } from "@supabase/supabase-js";

/*
 * The magic-link sender shared by the login form (`requestMagicLink`) and the board's access
 * link (A-15, `sendAccessLink`). GoTrue builds the link from the "Magic link" template
 * (`{{ .SiteURL }}/auth/magic-link?token_hash=…&type=email`, see CLAUDE.md), so both send the
 * same mail. Callers must have checked that the address belongs to a CONFIRMED account: for an
 * unconfirmed one GoTrue would send a sign-up confirmation instead (see magic-link-actions.ts).
 */

export type MagicLinkSendResult =
  | { ok: true }
  | {
      ok: false;
      /** GoTrue's own e-mail rate limit. */
      throttled: boolean;
      code: string | null;
      status: number | null;
    };

/** Sends the sign-in link to `email`, never creating a user. Never logs the address. */
export async function sendMagicLinkOtp(email: string): Promise<MagicLinkSendResult> {
  // Cookie-less client: nothing to persist on the server, the member signs in from the link.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  if (!error) return { ok: true };

  return {
    ok: false,
    throttled: error.status === 429 || error.code === "over_email_send_rate_limit",
    code: error.code ?? null,
    status: error.status ?? null,
  };
}
