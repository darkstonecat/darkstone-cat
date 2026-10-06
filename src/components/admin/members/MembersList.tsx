import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { MdArrowDownward, MdArrowUpward, MdChevronLeft, MdChevronRight } from "react-icons/md";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { isSuperadmin, isBoardRole } from "@/lib/auth/roles";
import {
  buildMembersHref,
  formatAdminDate,
  nextSort,
  sortDirectionOf,
  type AdminMemberListRow,
  type MemberSortColumn,
  type MembersQuery,
} from "@/lib/admin/members-list";
import { listParamFor } from "@/lib/admin/member-file";
import Notice from "../Notice";
import StatusChip from "../StatusChip";
import { adminButtonClass } from "../adminButtons";

const NO_VALUE = "—";

/** Member file link; a non-default list view travels in `?list=` so "back" returns to it. */
function memberHref(row: AdminMemberListRow, query: MembersQuery) {
  const base = `/admin/members/${encodeURIComponent(row.member_number)}`;
  const list = listParamFor(query);
  return list ? `${base}?list=${encodeURIComponent(list)}` : base;
}

function fullName(row: AdminMemberListRow) {
  return `${row.first_name} ${row.last_name}`.trim();
}

function StateChip({ row }: { row: AdminMemberListRow }) {
  const t = useTranslations("admin.members");
  if (row.state === "active") return <StatusChip kind="active" />;
  const date = formatAdminDate(row.left_on);
  return <StatusChip kind="left" label={date ? t("left_since", { date }) : undefined} />;
}

/** Board and superadmin get a chip; a plain member is just text (README §4). */
function RoleCell({ role }: { role: string }) {
  const t = useTranslations("admin");
  if (isSuperadmin(role)) return <StatusChip kind="superadmin" />;
  if (isBoardRole(role)) return <StatusChip kind="board" />;
  return <span className="text-sm text-stone-custom/70">{t("role_member")}</span>;
}

type MembersListProps = {
  rows: AdminMemberListRow[];
  total: number;
  query: MembersQuery;
};

/** Result of `admin_list_members`: table from `md`, cards below, count and pager, empty state. */
export default function MembersList({ rows, total, query }: MembersListProps) {
  const t = useTranslations("admin.members");

  if (rows.length === 0) {
    return (
      <div role="status" className="rounded-2xl bg-brand-white p-8 text-center text-stone-custom/75">
        {t("empty")}
      </div>
    );
  }

  const from = (query.page - 1) * query.pp + 1;
  const to = from + rows.length - 1;
  const hasPrev = query.page > 1;
  const hasNext = to < total;

  return (
    <section aria-labelledby="members-list-title" className="overflow-hidden rounded-2xl bg-brand-white">
      <h2 id="members-list-title" className="sr-only">
        {t("list_label")}
      </h2>

      <table className="hidden w-full text-left md:table">
        <thead className="border-b border-stone-custom/10 text-sm text-stone-custom/70">
          <tr>
            <SortHeader column="number" query={query} label={t("col_number")} className="w-[100px]" />
            <SortHeader column="name" query={query} label={t("col_name")} />
            <th scope="col" className="px-4 py-3 font-semibold">
              {t("col_email")}
            </th>
            <th scope="col" className="w-[190px] px-4 py-3 font-semibold">
              {t("col_state")}
            </th>
            <th scope="col" className="w-[110px] px-4 py-3 font-semibold">
              {t("col_role")}
            </th>
            <SortHeader column="joined" query={query} label={t("col_joined")} className="w-[110px]" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="relative border-b border-stone-custom/5 last:border-0 hover:bg-stone-custom/3"
            >
              <td className="px-4 py-3 font-mono text-[13px] text-stone-custom/65">
                <Link
                  href={memberHref(row, query)}
                  className="rounded after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-brand-orange"
                >
                  {row.member_number}
                </Link>
              </td>
              <td className="px-4 py-3 text-sm font-bold text-stone-custom">{fullName(row)}</td>
              <td className="px-4 py-3 text-sm text-stone-custom/80">{row.email ?? NO_VALUE}</td>
              <td className="px-4 py-3">
                <StateChip row={row} />
              </td>
              <td className="px-4 py-3">
                <RoleCell role={row.role} />
              </td>
              <td className="px-4 py-3 text-sm text-stone-custom/70">
                {formatAdminDate(row.current_joined_on) ?? NO_VALUE}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="flex flex-col gap-3 bg-brand-beige p-0 md:hidden">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={memberHref(row, query)}
              className="flex min-h-11 items-center gap-3 rounded-2xl bg-brand-white p-4 focus-visible:outline-2 focus-visible:outline-brand-orange"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-bold text-stone-custom">{fullName(row)}</span>
                  <span className="font-mono text-[13px] text-stone-custom/65">{row.member_number}</span>
                </div>
                <span className="truncate text-sm text-stone-custom/70">{row.email ?? NO_VALUE}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <StateChip row={row} />
                  <RoleCell role={row.role} />
                </div>
                <span className="text-xs text-stone-custom/65">
                  {t("joined_label", { date: formatAdminDate(row.current_joined_on) ?? NO_VALUE })}
                </span>
              </div>
              <MdChevronRight aria-hidden="true" className="size-6 shrink-0 text-stone-custom/40" />
            </Link>
          </li>
        ))}
      </ul>

      <nav
        aria-label={t("pagination_label")}
        className="flex items-center justify-between gap-3 border-t border-stone-custom/10 px-4 py-3 max-md:border-0 max-md:bg-brand-beige max-md:pb-0"
      >
        <p className="text-sm text-stone-custom/70">{t("showing", { from, to, total })}</p>
        <div className="flex gap-2">
          <PagerLink href={hasPrev ? buildMembersHref(query, { page: query.page - 1 }) : null} label={t("prev")}>
            <MdChevronLeft aria-hidden="true" className="size-6" />
          </PagerLink>
          <PagerLink href={hasNext ? buildMembersHref(query, { page: query.page + 1 }) : null} label={t("next")}>
            <MdChevronRight aria-hidden="true" className="size-6" />
          </PagerLink>
        </div>
      </nav>
    </section>
  );
}

function SortHeader({
  column,
  query,
  label,
  className,
}: {
  column: MemberSortColumn;
  query: MembersQuery;
  label: string;
  className?: string;
}) {
  const direction = sortDirectionOf(query.sort, column);
  return (
    <th scope="col" aria-sort={direction} className={cn("px-4 py-3 font-semibold", className)}>
      <Link
        href={buildMembersHref(query, { sort: nextSort(query.sort, column), page: 1 })}
        className="inline-flex min-h-11 items-center gap-1 rounded hover:text-stone-custom focus-visible:outline-2 focus-visible:outline-brand-orange"
      >
        {label}
        {direction === "ascending" && <MdArrowUpward aria-hidden="true" className="size-4" />}
        {direction === "descending" && <MdArrowDownward aria-hidden="true" className="size-4" />}
      </Link>
    </th>
  );
}

const PAGER_CLASS = "flex size-11 items-center justify-center rounded-xl border border-stone-custom/15 text-stone-custom";

function PagerLink({ href, label, children }: { href: string | null; label: string; children: ReactNode }) {
  if (!href) {
    return (
      <span aria-label={label} aria-disabled="true" role="link" className={cn(PAGER_CLASS, "opacity-40")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className={cn(PAGER_CLASS, "hover:bg-stone-custom/5")}>
      {children}
    </Link>
  );
}

/** The list could not be loaded: blocked notice and a link that retries the same view. */
export function MembersLoadError({ query }: { query: MembersQuery }) {
  const t = useTranslations("admin.members");
  return (
    <div className="flex flex-col items-start gap-4">
      <Notice kind="blocked">{t("error")}</Notice>
      <Link href={buildMembersHref(query)} className={adminButtonClass("secondary")}>
        {t("retry")}
      </Link>
    </div>
  );
}
