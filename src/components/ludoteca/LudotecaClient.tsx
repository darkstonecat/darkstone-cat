"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence } from "motion/react";
import type { BggGame } from "@/lib/bgg";
import FilterBar from "./FilterBar";
import GameGrid from "./GameGrid";
import GameDetailModal from "./GameDetailModal";
import Pagination from "./Pagination";

interface LudotecaClientProps {
  games: BggGame[];
  error?: "timeout" | "api_error" | "parse_error";
}

export interface Filters {
  search: string;
  gameType: "" | "boardgame" | "boardgameexpansion";
  players: number;
  maxDuration: number;
  maxWeight: number;
  minAge: number;
  sortBy: "name" | "rating" | "weight" | "year";
}

const DEFAULT_FILTERS: Filters = {
  search: "",
  gameType: "",
  players: 0,
  maxDuration: 0,
  maxWeight: 0,
  minAge: 0,
  sortBy: "name",
};

const ITEMS_PER_PAGE_OPTIONS = [12, 24, 48, 96];

export default function LudotecaClient({ games, error }: LudotecaClientProps) {
  const t = useTranslations("ludoteca");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(24);
  const [selectedGame, setSelectedGame] = useState<BggGame | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  const filtered = useMemo(() => {
    let result = [...games];
    const search = debouncedSearch.toLowerCase();

    // Text search
    if (search) {
      result = result.filter(
        (g) =>
          g.name.toLowerCase().includes(search) ||
          (g.originalName?.toLowerCase().includes(search) ?? false)
      );
    }

    // Game type
    if (filters.gameType) {
      result = result.filter((g) => g.subtype === filters.gameType);
    }

    // Players
    if (filters.players > 0) {
      result = result.filter(
        (g) =>
          g.minPlayers <= filters.players && g.maxPlayers >= filters.players
      );
    }

    // Duration
    if (filters.maxDuration > 0) {
      result = result.filter((g) => g.playingTime > 0 && g.playingTime <= filters.maxDuration);
    }

    // Weight/complexity
    if (filters.maxWeight > 0) {
      result = result.filter((g) => g.weight > 0 && g.weight <= filters.maxWeight);
    }

    // Min age
    if (filters.minAge > 0) {
      result = result.filter((g) => g.minAge > 0 && g.minAge <= filters.minAge);
    }

    // Sort
    result.sort((a, b) => {
      switch (filters.sortBy) {
        case "rating":
          return b.rating - a.rating;
        case "weight":
          return b.weight - a.weight;
        case "year":
          return b.year - a.year;
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return result;
  }, [games, debouncedSearch, filters]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const paginatedGames = filtered.slice(startIndex, startIndex + itemsPerPage);

  const updateFilter = useCallback(
    <K extends keyof Filters>(key: K, value: Filters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
      setCurrentPage(1);
    },
    []
  );

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setDebouncedSearch("");
    setCurrentPage(1);
  }, []);

  const handleItemsPerPageChange = useCallback((n: number) => {
    setItemsPerPage(n);
    setCurrentPage(1);
  }, []);

  const hasActiveFilters = useMemo(
    () =>
      filters.search !== "" ||
      filters.gameType !== "" ||
      filters.players !== 0 ||
      filters.maxDuration !== 0 ||
      filters.maxWeight !== 0 ||
      filters.minAge !== 0,
    [filters]
  );

  // Error state
  if (error) {
    return (
      <div className="container mx-auto max-w-6xl px-6 pt-16 text-center">
        <p className="text-lg text-stone-600">{t("error_loading")}</p>
      </div>
    );
  }

  // Empty collection
  if (games.length === 0) {
    return (
      <div className="container mx-auto max-w-6xl px-6 pt-16 text-center">
        <p className="text-lg text-stone-600">{t("empty_collection")}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-6 pt-10">
      <FilterBar
        filters={filters}
        onFilterChange={updateFilter}
        onReset={resetFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Results count */}
      <p className="mt-6 text-sm text-stone-500">
        {t("results_count", { count: filtered.length, total: games.length })}
      </p>

      {filtered.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-lg text-stone-600">{t("no_results")}</p>
          <button
            onClick={resetFilters}
            className="mt-4 rounded-lg bg-stone-custom px-6 py-2 text-sm font-medium text-brand-white transition-opacity hover:opacity-80"
          >
            {t("reset_filters")}
          </button>
        </div>
      ) : (
        <>
          <GameGrid
            games={paginatedGames}
            onSelectGame={setSelectedGame}
          />

          {totalPages > 1 && (
            <Pagination
              currentPage={safePage}
              totalPages={totalPages}
              itemsPerPage={itemsPerPage}
              itemsPerPageOptions={ITEMS_PER_PAGE_OPTIONS}
              totalItems={filtered.length}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={handleItemsPerPageChange}
            />
          )}
        </>
      )}

      <AnimatePresence>
        {selectedGame && (
          <GameDetailModal
            game={selectedGame}
            onClose={() => setSelectedGame(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
