// ---------------------------------------------------------------------------
// Ludoya integration — HTTP client
// ---------------------------------------------------------------------------
// Thin fetch wrapper with timeout, retry with exponential backoff, typed
// errors, a mock mode backed by fixtures, and group-id rediscovery.

import fs from "node:fs/promises";
import path from "node:path";
import { ludoyaConfig, ludoyaEndpoints } from "./config";

export class LudoyaApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | null,
    public readonly url: string,
    message?: string
  ) {
    super(`Ludoya API ${status}${code ? ` (${code})` : ""}: ${message ?? url}`);
    this.name = "LudoyaApiError";
  }
}

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

function isTimeout(error: unknown): boolean {
  return error instanceof Error && error.name === "TimeoutError";
}

function isRetryable(error: unknown): boolean {
  if (error instanceof LudoyaApiError) return RETRYABLE_STATUSES.has(error.status);
  // Timeouts and network failures ("fetch failed") are worth another try.
  return true;
}

async function readErrorBody(res: Response): Promise<{ code: string | null; message?: string }> {
  try {
    const body = (await res.json()) as { code?: unknown; message?: unknown };
    return {
      code: typeof body.code === "string" ? body.code : null,
      message: typeof body.message === "string" ? body.message : undefined,
    };
  } catch {
    return { code: null };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * GET a Ludoya endpoint and return the parsed JSON body.
 * Retries on timeouts, network errors and retryable statuses; fails fast on
 * other 4xx responses so a wrong id or a removed route surfaces immediately.
 */
export async function ludoyaGet<T = unknown>(
  endpointPath: string,
  { revalidate = ludoyaConfig.revalidateSeconds }: { revalidate?: number } = {}
): Promise<T> {
  if (ludoyaConfig.mock) return readMock<T>(endpointPath);

  const url = `${ludoyaConfig.apiUrl}${endpointPath}`;
  let lastError: unknown;

  for (let attempt = 1; attempt <= ludoyaConfig.retryAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(ludoyaConfig.requestTimeoutMs),
        // Next.js only stores 200 responses in its data cache. When an entry
        // is stale it serves the old response and refetches in the background;
        // a failed refetch keeps the old entry. So if Ludoya goes down, the
        // site keeps showing the last good data instead of an error state.
        next: { revalidate },
      });
      if (res.ok) return (await res.json()) as T;
      const { code, message } = await readErrorBody(res);
      throw new LudoyaApiError(res.status, code, url, message);
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === ludoyaConfig.retryAttempts) break;
      const delay = ludoyaConfig.retryBaseDelayMs * 2 ** (attempt - 1);
      console.warn(
        `[Ludoya] ${describeError(error)} — retrying in ${delay}ms (attempt ${attempt}/${ludoyaConfig.retryAttempts})`
      );
      await sleep(delay);
    }
  }
  throw lastError;
}

export function isTimeoutError(error: unknown): boolean {
  return isTimeout(error);
}

export function describeError(error: unknown): string {
  if (error instanceof LudoyaApiError) return error.message;
  if (isTimeout(error)) return `Ludoya request timed out after ${ludoyaConfig.requestTimeoutMs}ms`;
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

// ---------------------------------------------------------------------------
// Group id rediscovery
// ---------------------------------------------------------------------------

// Cached per server instance; the configured id is used until it fails.
let rediscoveredGroupId: string | null = null;

/** Look the group up by username through the public search endpoint. */
export async function discoverGroupId(): Promise<string | null> {
  const username = ludoyaConfig.groupUsername;
  const raw = await ludoyaGet<{ elements?: unknown }>(
    ludoyaEndpoints.groupSearch(ludoyaConfig.groupSearchQuery)
  );
  if (!Array.isArray(raw?.elements)) return null;
  const match = raw.elements.find(
    (g): g is { id: string; username: string } =>
      typeof g === "object" && g !== null &&
      (g as { username?: unknown }).username === username &&
      typeof (g as { id?: unknown }).id === "string"
  );
  return match?.id ?? null;
}

/**
 * Fetch the group's events. If the configured group id no longer resolves,
 * rediscover it by username once and retry, logging what changed.
 */
export async function fetchGroupEventsRaw(): Promise<unknown> {
  const groupId = rediscoveredGroupId ?? ludoyaConfig.groupId;
  try {
    return await ludoyaGet(ludoyaEndpoints.groupEvents(groupId));
  } catch (error) {
    if (!(error instanceof LudoyaApiError) || error.status !== 404) throw error;

    console.warn(
      `[Ludoya] ${error.message}. Rediscovering group id by username "${ludoyaConfig.groupUsername}"…`
    );
    const discovered = await discoverGroupId().catch((e) => {
      console.warn(`[Ludoya] Group rediscovery failed: ${describeError(e)}`);
      return null;
    });

    if (!discovered) throw error;
    if (discovered === groupId) {
      console.error(
        `[Ludoya] Group id ${groupId} is still valid, so the endpoint itself changed: ${error.url}`
      );
      throw error;
    }

    console.warn(
      `[Ludoya] Group id changed ${groupId} → ${discovered}. Set LUDOYA_GROUP_ID=${discovered} to silence this.`
    );
    rediscoveredGroupId = discovered;
    return ludoyaGet(ludoyaEndpoints.groupEvents(discovered));
  }
}

// ---------------------------------------------------------------------------
// Mock mode (LUDOYA_MOCK=1) — fixtures captured from the live API
// ---------------------------------------------------------------------------

function mockFileFor(endpointPath: string): string | null {
  const pathname = endpointPath.split("?")[0];
  if (/^\/users\/[^/]+\/events$/.test(pathname)) return "events.json";
  if (pathname === "/groups/search") return "groups-search.json";
  const boardgame = pathname.match(/^\/boardgames\/([^/]+)$/);
  if (boardgame) return `boardgames/${decodeURIComponent(boardgame[1])}.json`;
  const children = pathname.match(/^\/events\/([^/]+)\/children$/);
  if (children) return `children-${children[1]}.json`;
  return null;
}

async function readMock<T>(endpointPath: string): Promise<T> {
  const file = mockFileFor(endpointPath);
  if (!file) {
    throw new LudoyaApiError(404, "mock_missing", endpointPath, `No fixture for ${endpointPath}`);
  }
  const fullPath = path.join(process.cwd(), "public", "mock", "ludoya", file);
  try {
    return JSON.parse(await fs.readFile(fullPath, "utf-8")) as T;
  } catch {
    // Not every event has a captured children fixture; treat as "no games".
    if (file.startsWith("children-")) return { list: [] } as T;
    throw new LudoyaApiError(404, "mock_missing", endpointPath, `Fixture not found: ${fullPath}`);
  }
}
