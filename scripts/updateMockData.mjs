// scripts/updateMockData.mjs
// Fetches real BGG data using the API and updates public/mock/ XML files.
//
// Usage:
//   node scripts/updateMockData.mjs
//
// Requires env vars BGG_USERNAME and BGG_API_KEY (reads from .env.local automatically).

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MOCK_DIR = path.join(ROOT, "public", "mock");

// ---------------------------------------------------------------------------
// Load .env.local
// ---------------------------------------------------------------------------

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const envPath = path.join(ROOT, file);
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

loadEnv();

const USERNAME = process.env.BGG_USERNAME;
const API_KEY = process.env.BGG_API_KEY;

if (!USERNAME || !API_KEY) {
  console.error("Error: BGG_USERNAME and BGG_API_KEY must be set in .env.local");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// BGG fetch with retry (handles 202 "please wait" responses)
// ---------------------------------------------------------------------------

const BGG_BASE = "https://boardgamegeek.com/xmlapi2";
const MAX_RETRIES = 8;
const BATCH_SIZE = 20;

async function fetchBgg(url) {
  let delay = 3000;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    console.log(`  → fetch ${attempt + 1}/${MAX_RETRIES}: ${url.replace(BGG_BASE, "")}`);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    if (res.status === 200) return res.text();

    if (res.status === 202) {
      console.log(`    ⏳ BGG queuing request, retrying in ${delay / 1000}s...`);
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, 30000);
      continue;
    }

    throw new Error(`BGG API error: HTTP ${res.status} — ${await res.text()}`);
  }
  throw new Error("BGG API timeout: too many 202 responses");
}

// ---------------------------------------------------------------------------
// Extract item IDs from collection XML
// ---------------------------------------------------------------------------

function extractIds(collectionXml) {
  const ids = [];
  const re = /objectid="(\d+)"/g;
  let match;
  while ((match = re.exec(collectionXml)) !== null) {
    ids.push(match[1]);
  }
  return [...new Set(ids)];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n📦 Fetching BGG collection for user "${USERNAME}"...\n`);

  // 1. Fetch collection (two calls — API doesn't accept combined subtypes)
  const baseUrl = `${BGG_BASE}/collection?username=${USERNAME}&own=1&subtype=boardgame&stats=1`;
  const expUrl = `${BGG_BASE}/collection?username=${USERNAME}&own=1&subtype=boardgameexpansion&stats=1`;
  const [baseXml, expXml] = await Promise.all([fetchBgg(baseUrl), fetchBgg(expUrl)]);

  const baseIds = extractIds(baseXml);
  const expIds = extractIds(expXml);
  const ids = [...new Set([...baseIds, ...expIds])];
  console.log(`\n✅ Collection fetched: ${baseIds.length} base games + ${expIds.length} expansions = ${ids.length} total\n`);

  // Merge both XMLs into a single collection.xml
  const baseItems = baseXml.match(/<items[^>]*>([\s\S]*)<\/items>/);
  const expItems = expXml.match(/<items[^>]*>([\s\S]*)<\/items>/);
  const totalCount = baseIds.length + expIds.length;
  const collectionXml = `<?xml version="1.0" encoding="utf-8" standalone="yes" ?>\n<items totalitems="${totalCount}" termsofuse="https://boardgamegeek.com/xmlapi/termsofuse" pubdate="${ new Date().toISOString()}">\n${(baseItems?.[1] ?? "").trim()}\n${(expItems?.[1] ?? "").trim()}\n</items>`;

  // 2. Fetch thing data in batches
  console.log(`📦 Fetching thing data (${Math.ceil(ids.length / BATCH_SIZE)} batches)...\n`);

  const thingChunks = [];
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const url = `${BGG_BASE}/thing?id=${batch.join(",")}&stats=1`;
    const xml = await fetchBgg(url);
    thingChunks.push(xml);
  }

  // Merge thing XML responses into a single document
  const thingItems = thingChunks.flatMap((xml) => {
    const match = xml.match(/<items[^>]*>([\s\S]*)<\/items>/);
    return match ? [match[1].trim()] : [];
  });

  const thingsXml = `<?xml version="1.0" encoding="utf-8"?>\n<items termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">\n${thingItems.join("\n")}\n</items>`;

  // 3. Write files
  fs.mkdirSync(MOCK_DIR, { recursive: true });

  fs.writeFileSync(path.join(MOCK_DIR, "collection.xml"), collectionXml, "utf-8");
  console.log(`\n✅ Saved public/mock/collection.xml`);

  fs.writeFileSync(path.join(MOCK_DIR, "things.xml"), thingsXml, "utf-8");
  console.log(`✅ Saved public/mock/things.xml`);

  console.log(`\n🎉 Mock data updated successfully!\n`);
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
