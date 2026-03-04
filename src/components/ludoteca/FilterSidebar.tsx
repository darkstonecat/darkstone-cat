"use client";

import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import type { Filters } from "./LudotecaClient";
import SearchableMultiSelect from "./SearchableMultiSelect";

interface FilterSidebarProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
  totalResults: number;
  availableRankTypes: string[];
  availableCategories: string[];
  availableMechanics: string[];
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
  availableRankTypes,
  availableCategories,
  availableMechanics,
  onClose,
  isMobile,
}: FilterSidebarProps) {
  const t = useTranslations("ludoteca");

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const chipBase =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-full border px-3 text-sm font-medium transition-colors cursor-pointer select-none";
  const chipActive =
    "border-transparent bg-brand-orange text-white";
  const chipInactive =
    "border-stone-300 bg-white text-stone-600 hover:bg-stone-100";

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
            className="h-10 w-full rounded-full border border-stone-300 bg-white pl-10 pr-4 text-sm text-stone-700 outline-none transition-colors placeholder:text-stone-400 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange focus-visible:outline-2 focus-visible:outline-brand-orange focus-visible:outline-offset-2"
            aria-label={t("filter_search")}
          />
        </div>
      </div>

      <hr className="border-stone-200" />

      {/* Game type */}
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2.5 text-sm font-bold tracking-tight text-stone-custom">
          {t("filter_type")}
        </legend>
        <div className="flex flex-wrap gap-2">
          {([
            { value: "boardgame", label: t("filter_type_base") },
            { value: "boardgameexpansion", label: t("filter_type_expansion") },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              onClick={() => update("gameType", toggleInArray(filters.gameType, opt.value))}
              className={`${chipBase} ${
                filters.gameType.includes(opt.value) ? chipActive : chipInactive
              }`}
              aria-pressed={filters.gameType.includes(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      <hr className="border-stone-200" />

      {/* Players */}
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2.5 text-sm font-bold tracking-tight text-stone-custom">
          {t("filter_players_title")}
        </legend>
        <div className="flex flex-wrap gap-2">
          {PLAYER_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => update("players", toggleInArray(filters.players, n))}
              className={`${chipBase} ${n <= 10 ? "w-9 px-0" : ""} ${
                filters.players.includes(n) ? chipActive : chipInactive
              }`}
              aria-pressed={filters.players.includes(n)}
            >
              {n <= 10 ? n : t("filter_players_more")}
            </button>
          ))}
        </div>
      </fieldset>

      <hr className="border-stone-200" />

      {/* Duration */}
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2.5 text-sm font-bold tracking-tight text-stone-custom">
          {t("filter_duration_title")}
        </legend>
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
              aria-pressed={filters.duration.includes(key)}
            >
              {t(`filter_duration_${key.replace("-", "_").replace("+", "plus")}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <hr className="border-stone-200" />

      {/* Complexity */}
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2.5 text-sm font-bold tracking-tight text-stone-custom">
          {t("filter_weight_title")}
        </legend>
        <div className="flex flex-wrap gap-2">
          {WEIGHT_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => update("weight", toggleInArray(filters.weight, n))}
              className={`${chipBase} ${
                filters.weight.includes(n) ? chipActive : chipInactive
              }`}
              aria-pressed={filters.weight.includes(n)}
            >
              {t(`filter_weight_${n}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <hr className="border-stone-200" />

      {/* Age */}
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2.5 text-sm font-bold tracking-tight text-stone-custom">
          {t("filter_age_title")}
        </legend>
        <div className="flex flex-wrap gap-2">
          {AGE_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => update("age", toggleInArray(filters.age, n))}
              className={`${chipBase} w-11 px-0 ${
                filters.age.includes(n) ? chipActive : chipInactive
              }`}
              aria-pressed={filters.age.includes(n)}
            >
              +{n}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Rank types */}
      {availableRankTypes.length > 0 && (
        <>
          <hr className="border-stone-200" />
          <div>
            <h3 className="mb-2.5 text-sm font-bold tracking-tight text-stone-custom">
              {t("filter_rank_title")}
            </h3>
            <SearchableMultiSelect
              options={availableRankTypes}
              selected={filters.rankTypes}
              onChange={(v) => update("rankTypes", v)}
              placeholder={t("filter_select_placeholder")}
              searchPlaceholder={t("filter_rank_placeholder")}
              selectedLabel={(n) => t("filter_selected_count", { count: n })}
              label={t("filter_rank_title")}
              optionLabel={(rank) => t(`filter_rank_${rank}`)}
            />
          </div>
        </>
      )}

      {/* Categories */}
      {availableCategories.length > 0 && (
        <>
          <hr className="border-stone-200" />
          <div>
            <h3 className="mb-2.5 text-sm font-bold tracking-tight text-stone-custom">
              {t("filter_categories_title")}
            </h3>
            <SearchableMultiSelect
              options={availableCategories}
              selected={filters.categories}
              onChange={(v) => update("categories", v)}
              placeholder={t("filter_select_placeholder")}
              searchPlaceholder={t("filter_categories_placeholder")}
              selectedLabel={(n) => t("filter_selected_count", { count: n })}
              label={t("filter_categories_title")}
            />
          </div>
        </>
      )}

      {/* Mechanics */}
      {availableMechanics.length > 0 && (
        <>
          <hr className="border-stone-200" />
          <div>
            <h3 className="mb-2.5 text-sm font-bold tracking-tight text-stone-custom">
              {t("filter_mechanics_title")}
            </h3>
            <SearchableMultiSelect
              options={availableMechanics}
              selected={filters.mechanics}
              onChange={(v) => update("mechanics", v)}
              placeholder={t("filter_select_placeholder")}
              searchPlaceholder={t("filter_mechanics_placeholder")}
              selectedLabel={(n) => t("filter_selected_count", { count: n })}
              label={t("filter_mechanics_title")}
            />
          </div>
        </>
      )}

      {/* Clear filters */}
      {!isMobile && (
        <>
          <hr className="border-stone-200" />
          <button
            onClick={onReset}
            disabled={!hasActiveFilters}
            className="w-full rounded-full border border-stone-300 bg-white py-2.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("filter_clear")}
          </button>
        </>
      )}

      {isMobile && (
        <button
          onClick={onReset}
          disabled={!hasActiveFilters}
          className="text-sm font-medium text-brand-orange underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline"
        >
          {t("filter_clear")}
        </button>
      )}
    </div>
  );
}
