"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { MdAutorenew, MdPersonOff } from "react-icons/md";
import { useRouter } from "@/i18n/routing";
import { isBoardRole } from "@/lib/auth/roles";
import { formatAdminDate } from "@/lib/admin/members-list";
import { leaveDateBounds, madridToday } from "@/lib/admin/leave-dates";
import { leaveMember, rejoinMember, type RejoinChannel } from "@/lib/admin/membership-actions";
import type { AdminMemberFileRow } from "@/lib/admin/member-file";
import AdminDialog from "../AdminDialog";
import Notice from "../Notice";
import ReasonButton from "../ReasonButton";
import { INPUT_CLASS, TEXTAREA_CLASS, errorKey } from "./errors";

/** Same limits as the actions (500 code points) and `membership_close` (reason min 5, D-E provisional). */
const REASON_MIN = 5;
const TEXT_MAX = 500;
const CHANNELS: readonly RejoinChannel[] = ["form", "email", "in_person", "other"];
const CHECKLIST = ["identity", "last_leave", "no_duplicate", "request_logged"] as const;

type MembershipActionsProps = {
  member: Pick<
    AdminMemberFileRow,
    | "id"
    | "member_number"
    | "state"
    | "first_name"
    | "last_name"
    | "role"
    | "has_login"
    | "anonymised_at"
    | "current_joined_on"
    | "left_on"
    | "left_by"
    | "leave_reason"
  >;
  /** The signed-in board member is looking at their own file (the database refuses `self_target`). */
  isSelf: boolean;
};

type Outcome = { kind: "left" | "rejoined"; emailSent: boolean };

/**
 * A-6 "Dona de baixa" (active member) and A-7 "Reincorpora" (former member). Disabled triggers
 * keep a visible reason. The outcome notice lives here (not in the dialog) so it survives the
 * `router.refresh()` that swaps the file between active and former.
 */
export default function MembershipActions({ member, isSelf }: MembershipActionsProps) {
  const t = useTranslations("admin.member_file.membership");
  const router = useRouter();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const former = member.state === "former";
  const name = `${member.first_name} ${member.last_name}`.trim();
  const target = t("target", { number: member.member_number, name });

  function handleDone(next: Outcome) {
    setOutcome(next);
    router.refresh();
  }

  const leaveBlock = isBoardRole(member.role) ? t("leave_blocked_role") : isSelf ? t("leave_blocked_self") : null;
  const rejoinBlock = member.anonymised_at ? t("rejoin_blocked_anonymised") : !member.has_login ? t("rejoin_blocked_no_login") : null;

  return (
    <div className="flex flex-col gap-3">
      {outcome && (
        <div role="status" className="flex flex-col gap-3">
          <Notice kind="info">
            <p className="font-bold">{t(outcome.kind === "left" ? "left_done" : "rejoined_done")}</p>
          </Notice>
          {!outcome.emailSent && <Notice kind="warning">{t("email_failed")}</Notice>}
        </div>
      )}
      {former ? (
        <RejoinControl
          member={member}
          target={target}
          blocked={rejoinBlock}
          onDone={(emailSent) => handleDone({ kind: "rejoined", emailSent })}
        />
      ) : (
        <LeaveControl
          member={member}
          target={target}
          blocked={leaveBlock}
          onDone={(emailSent) => handleDone({ kind: "left", emailSent })}
        />
      )}
    </div>
  );
}

type ControlProps = {
  member: MembershipActionsProps["member"];
  target: string;
  blocked: string | null;
  onDone: (emailSent: boolean) => void;
};

function LeaveControl({ member, target, blocked, onDone }: ControlProps) {
  const t = useTranslations("admin.member_file.membership");
  const tErr = useTranslations("admin.member_file.errors");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [date, setDate] = useState("");
  const [today, setToday] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dateId = useId();

  const bounds = today ? leaveDateBounds(member.current_joined_on, today) : null;
  const dateInvalid = Boolean(bounds && date && (date < bounds.min || date > bounds.max));

  function handleOpen() {
    const now = madridToday();
    setToday(now);
    setDate(now);
    setOpen(true);
  }

  function handleClose() {
    if (busy) return;
    setOpen(false);
    setReason("");
    setError("");
  }

  async function handleLeave() {
    setBusy(true);
    setError("");
    try {
      const result = await leaveMember(member.id, reason.trim(), date || null);
      if ("error" in result) {
        setError(tErr(errorKey(result.error)));
        return;
      }
      setOpen(false);
      setReason("");
      onDone(result.emailSent);
    } catch {
      setError(tErr("failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ReasonButton
        variant="danger"
        reason={blocked ?? ""}
        disabled={blocked !== null}
        onClick={handleOpen}
        className="gap-2 max-md:w-full"
      >
        <MdPersonOff aria-hidden="true" className="size-5" />
        {t("leave_button")}
      </ReasonButton>
      <AdminDialog
        open={open}
        onClose={handleClose}
        onConfirm={handleLeave}
        title={t("leave_title")}
        target={target}
        variant="danger"
        procedure="P-2"
        confirmLabel={busy ? t("leave_saving") : t("leave_confirm")}
        confirmDisabled={dateInvalid}
        confirmDisabledReason={t("date_invalid")}
        busy={busy}
        error={error || undefined}
        reason={{
          label: t("leave_reason_label"),
          value: reason,
          onChange: setReason,
          minLength: REASON_MIN,
          maxLength: TEXT_MAX,
          help: t("leave_reason_help"),
        }}
      >
        <div className="flex flex-col gap-2 rounded-xl bg-stone-custom/5 p-4 text-sm text-stone-custom">
          <p className="font-bold">{t("what_happens")}</p>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {(["leave_1", "leave_2", "leave_3", "leave_4", "leave_5"] as const).map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={dateId} className="text-sm font-semibold text-stone-custom">
            {t("leave_date_label")}
          </label>
          <input
            id={dateId}
            type="date"
            value={date}
            min={bounds?.min}
            max={bounds?.max}
            disabled={busy}
            onChange={(event) => setDate(event.target.value)}
            aria-invalid={dateInvalid || undefined}
            className={INPUT_CLASS}
          />
          <p className="text-[13px] text-stone-custom/65">{t("leave_date_help")}</p>
        </div>
      </AdminDialog>
    </>
  );
}

function RejoinControl({ member, target, blocked, onDone }: ControlProps) {
  const t = useTranslations("admin.member_file.membership");
  const tErr = useTranslations("admin.member_file.errors");
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [channel, setChannel] = useState<RejoinChannel | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const noteId = useId();

  const allChecked = CHECKLIST.every((key) => checked[key]);
  const boardLeaveDate = formatAdminDate(member.left_on);

  function reset() {
    setChecked({});
    setChannel(null);
    setNote("");
    setError("");
  }

  function handleClose() {
    if (busy) return;
    setOpen(false);
    reset();
  }

  async function handleRejoin() {
    if (!channel) return;
    setBusy(true);
    setError("");
    try {
      const result = await rejoinMember(member.id, channel, note.trim() || null);
      if ("error" in result) {
        setError(tErr(errorKey(result.error)));
        return;
      }
      setOpen(false);
      reset();
      onDone(result.emailSent);
    } catch {
      setError(tErr("failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ReasonButton
        variant="primary"
        reason={blocked ?? ""}
        disabled={blocked !== null}
        onClick={() => setOpen(true)}
        className="gap-2 max-md:w-full"
      >
        <MdAutorenew aria-hidden="true" className="size-5" />
        {t("rejoin_button")}
      </ReasonButton>
      <AdminDialog
        open={open}
        onClose={handleClose}
        onConfirm={handleRejoin}
        title={t("rejoin_title")}
        target={target}
        procedure="P-1"
        confirmLabel={busy ? t("rejoin_saving") : t("rejoin_confirm")}
        confirmDisabled={!allChecked || !channel}
        confirmDisabledReason={t("rejoin_disabled")}
        busy={busy}
        error={error || undefined}
      >
        {member.left_by === "board" && (
          <Notice kind="warning">
            {boardLeaveDate ? t("board_leave_warning", { date: boardLeaveDate }) : t("board_leave_warning_no_date")}
            {member.leave_reason ? ` ${t("board_leave_reason", { reason: member.leave_reason })}` : ""} {t("board_leave_talk")}
          </Notice>
        )}
        <fieldset className="flex flex-col gap-1" disabled={busy}>
          <legend className="mb-2 text-sm font-semibold text-stone-custom">{t("checklist_title")}</legend>
          {CHECKLIST.map((key) => (
            <label key={key} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-stone-custom">
              <input
                type="checkbox"
                checked={Boolean(checked[key])}
                onChange={(event) => setChecked((prev) => ({ ...prev, [key]: event.target.checked }))}
                className="size-4 accent-stone-custom"
              />
              {t(`check_${key}`)}
            </label>
          ))}
        </fieldset>
        <fieldset className="flex flex-col gap-1" disabled={busy}>
          <legend className="mb-2 text-sm font-semibold text-stone-custom">
            {t("channel_label")} <span aria-hidden="true" className="text-brand-red">*</span>
          </legend>
          {CHANNELS.map((item) => (
            <label key={item} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-stone-custom">
              <input
                type="radio"
                name="rejoin-channel"
                value={item}
                checked={channel === item}
                onChange={() => setChannel(item)}
                className="size-4 accent-stone-custom"
              />
              {t(`channel_${item}`)}
            </label>
          ))}
        </fieldset>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={noteId} className="text-sm font-semibold text-stone-custom">
            {t("note_label")}
          </label>
          <textarea
            id={noteId}
            rows={2}
            maxLength={TEXT_MAX}
            disabled={busy}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className={TEXTAREA_CLASS}
          />
          <p className="text-[13px] text-stone-custom/65">{t("note_help")}</p>
        </div>
        <div className="flex flex-col gap-2 rounded-xl bg-stone-custom/5 p-4 text-sm text-stone-custom">
          <p className="font-bold">{t("what_happens")}</p>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {(["rejoin_1", "rejoin_2", "rejoin_3", "rejoin_4", "rejoin_5"] as const).map((key) => (
              <li key={key}>{t(key, { number: member.member_number })}</li>
            ))}
          </ul>
        </div>
      </AdminDialog>
    </>
  );
}
