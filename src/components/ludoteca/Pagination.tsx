"use client";

import { useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { MdChevronLeft, MdChevronRight } from "react-icons/md";
import Dropdown from "./Dropdown";

const PAGE_SIZE_OPTIONS = [24, 48, 96, 192] as const;

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (size: number) => void;
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
  onItemsPerPageChange,
}: PaginationProps) {
  const t = useTranslations("ludoteca");
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);
  const pages = getPageNumbers(currentPage, totalPages);

  const btnBase =
    "flex h-9 min-w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors";
  const showPerPage = totalItems > PAGE_SIZE_OPTIONS[0];
  const visibleSizeOptions = useMemo(
    () => PAGE_SIZE_OPTIONS.filter((size, i) => i === 0 || PAGE_SIZE_OPTIONS[i - 1] < totalItems),
    [totalItems]
  );
  const sizeDropdownOptions = useMemo(
    () => visibleSizeOptions.map((size) => ({ value: String(size), label: String(size) })),
    [visibleSizeOptions]
  );
  const maxVisibleSize = visibleSizeOptions[visibleSizeOptions.length - 1];

  useEffect(() => {
    if (itemsPerPage > maxVisibleSize) {
      onItemsPerPageChange(maxVisibleSize);
    }
  }, [itemsPerPage, maxVisibleSize, onItemsPerPageChange]);

  return (
    <div className="my-4">
      {/* Mobile: prev/next + per page */}
      <div className="flex flex-col gap-3 sm:hidden">
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="flex h-10 flex-1 items-center justify-center gap-1 rounded-lg bg-stone-200 text-sm font-medium text-stone-700 transition-colors disabled:opacity-30"
              aria-label={t("pagination_prev")}
            >
              <MdChevronLeft className="h-4 w-4" />
              {t("pagination_prev")}
            </button>
            <span className="text-xs text-stone-600">
              {currentPage}/{totalPages}
            </span>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="flex h-10 flex-1 items-center justify-center gap-1 rounded-lg bg-stone-200 text-sm font-medium text-stone-700 transition-colors disabled:opacity-30"
              aria-label={t("pagination_next")}
            >
              {t("pagination_next")}
              <MdChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
        {showPerPage && (
          <div className="flex items-center justify-end gap-2 text-sm text-stone-600">
            <span>{t("per_page")}</span>
            <Dropdown
              value={String(itemsPerPage)}
              options={sizeDropdownOptions}
              onChange={(v) => onItemsPerPageChange(Number(v))}
              ariaLabel={t("per_page")}
              className="min-w-20"
            />
          </div>
        )}
      </div>

      {/* Desktop: single row — showing info | pages | per page */}
      <div className="hidden items-center sm:flex">
        {/* Left: showing info */}
        <p aria-live="polite" className="flex-1 text-xs text-stone-600">
          {t("pagination_showing", {
            start: startItem,
            end: endItem,
            total: totalItems,
          })}
        </p>

        {/* Center: numbered pagination */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={`${btnBase} border border-stone-300 bg-white px-2 disabled:opacity-30`}
              aria-label={t("pagination_prev")}
            >
              <MdChevronLeft className="h-4 w-4" />
            </button>

            {pages.map((page, i) =>
              page === "..." ? (
                <span
                  key={`ellipsis-${i}`}
                  role="separator"
                  aria-label={t("pagination_ellipsis")}
                  className="flex h-9 min-w-9 items-center justify-center text-sm text-stone-600"
                >
                  ...
                </span>
              ) : (
                <button
                  key={page}
                  onClick={() => onPageChange(page)}
                  aria-label={t("pagination_page", { page })}
                  aria-current={page === currentPage ? "page" : undefined}
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
              <MdChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Right: per page */}
        {showPerPage && (
          <div className="flex flex-1 items-center justify-end gap-2 text-sm text-stone-600">
            <span>{t("per_page")}</span>
            <Dropdown
              value={String(itemsPerPage)}
              options={sizeDropdownOptions}
              onChange={(v) => onItemsPerPageChange(Number(v))}
              ariaLabel={t("per_page")}
              className="min-w-20"
            />
          </div>
        )}
      </div>
    </div>
  );
}
