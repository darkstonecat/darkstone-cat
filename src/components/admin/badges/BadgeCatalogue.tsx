"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MdAdd } from "react-icons/md";
import { Link, useRouter } from "@/i18n/routing";
import type { AdminBadgeRow } from "@/lib/admin/badges";
import { formatAdminTimestamp } from "@/lib/admin/member-file";
import { localize } from "@/lib/badges/catalogue";
import Notice from "../Notice";
import ReasonButton from "../ReasonButton";
import { adminButtonClass } from "../adminButtons";
import BadgeCircle from "./BadgeCircle";
import BadgeStateDialog, { type BadgeStateAction } from "./BadgeStateDialog";
import CreateBadgeDialog from "./CreateBadgeDialog";
import { CARD, CHIP, META, badgeLanguages } from "./shared";

type BadgeCatalogueProps = {
  /** Every badge of `admin_list_badges` (archived ones included), in display order. */
  badges: AdminBadgeRow[];
  /** Superadmins can delete a badge that was never awarded. */
  isSuperadmin: boolean;
  loadError?: boolean;
};

const ROW =
  "grid grid-cols-[auto_1fr] items-center gap-4 border-t border-stone-custom/10 py-4 first:border-0 first:pt-0 sm:grid-cols-[auto_1fr_auto]";
const ACTIONS = "col-span-2 flex flex-wrap items-start gap-2 sm:col-span-1 sm:justify-end";

/**
 * `/admin/badges` (S7.2): active badges in the order members see them, with the derived tenure
 * badge first, then the archived ones, and the "Com funcionen" side card.
 */
export default function BadgeCatalogue({ badges, isSuperadmin, loadError = false }: BadgeCatalogueProps) {
  const t = useTranslations("admin.badges");
  const locale = useLocale();
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [pending, setPending] = useState<{ action: BadgeStateAction; badge: AdminBadgeRow } | null>(null);
  const [outcome, setOutcome] = useState<BadgeStateAction | null>(null);

  // Display order as members see it (the function already sorts; kept stable here).
  const sorted = [...badges].sort((a, b) => a.sort_order - b.sort_order || a.key.localeCompare(b.key));
  const active = sorted.filter((badge) => !badge.archived_at);
  const archived = sorted.filter((badge) => badge.archived_at);

  function open(action: BadgeStateAction, badge: AdminBadgeRow) {
    setOutcome(null);
    setPending({ action, badge });
  }

  function languages(badge: AdminBadgeRow) {
    const present = badgeLanguages(badge);
    return present.length === 1 && present[0] === "ca" ? t("only_ca") : present.join(" · ");
  }

  function deleteBlock(badge: AdminBadgeRow) {
    if (!isSuperadmin) return t("delete_blocked_role");
    return badge.ever_awarded ? t("delete_blocked_awarded") : "";
  }

  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-6 px-4 pt-10 pb-16 sm:px-6 md:pt-16">
      {outcome && (
        <div role="status">
          <Notice kind="info">
            <p className="font-bold">{t(`${outcome}_done`)}</p>
          </Notice>
        </div>
      )}
      {loadError && (
        <Notice kind="blocked">
          <p>{t("load_error")}</p>
        </Notice>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <section aria-labelledby="badges-active" className={CARD}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="badges-active" className="text-xl font-bold text-stone-custom">
                  {t("active_title")}
                </h2>
                <p className="text-[13px] text-stone-custom/65">{t("active_summary", { count: active.length })}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOutcome(null);
                  setCreateOpen(true);
                }}
                className={adminButtonClass("primary", "gap-2")}
              >
                <MdAdd aria-hidden="true" className="size-5" />
                {t("new_button")}
              </button>
            </div>

            <ul className="flex flex-col">
              <li className={ROW}>
                <BadgeCircle icon="star" look="auto" />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-bold text-stone-custom">
                    {t("tenure_name")}
                    <span className={`${CHIP} bg-stone-custom/7 text-stone-custom/80`}>{t("automatic")}</span>
                  </p>
                  <p className="text-[13px] text-stone-custom/65">{t("tenure_text")}</p>
                </div>
              </li>
              {active.map((badge) => {
                const name = localize(badge.name, locale);
                return (
                  <li key={badge.key} className={ROW}>
                    <BadgeCircle icon={badge.icon} />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-bold text-stone-custom">
                        <Link href={`/admin/badges/${badge.key}`} className="hover:underline">
                          {name}
                        </Link>
                        {!badge.show_locked && (
                          <span className={`${CHIP} bg-brand-orange/12 text-brand-orange-text`}>{t("hidden_chip")}</span>
                        )}
                      </p>
                      <p className="text-[13px] text-stone-custom/65">{localize(badge.earned_text, locale)}</p>
                      <p className={`${META} mt-1`}>
                        <span>{t("holders_count", { count: badge.active_holders })}</span>
                        {badge.show_locked && <span>{t("show_locked_on")}</span>}
                        <span>{languages(badge)}</span>
                      </p>
                    </div>
                    <div className={ACTIONS}>
                      <Link
                        href={`/admin/badges/${badge.key}`}
                        aria-label={t("manage_aria", { name })}
                        className={adminButtonClass("secondary")}
                      >
                        {t("manage")}
                      </Link>
                      <button
                        type="button"
                        onClick={() => open("archive", badge)}
                        aria-label={t("archive_aria", { name })}
                        className={adminButtonClass("secondary", "text-brand-red")}
                      >
                        {t("archive")}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            {active.length === 0 && !loadError && (
              <p className="text-sm text-stone-custom/65">{t("none_active")}</p>
            )}
          </section>

          {archived.length > 0 && (
            <section aria-labelledby="badges-archived" className={CARD}>
              <div>
                <h2 id="badges-archived" className="text-xl font-bold text-stone-custom">
                  {t("archived_title")}
                </h2>
                <p className="text-[13px] text-stone-custom/65">{t("archived_intro")}</p>
              </div>
              <ul className="flex flex-col">
                {archived.map((badge) => {
                  const name = localize(badge.name, locale);
                  const date = formatAdminTimestamp(badge.archived_at);
                  const block = deleteBlock(badge);
                  return (
                    <li key={badge.key} className={ROW}>
                      <BadgeCircle icon={badge.icon} className="opacity-55" />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-bold text-stone-custom/55">
                          <Link href={`/admin/badges/${badge.key}`} className="hover:underline">
                            {name}
                          </Link>
                          <span className={`${CHIP} bg-stone-custom/7 text-stone-custom/80`}>{t("archived_chip")}</span>
                        </p>
                        <p className="text-[13px] text-stone-custom/50">{localize(badge.earned_text, locale)}</p>
                        <p className={`${META} mt-1`}>
                          <span>{t("held_before", { count: badge.holders })}</span>
                          {date && <span>{t("archived_on", { date })}</span>}
                        </p>
                      </div>
                      <div className={ACTIONS}>
                        <button
                          type="button"
                          onClick={() => open("restore", badge)}
                          aria-label={t("restore_aria", { name })}
                          className={adminButtonClass("secondary")}
                        >
                          {t("restore")}
                        </button>
                        <ReasonButton
                          variant="secondary"
                          reason={block}
                          disabled={block !== ""}
                          onClick={() => open("delete", badge)}
                          aria-label={t("delete_aria", { name })}
                          className="text-brand-red"
                        >
                          {t("delete")}
                        </ReasonButton>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="text-[13px] text-stone-custom/65">{t("delete_hint")}</p>
            </section>
          )}
        </div>

        <aside aria-labelledby="badges-how" className={CARD}>
          <h2 id="badges-how" className="text-xl font-bold text-stone-custom">
            {t("how_title")}
          </h2>
          <dl className="flex flex-col text-sm">
            {(["award", "archive", "delete"] as const).map((item) => (
              <div key={item} className="flex flex-col gap-1 border-t border-stone-custom/10 py-3 first:border-0 first:pt-0">
                <dt className="text-[15px] font-bold text-stone-custom">{t(`how_${item}_title`)}</dt>
                <dd className="text-stone-custom/65">{t(`how_${item}_text`)}</dd>
              </div>
            ))}
          </dl>
          <Notice kind="info">
            <p>{t("how_notice")}</p>
          </Notice>
        </aside>
      </div>

      <CreateBadgeDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <BadgeStateDialog
        pending={pending}
        onClose={() => setPending(null)}
        onDone={(action) => {
          setPending(null);
          setOutcome(action);
          router.refresh();
        }}
      />
    </div>
  );
}
