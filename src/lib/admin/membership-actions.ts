"use server";

import { createClient } from "@/lib/supabase/server";
import { adminDbErrorCode, type AdminActionError } from "@/lib/admin/action-errors";
import { authoriseBoardOnMember, logAdminFailure, revalidateMemberPages } from "@/lib/admin/action-context";
import { sendMail } from "@/lib/mail";
import { boardLeaveEmail, rejoinEmail, type MembershipEmail } from "@/lib/mail/templates/membership";

/*
 * Board leave (A-6) and rejoin (A-7). Same pattern as `member-actions.ts`: role check, input
 * validation, then the SECURITY DEFINER function with the user's SESSION client, which checks
 * the role again, bans or unbans the login account and writes the audit entry in one
 * transaction (T6). The e-mail goes afterwards, to the address the function returns: a mail
 * failure never rolls back or hides the membership change (`emailSent: false`).
 */

type Fail = { error: AdminActionError };
type Done = { ok: true; emailSent: boolean };

export type RejoinChannel = "form" | "email" | "in_person" | "other";

const REJOIN_CHANNELS: readonly string[] = ["form", "email", "in_person", "other"];
/** 500 code points, as `membership_close` / `admin_member_rejoin` count them. */
const MAX_TEXT_LENGTH = 500;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAIL_LOG_TAG = "membership-mail";

/** A real calendar date in `YYYY-MM-DD` form (no time, no other format). */
function isIsoDate(value: string): boolean {
  const match = ISO_DATE_RE.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Optional note: trimmed text, null when blank; `invalid` / `note_too_long` otherwise. */
function optionalNote(value: unknown): { value: string | null } | Fail {
  if (value === undefined || value === null) return { value: null };
  if (typeof value !== "string") return { error: "invalid" };
  const text = value.trim();
  if ([...text].length > MAX_TEXT_LENGTH) return { error: "note_too_long" };
  return { value: text || null };
}

/** The single row of a RETURNS TABLE function (PostgREST answers an array). */
function firstRow(data: unknown): Record<string, unknown> | null {
  const row = Array.isArray(data) ? data[0] : data;
  return row && typeof row === "object" ? (row as Record<string, unknown>) : null;
}

function text(row: Record<string, unknown> | null, key: string): string {
  const value = row?.[key];
  return typeof value === "string" ? value : "";
}

/** Sends a membership e-mail to the returned address; false when there is none or SMTP fails. */
async function notify(to: string, mail: MembershipEmail): Promise<boolean> {
  if (!to) return false;
  try {
    const result = await sendMail({ to, ...mail }, { logTag: MAIL_LOG_TAG });
    return result.ok;
  } catch {
    // sendMail never throws; this only guards against a future change. No details logged.
    console.error("[%s] send failed", MAIL_LOG_TAG);
    return false;
  }
}

// ---------------------------------------------------------------------------------------------
// A-6 · Give a member baixa
// ---------------------------------------------------------------------------------------------

/**
 * `leftOn` is an ISO date (`YYYY-MM-DD`); omitted, null or "" means today in Madrid (decided by
 * the database). The reason is required and sent to the member by e-mail (BR-8): blank is
 * refused here, over 500 characters too; the minimum length (5) is left to the database.
 */
export async function leaveMember(
  memberId: string,
  reason: string,
  leftOn?: string | null
): Promise<Done | Fail> {
  const auth = await authoriseBoardOnMember(memberId);
  if ("error" in auth) return auth;

  if (reason === undefined || reason === null) return { error: "reason_required" };
  if (typeof reason !== "string") return { error: "invalid" };
  const why = reason.trim();
  if (!why) return { error: "reason_required" };
  if ([...why].length > MAX_TEXT_LENGTH) return { error: "reason_too_long" };

  let date: string | null = null;
  if (leftOn !== undefined && leftOn !== null && leftOn !== "") {
    if (typeof leftOn !== "string" || !isIsoDate(leftOn)) return { error: "invalid_date" };
    date = leftOn;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_member_leave", {
    p_member_id: auth.id,
    p_reason: why,
    p_left_on: date,
  });

  if (error) {
    logAdminFailure("leave_member", error.code);
    return { error: adminDbErrorCode(error) };
  }

  revalidateMemberPages();

  const row = firstRow(data);
  const emailSent = await notify(
    text(row, "email"),
    boardLeaveEmail({
      firstName: text(row, "first_name"),
      memberNumber: text(row, "member_number"),
      leftOn: text(row, "left_on") || date || "",
      reason: why,
    })
  );
  return { ok: true, emailSent };
}

// ---------------------------------------------------------------------------------------------
// A-7 · Reinstate a former member
// ---------------------------------------------------------------------------------------------

/**
 * `channel` is how the request arrived (the dialog's radio group); the optional note is stored
 * as the audit reason and is not part of the e-mail.
 */
export async function rejoinMember(
  memberId: string,
  channel: RejoinChannel,
  note?: string | null
): Promise<Done | Fail> {
  const auth = await authoriseBoardOnMember(memberId);
  if ("error" in auth) return auth;

  if (typeof channel !== "string" || !REJOIN_CHANNELS.includes(channel)) return { error: "invalid_channel" };
  const why = optionalNote(note);
  if ("error" in why) return why;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_member_rejoin", {
    p_member_id: auth.id,
    p_channel: channel,
    p_note: why.value,
  });

  if (error) {
    logAdminFailure("rejoin_member", error.code);
    return { error: adminDbErrorCode(error) };
  }

  revalidateMemberPages();

  const row = firstRow(data);
  const emailSent = await notify(
    text(row, "email"),
    rejoinEmail({ firstName: text(row, "first_name"), memberNumber: text(row, "member_number") })
  );
  return { ok: true, emailSent };
}
