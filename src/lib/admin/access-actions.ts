"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMagicLinkOtp } from "@/lib/supabase/magic-link";
import { allowRequestShared } from "@/lib/rate-limit";
import { adminDbErrorCode, type AdminActionError } from "@/lib/admin/action-errors";
import { authoriseBoardOnMember, logAdminFailure } from "@/lib/admin/action-context";

/*
 * A-15 · Send a member an access link (procedure P-6). The board never sees the link or the
 * address: the action resolves the member's own account e-mail on the server and sends the same
 * magic link as the login form. Steps, in this order:
 *
 *   1. `getAdminAccess('board')` and the member id (UUID).
 *   2. id → member number with the service role (only that column: since T7b a board session
 *      cannot read other members' rows), then `admin_get_member` with the user's SESSION client,
 *      which checks the role again and hides purged stubs and unconfirmed sign-ups (BR-22).
 *   3. Active members only (`not_active`), with a login account and an address (`no_login`).
 *   4. One link per member every 10 minutes, shared by every instance (bucket
 *      `access-link:<member uuid>`). The bucket is consumed before the audit entry, so a refused
 *      attempt never leaves an entry that claims a link was sent.
 *   5. `log_admin_event('member.send_access_link', target)` with the SESSION client BEFORE
 *      sending (fail closed: no entry, no mail).
 *   6. Send. A failure after the entry is reported (`send_failed`); the entry stays, as the
 *      record of the attempt.
 */

type Fail = { error: AdminActionError };
type RateLimited = { error: "rate_limited"; retryAfter: number | null };

const AUDIT_ACTION = "member.send_access_link";
const WINDOW_MS = 10 * 60 * 1000;
const WINDOW_SECONDS = WINDOW_MS / 1000;
const LOG_NAME = "send_access_link";

/** The single row of a RETURNS TABLE function (PostgREST answers an array). */
function firstRow(data: unknown): Record<string, unknown> | null {
  const row = Array.isArray(data) ? data[0] : data;
  return row && typeof row === "object" ? (row as Record<string, unknown>) : null;
}

type SessionClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Seconds until the next link is allowed, from the last `member.send_access_link` entry for this
 * member (the board can read the audit log). Null when it cannot be told: no readable entry, or
 * the limiter fell back to memory after an entry older than the window.
 */
async function secondsUntilNextLink(supabase: SessionClient, memberId: string): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from("audit_log")
      .select("created_at")
      .eq("action", AUDIT_ACTION)
      .eq("target_member_id", memberId)
      .order("id", { ascending: false })
      .limit(1);
    if (error) return null;
    const createdAt = firstRow(data)?.created_at;
    const last = typeof createdAt === "string" ? Date.parse(createdAt) : NaN;
    if (!Number.isFinite(last)) return null;
    const seconds = Math.ceil((last + WINDOW_MS - Date.now()) / 1000);
    return seconds > 0 && seconds <= WINDOW_SECONDS ? seconds : null;
  } catch {
    return null;
  }
}

/**
 * Sends the sign-in link to the member's own account e-mail. Takes only the member id: an
 * address from the client is never accepted. Never returns or logs the address.
 */
export async function sendAccessLink(memberId: string): Promise<{ ok: true } | RateLimited | Fail> {
  const auth = await authoriseBoardOnMember(memberId);
  if ("error" in auth) return auth;

  const lookup = await createAdminClient()
    .from("members")
    .select("member_number")
    .eq("id", auth.id)
    .maybeSingle();
  if (lookup.error) {
    logAdminFailure(LOG_NAME, lookup.error.code);
    return { error: "failed" };
  }
  const memberNumber = (lookup.data as { member_number?: unknown } | null)?.member_number;
  if (typeof memberNumber !== "string" || !memberNumber) return { error: "not_found" };

  const supabase = await createClient();
  const member = await supabase.rpc("admin_get_member", { p_member_number: memberNumber });
  if (member.error) {
    logAdminFailure(LOG_NAME, member.error.code);
    return { error: adminDbErrorCode(member.error) };
  }
  const row = firstRow(member.data);
  if (!row || row.id !== auth.id) return { error: "not_found" };
  if (row.state !== "active") return { error: "not_active" };
  const email = typeof row.email === "string" ? row.email.trim() : "";
  if (row.has_login !== true || !email) return { error: "no_login" };

  if (!(await allowRequestShared(`access-link:${auth.id}`, null, 1, WINDOW_MS))) {
    return { error: "rate_limited", retryAfter: await secondsUntilNextLink(supabase, auth.id) };
  }

  const logged = await supabase.rpc("log_admin_event", {
    p_action: AUDIT_ACTION,
    p_target: auth.id,
    p_details: {},
    p_reason: null,
  });
  if (logged.error) {
    logAdminFailure(LOG_NAME, logged.error.code);
    return { error: adminDbErrorCode(logged.error) };
  }

  try {
    const sent = await sendMagicLinkOtp(email);
    if (sent.ok) return { ok: true };
    logAdminFailure(LOG_NAME, sent.code ?? (sent.status === null ? null : String(sent.status)));
    return sent.throttled ? { error: "rate_limited", retryAfter: null } : { error: "send_failed" };
  } catch {
    logAdminFailure(LOG_NAME, "send_exception");
    return { error: "send_failed" };
  }
}
