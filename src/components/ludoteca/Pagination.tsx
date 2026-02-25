"use client";

import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
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
  totalItems,
  itemsPerPage,
  onPageChange,
}: PaginationProps) {
  const t = useTranslations("ludoteca");
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);
  const pages = getPageNumbers(currentPage, totalPages);

  const btnBase =
    "flex h-9 min-w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors";

  return (
    <div className="my-4 flex items-center justify-between gap-2">
      {/* Showing info — desktop only */}
      <p className="hidden text-xs text-stone-400 sm:block">
        {t("pagination_showing", {
          start: startItem,
          end: endItem,
          total: totalItems,
        })}
      </p>

      {/* Mobile: simple prev/next */}
      <div className="flex flex-1 items-center justify-between gap-2 sm:hidden">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="flex h-10 flex-1 items-center justify-center gap-1 rounded-lg bg-stone-200 text-sm font-medium text-stone-700 transition-colors disabled:opacity-30"
          aria-label={t("pagination_prev")}
        >
          <ChevronLeft className="h-4 w-4" />
          {t("pagination_prev")}
        </button>
        <span className="text-xs text-stone-400">
          {currentPage}/{totalPages}
        </span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="flex h-10 flex-1 items-center justify-center gap-1 rounded-lg bg-stone-200 text-sm font-medium text-stone-700 transition-colors disabled:opacity-30"
          aria-label={t("pagination_next")}
        >
          {t("pagination_next")}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Desktop: numbered pagination */}
      <div className="hidden items-center gap-1 sm:flex">
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
                  ? "bg-brand-orange text-white"
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
    </div>
  );
}
