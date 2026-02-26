"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { SlidersHorizontal, ArrowDownUp, LayoutGrid, List } from "lucide-react";
import type { BggGame } from "@/lib/bgg";
import FilterSidebar from "./FilterSidebar";
import GameGrid from "./GameGrid";
import GameDetailModal from "./GameDetailModal";
import Pagination from "./Pagination";
import SortDropdown from "./SortDropdown";

interface LudotecaClientProps {
  games: BggGame[];
  error?: "timeout" | "api_error" | "parse_error";
}

export interface Filters {
  search: string;
  gameType: "" | "boardgame" | "boardgameexpansion";
  players: number[];
  duration: string[];
  weight: number[];
  age: number[];
  categories: string[];
  mechanics: string[];
}

export const DEFAULT_FILTERS: Filters = {
  search: "",
  gameType: "",
  players: [],
  duration: [],
  weight: [],
  age: [],
  categories: [],
  mechanics: [],
};

const DURATION_RANGES: Record<string, [number, number]> = {
  lt30: [0, 29],
  "30-60": [30, 60],
  "60-120": [61, 120],
  "120-180": [121, 180],
  "180-240": [181, 240],
  "240+": [241, Infinity],
};

const PAGE_SIZE_OPTIONS = [24, 48, 96, 192] as const;
const DEFAULT_PAGE_SIZE = 24;
const VALID_PAGE_SIZES = new Set(PAGE_SIZE_OPTIONS);

const VALID_GAME_TYPES = new Set(["boardgame", "boardgameexpansion"]);
const VALID_DURATIONS = new Set(["lt30", "30-60", "60-120", "120-180", "180-240", "240+"]);
const VALID_SORTS = new Set(["name-asc", "name-desc", "rating-desc", "rating-asc", "weight-desc", "weight-asc"]);

function parseFiltersFromParams(params: URLSearchParams): {
  filters: Filters;
  sortBy: string;
  viewMode: "grid" | "list";
  page: number;
  perPage: number;
} {
  const nums = (key: string) =>
    params.get(key)?.split(",").map(Number).filter((n) => !isNaN(n) && n > 0) ?? [];
  const strs = (key: string) =>
    params.get(key)?.split(",").filter(Boolean) ?? [];
  const type = params.get("type") ?? "";
  const sort = params.get("sort") ?? "name-asc";
  const view = params.get("view");
  const pp = parseInt(params.get("pp") ?? "", 10);

  return {
    filters: {
      search: params.get("q") ?? "",
      gameType: VALID_GAME_TYPES.has(type) ? (type as Filters["gameType"]) : "",
      players: nums("players"),
      duration: strs("duration").filter((d) => VALID_DURATIONS.has(d)),
      weight: nums("weight").filter((w) => w >= 1 && w <= 5),
      age: nums("age"),
      categories: strs("cat"),
      mechanics: strs("mech"),
    },
    sortBy: VALID_SORTS.has(sort) ? sort : "name-asc",
    viewMode: view === "list" ? "list" : "grid",
    page: Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1),
    perPage: VALID_PAGE_SIZES.has(pp as typeof PAGE_SIZE_OPTIONS[number]) ? pp : DEFAULT_PAGE_SIZE,
  };
}

function serializeStateToUrl(
  debouncedSearch: string,
  filters: Filters,
  sortBy: string,
  viewMode: string,
  page: number,
  perPage: number
): void {
  const params = new URLSearchParams();
  if (debouncedSearch) params.set("q", debouncedSearch);
  if (filters.gameType) params.set("type", filters.gameType);
  if (filters.players.length) params.set("players", filters.players.join(","));
  if (filters.duration.length) params.set("duration", filters.duration.join(","));
  if (filters.weight.length) params.set("weight", filters.weight.join(","));
  if (filters.age.length) params.set("age", filters.age.join(","));
  if (filters.categories.length) params.set("cat", filters.categories.join(","));
  if (filters.mechanics.length) params.set("mech", filters.mechanics.join(","));
  if (sortBy !== "name-asc") params.set("sort", sortBy);
  if (viewMode !== "grid") params.set("view", viewMode);
  if (page > 1) params.set("page", String(page));
  if (perPage !== DEFAULT_PAGE_SIZE) params.set("pp", String(perPage));
  const qs = params.toString();
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState(null, "", url);
}

export default function LudotecaClient({ games, error }: LudotecaClientProps) {
  const t = useTranslations("ludoteca");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState("name-asc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedGame, setSelectedGame] = useState<BggGame | null>(null);
  const allGamesMap = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [mobileSortOpen, setMobileSortOpen] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const urlInitialized = useRef(false);
  const mobileFilterPanelRef = useRef<HTMLDivElement>(null);
  const mobileFilterBtnRef = useRef<HTMLButtonElement>(null);

  // Read URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.toString()) {
      const parsed = parseFiltersFromParams(params);
      setFilters(parsed.filters);
      setDebouncedSearch(parsed.filters.search);
      setSortBy(parsed.sortBy);
      setViewMode(parsed.viewMode);
      setItemsPerPage(parsed.perPage);
      setCurrentPage(parsed.page);
    }
    urlInitialized.current = true;
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  const filtered = useMemo(() => {
    let result = [...games];
    const search = debouncedSearch.toLowerCase();

    if (search) {
      result = result.filter(
        (g) =>
          g.name.toLowerCase().includes(search) ||
          (g.originalName?.toLowerCase().includes(search) ?? false)
      );
    }

    if (filters.gameType) {
      result = result.filter((g) => g.subtype === filters.gameType);
    }

    if (filters.players.length > 0) {
      result = result.filter((g) =>
        filters.players.some(
          (p) => g.minPlayers <= p && g.maxPlayers >= p
        )
      );
    }

    if (filters.duration.length > 0) {
      result = result.filter(
        (g) =>
          g.playingTime > 0 &&
          filters.duration.some((d) => {
            const range = DURATION_RANGES[d];
            if (!range) return false;
            return g.playingTime >= range[0] && g.playingTime <= range[1];
          })
      );
    }

    if (filters.weight.length > 0) {
      result = result.filter(
        (g) =>
          g.weight > 0 &&
          filters.weight.some((w) => Math.round(g.weight) === w)
      );
    }

    if (filters.age.length > 0) {
      result = result.filter(
        (g) =>
          g.minAge > 0 && filters.age.some((a) => g.minAge <= a)
      );
    }

    if (filters.categories.length > 0) {
      result = result.filter((g) =>
        filters.categories.some((c) => g.categories.includes(c))
      );
    }

    if (filters.mechanics.length > 0) {
      result = result.filter((g) =>
        filters.mechanics.some((m) => g.mechanics.includes(m))
      );
    }

    // Sort
    const [sortField, sortDir] = sortBy.split("-") as [string, string];
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "rating":
          cmp = a.rating - b.rating;
          break;
        case "weight":
          cmp = a.weight - b.weight;
          break;
        default:
          cmp = a.name.localeCompare(b.name);
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return result;
  }, [games, debouncedSearch, filters, sortBy]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const paginatedGames = filtered.slice(startIndex, startIndex + itemsPerPage);

  const setFiltersAndReset = useCallback((newFilters: Filters) => {
    setFilters(newFilters);
    setCurrentPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setDebouncedSearch("");
    setCurrentPage(1);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Sync state → URL
  useEffect(() => {
    if (!urlInitialized.current) return;
    serializeStateToUrl(debouncedSearch, filters, sortBy, viewMode, safePage, itemsPerPage);
  }, [debouncedSearch, filters, sortBy, viewMode, safePage, itemsPerPage]);

  // Focus trap for mobile filter panel
  useEffect(() => {
    if (!mobileFilterOpen) {
      mobileFilterBtnRef.current?.focus();
      return;
    }
    const panel = mobileFilterPanelRef.current;
    if (!panel) return;

    const FOCUSABLE =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    // Focus first element on open
    const focusable = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (focusable.length > 0) focusable[0].focus();

    panel.addEventListener("keydown", handleKeyDown);
    return () => panel.removeEventListener("keydown", handleKeyDown);
  }, [mobileFilterOpen]);

  const allCategories = useMemo(
    () => [...new Set(games.flatMap((g) => g.categories))].sort(),
    [games]
  );

  const allMechanics = useMemo(
    () => [...new Set(games.flatMap((g) => g.mechanics))].sort(),
    [games]
  );

  const hasActiveFilters = useMemo(
    () =>
      filters.search !== "" ||
      filters.gameType !== "" ||
      filters.players.length > 0 ||
      filters.duration.length > 0 ||
      filters.weight.length > 0 ||
      filters.age.length > 0 ||
      filters.categories.length > 0 ||
      filters.mechanics.length > 0,
    [filters]
  );

  if (error) {
    return (
      <div className="container mx-auto max-w-6xl px-6 pt-16 text-center">
        <p className="text-lg text-stone-600">{t("error_loading")}</p>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="container mx-auto max-w-6xl px-6 pt-16 text-center">
        <p className="text-lg text-stone-600">{t("empty_collection")}</p>
      </div>
    );
  }

  const sortOptions = [
    { value: "name-asc", label: t("sort_name_asc") },
    { value: "name-desc", label: t("sort_name_desc") },
    { value: "rating-desc", label: t("sort_rating_desc") },
    { value: "rating-asc", label: t("sort_rating_asc") },
    { value: "weight-desc", label: t("sort_weight_desc") },
    { value: "weight-asc", label: t("sort_weight_asc") },
  ];

  return (
    <div ref={resultsRef} className="container mx-auto max-w-7xl scroll-mt-16 px-4 pt-6 sm:px-6">
      {/* Mobile sticky bar */}
      <div className="sticky top-16 z-30 -mx-4 mb-4 flex gap-3 bg-brand-beige px-4 py-3 sm:-mx-6 sm:px-6 md:hidden">
        <button
          ref={mobileFilterBtnRef}
          onClick={() => setMobileFilterOpen(true)}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-orange py-2.5 text-sm font-semibold text-white"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {t("btn_filter")}
          {hasActiveFilters && (
            <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white/25 px-1 text-xs">
              {filters.players.length + filters.duration.length + filters.weight.length + filters.age.length + filters.categories.length + filters.mechanics.length + (filters.gameType ? 1 : 0)}
            </span>
          )}
        </button>
        <div className="relative flex-1">
          <button
            onClick={() => setMobileSortOpen(!mobileSortOpen)}
            className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-brand-orange py-2.5 text-sm font-semibold text-brand-orange"
          >
            <ArrowDownUp className="h-4 w-4" />
            {t("btn_sort")}
          </button>
          {mobileSortOpen && (
            <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-2xl border border-stone-200 bg-white shadow-lg">
              {sortOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setSortBy(opt.value);
                    setMobileSortOpen(false);
                    setCurrentPage(1);
                  }}
                  className={`w-full px-4 py-2.5 text-left text-sm transition-colors first:rounded-t-2xl last:rounded-b-2xl ${
                    sortBy === opt.value
                      ? "bg-brand-orange/10 font-semibold text-brand-orange"
                      : "text-stone-700 hover:bg-stone-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-8">
        {/* Desktop sidebar */}
        <aside className="hidden w-[300px] shrink-0 md:block">
          <div className="rounded-2xl border border-stone-200 bg-white p-6">
            <FilterSidebar
              filters={filters}
              onFiltersChange={setFiltersAndReset}
              onReset={resetFilters}
              hasActiveFilters={hasActiveFilters}
              totalResults={filtered.length}
              availableCategories={allCategories}
              availableMechanics={allMechanics}
            />
          </div>
        </aside>

        {/* Results column */}
        <div className="min-w-0 flex-1">
          {/* Desktop toolbar */}
          <div className="mb-4 hidden items-center justify-between md:flex">
            <div className="flex items-center gap-3">
              <SortDropdown
                value={sortBy}
                options={sortOptions}
                onChange={(v) => {
                  setSortBy(v);
                  setCurrentPage(1);
                }}
                ariaLabel={t("btn_sort")}
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex rounded-lg border border-stone-300 bg-white">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`flex h-9 w-9 items-center justify-center rounded-l-lg transition-colors ${
                    viewMode === "grid"
                      ? "bg-stone-custom text-white"
                      : "text-stone-400 hover:text-stone-600"
                  }`}
                  aria-label={t("view_grid")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`flex h-9 w-9 items-center justify-center rounded-r-lg border-l border-stone-300 transition-colors ${
                    viewMode === "list"
                      ? "bg-stone-custom text-white"
                      : "text-stone-400 hover:text-stone-600"
                  }`}
                  aria-label={t("view_list")}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Mobile view toggle */}
          <div className="mb-3 flex justify-end md:hidden">
            <div className="flex rounded-lg border border-stone-300 bg-white">
              <button
                onClick={() => setViewMode("grid")}
                className={`flex h-9 w-9 items-center justify-center rounded-l-lg transition-colors ${
                  viewMode === "grid"
                    ? "bg-stone-custom text-white"
                    : "text-stone-400 hover:text-stone-600"
                }`}
                aria-label={t("view_grid")}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`flex h-9 w-9 items-center justify-center rounded-r-lg border-l border-stone-300 transition-colors ${
                  viewMode === "list"
                    ? "bg-stone-custom text-white"
                    : "text-stone-400 hover:text-stone-600"
                }`}
                aria-label={t("view_list")}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="mt-16 text-center">
              <p className="text-lg text-stone-600">{t("no_results")}</p>
              <button
                onClick={resetFilters}
                className="mt-4 rounded-lg bg-stone-custom px-6 py-2 text-sm font-medium text-brand-white transition-opacity hover:opacity-80"
              >
                {t("filter_clear")}
              </button>
            </div>
          ) : (
            <>
              <GameGrid
                games={paginatedGames}
                viewMode={viewMode}
                onSelectGame={setSelectedGame}
              />

              <Pagination
                currentPage={safePage}
                totalPages={totalPages}
                totalItems={filtered.length}
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
                onItemsPerPageChange={(size) => {
                  setItemsPerPage(size);
                  setCurrentPage(1);
                }}
              />
            </>
          )}
        </div>
      </div>

      {/* Mobile filter fullscreen panel */}
      <AnimatePresence>
        {mobileFilterOpen && (
          <motion.div
            ref={mobileFilterPanelRef}
            className="fixed inset-0 z-50 flex flex-col bg-white md:hidden"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="flex-1 overflow-y-auto px-5 pt-5 pb-24">
              <FilterSidebar
                filters={filters}
                onFiltersChange={setFiltersAndReset}
                onReset={resetFilters}
                hasActiveFilters={hasActiveFilters}
                totalResults={filtered.length}
                availableCategories={allCategories}
                availableMechanics={allMechanics}
                onClose={() => setMobileFilterOpen(false)}
                isMobile
              />
            </div>
            <div className="sticky bottom-0 border-t border-stone-200 bg-white p-4">
              <button
                onClick={() => setMobileFilterOpen(false)}
                className="w-full rounded-full bg-brand-orange py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                {t("filter_apply")} ({filtered.length})
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game detail modal */}
      <AnimatePresence>
        {selectedGame && (
          <GameDetailModal
            game={selectedGame}
            allGames={allGamesMap}
            onClose={() => setSelectedGame(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
