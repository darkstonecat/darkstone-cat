"use client";

import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import type { Filters } from "./LudotecaClient";

interface FilterBarProps {
  filters: Filters;
  onFilterChange: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
}

export default function FilterBar({
  filters,
  onFilterChange,
  onReset,
  hasActiveFilters,
}: FilterBarProps) {
  const t = useTranslations("ludoteca");

  const selectClass =
    "h-10 rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-700 outline-none transition-colors focus:border-stone-custom focus:ring-1 focus:ring-stone-custom";

  return (
    <div className="flex flex-col gap-3">
      {/* Search + Reset */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onFilterChange("search", e.target.value)}
            placeholder={t("filter_search")}
            className="h-10 w-full rounded-lg border border-stone-300 bg-white pl-10 pr-4 text-sm text-stone-700 outline-none transition-colors placeholder:text-stone-400 focus:border-stone-custom focus:ring-1 focus:ring-stone-custom"
            aria-label={t("filter_search")}
          />
        </div>
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="flex h-10 items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-500 transition-colors hover:bg-stone-100"
            aria-label={t("reset_filters")}
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">{t("reset_filters")}</span>
          </button>
        )}
      </div>

      {/* Filter selects */}
      <div className="flex flex-wrap gap-2">
        {/* Game type */}
        <select
          value={filters.gameType}
          onChange={(e) =>
            onFilterChange("gameType", e.target.value as Filters["gameType"])
          }
          className={selectClass}
          aria-label={t("filter_type")}
        >
          <option value="">{t("filter_type")}</option>
          <option value="boardgame">{t("filter_type_base")}</option>
          <option value="boardgameexpansion">{t("filter_type_expansion")}</option>
        </select>

        {/* Players */}
        <select
          value={filters.players}
          onChange={(e) => onFilterChange("players", Number(e.target.value))}
          className={selectClass}
          aria-label={t("filter_players")}
        >
          <option value={0}>{t("filter_players")}</option>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <option key={n} value={n}>
              {n === 8 ? "8+" : `${n} ${t("filter_players_label")}`}
            </option>
          ))}
        </select>

        {/* Duration */}
        <select
          value={filters.maxDuration}
          onChange={(e) =>
            onFilterChange("maxDuration", Number(e.target.value))
          }
          className={selectClass}
          aria-label={t("filter_duration")}
        >
          <option value={0}>{t("filter_duration")}</option>
          <option value={30}>&le; 30 min</option>
          <option value={60}>&le; 1h</option>
          <option value={120}>&le; 2h</option>
          <option value={180}>&le; 3h</option>
          <option value={9999}>&gt; 3h</option>
        </select>

        {/* Complexity */}
        <select
          value={filters.maxWeight}
          onChange={(e) => onFilterChange("maxWeight", Number(e.target.value))}
          className={selectClass}
          aria-label={t("filter_weight")}
        >
          <option value={0}>{t("filter_weight")}</option>
          <option value={2}>{t("filter_weight_light")}</option>
          <option value={3}>{t("filter_weight_medium")}</option>
          <option value={4}>{t("filter_weight_heavy")}</option>
          <option value={5}>{t("filter_weight_expert")}</option>
        </select>

        {/* Min age */}
        <select
          value={filters.minAge}
          onChange={(e) => onFilterChange("minAge", Number(e.target.value))}
          className={selectClass}
          aria-label={t("filter_age")}
        >
          <option value={0}>{t("filter_age")}</option>
          <option value={6}>&le; 6+</option>
          <option value={8}>&le; 8+</option>
          <option value={10}>&le; 10+</option>
          <option value={12}>&le; 12+</option>
          <option value={14}>&le; 14+</option>
          <option value={16}>&le; 16+</option>
        </select>

        {/* Sort */}
        <select
          value={filters.sortBy}
          onChange={(e) =>
            onFilterChange("sortBy", e.target.value as Filters["sortBy"])
          }
          className={selectClass}
          aria-label={t("filter_sort")}
        >
          <option value="name">{t("sort_name")}</option>
          <option value="rating">{t("sort_rating")}</option>
          <option value="weight">{t("sort_weight")}</option>
          <option value="year">{t("sort_year")}</option>
        </select>
      </div>
    </div>
  );
}
