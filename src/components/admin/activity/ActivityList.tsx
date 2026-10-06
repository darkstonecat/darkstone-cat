import { useTranslations } from "next-intl";
import { MdChevronRight } from "react-icons/md";
import { Link } from "@/i18n/routing";
import { buildActivityHref, hasActivityFilters, type ActivityQuery } from "@/lib/admin/activity";
import type { AdminActivityRow } from "@/lib/admin/audit-format";
import Notice from "../Notice";
import { adminButtonClass } from "../adminButtons";
import { AuditActorLabel, AuditTimeLabel, useAuditLines } from "./AuditParts";

type ActivityListProps = {
  rows: AdminActivityRow[];
  total: number;
  hasMore: boolean;
  query: ActivityQuery;
  now?: Date;
};

function Row({ entry, now }: { entry: AdminActivityRow; now?: Date }) {
  const { actor, sentence, detail } = useAuditLines(entry);
  return (
    <>
      <td className="px-4 py-3.5 align-top text-[13px] whitespace-nowrap text-stone-custom/65">
        <AuditTimeLabel iso={entry.created_at} now={now} />
      </td>
      <td className="px-4 py-3.5 align-top text-sm text-stone-custom">
        <AuditActorLabel actor={actor} />
      </td>
      <td className="px-4 py-3.5 align-top text-[15px] text-stone-custom">
        <span className="block first-letter:uppercase">{sentence}</span>
      </td>
      <td className="px-4 py-3.5 align-top text-[13px] break-words text-stone-custom/65">{detail}</td>
    </>
  );
}

function MobileEntry({ entry, now }: { entry: AdminActivityRow; now?: Date }) {
  const { actor, sentence, detail } = useAuditLines(entry);
  return (
    <li className="flex flex-col gap-1.5 rounded-2xl bg-brand-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-stone-custom/65">
        <AuditTimeLabel iso={entry.created_at} now={now} />
        <span className="flex items-center gap-2 text-stone-custom">
          <AuditActorLabel actor={actor} withChip={false} />
        </span>
      </div>
      <p className="text-[15px] text-stone-custom first-letter:uppercase">{sentence}</p>
      {detail && <p className="text-[13px] break-words text-stone-custom/65">{detail}</p>}
    </li>
  );
}

/** Entries of `admin_list_activity`: table from `md`, cards below, count and keyset pager. */
export default function ActivityList({ rows, total, hasMore, query, now }: ActivityListProps) {
  const t = useTranslations("admin.activity");

  if (rows.length === 0) {
    return (
      <div role="status" className="rounded-2xl bg-brand-white p-8 text-center text-stone-custom/75">
        {hasActivityFilters(query) || query.before !== null ? t("empty_filtered") : t("empty")}
        {query.before !== null && (
          <p className="mt-3">
            <Link href={buildActivityHref(query, { before: null })} className={adminButtonClass("secondary")}>
              {t("back_to_newest")}
            </Link>
          </p>
        )}
      </div>
    );
  }

  return (
    <section aria-labelledby="activity-entries" className="rounded-2xl bg-brand-white p-5 max-md:bg-transparent max-md:p-0 md:p-8">
      <div className="flex items-baseline justify-between gap-3 max-md:px-1">
        <h2 id="activity-entries" className="text-[22px] font-bold text-stone-custom">
          {t("entries_title")}
        </h2>
        <p className="text-sm text-stone-custom/65">{t("entries_count", { count: total })}</p>
      </div>

      <table className="mt-5 hidden w-full table-fixed text-left md:table">
        <caption className="sr-only">{t("caption")}</caption>
        <thead>
          <tr className="border-b border-stone-custom/15 text-[13px] font-semibold text-stone-custom/65">
            <th scope="col" className="w-[130px] px-4 py-3">
              {t("col_date")}
            </th>
            <th scope="col" className="w-[210px] px-4 py-3">
              {t("col_actor")}
            </th>
            <th scope="col" className="px-4 py-3">
              {t("col_action")}
            </th>
            <th scope="col" className="w-[270px] px-4 py-3">
              {t("col_details")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((entry) => (
            <tr key={entry.id} className="border-b border-stone-custom/8 last:border-0">
              <Row entry={entry} now={now} />
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="mt-4 flex flex-col gap-3 md:hidden">
        {rows.map((entry) => (
          <MobileEntry key={entry.id} entry={entry} now={now} />
        ))}
      </ul>

      <nav aria-label={t("pagination_label")} className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-custom/70">{t("showing", { count: rows.length, total })}</p>
        <div className="flex gap-2">
          {query.before !== null && (
            <Link href={buildActivityHref(query, { before: null })} className={adminButtonClass("secondary")}>
              {t("back_to_newest")}
            </Link>
          )}
          {hasMore && (
            <Link
              href={buildActivityHref(query, { before: rows[rows.length - 1].id })}
              rel="next"
              className={adminButtonClass("primary", "gap-1")}
            >
              {t("load_more")}
              <MdChevronRight aria-hidden="true" className="size-5" />
            </Link>
          )}
        </div>
      </nav>
    </section>
  );
}

/** The log could not be loaded: blocked notice and a link that retries the same view. */
export function ActivityLoadError({ query }: { query: ActivityQuery }) {
  const t = useTranslations("admin.activity");
  return (
    <div className="flex flex-col items-start gap-4">
      <Notice kind="blocked">{t("error")}</Notice>
      <Link href={buildActivityHref(query)} className={adminButtonClass("secondary")}>
        {t("retry")}
      </Link>
    </div>
  );
}
