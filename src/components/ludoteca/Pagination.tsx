"use client";

import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  itemsPerPageOptions: number[];
  totalItems: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (n: number) => void;
}

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "...")[] = [1];

  if (current > 3) pages.push("...");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push("...");

  pages.push(total);
  return pages;
}

export default function Pagination({
  currentPage,
  totalPages,
  itemsPerPage,
  itemsPerPageOptions,
  totalItems,
  onPageChange,
  onItemsPerPageChange,
}: PaginationProps) {
  const t = useTranslations("ludoteca");
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const pages = getPageNumbers(currentPage, totalPages);

  const btnBase =
    "flex h-9 min-w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors";

  return (
    <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
      {/* Showing X-Y of Z */}
      <p className="text-sm text-stone-500">
        {t("pagination_showing", {
          start: startItem,
          end: endItem,
          total: totalItems,
        })}
      </p>

      {/* Page navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`${btnBase} border border-stone-300 bg-white px-2 disabled:opacity-30`}
          aria-label={t("pagination_prev")}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {pages.map((page, i) =>
          page === "..." ? (
            <span
              key={`ellipsis-${i}`}
              className="flex h-9 min-w-9 items-center justify-center text-sm text-stone-400"
            >
              ...
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`${btnBase} ${
                page === currentPage
                  ? "bg-stone-custom text-brand-white"
                  : "border border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
              }`}
            >
              {page}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={`${btnBase} border border-stone-300 bg-white px-2 disabled:opacity-30`}
          aria-label={t("pagination_next")}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Items per page */}
      <select
        value={itemsPerPage}
        onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
        className="h-9 rounded-lg border border-stone-300 bg-white px-2 text-sm text-stone-700 outline-none"
        aria-label={t("pagination_per_page")}
      >
        {itemsPerPageOptions.map((n) => (
          <option key={n} value={n}>
            {n} / {t("pagination_page_label")}
          </option>
        ))}
      </select>
    </div>
  );
}
