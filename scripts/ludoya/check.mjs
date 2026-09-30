#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Ludoya public API health check
// ---------------------------------------------------------------------------
// Verifies, against the live public API (v1), every assumption the site makes:
// the key works, locations and the events feed have the expected shape,
// planned plays come as sub-events, user search answers, and images are
// reachable.
//
//   npm run ludoya:check        (reads LUDOYA_API_KEY from .env.local or the environment)
//
// Exit code 1 on any failure so it can run in CI (.github/workflows/ludoya-check.yml).
// No dependencies: runs with Node 18+ built-in fetch. Uses GET requests only and
// about six calls per run, far below the 100 requests/minute Business limit.
//
// Defaults mirror src/lib/ludoya/config.ts; override with the same env vars.

import fs from "node:fs";

function loadLocalEnv() {
  // Convenience for local runs; CI provides the variable directly.
  for (const file of [".env.local", ".env"]) {
    try {
      for (const line of fs.readFileSync(file, "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    } catch {
      // No such file: fine.
    }
  }
}
loadLocalEnv();

const API_URL = (process.env.LUDOYA_API_URL || "https://api.ludoya.com").replace(/\/$/, "");
const API_KEY = process.env.LUDOYA_API_KEY;
const IMAGE_HOST = "ludoya-images.s3.eu-west-par.io.cloud.ovh.net";
const TIMEOUT_MS = 20_000;

const failures = [];
const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
  failures.push(msg);
  console.log(`  ✗ ${msg}`);
};
const section = (title) => console.log(`\n${title}`);

async function getJson(path) {
  const url = `${API_URL}/public/v1${path}`;
  const res = await fetch(url, {
    headers: { accept: "application/json", "X-Api-Key": API_KEY },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  // Never print the key; only the path is reported.
  return { url: `/public/v1${path}`, status: res.status, ok: res.ok, body, headers: res.headers };
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
  console.log(`Ludoya public API check — ${API_URL}`);

  if (!API_KEY) {
    fail("LUDOYA_API_KEY is not set (add it to .env.local, or as the LUDOYA_API_KEY secret in GitHub)");
    return finish();
  }

  // 1. Key + locations -------------------------------------------------------
  section("1. Key and locations");
  const locations = await getJson("/locations");
  if (locations.status === 401 || locations.status === 403) {
    fail(`GET ${locations.url} → ${locations.status} ${body(locations)} — the API key was rejected or expired`);
    return finish();
  }
  if (!locations.ok || !Array.isArray(locations.body?.locations)) {
    fail(`GET ${locations.url} → ${locations.status} ${keysOf(locations.body)}`);
  } else {
    const list = locations.body.locations;
    ok(`GET /locations → ${list.length} locations (rate limit remaining: ${locations.headers.get("x-ratelimit-remaining") ?? "n/a"})`);
    const defaults = list.filter((l) => l?.isDefault === true);
    if (defaults.length === 1) ok(`Usual venue: "${defaults[0].name}"`);
    else fail(`Expected exactly one default location, found ${defaults.length}`);
    for (const [key, type] of [["id", "string"], ["name", "string"]]) expectField(list[0], key, type, "locations[0]");
    expectField(list[0], "address", "string", "locations[0]", { optional: true });
    expectField(list[0], "isDefault", "boolean", "locations[0]");
  }

  // 2. Events feed (with sub-events) ----------------------------------------
  section("2. Events feed");
  const events = await getJson("/events?includeSubEvents=true");
  let elements = [];
  if (!events.ok) {
    fail(`GET ${events.url} → ${events.status} ${body(events)}`);
  } else if (!Array.isArray(events.body?.futureEvents?.elements)) {
    fail(`futureEvents.elements missing — top-level keys ${keysOf(events.body)}`);
  } else {
    elements = events.body.futureEvents.elements;
    ok(`GET /events?includeSubEvents=true → ${elements.length} future events and sub-events`);
    if (elements.length === 0) fail("Feed returned zero future events (expected weekly sessions)");
    if (!Array.isArray(events.body?.pastEvents?.elements)) fail("pastEvents.elements missing");
    const first = elements[0];
    const ctx = "futureEvents.elements[0]";
    for (const [key, type] of [
      ["id", "string"],
      ["type", "string"],
      ["title", "string"],
      ["startsAt", "string"],
      ["endsAt", "string"],
      ["timeZone", "string"],
      ["participantCount", "number"],
      ["visibility", "string"],
    ]) {
      expectField(first, key, type, ctx);
    }
    for (const key of ["canceled", "draft"]) expectField(first, key, "boolean", ctx, { optional: true });
    for (const key of ["capacity", "minParticipants"]) expectField(first, key, "number", ctx, { optional: true });
    expectField(first, "imageUrl", "string", ctx, { optional: true });
    if (expectField(first, "location", "object", ctx, { optional: true }) && first.location) {
      expectField(first.location, "id", "string", `${ctx}.location`);
      expectField(first.location, "name", "string", `${ctx}.location`);
    }
    if (first?.startsAt && Number.isNaN(Date.parse(first.startsAt))) fail(`${ctx}.startsAt is not an ISO date`);
    const sessions = elements.filter((e) => !e.parentId && e.type === "MEETUP");
    if (sessions.length === 0) fail("No top-level MEETUP among the future events");
    else ok(`${sessions.length} sessions (top-level MEETUP), ${elements.length - sessions.length} other events`);
  }

  // 3. Planned plays as sub-events ------------------------------------------
  section("3. Planned plays (sub-events)");
  const plays = elements.filter((e) => e.parentId && isObject(e.game));
  if (plays.length === 0) {
    console.log("  – No upcoming session has planned games yet; skipping play checks");
  } else {
    ok(`${plays.length} planned plays come inline with parentId`);
    const play = plays[0];
    expectField(play, "startsAt", "string", "play");
    expectField(play.game, "name", "string", "play.game");
    expectField(play.game, "slug", "string", "play.game");
    expectField(play.game, "imageUrl", "string", "play.game", { optional: true });
    expectField(play.game, "yearPublished", "number", "play.game", { optional: true });
    const sessionIds = new Set(elements.filter((e) => !e.parentId).map((e) => e.id));
    if (!plays.some((p) => sessionIds.has(p.parentId))) fail("No play's parentId matches a listed session");

    const children = await getJson(`/events/${play.parentId}/children`);
    if (!children.ok || !Array.isArray(children.body?.children)) {
      fail(`GET ${children.url} → ${children.status} ${keysOf(children.body)}`);
    } else {
      ok(`GET /events/{id}/children → ${children.body.children.length} children`);
    }
  }

  // 4. User search ------------------------------------------------------------
  section("4. User search");
  const users = await getJson("/search/users?query=a&intent=PLAY&pagination=1,0");
  if (!users.ok || !Array.isArray(users.body?.users?.elements)) {
    fail(`GET ${users.url} → ${users.status} ${keysOf(users.body)}`);
  } else {
    ok("GET /search/users?intent=PLAY → users.elements is an array");
    const user = users.body.users.elements[0];
    if (user) {
      expectField(user, "id", "string", "users.elements[0]");
      expectField(user, "username", "string", "users.elements[0]");
    }
  }

  // 5. Images -----------------------------------------------------------------
  section("5. Images");
  const urls = [
    ...new Set(
      elements.flatMap((e) => [e.imageUrl, e.game?.imageUrl]).filter((u) => typeof u === "string")
    ),
  ].slice(0, 12);
  if (urls.length === 0) {
    console.log("  – No event or game has an image; skipping");
  } else {
    let reachable = 0;
    for (const url of urls) {
      if (new URL(url).host !== IMAGE_HOST) {
        fail(`Image host changed: ${url} (expected ${IMAGE_HOST}); update next.config.ts remotePatterns + CSP`);
        continue;
      }
      const status = await head(url);
      if (status === 200) reachable++;
      else fail(`Image ${url} → ${status}`);
    }
    const summary = `${reachable}/${urls.length} sampled image URLs reachable`;
    if (reachable === urls.length) ok(summary);
    else console.log(`  – ${summary}`);
  }

  finish();
}

function body(res) {
  return JSON.stringify(res.body ?? "").slice(0, 200);
}

function finish() {
  console.log("");
  if (failures.length === 0) {
    console.log("All Ludoya checks passed.");
    return;
  }
  console.log(`${failures.length} check(s) failed:`);
  for (const f of failures) console.log(`  - ${f}`);
  console.log("\nSee docs/ludoya-api-reference.md for how to investigate.");
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(`\nUnexpected error: ${error?.message ?? error}`);
  process.exitCode = 1;
});
