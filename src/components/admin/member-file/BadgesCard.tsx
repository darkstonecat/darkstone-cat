"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { MdAdd } from "react-icons/md";
import { useRouter } from "@/i18n/routing";
import { awardBadge, revokeBadge } from "@/lib/admin/member-actions";
import {
  KNOWN_BADGE_KEYS,
  formatAdminTimestamp,
  yearOf,
  type AdminMemberFileRow,
} from "@/lib/admin/member-file";
import AdminDialog from "../AdminDialog";
import Notice from "../Notice";
import ReasonButton from "../ReasonButton";
import { adminButtonClass } from "../adminButtons";
import { TEXTAREA_CLASS, errorKey } from "./errors";

const TEXT_MAX = 500;
const ROW = "flex flex-col gap-0.5 border-t border-stone-custom/10 py-3 first:border-0";

type BadgesCardProps = {
  member: Pick<
    AdminMemberFileRow,
    "id" | "member_number" | "state" | "first_name" | "last_name" | "badges" | "membership_start_date"
  >;
};

/**
 * "Insígnies" card of the member file (A-8). "Membre {year}" is derived (BR-6): never awarded or
 * revoked. Awarding and revoking are for active members only (the database refuses a former one).
 * The outcome notice lives here so it survives the `router.refresh()` after each change.
 */
export default function BadgesCard({ member }: BadgesCardProps) {
  const t = useTranslations("admin.member_file");
  const tb = useTranslations("admin.member_file.badge_actions");
  const tErr = useTranslations("admin.member_file.errors");
  const router = useRouter();
  const former = member.state === "former";
  const badges = member.badges ?? [];
  const startYear = yearOf(member.membership_start_date);
  const name = `${member.first_name} ${member.last_name}`.trim();
  const target = t("membership.target", { number: member.member_number, name });
  const held = new Map(badges.map((badge) => [badge.badge_key, badge]));
  const allHeld = KNOWN_BADGE_KEYS.every((key) => held.has(key));

  const [outcome, setOutcome] = useState<"awarded" | "revoked" | null>(null);
  const [awardOpen, setAwardOpen] = useState(false);
  const [choice, setChoice] = useState("");
  const [note, setNote] = useState("");
  const [revokeKey, setRevokeKey] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const noteId = useId();
  const reasonId = useId();

  const badgeName = (key: string) =>
    (KNOWN_BADGE_KEYS as readonly string[]).includes(key) ? t(`badge_${key}`) : key;

  function closeAward() {
    if (busy) return;
    setAwardOpen(false);
    setChoice("");
    setNote("");
    setError("");
  }

  function closeRevoke() {
    if (busy) return;
    setRevokeKey(null);
    setReason("");
    setError("");
  }

  async function handleAward() {
    if (!choice) return;
    setBusy(true);
    setError("");
    try {
      const result = await awardBadge(member.id, choice, note.trim() || null);
      if ("error" in result) {
        setError(tErr(errorKey(result.error)));
        return;
      }
      setAwardOpen(false);
      setChoice("");
      setNote("");
      setOutcome("awarded");
      router.refresh();
    } catch {
      setError(tErr("failed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke() {
    if (!revokeKey) return;
    setBusy(true);
    setError("");
    try {
      const result = await revokeBadge(member.id, revokeKey, reason.trim() || null);
      if ("error" in result) {
        setError(tErr(errorKey(result.error)));
        return;
      }
      setRevokeKey(null);
      setReason("");
      setOutcome("revoked");
      router.refresh();
    } catch {
      setError(tErr("failed"));
    } finally {
      setBusy(false);
    }
  }

  const awardBlock = former ? tb("blocked_former") : allHeld ? tb("blocked_all") : "";

  return (
    <section
      aria-labelledby="mf-badges"
      className="flex flex-col gap-4 rounded-2xl bg-brand-white p-5 md:p-8"
    >
      <h3 id="mf-badges" className="text-xl font-bold text-stone-custom">
        {t("badges_title")}
      </h3>
      {outcome && (
        <div role="status">
          <Notice kind="info">
            <p className="font-bold">{tb(outcome === "awarded" ? "award_done" : "revoke_done")}</p>
          </Notice>
        </div>
      )}
      <ul className="flex flex-col">
        {startYear !== null && (
          <li className={ROW}>
            <span className="font-semibold text-stone-custom">{t("badge_member_year", { year: startYear })}</span>
            <span className="text-[13px] text-stone-custom/65">{t("badge_automatic")}</span>
          </li>
        )}
        {badges.map((badge) => {
          const date = formatAdminTimestamp(badge.awarded_at);
          return (
            <li key={badge.badge_key} className={`${ROW} sm:flex-row sm:items-center sm:justify-between sm:gap-4`}>
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-stone-custom">{badgeName(badge.badge_key)}</span>
                <span className="text-[13px] text-stone-custom/65">
                  {date && badge.awarded_by_name
                    ? t("badge_awarded_by", { date, name: badge.awarded_by_name })
                    : date
                      ? t("badge_awarded", { date })
                      : null}
                </span>
              </div>
              {!former && (
                <button
                  type="button"
                  onClick={() => {
                    setOutcome(null);
                    setRevokeKey(badge.badge_key);
                  }}
                  aria-label={tb("revoke_aria", { badge: badgeName(badge.badge_key) })}
                  className={adminButtonClass("secondary", "self-start text-brand-red")}
                >
                  {tb("revoke_button")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {badges.length === 0 && startYear === null && <p className="text-sm text-stone-custom/65">{t("badges_none")}</p>}
      {former && <p className="text-[13px] text-stone-custom/65">{t("badges_kept")}</p>}

      <ReasonButton
        variant="secondary"
        reason={awardBlock}
        disabled={awardBlock !== ""}
        onClick={() => {
          setOutcome(null);
          setAwardOpen(true);
        }}
        className="gap-2 self-start"
      >
        <MdAdd aria-hidden="true" className="size-5" />
        {tb("award_button")}
      </ReasonButton>

      <AdminDialog
        open={awardOpen}
        onClose={closeAward}
        onConfirm={handleAward}
        title={tb("award_title")}
        target={target}
        confirmLabel={busy ? tb("award_saving") : tb("award_confirm")}
        confirmDisabled={!choice}
        confirmDisabledReason={tb("award_disabled")}
        busy={busy}
        error={error || undefined}
      >
        <fieldset className="flex flex-col gap-1" disabled={busy}>
          <legend className="mb-2 text-sm font-semibold text-stone-custom">
            {tb("award_label")} <span aria-hidden="true" className="text-brand-red">*</span>
          </legend>
          {KNOWN_BADGE_KEYS.map((key) => {
            const existing = held.get(key);
            const since = existing ? formatAdminTimestamp(existing.awarded_at) : null;
            return (
              <label
                key={key}
                className="flex min-h-11 cursor-pointer items-start gap-3 py-2 text-sm text-stone-custom has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
              >
                <input
                  type="radio"
                  name="award-badge"
                  value={key}
                  checked={choice === key}
                  disabled={Boolean(existing)}
                  onChange={() => setChoice(key)}
                  className="mt-0.5 size-4 accent-stone-custom"
                />
                <span className="flex flex-col">
                  <span className="font-semibold">{t(`badge_${key}`)}</span>
                  <span className="text-[13px] text-stone-custom/65">
                    {existing ? (since ? tb("held_since", { date: since }) : tb("held")) : tb(`caption_${key}`)}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>
        <p className="text-[13px] text-stone-custom/65">{tb("automatic_note")}</p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={noteId} className="text-sm font-semibold text-stone-custom">
            {tb("note_label")}
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
          <p className="text-[13px] text-stone-custom/65">{tb("note_help")}</p>
        </div>
      </AdminDialog>

      <AdminDialog
        open={revokeKey !== null}
        onClose={closeRevoke}
        onConfirm={handleRevoke}
        title={tb("revoke_title", { badge: revokeKey ? badgeName(revokeKey) : "" })}
        variant="danger"
        confirmLabel={busy ? tb("revoke_saving") : tb("revoke_confirm")}
        busy={busy}
        error={error || undefined}
      >
        <p className="text-sm text-stone-custom">
          {tb("revoke_text", { name, number: member.member_number })}
        </p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={reasonId} className="text-sm font-semibold text-stone-custom">
            {tb("reason_label")}
          </label>
          <textarea
            id={reasonId}
            rows={2}
            maxLength={TEXT_MAX}
            disabled={busy}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={TEXTAREA_CLASS}
          />
          <p className="text-[13px] text-stone-custom/65">{tb("note_help")}</p>
        </div>
      </AdminDialog>
    </section>
  );
}
