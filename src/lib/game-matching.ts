// ---------------------------------------------------------------------------
// Game Matching Engine — Resolve Ludoya planned plays to BGG games
// ---------------------------------------------------------------------------

import type { BggGame, BggSearchResult, BggThingBasic } from "./bgg";
import { searchBggGames, fetchBggThings } from "./bgg";
import { resolveBggIds, type LudoyaPlannedPlay } from "./ludoya";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type GameType = "boardgame" | "rpg" | "unknown";
export type FrameColor = "green" | "orange" | "red" | "rpg";

export interface ResolvedGame {
  name: string; // Display name (from Ludoya)
  bggId: string;
  imageUrl: string; // High-res BGG image
  weight: number;
  type: GameType;
  frame: FrameColor;
}

// ---------------------------------------------------------------------------
// Manual overrides: Ludoya game name → BGG game ID
// ---------------------------------------------------------------------------
// Most games resolve through the BGG id Ludoya links to. Add an entry here
// only when that link is missing or points to the wrong BGG item.
// Key = exact game name as it appears in Ludoya (case-sensitive).

const GAME_NAME_OVERRIDES: Record<string, string> = {
  // "Ludoya Name": "BGG ID",
};

// ---------------------------------------------------------------------------
// Manual RPG list — fallback when BGG type/categories are unavailable
// ---------------------------------------------------------------------------

const RPG_GAME_NAMES = new Set([
  "dungeons & dragons",
  "d&d",
  "d&d roleplaying game dice",
  "pathfinder",
  "call of cthulhu",
  "la crida de cthulhu",
  "la llamada de cthulhu",
  "vampire the masquerade",
  "vampire: la mascarada",
  "aquelarre",
  "forbidden lands",
  "mothership",
  "mork borg",
  "mörk borg",
  "blades in the dark",
  "fate",
  "savage worlds",
  "shadowrun",
  "warhammer fantasy roleplay",
  "pendragon",
  "runequest",
  "traveller",
  "stars without number",
  "cyberpunk red",
  "delta green",
  "alien rpg",
  "vaesen",
  "symbaroum",
  "the one ring",
  "el senyor dels anells",
  "dungeon world",
  "kids on bikes",
  "tales from the loop",
  "the witcher",
  "dragon age",
  "world of darkness",
]);

// ---------------------------------------------------------------------------
// BGG item types that indicate RPG or Accessory
// ---------------------------------------------------------------------------
// The BGG thing endpoint `<item type="...">` is the most reliable indicator.

const RPG_BGG_TYPES = new Set([
  "rpgitem",
  "rpgissue",
]);

const ACCESSORY_BGG_TYPES = new Set([
  "boardgameaccessory",
]);

// ---------------------------------------------------------------------------
// BGG categories for classification fallback
// ---------------------------------------------------------------------------
// Used when we have categories but no thingType (e.g. club collection games).

const ACCESSORY_BGG_CATEGORIES = new Set([
  "Accessory",
  "Accessory (dice, maps, screens, cards)",
]);

// ---------------------------------------------------------------------------
// Name normalization
// ---------------------------------------------------------------------------

function normalizeName(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      // Remove diacritics (accents)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      // Remove common articles
      .replace(/\b(el|la|els|les|los|las|the|a|an|l'|d')\b/g, "")
      // Remove special characters except spaces and ampersands
      .replace(/[^a-z0-9\s&]/g, "")
      // Collapse multiple spaces
      .replace(/\s+/g, " ")
      .trim()
  );
}

// ---------------------------------------------------------------------------
// Levenshtein distance
// ---------------------------------------------------------------------------

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

// ---------------------------------------------------------------------------
// Minimum similarity threshold for fuzzy matching
// ---------------------------------------------------------------------------

const FUZZY_THRESHOLD = 0.75;

// ---------------------------------------------------------------------------
// Core matching functions (against club collection)
// ---------------------------------------------------------------------------

function findById(bggGames: BggGame[], id: string): BggGame | null {
  return bggGames.find((g) => g.id === id) ?? null;
}

function findExactMatch(
  bggGames: BggGame[],
  normalizedName: string
): BggGame | null {
  return (
    bggGames.find((g) => {
      if (normalizeName(g.name) === normalizedName) return true;
      if (g.originalName && normalizeName(g.originalName) === normalizedName)
        return true;
      return false;
    }) ?? null
  );
}

function findFuzzyMatch(
  bggGames: BggGame[],
  normalizedName: string
): BggGame | null {
  let bestGame: BggGame | null = null;
  let bestScore = 0;

  for (const game of bggGames) {
    const nameScore = similarity(normalizeName(game.name), normalizedName);
    let score = nameScore;

    if (game.originalName) {
      const origScore = similarity(
        normalizeName(game.originalName),
        normalizedName
      );
      score = Math.max(score, origScore);
    }

    if (score > bestScore) {
      bestScore = score;
      bestGame = game;
    }
  }

  return bestScore >= FUZZY_THRESHOLD ? bestGame : null;
}

// ---------------------------------------------------------------------------
// BGG search: pick the best candidate from search results
// ---------------------------------------------------------------------------

function pickBestSearchResult(
  results: BggSearchResult[],
  normalizedName: string,
  yearHint: number
): BggSearchResult | null {
  let best: BggSearchResult | null = null;
  let bestScore = 0;

  for (const r of results) {
    const score = similarity(normalizeName(r.name), normalizedName);
    if (score > bestScore) {
      bestScore = score;
      best = r;
    } else if (score === bestScore && score >= FUZZY_THRESHOLD && best) {
      // Tiebreaker: prefer year match from Ludoya, else prefer newest
      if (yearHint > 0) {
        const bestYearDiff = Math.abs(best.year - yearHint);
        const currYearDiff = Math.abs(r.year - yearHint);
        if (currYearDiff < bestYearDiff) best = r;
      } else {
        if (r.year > best.year) best = r;
      }
    }
  }

  return bestScore >= FUZZY_THRESHOLD ? best : null;
}

// ---------------------------------------------------------------------------
// Game type detection
// ---------------------------------------------------------------------------

function isRpgByName(ludoyaName: string): boolean {
  const normalized = normalizeName(ludoyaName);
  const rpgNames = Array.from(RPG_GAME_NAMES);
  for (let i = 0; i < rpgNames.length; i++) {
    if (normalized.includes(normalizeName(rpgNames[i]))) return true;
  }
  return false;
}

function hasAccessoryCategory(categories: string[]): boolean {
  for (let i = 0; i < categories.length; i++) {
    if (ACCESSORY_BGG_CATEGORIES.has(categories[i])) return true;
  }
  return false;
}

/**
 * Determine game type.
 * Priority:
 *   1. Manual RPG name list (forced, skips all other checks)
 *   2. Accessory detection (BGG type or category → unknown)
 *   3. RPG detection (BGG item type rpgitem/rpgissue → rpg)
 *   4. RPG detection (Ludoya classifies the game as an RPG book → rpg)
 *   5. Default → boardgame
 */
export function getGameType(
  categories: string[],
  ludoyaName: string,
  thingType?: string,
  isLudoyaRpg = false
): GameType {
  // 1. Manual name lists — forced classification, no further checks needed
  if (isRpgByName(ludoyaName)) return "rpg";

  // 2. Accessory — BGG type or category
  if (thingType && ACCESSORY_BGG_TYPES.has(thingType)) return "unknown";
  if (hasAccessoryCategory(categories)) return "unknown";

  // 3. RPG — BGG item type
  if (thingType && RPG_BGG_TYPES.has(thingType)) return "rpg";

  // 4. RPG — Ludoya game type (the club collection only has board game subtypes)
  if (isLudoyaRpg) return "rpg";

  // 5. Default: boardgame
  return "boardgame";
}

// ---------------------------------------------------------------------------
// Difficulty → frame color
// ---------------------------------------------------------------------------

export function getDifficultyFrame(weight: number, type: GameType): FrameColor {
  if (type === "rpg" || type === "unknown") return "rpg";
  if (weight <= 0) return "orange"; // No weight data → default medium
  if (weight < 2.5) return "green";
  if (weight <= 3.5) return "orange";
  return "red";
}

// ---------------------------------------------------------------------------
// Build ResolvedGame helpers
// ---------------------------------------------------------------------------

/**
 * Which cover to use. With an exact BGG id the BGG cover is reliable. With a
 * name-based match the BGG item may be the wrong game, so Ludoya's cover
 * (always the right game) wins.
 */
type CoverPreference = "bgg" | "ludoya";

function pickCover(bggImage: string, play: LudoyaPlannedPlay, prefer: CoverPreference): string {
  if (prefer === "ludoya") return play.imageUrl || bggImage;
  return bggImage || play.imageUrl || "";
}

function buildFromBggGame(
  play: LudoyaPlannedPlay,
  game: BggGame,
  prefer: CoverPreference
): ResolvedGame {
  // Club collection games have subtype "boardgame"/"boardgameexpansion"
  const type = getGameType(game.categories, play.gameName, game.subtype, play.isRpg);
  return {
    name: play.gameName,
    bggId: game.id,
    imageUrl: pickCover(game.image, play, prefer),
    weight: game.weight,
    type,
    frame: getDifficultyFrame(game.weight, type),
  };
}

function buildFromThingData(
  play: LudoyaPlannedPlay,
  thing: BggThingBasic,
  prefer: CoverPreference
): ResolvedGame {
  // Games outside the club collection — use thingType for classification
  const type = getGameType(thing.categories, play.gameName, thing.thingType, play.isRpg);
  return {
    name: play.gameName,
    bggId: thing.id,
    imageUrl: pickCover(thing.image, play, prefer),
    weight: thing.weight,
    type,
    frame: getDifficultyFrame(thing.weight, type),
  };
}

/** Last resort: no BGG data at all. Ludoya cover and the default frame. */
function buildFromLudoyaOnly(play: LudoyaPlannedPlay): ResolvedGame | null {
  if (!play.imageUrl) return null;
  const type = getGameType([], play.gameName, undefined, play.isRpg);
  return {
    name: play.gameName,
    bggId: "",
    imageUrl: play.imageUrl,
    weight: 0,
    type,
    frame: getDifficultyFrame(0, type),
  };
}

// ---------------------------------------------------------------------------
// Name matching against the club collection (fallback)
// ---------------------------------------------------------------------------

function findInCollectionByName(ludoyaName: string, bggGames: BggGame[]): BggGame | null {
  const normalizedLudoya = normalizeName(ludoyaName);
  return (
    findExactMatch(bggGames, normalizedLudoya) ??
    findFuzzyMatch(bggGames, normalizedLudoya)
  );
}

// ---------------------------------------------------------------------------
// Prioritization: balance boardgames and RPGs, then take first N
// ---------------------------------------------------------------------------

const MAX_GAMES = 8;

function prioritizeGames(games: ResolvedGame[]): ResolvedGame[] {
  if (games.length <= MAX_GAMES) return games;

  const boardgames = games.filter((g) => g.type === "boardgame");
  const rpgs = games.filter((g) => g.type === "rpg");

  if (boardgames.length === 0 || rpgs.length === 0) {
    return games.slice(0, MAX_GAMES);
  }

  const rpgRatio = rpgs.length / games.length;
  let rpgSlots = Math.max(1, Math.round(MAX_GAMES * rpgRatio));
  let bgSlots = MAX_GAMES - rpgSlots;

  if (rpgSlots > rpgs.length) {
    rpgSlots = rpgs.length;
    bgSlots = MAX_GAMES - rpgSlots;
  }
  if (bgSlots > boardgames.length) {
    bgSlots = boardgames.length;
    rpgSlots = MAX_GAMES - bgSlots;
  }

  const selected = [
    ...boardgames.slice(0, bgSlots),
    ...rpgs.slice(0, rpgSlots),
  ];

  return selected.sort((a, b) => games.indexOf(a) - games.indexOf(b));
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

type ResolutionSource =
  | "collection-id"
  | "bgg-id"
  | "collection-name"
  | "bgg-search"
  | "ludoya-only";

interface PendingPlay {
  index: number;
  play: LudoyaPlannedPlay;
}

function gameKey(game: ResolvedGame): string {
  return game.bggId || `ludoya:${normalizeName(game.name)}`;
}

/**
 * Resolve event planned plays to enriched game data for image generation.
 *
 * BGG is the source of truth for cover, weight and type. Ludoya only provides
 * the bridge: each game's BGG id. Pipeline per game:
 *
 *   1. BGG id — manual override (GAME_NAME_OVERRIDES) or Ludoya's BGG link
 *   2. Club collection lookup by id (no BGG request)
 *   3. BGG thing endpoint by id (one batched request)
 *   4. Fallback when there is no id or BGG did not answer:
 *      name match in the club collection, then BGG search + thing
 *   5. Last resort — Ludoya cover with the default frame
 *
 * After resolution: keep Ludoya order, dedup, balance boardgame/RPG ratio, cap at 8.
 */
export async function resolveEventGames(
  plannedPlays: LudoyaPlannedPlay[],
  bggGames: BggGame[]
): Promise<ResolvedGame[]> {
  const resolved = new Map<number, { game: ResolvedGame; source: ResolutionSource }>();
  const accept = (index: number, game: ResolvedGame, source: ResolutionSource) => {
    if (game.imageUrl) resolved.set(index, { game, source });
  };

  // Step 1: BGG id for each game
  const bridge = await resolveBggIds(
    plannedPlays.flatMap((p) => (p.slug && !GAME_NAME_OVERRIDES[p.gameName] ? [p.slug] : []))
  );
  const byId: (PendingPlay & { bggId: string })[] = [];
  const byName: PendingPlay[] = [];
  plannedPlays.forEach((play, index) => {
    const bggId =
      GAME_NAME_OVERRIDES[play.gameName] ?? (play.slug ? bridge.get(play.slug) : undefined);
    if (bggId) byId.push({ index, play, bggId });
    else byName.push({ index, play });
  });

  // Step 2: club collection by id
  const needThing: typeof byId = [];
  for (const pending of byId) {
    const game = findById(bggGames, pending.bggId);
    if (game) accept(pending.index, buildFromBggGame(pending.play, game, "bgg"), "collection-id");
    else needThing.push(pending);
  }

  // Step 3: BGG thing endpoint by id
  if (needThing.length > 0) {
    const things = await fetchBggThings(Array.from(new Set(needThing.map((p) => p.bggId))));
    for (const pending of needThing) {
      const thing = things.get(pending.bggId);
      if (thing) accept(pending.index, buildFromThingData(pending.play, thing, "bgg"), "bgg-id");
      if (!resolved.has(pending.index)) byName.push(pending);
    }
  }

  // Step 4a: name match in the club collection
  const searchable: PendingPlay[] = [];
  for (const pending of byName) {
    const game = findInCollectionByName(pending.play.gameName, bggGames);
    if (game) accept(pending.index, buildFromBggGame(pending.play, game, "ludoya"), "collection-name");
    if (!resolved.has(pending.index)) searchable.push(pending);
  }

  // Step 4b: BGG search + thing for games outside the collection
  if (searchable.length > 0) {
    const searchResults = await Promise.all(
      searchable.map((p) => searchBggGames(p.play.gameName, 5))
    );
    const candidates = new Map<number, string>(); // play index → BGG id
    searchable.forEach((pending, i) => {
      const best = pickBestSearchResult(
        searchResults[i],
        normalizeName(pending.play.gameName),
        pending.play.yearPublished
      );
      if (best) candidates.set(pending.index, best.id);
    });

    if (candidates.size > 0) {
      const things = await fetchBggThings(Array.from(new Set(candidates.values())));
      for (const pending of searchable) {
        const thing = things.get(candidates.get(pending.index) ?? "");
        if (thing) accept(pending.index, buildFromThingData(pending.play, thing, "ludoya"), "bgg-search");
      }
    }
  }

  // Step 5: Ludoya cover with the default frame
  plannedPlays.forEach((play, index) => {
    if (resolved.has(index)) return;
    const game = buildFromLudoyaOnly(play);
    if (game) accept(index, game, "ludoya-only");
  });

  // Keep Ludoya order
  const ordered = Array.from(resolved.entries()).sort((a, b) => a[0] - b[0]);
  console.info(
    `[EventImage] Resolved ${ordered.length}/${plannedPlays.length} games: ` +
      ordered.map(([, r]) => `${r.game.name} (${r.source}${r.game.bggId ? ` #${r.game.bggId}` : ""})`).join(", ")
  );

  // Deduplicate (same BGG item planned twice, or same Ludoya-only game)
  const seen = new Set<string>();
  const deduped = ordered
    .map(([, r]) => r.game)
    .filter((game) => {
      const key = gameKey(game);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return prioritizeGames(deduped);
}
