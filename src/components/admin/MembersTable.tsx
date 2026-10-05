"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { MdSearch, MdFileDownload, MdArrowUpward, MdArrowDownward } from "react-icons/md";
import ExportConfirmDialog from "./ExportConfirmDialog";
import { cn } from "@/lib/utils";
import { isBoardRole, isSuperadmin, roleLabelKey, roleRank, type Role } from "@/lib/auth/roles";

export type MemberRow = {
  memberNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneMasked: string | null;
  dniMasked: string | null;
  postalCode: string | null;
  role: Role;
  membershipStartDate: string | null;
};

type SortColumn = "memberNumber" | "name" | "email" | "role" | "membershipStartDate";
type SortDirection = "asc" | "desc";

const PAGE_SIZE = 15;

// Role chips (docs/mockups/admin-panel/README.md): "Junta" orange, "Superadmin" dark.
function roleChipClass(role: Role): string {
  return isSuperadmin(role)
    ? "bg-stone-custom text-brand-white"
    : "bg-brand-orange/10 text-brand-orange-text";
}

type MembersTableProps = {
  members: MemberRow[];
};

export default function MembersTable({ members }: MembersTableProps) {
  const t = useTranslations("admin");
  const [search, setSearch] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("memberNumber");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [exportOpen, setExportOpen] = useState(false);

  // Filter
  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(
      (m) =>
        m.firstName.toLowerCase().includes(q) ||
        m.lastName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.memberNumber.toLowerCase().includes(q),
    );
  }, [members, search]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case "memberNumber":
          cmp = a.memberNumber.localeCompare(b.memberNumber, undefined, { numeric: true });
          break;
        case "name":
          cmp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
          break;
        case "email":
          cmp = a.email.localeCompare(b.email);
          break;
        case "role":
          cmp = (roleRank(a.role) ?? 0) - (roleRank(b.role) ?? 0);
          break;
        case "membershipStartDate": {
          const da = a.membershipStartDate ?? "";
          const db = b.membershipStartDate ?? "";
          cmp = da.localeCompare(db);
          break;
        }
      }
      return sortDirection === "desc" ? -cmp : cmp;
    });
    return arr;
  }, [filtered, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  function handleSort(col: SortColumn) {
    if (sortColumn === col) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
    setPage(1);
  }

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function renderSortIcon(col: SortColumn) {
    if (sortColumn !== col) return null;
    return sortDirection === "asc" ? (
      <MdArrowUpward className="inline text-sm" />
    ) : (
      <MdArrowDownward className="inline text-sm" />
    );
  }

  function renderSortableTh(col: SortColumn, label: string) {
    return (
      <th
        key={col}
        className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left text-sm font-semibold text-stone-custom/70 transition-colors hover:text-stone-custom"
        onClick={() => handleSort(col)}
      >
        {label} {renderSortIcon(col)}
      </th>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Toolbar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-stone-custom/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={t("members_search_placeholder")}
            className="w-full rounded-xl border border-stone-custom/15 bg-brand-white py-3 pl-11 pr-4 text-stone-custom placeholder:text-stone-custom/50 outline-none transition-colors focus:border-brand-orange focus-visible:outline-2 focus-visible:outline-brand-orange focus-visible:outline-offset-2"
          />
        </div>
        <button
          onClick={() => setExportOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-stone-custom px-5 py-3 text-sm font-semibold text-brand-white transition-colors hover:bg-stone-custom/80"
        >
          <MdFileDownload className="text-lg" />
          {t("export_button")}
        </button>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-2xl border border-stone-custom/10 bg-brand-white md:block">
        <table className="w-full">
          <thead className="border-b border-stone-custom/10">
            <tr>
              {renderSortableTh("memberNumber", t("col_number"))}
              {renderSortableTh("name", t("col_name"))}
              {renderSortableTh("email", t("col_email"))}
              <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-semibold text-stone-custom/70">{t("col_phone")}</th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-semibold text-stone-custom/70">{t("col_dni")}</th>
              {renderSortableTh("role", t("col_role"))}
              {renderSortableTh("membershipStartDate", t("col_since"))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-stone-custom/50">
                  {t("members_no_results")}
                </td>
              </tr>
            ) : (
              paged.map((m) => (
                <tr key={m.memberNumber} className="border-b border-stone-custom/5 last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-stone-custom">{m.memberNumber}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-stone-custom">{m.firstName} {m.lastName}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-stone-custom/80">{m.email}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-stone-custom/60">{m.phoneMasked ?? t("not_provided")}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-stone-custom/60">{m.dniMasked ?? t("not_provided")}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    {isBoardRole(m.role) ? (
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", roleChipClass(m.role))}>{t(roleLabelKey(m.role))}</span>
                    ) : (
                      <span className="text-stone-custom/70">{t("role_member")}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-stone-custom/60">{m.membershipStartDate ?? t("not_provided")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {paged.length === 0 ? (
          <div className="rounded-2xl border border-stone-custom/10 bg-brand-white p-6 text-center text-stone-custom/50">
            {t("members_no_results")}
          </div>
        ) : (
          paged.map((m) => (
            <div key={m.memberNumber} className="rounded-2xl border border-stone-custom/10 bg-brand-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-stone-custom">#{m.memberNumber}</span>
                <div className="flex items-center gap-2">
                  {isBoardRole(m.role) && (
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", roleChipClass(m.role))}>{t(roleLabelKey(m.role))}</span>
                  )}
                </div>
              </div>
              <p className="font-semibold text-stone-custom">{m.firstName} {m.lastName}</p>
              <p className="mt-0.5 text-sm text-stone-custom/70">{m.email}</p>
              {(m.phoneMasked || m.dniMasked) && (
                <div className="mt-2 flex gap-4 text-xs text-stone-custom/50">
                  {m.phoneMasked && <span>{t("col_phone")}: {m.phoneMasked}</span>}
                  {m.dniMasked && <span>{t("col_dni")}: {m.dniMasked}</span>}
                </div>
              )}
              {m.membershipStartDate && (
                <p className="mt-1 text-xs text-stone-custom/50">{t("col_since")}: {m.membershipStartDate}</p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {sorted.length > PAGE_SIZE && (
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-between" aria-live="polite">
          <p className="text-sm text-stone-custom/60">
            {t("members_showing", {
              from: start + 1,
              to: Math.min(start + PAGE_SIZE, sorted.length),
              total: sorted.length,
            })}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="rounded-lg px-3 py-1.5 text-sm text-stone-custom transition-colors hover:bg-stone-custom/5 disabled:opacity-30 disabled:pointer-events-none"
              aria-label="Previous page"
            >
              &laquo;
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  n === safePage
                    ? "bg-stone-custom text-brand-white"
                    : "text-stone-custom hover:bg-stone-custom/5"
                }`}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="rounded-lg px-3 py-1.5 text-sm text-stone-custom transition-colors hover:bg-stone-custom/5 disabled:opacity-30 disabled:pointer-events-none"
              aria-label="Next page"
            >
              &raquo;
            </button>
          </div>
        </div>
      )}

      <ExportConfirmDialog open={exportOpen} onClose={() => setExportOpen(false)} />
    </motion.div>
  );
}
