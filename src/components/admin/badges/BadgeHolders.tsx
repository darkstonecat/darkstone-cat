"use client";

import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MdAdd } from "react-icons/md";
import { Link, useRouter } from "@/i18n/routing";
import { revokeBadge } from "@/lib/admin/member-actions";
import type { AdminBadgeRow, BadgeHolder } from "@/lib/admin/badges";
import { formatAdminTimestamp } from "@/lib/admin/member-file";
import { localize } from "@/lib/badges/catalogue";
import AdminDialog from "../AdminDialog";
import Notice from "../Notice";
import { adminButtonClass } from "../adminButtons";
import { TEXTAREA_CLASS } from "../member-file/errors";
import BulkAwardDialog from "./BulkAwardDialog";
import { CARD, badgeErrorKey } from "./shared";

/** Active holders shown before "Mostra'n N més". */
const FIRST_PAGE = 10;
const REASON_MAX = 500;
const ROW = "grid grid-cols-[1fr_auto] items-center gap-4 border-t border-stone-custom/10 py-3 first:border-0 sm:grid-cols-[1fr_auto_auto]";

type Outcome = { kind: "revoked" } | { kind: "awarded"; awarded: number; skipped: number };

type BadgeHoldersProps = { badge: AdminBadgeRow; holders: BadgeHolder[]; loadError: boolean };

const holderName = (holder: BadgeHolder) => `${holder.firstName} ${holder.lastName}`.trim() || holder.memberNumber;

/**
 * "Socis que la tenen" (S7.3): active holders with a link to their file and "Retira" (the
 * member file's revoke dialog, optional reason), 10 at a time; former members apart, without
 * a button. "Atorga a socis" opens the bulk award. An archived badge cannot be awarded or revoked.
 */
export default function BadgeHolders({ badge, holders, loadError }: BadgeHoldersProps) {
  const t = useTranslations("admin.badges");
  const locale = useLocale();
  const router = useRouter();
  const archived = Boolean(badge.archived_at);
  const badgeName = localize(badge.name, locale);
  const active = holders.filter((holder) => holder.state === "active");
  const former = holders.filter((holder) => holder.state === "former");

  const [showAll, setShowAll] = useState(false);
  const [awardOpen, setAwardOpen] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [revoking, setRevoking] = useState<BadgeHolder | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ids = { title: useId(), former: useId(), reason: useId() };

  const shown = showAll ? active : active.slice(0, FIRST_PAGE);

  function closeRevoke() {
    if (busy) return;
    setRevoking(null);
    setReason("");
    setError("");
  }

  async function handleRevoke() {
    if (!revoking) return;
    setBusy(true);
    setError("");
    try {
      const result = await revokeBadge(revoking.memberId, badge.key, reason.trim() || null);
      if ("error" in result) {
        setError(t(badgeErrorKey(result.error)));
        return;
      }
      setRevoking(null);
      setReason("");
      setOutcome({ kind: "revoked" });
      router.refresh();
    } catch {
      setError(t("errors.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby={ids.title} className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id={ids.title} className="text-xl font-bold text-stone-custom">
            {t("holder_list.title")}
          </h2>
          <p className="text-[13px] text-stone-custom/65">{t("holder_list.summary", { count: active.length })}</p>
        </div>
        {!archived && (
          <button
            type="button"
            onClick={() => {
              setOutcome(null);
              setAwardOpen(true);
            }}
            className={adminButtonClass("primary", "gap-2")}
          >
            <MdAdd aria-hidden="true" className="size-5" />
            {t("holder_list.award_button")}
          </button>
        )}
      </div>

      {outcome && (
        <div role="status">
          <Notice kind="info">
            {outcome.kind === "revoked" ? (
              <p className="font-bold">{t("holder_list.revoke_done")}</p>
            ) : (
              <p>
                <span className="font-bold">{t("award.done", { count: outcome.awarded })}</span>
                {outcome.skipped > 0 && <span> · {t("award.skipped", { count: outcome.skipped })}</span>}
              </p>
            )}
          </Notice>
        </div>
      )}
      {loadError && (
        <Notice kind="blocked">
          <p>{t("holder_list.load_error")}</p>
        </Notice>
      )}

      {active.length === 0 && !loadError ? (
        <p className="text-sm text-stone-custom/65">{t("holder_list.none")}</p>
      ) : (
        <ul className="flex flex-col">
          {shown.map((holder) => {
            const name = holderName(holder);
            const date = formatAdminTimestamp(holder.awardedAt);
            return (
              <li key={holder.memberId} className={ROW}>
                <div className="flex min-w-0 flex-col">
                  <Link
                    href={`/admin/members/${holder.memberNumber}`}
                    className="font-semibold break-words text-stone-custom underline-offset-2 hover:underline"
                  >
                    {name}
                  </Link>
                  <span className="text-[13px] text-stone-custom/65 tabular-nums">{holder.memberNumber}</span>
                </div>
                {date && (
                  <span className="text-[13px] text-stone-custom/65 max-sm:hidden">
                    {t("holder_list.awarded_on", { date })}
                  </span>
                )}
                {!archived ? (
                  <button
                    type="button"
                    onClick={() => {
                      setOutcome(null);
                      setRevoking(holder);
                    }}
                    aria-label={t("holder_list.revoke_aria", { name })}
                    className={adminButtonClass("secondary", "text-brand-red")}
                  >
                    {t("holder_list.revoke")}
                  </button>
                ) : (
                  <span />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!showAll && active.length > FIRST_PAGE && (
        <button type="button" onClick={() => setShowAll(true)} className={adminButtonClass("secondary", "self-start")}>
          {t("holder_list.show_more", { count: active.length - FIRST_PAGE })}
        </button>
      )}

      {former.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-stone-custom/10 pt-4">
          <h3 id={ids.former} className="text-base font-bold text-stone-custom">
            {t("holder_list.former_title")}
          </h3>
          <ul aria-labelledby={ids.former} className="flex flex-col">
            {former.map((holder) => (
              <li key={holder.memberId} className="flex flex-col border-t border-stone-custom/10 py-2.5 first:border-0">
                <Link
                  href={`/admin/members/${holder.memberNumber}`}
                  className="font-semibold text-stone-custom/75 underline-offset-2 hover:underline"
                >
                  {holderName(holder)}
                </Link>
                <span className="text-[13px] text-stone-custom/65 tabular-nums">{holder.memberNumber}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <BulkAwardDialog
        open={awardOpen}
        onClose={() => setAwardOpen(false)}
        onDone={(awarded, skipped) => {
          setAwardOpen(false);
          setOutcome({ kind: "awarded", awarded, skipped });
        }}
        badgeKey={badge.key}
        badgeName={badgeName}
      />

      <AdminDialog
        open={revoking !== null}
        onClose={closeRevoke}
        onConfirm={handleRevoke}
        title={t("holder_list.revoke_title", { badge: badgeName })}
        variant="danger"
        confirmLabel={busy ? t("holder_list.revoke_saving") : t("holder_list.revoke_confirm")}
        busy={busy}
        error={error || undefined}
      >
        {revoking && (
          <p className="text-sm text-stone-custom">
            {t("holder_list.revoke_text", { name: holderName(revoking), number: revoking.memberNumber })}
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.reason} className="text-sm font-semibold text-stone-custom">
            {t("holder_list.reason_label")}
          </label>
          <textarea
            id={ids.reason}
            rows={2}
            maxLength={REASON_MAX}
            disabled={busy}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={TEXTAREA_CLASS}
          />
          <p className="text-[13px] text-stone-custom/65">{t("holder_list.reason_help")}</p>
        </div>
      </AdminDialog>
    </section>
  );
}
