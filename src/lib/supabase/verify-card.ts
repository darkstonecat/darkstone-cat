import { createClient } from "@supabase/supabase-js";
import { isValidCardToken } from "@/lib/member-card/verify-url";

export type CardVerification = { valid: true; memberNumber: string } | { valid: false };

/**
 * Public card check for `/verify/<token>`. Uses an anonymous, cookie-less client: the caller is
 * not a signed-in member. The `verify_card_token` database function is the only door — it returns
 * validity and the member number, nothing else. A backend failure throws (never "not valid"), so
 * an outage cannot be mistaken for a revoked card.
 */
export async function verifyCardToken(token: string): Promise<CardVerification> {
  // Malformed tokens never leave the server
  if (!isValidCardToken(token)) return { valid: false };

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data, error } = await supabase.rpc("verify_card_token", { p_token: token });
  if (error) throw new Error(`verify_card_token failed: ${error.message}`);

  const row = Array.isArray(data) ? data[0] : data;
  if (row?.valid && typeof row.member_number === "string") {
    return { valid: true, memberNumber: row.member_number };
  }
  return { valid: false };
}
