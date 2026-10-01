import { XMLParser } from "fast-xml-parser";
import { promises as fs } from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BggExpansion {
  id: string;
  name: string;
  year: number;
  thumbnail: string;
}

export interface BggGame {
  id: string;
  subtype: "boardgame" | "boardgameexpansion";
  name: string;
  originalName?: string;
  year: number;
  thumbnail: string;
  image: string;
  minPlayers: number;
  maxPlayers: number;
  playingTime: number;
  rating: number;
  weight: number;
  minAge: number;
  categories: string[];
  mechanics: string[];
  rankTypes: string[];
  expansions: BggExpansion[];
}

export interface BggCollectionResult {
  games: BggGame[];
  baseCount: number;
  totalWithExpansions: number;
  fetchedAt: string;
  error?: "timeout" | "api_error" | "parse_error";
}

// ---------------------------------------------------------------------------
// XML Parser config
// ---------------------------------------------------------------------------

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: false,
  isArray: (tagName) => tagName === "item" || tagName === "rank" || tagName === "link",
});

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const BGG_BASE = "https://boardgamegeek.com/xmlapi2";

/**
 * Data-cache tag of the club collection requests (collection, expansions and
 * their thing enrichment). Per-game lookups (search, `fetchBggThings`) stay
 * untagged. Every call site of a tagged URL must pass the tag: the cache key
 * ignores tags and an entry keeps those of the request that wrote it.
 */
export const BGG_CACHE_TAG = "bgg";
const COLLECTION_TAGS = [BGG_CACHE_TAG];
const MAX_RETRIES = 5;
const BATCH_SIZE = 20;

async function fetchBggXml(
  url: string,
  options?: { tags?: string[] }
): Promise<string> {
  const token = process.env.BGG_API_KEY;
  if (!token) throw new Error("BGG_API_KEY not set");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  let delay = 2000;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(30_000),
      next: {
        revalidate: 86400,
        ...(options?.tags && { tags: options.tags }),
      },
    });

    if (res.status === 200) return res.text();
    if (res.status === 202) {
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
      continue;
    }
    throw new Error(`BGG API error: HTTP ${res.status}`);
  }
  throw new Error("BGG API timeout after retries");
}

async function readMockXml(filename: string): Promise<string> {
  const filePath = path.join(process.cwd(), "public", "mock", filename);
  return fs.readFile(filePath, "utf-8");
}

export interface RawCollectionItem {
  "@_objectid": string;
  "@_subtype": string;
  name: string | { "#text": string };
  originalname?: string | { "#text": string };
  yearpublished?: string;
  image?: string;
  thumbnail?: string;
  stats?: {
    "@_minplayers"?: string;
    "@_maxplayers"?: string;
    "@_playingtime"?: string;
    rating?: {
      average?: { "@_value"?: string };
      averageweight?: { "@_value"?: string };
      ranks?: {
        rank?: Array<{
          "@_type"?: string;
          "@_name"?: string;
          "@_value"?: string;
        }> | { "@_type"?: string; "@_name"?: string; "@_value"?: string };
      };
    };
  };
}

export function textValue(v: string | { "#text": string } | undefined): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  return v["#text"] ?? "";
}

export function parseCollectionItems(xml: string): RawCollectionItem[] {
  const parsed = parser.parse(xml);
  const items = parsed?.items?.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

export function extractRankTypes(ranks: unknown): string[] {
  if (!ranks) return [];
  const list = Array.isArray(ranks) ? ranks : [ranks];
  return list
    .filter(
      (r) =>
        r["@_type"] === "family" &&
        r["@_name"] &&
        r["@_value"] !== "Not Ranked"
    )
    .map((r) => r["@_name"] as string);
}

export function rawToGame(item: RawCollectionItem): BggGame {
  const rating = parseFloat(item.stats?.rating?.average?.["@_value"] ?? "0");
  const weight = parseFloat(item.stats?.rating?.averageweight?.["@_value"] ?? "0");

  return {
    id: item["@_objectid"],
    subtype: item["@_subtype"] as BggGame["subtype"],
    name: textValue(item.name),
    originalName: textValue(item.originalname) || undefined,
    year: parseInt(item.yearpublished ?? "0", 10) || 0,
    thumbnail: item.thumbnail ?? "",
    image: item.image ?? "",
    minPlayers: parseInt(item.stats?.["@_minplayers"] ?? "0", 10) || 0,
    maxPlayers: parseInt(item.stats?.["@_maxplayers"] ?? "0", 10) || 0,
    playingTime: parseInt(item.stats?.["@_playingtime"] ?? "0", 10) || 0,
    rating: isNaN(rating) ? 0 : Math.round(rating * 10) / 10,
    weight: isNaN(weight) ? 0 : Math.round(weight * 10) / 10,
    minAge: 0,
    categories: [],
    mechanics: [],
    rankTypes: extractRankTypes(item.stats?.rating?.ranks?.rank),
    expansions: [],
  };
}

// ---------------------------------------------------------------------------
// Mock things.xml parser
// ---------------------------------------------------------------------------

function parseMockThings(xml: string): Map<string, ThingData> {
  const result = new Map<string, ThingData>();
  const parsed = parser.parse(xml);
  const items = parsed?.items?.item;
  if (!items) return result;

  const list = Array.isArray(items) ? items : [items];

  for (const item of list) {
    const id = item["@_id"] as string;
    const weight =
      parseFloat(
        item?.statistics?.ratings?.averageweight?.["@_value"] ?? "0"
      ) || 0;
    const minAge = parseInt(item?.minage?.["@_value"] ?? "0", 10) || 0;

    const baseGameIds: string[] = [];
    const categories: string[] = [];
    const mechanics: string[] = [];
    const links = item?.link;
    if (Array.isArray(links)) {
      for (const link of links) {
        const type = link["@_type"];
        if (
          type === "boardgameexpansion" &&
          link["@_inbound"] === "true"
        ) {
          baseGameIds.push(link["@_id"]);
        } else if (type === "boardgamecategory" && link["@_value"]) {
          categories.push(link["@_value"]);
        } else if (type === "boardgamemechanic" && link["@_value"]) {
          mechanics.push(link["@_value"]);
        }
      }
    }

    const rankTypes = extractRankTypes(
      item?.statistics?.ratings?.ranks?.rank
    );

    result.set(id, {
      weight: Math.round(weight * 10) / 10,
      minAge,
      categories,
      mechanics,
      rankTypes,
      baseGameIds,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Expansion linking + enrichment via thing endpoint (production mode)
// ---------------------------------------------------------------------------

export interface ThingData {
  weight: number;
  minAge: number;
  categories: string[];
  mechanics: string[];
  rankTypes: string[];
  baseGameIds: string[];
}

async function fetchThingData(
  ids: string[]
): Promise<Map<string, ThingData>> {
  const result = new Map<string, ThingData>();

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const url = `${BGG_BASE}/thing?id=${batch.join(",")}&stats=1`;

    try {
      const xml = await fetchBggXml(url, { tags: COLLECTION_TAGS });
      const parsed = parser.parse(xml);
      const items = parsed?.items?.item;
      if (!items) continue;

      const list = Array.isArray(items) ? items : [items];

      for (const item of list) {
        const id = item["@_id"] as string;
        const weight =
          parseFloat(
            item?.statistics?.ratings?.averageweight?.["@_value"] ?? "0"
          ) || 0;
        const minAge = parseInt(item?.["@_minage"] ?? "0", 10) || 0;

        const baseGameIds: string[] = [];
        const categories: string[] = [];
        const mechanics: string[] = [];
        const links = item?.link;
        if (Array.isArray(links)) {
          for (const link of links) {
            const type = link["@_type"];
            if (
              type === "boardgameexpansion" &&
              link["@_inbound"] === "true"
            ) {
              baseGameIds.push(link["@_id"]);
            } else if (type === "boardgamecategory" && link["@_value"]) {
              categories.push(link["@_value"]);
            } else if (type === "boardgamemechanic" && link["@_value"]) {
              mechanics.push(link["@_value"]);
            }
          }
        }

        const rankTypes = extractRankTypes(
          item?.statistics?.ratings?.ranks?.rank
        );

        result.set(id, {
          weight: Math.round(weight * 10) / 10,
          minAge,
          categories,
          mechanics,
          rankTypes,
          baseGameIds,
        });
      }
    } catch {
      // Graceful degradation: continue without thing data for this batch
      console.warn(`Failed to fetch thing data for batch starting at ${i}`);
    }
  }

  return result;
}

export function linkExpansionsByThing(
  baseGames: BggGame[],
  expansionItems: BggGame[],
  thingMap: Map<string, ThingData>
): void {
  const baseMap = new Map(baseGames.map((g) => [g.id, g]));

  for (const exp of expansionItems) {
    const thing = thingMap.get(exp.id);
    if (!thing) continue;

    for (const baseId of thing.baseGameIds) {
      const base = baseMap.get(baseId);
      if (base) {
        base.expansions.push({
          id: exp.id,
          name: exp.originalName ?? exp.name,
          year: exp.year,
          thumbnail: exp.thumbnail,
        });
        break;
      }
    }
  }
}

export function enrichWithThingData(
  games: BggGame[],
  thingMap: Map<string, ThingData>
): void {
  for (const game of games) {
    const thing = thingMap.get(game.id);
    if (thing) {
      if (thing.weight > 0) game.weight = thing.weight;
      if (thing.minAge > 0) game.minAge = thing.minAge;
      if (thing.categories.length > 0) game.categories = thing.categories;
      if (thing.mechanics.length > 0) game.mechanics = thing.mechanics;
      if (thing.rankTypes.length > 0 && game.rankTypes.length === 0)
        game.rankTypes = thing.rankTypes;
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// BGG Search & Thing lookup (used by game-matching for external games)
// ---------------------------------------------------------------------------

export interface BggSearchResult {
  id: string;
  name: string;
  year: number;
}

export interface BggThingBasic {
  id: string;
  name: string;
  image: string;
  thumbnail: string;
  weight: number;
  categories: string[];
  /** BGG item type: "boardgame", "rpgitem", "boardgameaccessory", etc. */
  thingType: string;
}

/**
 * Search BGG for games matching a query string.
 * Returns up to `limit` results sorted by BGG relevance.
 * Requires BGG_API_KEY. Returns empty array on error or missing key.
 */
export async function searchBggGames(
  query: string,
  limit = 5
): Promise<BggSearchResult[]> {
  if (!process.env.BGG_API_KEY) return [];

  try {
    const encoded = encodeURIComponent(query);
    const url = `${BGG_BASE}/search?query=${encoded}&type=boardgame,rpgitem,boardgameaccessory&exact=0`;
    const xml = await fetchBggXml(url);
    const parsed = parser.parse(xml);
    const items = parsed?.items?.item;
    if (!items) return [];

    const list = Array.isArray(items) ? items : [items];
    return list.slice(0, limit).map((item) => {
      const nameNode = item.name;
      // Search results can return name as object with @_value or as array
      let name = "";
      if (Array.isArray(nameNode)) {
        const primary = nameNode.find(
          (n: Record<string, string>) => n["@_type"] === "primary"
        );
        name = primary?.["@_value"] ?? nameNode[0]?.["@_value"] ?? "";
      } else if (typeof nameNode === "object" && nameNode !== null) {
        name = nameNode["@_value"] ?? "";
      } else if (typeof nameNode === "string") {
        name = nameNode;
      }

      return {
        id: item["@_id"] as string,
        name,
        year: parseInt(item.yearpublished?.["@_value"] ?? "0", 10) || 0,
      };
    });
  } catch (err) {
    console.warn("[BGG] Search failed for:", query, err);
    return [];
  }
}

/**
 * Fetch basic thing data (image, weight, categories) for a list of BGG IDs.
 * Used to enrich games found via search that aren't in the club collection.
 * Requires BGG_API_KEY. Returns empty map on error or missing key.
 */
export async function fetchBggThings(
  ids: string[]
): Promise<Map<string, BggThingBasic>> {
  const result = new Map<string, BggThingBasic>();
  if (!process.env.BGG_API_KEY || ids.length === 0) return result;

  try {
    // Batch in groups of BATCH_SIZE
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const url = `${BGG_BASE}/thing?id=${batch.join(",")}&stats=1`;
      const xml = await fetchBggXml(url);
      const parsed = parser.parse(xml);
      const items = parsed?.items?.item;
      if (!items) continue;

      const list = Array.isArray(items) ? items : [items];
      for (const item of list) {
        const id = item["@_id"] as string;
        const weight =
          parseFloat(
            item?.statistics?.ratings?.averageweight?.["@_value"] ?? "0"
          ) || 0;

        // Extract primary name
        let name = "";
        const nameNode = item.name;
        if (Array.isArray(nameNode)) {
          const primary = nameNode.find(
            (n: Record<string, string>) => n["@_type"] === "primary"
          );
          name = primary?.["@_value"] ?? nameNode[0]?.["@_value"] ?? "";
        } else if (typeof nameNode === "object" && nameNode !== null) {
          name = nameNode["@_value"] ?? "";
        }

        const categories: string[] = [];
        const links = item?.link;
        if (Array.isArray(links)) {
          for (const link of links) {
            if (
              (link["@_type"] === "boardgamecategory" ||
                link["@_type"] === "rpgcategory") &&
              link["@_value"]
            ) {
              categories.push(link["@_value"]);
            }
          }
        }

        result.set(id, {
          id,
          name,
          image: item.image ?? "",
          thumbnail: item.thumbnail ?? "",
          weight: Math.round(weight * 10) / 10,
          categories,
          thingType: (item["@_type"] as string) ?? "boardgame",
        });
      }
    }
  } catch (err) {
    console.warn("[BGG] Thing fetch failed for IDs:", ids, err);
  }

  return result;
}

export async function fetchBggCollectionCount(): Promise<number> {
  const hasToken = !!process.env.BGG_API_KEY;
  const username = process.env.BGG_USERNAME!;

  try {
    if (hasToken) {
      const url = `${BGG_BASE}/collection?username=${username}&own=1&subtype=boardgame&stats=1`;
      const xml = await fetchBggXml(url, { tags: COLLECTION_TAGS });
      return parseCollectionItems(xml).length;
    } else {
      const xml = await readMockXml("collection.xml");
      const items = parseCollectionItems(xml);
      return items.filter((i) => i["@_subtype"] === "boardgame").length;
    }
  } catch (err) {
    console.error("Failed to fetch BGG collection count:", err);
    return 0;
  }
}

/**
 * Loads the club collection and throws on any failure. Used by the scheduled
 * cache refresh so a failed warm-up is reported; pages use
 * `fetchBggCollection`, which turns the error into a result.
 */
export async function fetchBggCollectionOrThrow(): Promise<BggCollectionResult> {
  const hasToken = !!process.env.BGG_API_KEY;
  const username = process.env.BGG_USERNAME!;

  let baseGames: BggGame[];
  let expansionItems: BggGame[];

  if (hasToken) {
    // Production mode: two separate calls (API doesn't accept combined subtypes)
    const baseUrl = `${BGG_BASE}/collection?username=${username}&own=1&subtype=boardgame&stats=1`;
    const expUrl = `${BGG_BASE}/collection?username=${username}&own=1&subtype=boardgameexpansion&stats=1`;
    const [baseXml, expXml] = await Promise.all([
      fetchBggXml(baseUrl, { tags: COLLECTION_TAGS }),
      fetchBggXml(expUrl, { tags: COLLECTION_TAGS }),
    ]);

    expansionItems = parseCollectionItems(expXml).map(rawToGame);

    // BGG may return expansions in the base call with subtype="boardgame",
    // so remove any overlap — the expansion call is the source of truth.
    const expIds = new Set(expansionItems.map((g) => g.id));
    baseGames = parseCollectionItems(baseXml)
      .map(rawToGame)
      .filter((g) => !expIds.has(g.id));

    // Fetch thing data for all items (weight, minAge, expansion links)
    const allIds = [...baseGames, ...expansionItems].map((g) => g.id);
    const thingMap = await fetchThingData(allIds);
    enrichWithThingData(baseGames, thingMap);
    enrichWithThingData(expansionItems, thingMap);
    linkExpansionsByThing(baseGames, expansionItems, thingMap);
  } else {
    // Mock mode: collection.xml + things.xml (enrichment data)
    const [collectionXml, thingsXml] = await Promise.all([
      readMockXml("collection.xml"),
      readMockXml("things.xml"),
    ]);

    const allGames = parseCollectionItems(collectionXml).map(rawToGame);
    const thingMap = parseMockThings(thingsXml);
    enrichWithThingData(allGames, thingMap);

    baseGames = allGames.filter((g) => g.subtype === "boardgame");
    expansionItems = allGames.filter(
      (g) => g.subtype === "boardgameexpansion"
    );

    linkExpansionsByThing(baseGames, expansionItems, thingMap);
  }

  // Combine base games + expansions, deduplicate
  const allItems = [...baseGames, ...expansionItems];
  const seen = new Set<string>();
  const deduped = allItems.filter((g) => {
    if (seen.has(g.id)) return false;
    seen.add(g.id);
    return true;
  });

  // Sort alphabetically by name
  deduped.sort((a, b) => a.name.localeCompare(b.name));

  const baseCount = deduped.filter((g) => g.subtype === "boardgame").length;

  return {
    games: deduped,
    baseCount,
    totalWithExpansions: deduped.length,
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchBggCollection(): Promise<BggCollectionResult> {
  try {
    return await fetchBggCollectionOrThrow();
  } catch (err) {
    console.error("Failed to fetch BGG collection:", err);

    const message = err instanceof Error ? err.message : String(err);
    let errorType: BggCollectionResult["error"] = "api_error";
    if (message.includes("timeout")) errorType = "timeout";
    if (message.includes("parse")) errorType = "parse_error";

    return {
      games: [],
      baseCount: 0,
      totalWithExpansions: 0,
      fetchedAt: new Date().toISOString(),
      error: errorType,
    };
  }
}
