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

/** Shortest attempt worth starting when a total budget is set. */
const MIN_ATTEMPT_MS = 500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface LudoyaGetOptions {
  /** Next.js data-cache lifetime in seconds for this request. */
  revalidate?: number;
  /** Next.js data-cache tags for this request, for `revalidateTag`. */
  tags?: string[];
  /** Per-attempt timeout. Defaults to `ludoyaConfig.requestTimeoutMs`. */
  timeoutMs?: number;
  /** Maximum attempts, first one included. Defaults to `ludoyaConfig.retryAttempts`. */
  attempts?: number;
  /**
   * Total time this call may take across attempts and backoff. No attempt starts
   * without time left, and its timeout is clipped to what remains. Unset means
   * no overall cap (attempts x timeout plus backoff).
   */
  budgetMs?: number;
}

const isAbort = (e: unknown) => e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");

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
  {
    revalidate = ludoyaConfig.eventsRevalidateSeconds,
    tags,
    timeoutMs = ludoyaConfig.requestTimeoutMs,
    attempts = ludoyaConfig.retryAttempts,
    budgetMs,
  }: LudoyaGetOptions = {}
): Promise<T> {
  if (ludoyaConfig.mock) return readMock<T>(endpointPath);

  const apiKey = ludoyaConfig.apiKey;
  if (!apiKey) {
    throw new LudoyaApiError(null, "missing_api_key", endpointPath, "LUDOYA_API_KEY is not set");
  }

  const url = `${ludoyaConfig.apiUrl}${LUDOYA_API_PREFIX}${endpointPath}`;
  let lastError: unknown;
  const startedAt = Date.now();
  const remaining = () => (budgetMs === undefined ? Infinity : budgetMs - (Date.now() - startedAt));

  for (let attempt = 1; attempt <= attempts; attempt++) {
    let retryAfterMs: number | null = null;
    try {
      const res = await fetch(url, {
        headers: { accept: "application/json", "X-Api-Key": apiKey },
        signal: AbortSignal.timeout(Math.max(1, Math.min(timeoutMs, remaining()))),
        next: { revalidate, ...(tags && { tags }) },
      });
      if (res.ok) {
        try {
          return (await res.json()) as T;
        } catch (bodyError) {
          // A timeout while reading the body stays a timeout; anything else is a
          // 200 that is not JSON, which a retry will not fix.
          if (isAbort(bodyError)) throw bodyError;
          throw asFinal(new LudoyaApiError(res.status, "unknown", endpointPath, "response body is not valid JSON"));
        }
      }

      const { code, message } = await readErrorBody(res);
      const retryAfter = res.status === 429 ? parseRetryAfter(res.headers.get("retry-after")) : null;
      const error = new LudoyaApiError(res.status, code, endpointPath, message, retryAfter);
      // A wait longer than we are willing to block for is the caller's problem.
      if (retryAfter !== null && retryAfter > ludoyaConfig.maxRetryAfterSeconds) throw asFinal(error);
      if (retryAfter !== null) retryAfterMs = retryAfter * 1000;
      throw error;
    } catch (raw) {
      const error = toApiError(raw, endpointPath, timeoutMs);
      lastError = error;
      if (!isRetryable(error) || isFinal(error) || attempt === attempts) break;
      const delay = retryAfterMs ?? ludoyaConfig.retryBaseDelayMs * 2 ** (attempt - 1);
      // Not enough budget left for the wait plus a meaningful next attempt.
      if (remaining() - delay < MIN_ATTEMPT_MS) break;
      console.warn(`[Ludoya] ${error.message} — retrying in ${delay}ms (attempt ${attempt}/${attempts})`);
      await sleep(delay);
    }
  }
  throw lastError;
}

// Marks an error the retry loop must not retry.
const finalErrors = new WeakSet<LudoyaApiError>();
const asFinal = (e: LudoyaApiError) => (finalErrors.add(e), e);
const isFinal = (e: LudoyaApiError) => finalErrors.has(e);

function toApiError(error: unknown, endpointPath: string, timeoutMs: number): LudoyaApiError {
  if (error instanceof LudoyaApiError) return error;
  if (isAbort(error)) {
    return new LudoyaApiError(null, "timeout", endpointPath, `request timed out after ${timeoutMs}ms`);
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
  if (pathname === "/search/users") {
    const query = (url.searchParams.get("query") ?? "").trim().toLowerCase();
    return query === MOCK_LUDOYA_USERNAME ? "search-users-found.json" : "search-users-empty.json";
  }
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
    throw new LudoyaApiError(404, "mock_missing", endpointPath, `Fixture not found: ${fullPath}`);
  }
}
