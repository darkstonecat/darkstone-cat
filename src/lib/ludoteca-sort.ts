import type { BggGame } from "@/lib/bgg";

/** Orders of the ludoteca list, as they appear in the `sort` URL param. */
export const LUDOTECA_SORTS = [
  "added-desc",
  "name-asc",
  "name-desc",
  "rating-desc",
  "rating-asc",
  "weight-desc",
  "weight-asc",
] as const;

export type LudotecaSort = (typeof LUDOTECA_SORTS)[number];

/** Newest additions first, so returning visitors see what arrived since their last visit. */
export const DEFAULT_LUDOTECA_SORT: LudotecaSort = "added-desc";

const SORT_SET: ReadonlySet<string> = new Set(LUDOTECA_SORTS);

export function isLudotecaSort(value: string): value is LudotecaSort {
  return SORT_SET.has(value);
}

const byName = (a: BggGame, b: BggGame) => a.name.localeCompare(b.name);

/**
 * `addedAt` is BGG's collection `lastmodified` ("YYYY-MM-DD HH:MM:SS"). Only the day counts: the
 * original collection was loaded in one session seconds apart, and those games should read in name
 * order, not in the order they were typed. Same day → name; games without a date go last.
 */
function byAddedDesc(a: BggGame, b: BggGame): number {
  const left = a.addedAt?.slice(0, 10) ?? "";
  const right = b.addedAt?.slice(0, 10) ?? "";
  if (left !== right) return left < right ? 1 : -1;
  return byName(a, b);
}

/** Returns a new array sorted by `sort`; the input is left untouched. */
export function sortGames(games: readonly BggGame[], sort: LudotecaSort): BggGame[] {
  if (sort === "added-desc") return [...games].sort(byAddedDesc);

  const [field, dir] = sort.split("-") as ["name" | "rating" | "weight", "asc" | "desc"];
  const compare = (a: BggGame, b: BggGame) => {
    if (field === "rating") return a.rating - b.rating;
    if (field === "weight") return a.weight - b.weight;
    return byName(a, b);
  };
  return [...games].sort((a, b) => (dir === "desc" ? -compare(a, b) : compare(a, b)));
}
