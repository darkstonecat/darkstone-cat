"use client";

import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import type { Filters } from "./LudotecaClient";

interface FilterSidebarProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
  totalResults: number;
  onClose?: () => void;
  isMobile?: boolean;
}

const PLAYER_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

const DURATION_OPTIONS = [
  "lt30",
  "30-60",
  "60-120",
  "120-180",
  "180-240",
  "240+",
] as const;

const WEIGHT_OPTIONS = [1, 2, 3, 4, 5] as const;

const AGE_OPTIONS = [3, 6, 8, 10, 12, 14, 16, 18] as const;

function toggleInArray<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

export default function FilterSidebar({
  filters,
  onFiltersChange,
  onReset,
  hasActiveFilters,
  totalResults,
  onClose,
  isMobile,
}: FilterSidebarProps) {
  const t = useTranslations("ludoteca");

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const chipBase =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors cursor-pointer select-none";
  const chipActive =
    "border-brand-orange bg-brand-orange text-white";
  const chipInactive =
    "border-stone-300 bg-white text-stone-600 hover:border-stone-400";

  return (
    <div className="flex flex-col gap-6">
      {/* Mobile header */}
      {isMobile && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-stone-900">
              {t("filter_panel_title")}
            </h2>
            <p className="text-sm text-stone-500">
              {t("results_count", { count: totalResults, total: totalResults })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100"
            aria-label={t("modal_close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Search */}
      <div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => update("search", e.target.value)}
            placeholder={t("filter_search")}
            className="h-10 w-full rounded-lg border border-stone-300 bg-white pl-10 pr-4 text-sm text-stone-700 outline-none transition-colors placeholder:text-stone-400 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange"
            aria-label={t("filter_search")}
          />
        </div>
      </div>

      {/* Game type */}
      <div>
        <h3 className="mb-2.5 text-sm font-semibold text-stone-800">
          {t("filter_type")}
        </h3>
        <select
          value={filters.gameType}
          onChange={(e) =>
            update("gameType", e.target.value as Filters["gameType"])
          }
          className="h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-700 outline-none transition-colors focus:border-brand-orange focus:ring-1 focus:ring-brand-orange"
          aria-label={t("filter_type")}
        >
          <option value="">{t("filter_type_all")}</option>
          <option value="boardgame">{t("filter_type_base")}</option>
          <option value="boardgameexpansion">{t("filter_type_expansion")}</option>
        </select>
      </div>

      <hr className="border-stone-200" />

      {/* Players */}
      <div>
        <h3 className="mb-2.5 text-sm font-semibold text-stone-800">
          {t("filter_players_title")}
        </h3>
        <div className="flex flex-wrap gap-2">
          {PLAYER_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => update("players", toggleInArray(filters.players, n))}
              className={`${chipBase} ${
                filters.players.includes(n) ? chipActive : chipInactive
              }`}
              role="switch"
              aria-checked={filters.players.includes(n)}
            >
              {n <= 10 ? n : t("filter_players_more")}
            </button>
          ))}
        </div>
      </div>

      <hr className="border-stone-200" />

      {/* Duration */}
      <div>
        <h3 className="mb-2.5 text-sm font-semibold text-stone-800">
          {t("filter_duration_title")}
        </h3>
        <div className="flex flex-wrap gap-2">
          {DURATION_OPTIONS.map((key) => (
            <button
              key={key}
              onClick={() =>
                update("duration", toggleInArray(filters.duration, key))
              }
              className={`${chipBase} ${
                filters.duration.includes(key) ? chipActive : chipInactive
              }`}
              role="switch"
              aria-checked={filters.duration.includes(key)}
            >
              {t(`filter_duration_${key.replace("-", "_").replace("+", "plus")}`)}
            </button>
          ))}
        </div>
      </div>

      <hr className="border-stone-200" />

      {/* Complexity */}
      <div>
        <h3 className="mb-2.5 text-sm font-semibold text-stone-800">
          {t("filter_weight_title")}
        </h3>
        <div className="flex flex-wrap gap-2">
          {WEIGHT_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => update("weight", toggleInArray(filters.weight, n))}
              className={`${chipBase} ${
                filters.weight.includes(n) ? chipActive : chipInactive
              }`}
              role="switch"
              aria-checked={filters.weight.includes(n)}
            >
              {t(`filter_weight_${n}`)}
            </button>
          ))}
        </div>
      </div>

      <hr className="border-stone-200" />

      {/* Age */}
      <div>
        <h3 className="mb-2.5 text-sm font-semibold text-stone-800">
          {t("filter_age_title")}
        </h3>
        <div className="flex flex-wrap gap-2">
          {AGE_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => update("age", toggleInArray(filters.age, n))}
              className={`${chipBase} ${
                filters.age.includes(n) ? chipActive : chipInactive
              }`}
              role="switch"
              aria-checked={filters.age.includes(n)}
            >
              +{n}
            </button>
          ))}
        </div>
      </div>

      {/* Clear filters */}
      {hasActiveFilters && !isMobile && (
        <>
          <hr className="border-stone-200" />
          <button
            onClick={onReset}
            className="w-full rounded-lg border border-stone-300 bg-white py-2.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
          >
            {t("filter_clear")}
          </button>
        </>
      )}

      {isMobile && hasActiveFilters && (
        <button
          onClick={() => {
            onReset();
          }}
          className="text-sm font-medium text-brand-orange underline underline-offset-2"
        >
          {t("filter_clear")}
        </button>
      )}
    </div>
  );
}
