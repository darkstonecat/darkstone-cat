// ---------------------------------------------------------------------------
// Ludoya integration — public API HTTP client
// ---------------------------------------------------------------------------
// Server-only fetch wrapper: `X-Api-Key` header, timeout, retry with backoff,
// `Retry-After` handling, typed error codes and a mock mode backed by
// fixtures. The key never leaves the server.

import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { LUDOYA_API_PREFIX, ludoyaConfig } from "./config";

/** Codes the API documents, plus the ones the client raises itself. */
export type LudoyaErrorCode =
  | "validation_failed"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "missing_api_key"
  | "timeout"
  | "network"
  | "mock_missing"
  | "unknown";

const API_CODES = new Set<string>([
  "validation_failed",
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "rate_limited",
]);

export class LudoyaApiError extends Error {
  constructor(
    /** HTTP status, or null when no response was received. */
    public readonly status: number | null,
    public readonly code: LudoyaErrorCode,
    /** Request path (never carries the key). */
    public readonly url: string,
    message?: string,
    /** Seconds the API asked to wait (429 only). */
    public readonly retryAfterSeconds: number | null = null
  ) {
    super(`Ludoya API ${status ?? "no response"} (${code}): ${message ?? url}`);
    this.name = "LudoyaApiError";
  }
}

const RETRYABLE_STATUSES = new Set([408, 425, 500, 502, 503, 504]);

function isRetryable(error: unknown): boolean {
  if (error instanceof LudoyaApiError) {
    if (error.code === "rate_limited") return true;
    if (error.status === null) return error.code === "timeout" || error.code === "network";
    return RETRYABLE_STATUSES.has(error.status);
  }
  return false;
}

async function readErrorBody(res: Response): Promise<{ code: LudoyaErrorCode; message?: string }> {
  try {
    const body = (await res.json()) as { code?: unknown; message?: unknown };
    const code = typeof body.code === "string" && API_CODES.has(body.code) ? (body.code as LudoyaErrorCode) : null;
    return {
      code: code ?? (res.status === 429 ? "rate_limited" : "unknown"),
      message: typeof body.message === "string" ? body.message : undefined,
    };
  } catch {
    return { code: res.status === 429 ? "rate_limited" : "unknown" };
  }
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface LudoyaGetOptions {
  /** Next.js data-cache lifetime in seconds for this request. */
  revalidate?: number;
}

/**
 * GET a public-API path (e.g. `/locations`) and return the parsed JSON body.
 *
 * Retries timeouts, network failures, 5xx and 429 (waiting `Retry-After` up to
 * `maxRetryAfterSeconds`); fails fast on other 4xx so a wrong id or key
 * surfaces immediately. Next.js only stores 200 responses in its data cache and
 * keeps serving the stale entry when a refetch fails, so an outage shows the
 * last good data instead of an error state.
 */
export async function ludoyaGet<T = unknown>(
  endpointPath: string,
  { revalidate = ludoyaConfig.eventsRevalidateSeconds }: LudoyaGetOptions = {}
): Promise<T> {
  if (ludoyaConfig.mock) return readMock<T>(endpointPath);

  const apiKey = ludoyaConfig.apiKey;
  if (!apiKey) {
    throw new LudoyaApiError(null, "missing_api_key", endpointPath, "LUDOYA_API_KEY is not set");
  }

  const url = `${ludoyaConfig.apiUrl}${LUDOYA_API_PREFIX}${endpointPath}`;
  let lastError: unknown;

  for (let attempt = 1; attempt <= ludoyaConfig.retryAttempts; attempt++) {
    let retryAfterMs: number | null = null;
    try {
      const res = await fetch(url, {
        headers: { accept: "application/json", "X-Api-Key": apiKey },
        signal: AbortSignal.timeout(ludoyaConfig.requestTimeoutMs),
        next: { revalidate },
      });
      if (res.ok) return (await res.json()) as T;

      const { code, message } = await readErrorBody(res);
      const retryAfter = res.status === 429 ? parseRetryAfter(res.headers.get("retry-after")) : null;
      const error = new LudoyaApiError(res.status, code, endpointPath, message, retryAfter);
      // A wait longer than we are willing to block for is the caller's problem.
      if (retryAfter !== null && retryAfter > ludoyaConfig.maxRetryAfterSeconds) throw asFinal(error);
      if (retryAfter !== null) retryAfterMs = retryAfter * 1000;
      throw error;
    } catch (raw) {
      const error = toApiError(raw, endpointPath);
      lastError = error;
      if (!isRetryable(error) || isFinal(error) || attempt === ludoyaConfig.retryAttempts) break;
      const delay = retryAfterMs ?? ludoyaConfig.retryBaseDelayMs * 2 ** (attempt - 1);
      console.warn(
        `[Ludoya] ${error.message} — retrying in ${delay}ms (attempt ${attempt}/${ludoyaConfig.retryAttempts})`
      );
      await sleep(delay);
    }
  }
  throw lastError;
}

// Marks an error the retry loop must not retry.
const finalErrors = new WeakSet<LudoyaApiError>();
const asFinal = (e: LudoyaApiError) => (finalErrors.add(e), e);
const isFinal = (e: LudoyaApiError) => finalErrors.has(e);

function toApiError(error: unknown, endpointPath: string): LudoyaApiError {
  if (error instanceof LudoyaApiError) return error;
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return new LudoyaApiError(
      null,
      "timeout",
      endpointPath,
      `request timed out after ${ludoyaConfig.requestTimeoutMs}ms`
    );
  }
  // Never echo error.message from fetch: it can carry the request URL.
  return new LudoyaApiError(null, "network", endpointPath, error instanceof Error ? error.name : "request failed");
}

export function isTimeoutError(error: unknown): boolean {
  return error instanceof LudoyaApiError && error.code === "timeout";
}

export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

// ---------------------------------------------------------------------------
// Mock mode (LUDOYA_MOCK=1) — sanitized fixtures shaped like the live API
// ---------------------------------------------------------------------------

/** Username the mock treats as an existing Ludoya user; any other query finds nobody. */
export const MOCK_LUDOYA_USERNAME = "member-a";

function mockFileFor(endpointPath: string): string | null {
  const url = new URL(endpointPath, "http://mock.invalid");
  const pathname = url.pathname;
  if (pathname === "/events") return "events.json";
  if (pathname === "/locations") return "locations.json";
  if (pathname === "/search/boardgames") return "search-boardgames.json";
  if (pathname === "/search/users") {
    const query = (url.searchParams.get("query") ?? "").trim().toLowerCase();
    return query === MOCK_LUDOYA_USERNAME ? "search-users-found.json" : "search-users-empty.json";
  }
  const children = pathname.match(/^\/events\/([^/]+)\/children$/);
  if (children) return `children-${decodeURIComponent(children[1])}.json`;
  return null;
}

async function readMock<T>(endpointPath: string): Promise<T> {
  const file = mockFileFor(endpointPath);
  if (!file) {
    throw new LudoyaApiError(404, "mock_missing", endpointPath, `No fixture for ${endpointPath}`);
  }
  const fullPath = path.join(process.cwd(), "public", "mock", "ludoya", "v1", file);
  try {
    return JSON.parse(await fs.readFile(fullPath, "utf-8")) as T;
  } catch {
    // Not every event has a captured children fixture; treat as "no children".
    if (file.startsWith("children-")) return { children: [] } as T;
    throw new LudoyaApiError(404, "mock_missing", endpointPath, `Fixture not found: ${fullPath}`);
  }
}
