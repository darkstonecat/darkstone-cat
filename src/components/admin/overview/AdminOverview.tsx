import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { MdArrowForward, MdBuild, MdDownload, MdMenuBook, MdSearch } from "react-icons/md";
import { Link } from "@/i18n/routing";
import type { AdminActivityRow } from "@/lib/admin/audit-format";
import { newsletterPercent, type AdminStatsRow } from "@/lib/admin/stats";
import Notice from "../Notice";
import { AuditActorLabel, AuditTimeLabel, useAuditLines } from "../activity/AuditParts";

const CARD = "rounded-2xl bg-brand-white";

type StatCardProps = { label: string; value: number; hint: string };

function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className={`${CARD} flex flex-col gap-1.5 px-7 py-6`}>
      <p className="text-sm font-semibold text-stone-custom/80">{label}</p>
      <p className="text-[44px] leading-[1.1] font-bold tracking-tight text-stone-custom">{value}</p>
      <p className="text-[13px] text-stone-custom/65">{hint}</p>
    </div>
  );
}

/** Six figures of V-1, in the spec's order. Cards are not links. */
export function OverviewStats({ stats }: { stats: AdminStatsRow }) {
  const t = useTranslations("admin.overview");
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard label={t("stat_active")} value={stats.active_members} hint={t("stat_active_hint")} />
      <StatCard label={t("stat_joined")} value={stats.joined_this_month} hint={t("stat_joined_hint")} />
      <StatCard
        label={t("stat_left")}
        value={stats.left_this_month}
        hint={t("stat_left_hint", { self: stats.left_this_month_self, board: stats.left_this_month_board })}
      />
      <StatCard label={t("stat_rejoined")} value={stats.rejoined_this_year} hint={t("stat_rejoined_hint")} />
      <StatCard
        label={t("stat_newsletter")}
        value={stats.newsletter_members}
        hint={t("stat_newsletter_hint", { percent: newsletterPercent(stats) })}
      />
      <StatCard
        label={t("stat_board")}
        value={stats.board_members}
        hint={t("stat_board_hint", { count: stats.superadmins })}
      />
    </div>
  );
}

function RecentEntry({ entry, now }: { entry: AdminActivityRow; now?: Date }) {
  const { actor, sentence, detail } = useAuditLines(entry);
  return (
    <li className="grid grid-cols-1 gap-1 border-t border-stone-custom/8 py-3.5 first:border-0 sm:grid-cols-[112px_1fr] sm:gap-4">
      <span className="text-[13px] text-stone-custom/65">
        <AuditTimeLabel iso={entry.created_at} now={now} />
      </span>
      <div className="min-w-0">
        <p className="text-[15px] text-stone-custom">
          <AuditActorLabel actor={actor} withChip={false} /> {sentence}
        </p>
        {detail && <p className="text-[13px] break-words text-stone-custom/65">{detail}</p>}
      </div>
    </li>
  );
}

/** "Activitat recent": the latest entries, an empty message or an error notice. `rows` null = failed. */
export function RecentActivity({ rows, now }: { rows: AdminActivityRow[] | null; now?: Date }) {
  const t = useTranslations("admin.overview");
  return (
    <section aria-labelledby="overview-activity" className={`${CARD} flex flex-col gap-5 p-5 md:p-8`}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="overview-activity" className="text-[22px] font-bold text-stone-custom">
          {t("activity_title")}
        </h2>
        <Link
          href="/admin/activity"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-orange-text"
        >
          {t("activity_all")}
          <MdArrowForward aria-hidden="true" className="size-5" />
        </Link>
      </div>
      {rows === null ? (
        <Notice kind="blocked">{t("activity_error")}</Notice>
      ) : rows.length === 0 ? (
        <p role="status" className="text-sm text-stone-custom/65">
          {t("activity_empty")}
        </p>
      ) : (
        <ol className="flex flex-col">
          {rows.map((entry) => (
            <RecentEntry key={entry.id} entry={entry} now={now} />
          ))}
        </ol>
      )}
    </section>
  );
}

function Shortcut({ href, icon, title, text }: { href: string; icon: ReactNode; title: string; text: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-16 items-center gap-3.5 rounded-xl bg-brand-white/6 px-4 py-3 transition-colors hover:bg-brand-white/12 focus-visible:outline-2 focus-visible:outline-brand-orange-light"
    >
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-white/10 text-xl">
        {icon}
      </span>
      <span className="flex flex-col">
        <span className="text-[15px] font-semibold">{title}</span>
        <span className="text-[13px] text-brand-white/65">{text}</span>
      </span>
    </Link>
  );
}

/** "Dreceres": four real links, 44 px or more. */
export function OverviewShortcuts() {
  const t = useTranslations("admin.overview");
  return (
    <aside aria-labelledby="overview-shortcuts" className="flex flex-col gap-4 rounded-2xl bg-stone-custom p-5 text-brand-white md:p-8">
      <h2 id="overview-shortcuts" className="text-[22px] font-bold">
        {t("shortcuts_title")}
      </h2>
      <Shortcut href="/admin/members" icon={<MdSearch />} title={t("shortcut_members")} text={t("shortcut_members_text")} />
      <Shortcut href="/admin/members" icon={<MdDownload />} title={t("shortcut_export")} text={t("shortcut_export_text")} />
      <Shortcut href="/admin/tools" icon={<MdBuild />} title={t("shortcut_tools")} text={t("shortcut_tools_text")} />
      <Shortcut href="/admin/procedures" icon={<MdMenuBook />} title={t("shortcut_procedures")} text={t("shortcut_procedures_text")} />
    </aside>
  );
}

type AdminOverviewProps = {
  /** Null when `admin_stats` failed. */
  stats: AdminStatsRow | null;
  /** Null when `admin_list_activity` failed. */
  activity: AdminActivityRow[] | null;
  now?: Date;
};

/** V-1: figures, then recent activity next to the shortcuts (shortcuts first on mobile). */
export default function AdminOverview({ stats, activity, now }: AdminOverviewProps) {
  const t = useTranslations("admin.overview");
  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-6 px-4 pt-10 sm:px-6 md:pt-16">
      <section aria-labelledby="overview-figures" className="flex flex-col gap-4">
        <h2 id="overview-figures" className="text-xs font-bold tracking-[0.2em] text-brand-orange-text uppercase">
          {t("figures_title")}
        </h2>
        {stats ? (
          <OverviewStats stats={stats} />
        ) : (
          <div className="flex flex-col items-start gap-4">
            <Notice kind="blocked">{t("stats_error")}</Notice>
            <Link href="/admin" className="inline-flex min-h-11 items-center rounded-xl border border-stone-custom/15 bg-brand-white px-5 text-sm font-semibold text-stone-custom">
              {t("retry")}
            </Link>
          </div>
        )}
      </section>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="order-2 lg:order-1">
          <RecentActivity rows={activity} now={now} />
        </div>
        <div className="order-1 lg:order-2">
          <OverviewShortcuts />
        </div>
      </div>
    </div>
  );
}
