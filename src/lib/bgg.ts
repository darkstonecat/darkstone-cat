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
const MAX_RETRIES = 5;
const BATCH_SIZE = 20;

async function fetchBggXml(url: string): Promise<string> {
  const token = process.env.BGG_API_TOKEN;
  if (!token) throw new Error("BGG_API_TOKEN not set");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  let delay = 2000;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(url, { headers, next: { revalidate: 86400 } });

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

interface RawCollectionItem {
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
    };
  };
}

function textValue(v: string | { "#text": string } | undefined): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  return v["#text"] ?? "";
}

function parseCollectionItems(xml: string): RawCollectionItem[] {
  const parsed = parser.parse(xml);
  const items = parsed?.items?.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

function rawToGame(item: RawCollectionItem): BggGame {
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
    expansions: [],
  };
}

// ---------------------------------------------------------------------------
// Expansion linking: name-based heuristic
// ---------------------------------------------------------------------------

function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/[()[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function linkExpansionsByName(
  baseGames: BggGame[],
  expansionItems: BggGame[]
): void {
  const sortedBases = [...baseGames].sort(
    (a, b) => b.name.length - a.name.length
  );

  for (const exp of expansionItems) {
    const expNameNorm = normalizeForMatch(exp.originalName ?? exp.name);

    for (const base of sortedBases) {
      const baseNameNorm = normalizeForMatch(base.originalName ?? base.name);
      if (baseNameNorm.length < 3) continue;

      if (
        expNameNorm.startsWith(baseNameNorm + ":") ||
        expNameNorm.startsWith(baseNameNorm + " –") ||
        expNameNorm.startsWith(baseNameNorm + " —") ||
        expNameNorm.startsWith(baseNameNorm + " -")
      ) {
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

    const categories: string[] = [];
    const mechanics: string[] = [];
    const links = item?.link;
    if (Array.isArray(links)) {
      for (const link of links) {
        const type = link["@_type"];
        if (type === "boardgamecategory" && link["@_value"]) {
          categories.push(link["@_value"]);
        } else if (type === "boardgamemechanic" && link["@_value"]) {
          mechanics.push(link["@_value"]);
        }
      }
    }

    result.set(id, {
      weight: Math.round(weight * 10) / 10,
      minAge,
      categories,
      mechanics,
      baseGameIds: [],
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Expansion linking + enrichment via thing endpoint (production mode)
// ---------------------------------------------------------------------------

interface ThingData {
  weight: number;
  minAge: number;
  categories: string[];
  mechanics: string[];
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

        result.set(id, {
          weight: Math.round(weight * 10) / 10,
          minAge,
          categories,
          mechanics,
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

function linkExpansionsByThing(
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

function enrichWithThingData(
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
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function fetchBggCollection(): Promise<BggCollectionResult> {
  const hasToken = !!process.env.BGG_API_TOKEN;
  const username = process.env.BGG_USERNAME ?? "citizen987";

  try {
    let baseGames: BggGame[];
    let expansionItems: BggGame[];

    if (hasToken) {
      // Production mode: single collection call with both subtypes
      const collectionUrl = `${BGG_BASE}/collection?username=${username}&own=1&subtype=boardgame,boardgameexpansion&stats=1`;
      const collectionXml = await fetchBggXml(collectionUrl);
      const allItems = parseCollectionItems(collectionXml).map(rawToGame);

      baseGames = allItems.filter((g) => g.subtype === "boardgame");
      expansionItems = allItems.filter(
        (g) => g.subtype === "boardgameexpansion"
      );

      // Fetch thing data for all items (weight, minAge, expansion links)
      const allIds = allItems.map((g) => g.id);
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

      // Separate expansions identified by "Expansion for Base-game" category
      const EXPANSION_CAT = "Expansion for Base-game";
      baseGames = allGames.filter((g) => !g.categories.includes(EXPANSION_CAT));
      expansionItems = allGames.filter((g) =>
        g.categories.includes(EXPANSION_CAT)
      );

      // Mark expansion subtypes (collection.xml has all as "boardgame")
      for (const exp of expansionItems) {
        exp.subtype = "boardgameexpansion";
      }

      // Strip the metadata category from display
      for (const game of [...baseGames, ...expansionItems]) {
        game.categories = game.categories.filter((c) => c !== EXPANSION_CAT);
      }

      linkExpansionsByName(baseGames, expansionItems);
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
