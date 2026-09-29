#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Ludoya API health check
// ---------------------------------------------------------------------------
// Verifies, against the live API, every assumption the events page makes:
// the group id resolves, the events feed has the expected shape, planned
// plays can be read from child events, and images are reachable.
//
//   npm run ludoya:check
//
// Exit code 1 on any failure so it can run in CI (.github/workflows/ludoya-check.yml).
// No dependencies: runs with Node 18+ built-in fetch.
//
// Defaults mirror src/lib/ludoya/config.ts; override with the same env vars.

const API_URL = (process.env.LUDOYA_API_URL || "https://api.ludoya.com").replace(/\/$/, "");
const GROUP_ID = process.env.LUDOYA_GROUP_ID || "b28a80d31be24cffa35d9176c3f1ac50";
const GROUP_USERNAME = process.env.LUDOYA_GROUP_USERNAME || "darkstonecat";
const GROUP_SEARCH_QUERY = process.env.LUDOYA_GROUP_SEARCH_QUERY || "darkstone";
const IMAGE_BASE_URL =
  process.env.LUDOYA_IMAGE_BASE_URL || "https://ludoya-images.s3.eu-west-par.io.cloud.ovh.net";
const TIMEOUT_MS = 20_000;

const failures = [];
const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
  failures.push(msg);
  console.log(`  ✗ ${msg}`);
};
const section = (title) => console.log(`\n${title}`);

async function getJson(path) {
  const url = `${API_URL}${path}`;
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { url, status: res.status, ok: res.ok, body };
}

// Returns 200 when the image is reachable, otherwise the failing HTTP status or
// a "network error: ..." string. Never throws, so a transient network failure
// is recorded as a failed check instead of aborting the whole run.
// The image host sometimes hangs on HEAD while GET on the same object succeeds,
// so a failed HEAD is retried once as a 1-byte ranged GET.
async function head(url) {
  const attempts = [
    () => fetch(url, { method: "HEAD", signal: AbortSignal.timeout(TIMEOUT_MS) }),
    () => fetch(url, { headers: { range: "bytes=0-0" }, signal: AbortSignal.timeout(TIMEOUT_MS) }),
  ];
  let failure;
  for (const attempt of attempts) {
    try {
      const res = await attempt();
      await res.body?.cancel();
      if (res.status === 200 || res.status === 206) return 200;
      failure = res.status;
    } catch (error) {
      failure = `network error: ${error?.cause?.code ?? error?.name ?? error?.message}`;
    }
  }
  return failure;
}

const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const keysOf = (v) => (isObject(v) ? `{${Object.keys(v).slice(0, 15).join(", ")}}` : typeof v);

function expectField(obj, key, type, ctx, { optional = false } = {}) {
  const value = obj?.[key];
  if (value === undefined || value === null) {
    if (optional) return true;
    fail(`${ctx}.${key} missing — got ${keysOf(obj)}`);
    return false;
  }
  const actual = Array.isArray(value) ? "array" : typeof value;
  if (actual !== type) {
    fail(`${ctx}.${key} expected ${type}, got ${actual}`);
    return false;
  }
  return true;
}

async function main() {
  console.log(`Ludoya API check — ${API_URL} — group ${GROUP_USERNAME} (${GROUP_ID})`);

  // 1. Group id still resolves and matches the username -------------------
  section("1. Group");
  let groupId = GROUP_ID;
  const search = await getJson(`/groups/search?nameFilter=${encodeURIComponent(GROUP_SEARCH_QUERY)}`);
  if (!search.ok || !Array.isArray(search.body?.elements)) {
    fail(`GET ${search.url} → ${search.status} ${keysOf(search.body)}`);
  } else {
    const match = search.body.elements.find((g) => g?.username === GROUP_USERNAME);
    if (!match) fail(`No group with username "${GROUP_USERNAME}" among results for nameFilter="${GROUP_SEARCH_QUERY}"`);
    else if (match.id !== GROUP_ID) {
      fail(`Group id changed: configured ${GROUP_ID}, API says ${match.id}. Set LUDOYA_GROUP_ID=${match.id}`);
      groupId = match.id;
    } else ok(`Group id ${GROUP_ID} matches username "${GROUP_USERNAME}"`);
  }

  // 2. Events feed ---------------------------------------------------------
  section("2. Events feed");
  const events = await getJson(`/users/${groupId}/events?displayAllRecurring=true`);
  let elements = [];
  if (!events.ok) {
    fail(`GET ${events.url} → ${events.status} ${JSON.stringify(events.body ?? "").slice(0, 200)}`);
  } else if (!Array.isArray(events.body?.futureEvents?.elements)) {
    fail(`futureEvents.elements missing — top-level keys ${keysOf(events.body)}`);
  } else {
    elements = events.body.futureEvents.elements;
    ok(`GET /users/{groupId}/events → ${elements.length} future events`);
    if (elements.length === 0) fail("Feed returned zero future events (expected weekly sessions)");
    const first = elements[0];
    const ctx = "futureEvents.elements[0]";
    for (const [key, type] of [
      ["id", "string"],
      ["title", "string"],
      ["startsAt", "string"],
      ["endsAt", "string"],
      ["timeZone", "string"],
    ]) {
      expectField(first, key, type, ctx);
    }
    expectField(first, "canceled", "boolean", ctx, { optional: true });
    expectField(first, "imageUrl", "string", ctx, { optional: true });
    if (expectField(first, "childEventCounts", "object", ctx, { optional: true }) && first.childEventCounts) {
      expectField(first.childEventCounts, "games", "number", `${ctx}.childEventCounts`, { optional: true });
    }
    if (first?.startsAt && Number.isNaN(Date.parse(first.startsAt))) fail(`${ctx}.startsAt is not an ISO date`);
    const notCanceled = elements.filter((e) => !e.canceled).length;
    ok(`${notCanceled} active, ${elements.length - notCanceled} cancelled`);
  }

  // 3. Planned plays via child events ------------------------------------
  section("3. Planned plays (child events)");
  const withGames = elements.find((e) => (e.childEventCounts?.games ?? 0) > 0);
  if (!withGames) {
    console.log("  – No upcoming event has planned games yet; skipping children check");
  } else {
    const children = await getJson(`/events/${withGames.id}/children`);
    if (!children.ok || !Array.isArray(children.body?.list)) {
      fail(`GET ${children.url} → ${children.status} ${keysOf(children.body)}`);
    } else {
      const plays = children.body.list.filter((c) => isObject(c?.game));
      ok(`GET /events/{id}/children → ${children.body.list.length} children, ${plays.length} with a game`);
      if (plays.length === 0) fail("childEventCounts.games > 0 but no child carries a game object");
      const game = plays[0]?.game;
      if (game) {
        expectField(game, "name", "string", "children.list[0].game");
        expectField(game, "yearPublished", "number", "children.list[0].game", { optional: true });
        expectField(game, "type", "string", "children.list[0].game", { optional: true });
        if (expectField(game, "slug", "string", "children.list[0].game")) {
          // Event images resolve games on BGG through the link in Ludoya's game detail.
          const detail = await getJson(`/boardgames/${encodeURIComponent(game.slug)}`);
          if (!detail.ok) {
            fail(`GET ${detail.url} → ${detail.status} ${keysOf(detail.body)}`);
          } else if (typeof detail.body?.bggUrl !== "string") {
            fail(`boardgames/${game.slug}.bggUrl missing — got ${keysOf(detail.body)}`);
          } else if (!/^https?:\/\/(?:www\.)?boardgamegeek\.com\/[a-z]+\/\d+/i.test(detail.body.bggUrl)) {
            fail(`boardgames/${game.slug}.bggUrl has an unexpected format: ${detail.body.bggUrl}`);
          } else {
            ok(`GET /boardgames/{slug} → BGG link ${detail.body.bggUrl}`);
          }
        }
        if (expectField(game, "imageId", "string", "children.list[0].game", { optional: true }) && game.imageId) {
          const url = `${IMAGE_BASE_URL}/${game.imageId}.jpg`;
          const status = await head(url);
          if (status === 200) ok(`Game image reachable: ${url}`);
          else fail(`Game image ${url} → ${status}`);
        }
      }
    }
  }

  // 4. Event images ----------------------------------------------------------
  // The feed only carries reduced images; the site derives the original by
  // stripping the size suffix. Check every distinct image in the feed.
  section("4. Event images");
  const previews = [...new Set(elements.map((e) => e.imageUrl).filter((u) => typeof u === "string"))];
  if (previews.length === 0) {
    console.log("  – No upcoming event has an image; skipping");
  } else {
    let reachable = 0;
    let checked = 0;
    for (const preview of previews) {
      if (!preview.startsWith(IMAGE_BASE_URL)) {
        fail(`Event image host changed: ${preview} (expected ${IMAGE_BASE_URL}); update next.config.ts remotePatterns + CSP`);
        continue;
      }
      const full = preview.replace(/[-_](?:preview|thumbnail)(\.[a-z0-9]+)$/i, "$1");
      for (const url of new Set([preview, full])) {
        checked++;
        const status = await head(url);
        if (status === 200) reachable++;
        else fail(`Event image ${url} → ${status}`);
      }
    }
    // Each failing URL is already reported above, so only claim success when
    // every one of them was reachable; a ✓ next to "0 reachable" reads as a pass.
    const summary = `${previews.length} distinct event images, ${reachable}/${checked} URLs reachable (reduced + original)`;
    if (reachable === checked) ok(summary);
    else console.log(`  – ${summary}`);
  }

  // Summary ----------------------------------------------------------------
  console.log("");
  if (failures.length === 0) {
    console.log("All Ludoya checks passed.");
    return;
  }
  console.log(`${failures.length} check(s) failed:`);
  for (const f of failures) console.log(`  - ${f}`);
  console.log("\nSee docs/ludoya-api-reference.md for how to rediscover endpoints.");
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(`\nUnexpected error: ${error?.message ?? error}`);
  process.exitCode = 1;
});
