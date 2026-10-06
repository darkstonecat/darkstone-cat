"use client";

import { useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MdAdminPanelSettings, MdDeleteForever } from "react-icons/md";
import { useRouter } from "@/i18n/routing";
import { isBoardRole, roleLabelKey } from "@/lib/auth/roles";
import { formatAdminDate } from "@/lib/admin/members-list";
import { formatAdminTimestamp, type AdminMemberFileRow } from "@/lib/admin/member-file";
import { anonymiseMember, setMemberRole, type AssignableRole } from "@/lib/admin/superadmin-actions";
import AdminDialog from "../AdminDialog";
import Notice from "../Notice";
import ReasonButton from "../ReasonButton";
import { adminButtonClass } from "../adminButtons";
import { INPUT_CLASS, TEXTAREA_CLASS, errorKey } from "./errors";

const TEXT_MAX = 500;
const ROLES: readonly AssignableRole[] = ["member", "board", "superadmin"];

type RoleCardProps = {
  member: Pick<
    AdminMemberFileRow,
    | "id"
    | "member_number"
    | "state"
    | "first_name"
    | "last_name"
    | "role"
    | "role_since"
    | "has_login"
    | "anonymised_at"
    | "purge_on"
  >;
  /** Superadmin viewer: may change roles and anonymise. A board member sees the role read-only. */
  canManage: boolean;
  /** The signed-in superadmin is looking at their own file (`self_role_change`). */
  isSelf: boolean;
};

type Anonymised = { purgeOn: string | null; accountDeleted: boolean };

/**
 * V-3 "Rol" card. Role changes (S-1/S-2) and anonymisation (S-3) are superadmin-only and the
 * server actions check it again; hiding the buttons is not the protection. Outcomes live here so
 * they survive the `router.refresh()`.
 */
export default function RoleCard({ member, canManage, isSelf }: RoleCardProps) {
  const t = useTranslations("admin.member_file");
  const tr = useTranslations("admin.member_file.role_actions");
  const tAdmin = useTranslations("admin");
  const tErr = useTranslations("admin.member_file.errors");
  const router = useRouter();
  const former = member.state === "former";
  const name = `${member.first_name} ${member.last_name}`.trim();
  const target = t("membership.target", { number: member.member_number, name });
  const current = roleLabelKey(member.role).replace("role_", "") as AssignableRole;
  const since = isBoardRole(member.role) ? formatAdminTimestamp(member.role_since) : null;

  const [outcome, setOutcome] = useState<"role.grant" | "role.revoke" | null>(null);
  const [anonymised, setAnonymised] = useState<Anonymised | null>(null);
  const [retryError, setRetryError] = useState("");
  const [roleOpen, setRoleOpen] = useState(false);
  const [choice, setChoice] = useState<AssignableRole | "">("");
  const [roleReason, setRoleReason] = useState("");
  const [anonOpen, setAnonOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [anonReason, setAnonReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reasonId = useId();
  const anonReasonId = useId();
  const typedId = useId();
  // What was confirmed in the dialog, so the retry button repeats exactly the same call.
  const confirmedRef = useRef("");

  function closeRole() {
    if (busy) return;
    setRoleOpen(false);
    setChoice("");
    setRoleReason("");
    setError("");
  }

  function closeAnon() {
    if (busy) return;
    setAnonOpen(false);
    setTyped("");
    setAnonReason("");
    setError("");
  }

  async function handleRole() {
    if (!choice) return;
    setBusy(true);
    setError("");
    try {
      const result = await setMemberRole(member.id, choice, roleReason.trim() || null);
      if ("error" in result) {
        setError(tErr(errorKey(result.error)));
        return;
      }
      setRoleOpen(false);
      setChoice("");
      setRoleReason("");
      setOutcome(result.action);
      router.refresh();
    } catch {
      setError(tErr("failed"));
    } finally {
      setBusy(false);
    }
  }

  /** Runs S-3; the retry button runs the very same call (idempotent on the server). */
  async function runAnonymise(confirmation: string, reason: string | null): Promise<string | null> {
    try {
      // The text the superadmin typed, as typed: the database compares it with the number.
      const result = await anonymiseMember(member.id, confirmation, reason);
      if ("error" in result) return tErr(errorKey(result.error));
      setAnonymised({ purgeOn: result.purgeOn ?? member.purge_on, accountDeleted: result.accountDeleted });
      router.refresh();
      return null;
    } catch {
      return tErr("failed");
    }
  }

  async function handleAnonymise() {
    setBusy(true);
    setError("");
    confirmedRef.current = typed;
    const failure = await runAnonymise(typed, anonReason.trim() || null);
    setBusy(false);
    if (failure) {
      setError(failure);
      return;
    }
    setAnonOpen(false);
    setTyped("");
    setAnonReason("");
  }

  async function handleRetry() {
    setBusy(true);
    setRetryError("");
    const failure = await runAnonymise(confirmedRef.current, null);
    setBusy(false);
    if (failure) setRetryError(failure);
  }

  const roleBlock = isSelf ? tr("blocked_self") : former ? tr("blocked_former") : "";
  const anonBlock = member.anonymised_at && !member.has_login ? tr("anonymise_blocked_done") : "";
  const purgeDate = formatAdminDate(anonymised?.purgeOn ?? member.purge_on);
  const typedOk = typed.trim() === member.member_number;

  return (
    <section aria-labelledby="mf-role" className="flex flex-col gap-4 rounded-2xl bg-brand-white p-5 md:p-8">
      <h3 id="mf-role" className="text-xl font-bold text-stone-custom">
        {tr("title")}
      </h3>
      <p className="text-sm text-stone-custom/70">
        {t("role_card")} <strong className="text-stone-custom">{tAdmin(roleLabelKey(member.role))}</strong>
        {since ? ` · ${t("role_since", { date: since })}` : ""}
      </p>

      {outcome && (
        <div role="status">
          <Notice kind="info">
            <p className="font-bold">{tr(outcome === "role.grant" ? "done_grant" : "done_revoke")}</p>
          </Notice>
        </div>
      )}
      {anonymised && (
        <div role="status" className="flex flex-col gap-3">
          <Notice kind="info">
            <p className="font-bold">
              {purgeDate ? tr("anonymise_done", { date: purgeDate }) : tr("anonymise_done_no_date")}
            </p>
          </Notice>
          {!anonymised.accountDeleted && (
            <Notice kind="warning">
              <div className="flex flex-col items-start gap-3">
                <p>{tr("anonymise_account_pending")}</p>
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={busy}
                  className={adminButtonClass("secondary")}
                >
                  {tr("anonymise_retry")}
                </button>
                {retryError && (
                  <p role="alert" className="font-semibold text-red-900">
                    {retryError}
                  </p>
                )}
              </div>
            </Notice>
          )}
        </div>
      )}

      {!canManage ? (
        <p className="text-[13px] text-stone-custom/65">{tr("read_only")}</p>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <ReasonButton
            variant="secondary"
            reason={roleBlock}
            disabled={roleBlock !== ""}
            onClick={() => {
              setOutcome(null);
              setRoleOpen(true);
            }}
            className="gap-2 max-sm:w-full"
          >
            <MdAdminPanelSettings aria-hidden="true" className="size-5" />
            {tr("change_button")}
          </ReasonButton>
          {former && (
            <ReasonButton
              variant="danger"
              reason={anonBlock}
              disabled={anonBlock !== ""}
              onClick={() => {
                setAnonymised(null);
                setAnonOpen(true);
              }}
              className="gap-2 max-sm:w-full"
            >
              <MdDeleteForever aria-hidden="true" className="size-5" />
              {tr("anonymise_button")}
            </ReasonButton>
          )}
        </div>
      )}

      <AdminDialog
        open={roleOpen}
        onClose={closeRole}
        onConfirm={handleRole}
        title={tr("change_title")}
        target={target}
        superadminOnly
        confirmLabel={busy ? tr("change_saving") : tr("change_confirm")}
        confirmDisabled={!choice || choice === current}
        confirmDisabledReason={choice === current && choice ? tr("disabled_same") : tr("disabled_pick")}
        busy={busy}
        error={error || undefined}
      >
        <fieldset className="flex flex-col gap-1" disabled={busy}>
          <legend className="mb-2 text-sm font-semibold text-stone-custom">
            {tr("change_label")} <span aria-hidden="true" className="text-brand-red">*</span>
          </legend>
          {ROLES.map((role) => (
            <label key={role} className="flex min-h-11 cursor-pointer items-start gap-3 py-2 text-sm text-stone-custom">
              <input
                type="radio"
                name="member-role"
                value={role}
                checked={choice === role}
                onChange={() => setChoice(role)}
                className="mt-0.5 size-4 accent-stone-custom"
              />
              <span className="flex flex-col">
                <span className="font-semibold">
                  {tr(`option_${role}`)}
                  {role === current ? ` (${tr("option_current")})` : ""}
                </span>
                <span className="text-[13px] text-stone-custom/65">{tr(`option_${role}_help`)}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <p className="text-[13px] text-stone-custom/65">{tr("only_active")}</p>
        {choice && choice !== "member" && <Notice kind="warning">{tr("grant_warning")}</Notice>}
        {choice === "member" && current !== "member" && <Notice kind="info">{tr("revoke_hint")}</Notice>}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={reasonId} className="text-sm font-semibold text-stone-custom">
            {tr("reason_label")}
          </label>
          <textarea
            id={reasonId}
            rows={2}
            maxLength={TEXT_MAX}
            disabled={busy}
            value={roleReason}
            onChange={(event) => setRoleReason(event.target.value)}
            className={TEXTAREA_CLASS}
          />
          <p className="text-[13px] text-stone-custom/65">{tr("reason_help")}</p>
        </div>
      </AdminDialog>

      <AdminDialog
        open={anonOpen}
        onClose={closeAnon}
        onConfirm={handleAnonymise}
        title={tr("anonymise_title")}
        target={target}
        variant="danger"
        superadminOnly
        procedure="P-4"
        confirmLabel={busy ? tr("anonymise_saving") : tr("anonymise_confirm")}
        confirmDisabled={!typedOk}
        confirmDisabledReason={tr("anonymise_disabled")}
        busy={busy}
        error={error || undefined}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2 rounded-xl bg-stone-custom/5 p-4 text-sm text-stone-custom">
            <p className="font-bold">{tr("anonymise_deleted_title")}</p>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {(["anonymise_deleted_1", "anonymise_deleted_2", "anonymise_deleted_3"] as const).map((key) => (
                <li key={key}>{tr(key)}</li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-2 rounded-xl bg-stone-custom/5 p-4 text-sm text-stone-custom">
            <p className="font-bold">
              {purgeDate ? tr("anonymise_kept_title", { date: purgeDate }) : tr("anonymise_kept_title_no_date")}
            </p>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {(["anonymise_kept_1", "anonymise_kept_2", "anonymise_kept_3"] as const).map((key) => (
                <li key={key}>{tr(key)}</li>
              ))}
            </ul>
          </div>
        </div>
        <Notice kind="warning">{tr("anonymise_warning")}</Notice>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={typedId} className="text-sm font-semibold text-stone-custom">
            {tr("anonymise_confirm_label")} <span aria-hidden="true" className="text-brand-red">*</span>
          </label>
          <input
            id={typedId}
            type="text"
            autoComplete="off"
            value={typed}
            disabled={busy}
            onChange={(event) => setTyped(event.target.value)}
            className={INPUT_CLASS}
          />
          <p className="text-[13px] text-stone-custom/65">
            {tr("anonymise_confirm_help", { number: member.member_number })}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={anonReasonId} className="text-sm font-semibold text-stone-custom">
            {tr("reason_label")}
          </label>
          <textarea
            id={anonReasonId}
            rows={2}
            maxLength={TEXT_MAX}
            disabled={busy}
            value={anonReason}
            onChange={(event) => setAnonReason(event.target.value)}
            className={TEXTAREA_CLASS}
          />
          <p className="text-[13px] text-stone-custom/65">{tr("reason_help")}</p>
        </div>
      </AdminDialog>
    </section>
  );
}
