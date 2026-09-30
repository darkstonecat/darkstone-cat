import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LudoyaApiError, ludoyaGet } from "@/lib/ludoya/client";

const KEY = "ldy_test_secret_key";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

/** Run a request that sleeps between retries, advancing the fake clock. */
async function settle<T>(promise: Promise<T>): Promise<PromiseSettledResult<T>> {
  const result = promise.then(
    (value) => ({ status: "fulfilled", value }) as const,
    (reason) => ({ status: "rejected", reason }) as const
  );
  await vi.runAllTimersAsync();
  return result;
}

describe("ludoyaGet", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("LUDOYA_API_KEY", KEY);
    vi.stubEnv("LUDOYA_MOCK", "");
    vi.stubEnv("LUDOYA_API_URL", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("calls the public v1 URL with the X-Api-Key header and the revalidate option", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ locations: [] }));

    const body = await ludoyaGet("/locations", { revalidate: 60 });

    expect(body).toEqual({ locations: [] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.ludoya.com/public/v1/locations");
    expect((init?.headers as Record<string, string>)["X-Api-Key"]).toBe(KEY);
    expect((init as { next?: { revalidate: number } }).next).toEqual({ revalidate: 60 });
  });

  it("fails without a network call when the API key is missing", async () => {
    vi.stubEnv("LUDOYA_API_KEY", "");

    await expect(ludoyaGet("/locations")).rejects.toMatchObject({ code: "missing_api_key" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not retry other 4xx and maps the documented error code", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ code: "unauthorized", message: "Invalid API key" }, { status: 401 })
    );

    const error = await ludoyaGet("/locations").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(LudoyaApiError);
    expect(error).toMatchObject({ status: 401, code: "unauthorized" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries 5xx with backoff and returns the first good response", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ message: "boom" }, { status: 503 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const result = await settle(ludoyaGet("/locations"));

    expect(result).toMatchObject({ status: "fulfilled", value: { ok: true } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("honours a short Retry-After on 429 and then succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ code: "rate_limited" }, { status: 429, headers: { "retry-after": "2" } })
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const promise = ludoyaGet("/locations");
    await vi.advanceTimersByTimeAsync(1_900);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(200);

    await expect(promise).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces rate_limited immediately when Retry-After is longer than the cap", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ code: "rate_limited" }, { status: 429, headers: { "retry-after": "30" } })
    );

    const error = await ludoyaGet("/locations").catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 429, code: "rate_limited", retryAfterSeconds: 30 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after the configured attempts and reports the last error", async () => {
    fetchMock.mockImplementation(async () => jsonResponse({}, { status: 502 }));

    const result = await settle(ludoyaGet("/locations"));

    expect(result).toMatchObject({ status: "rejected", reason: { status: 502 } });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("maps a timeout to code 'timeout' and a network failure to 'network'", async () => {
    fetchMock.mockImplementation(async () => {
      throw Object.assign(new Error("The operation timed out"), { name: "TimeoutError" });
    });
    const timeout = await settle(ludoyaGet("/a"));
    expect(timeout).toMatchObject({ status: "rejected", reason: { code: "timeout" } });

    fetchMock.mockImplementation(async () => {
      throw new TypeError("fetch failed");
    });
    const network = await settle(ludoyaGet("/b"));
    expect(network).toMatchObject({ status: "rejected", reason: { code: "network" } });
  });

  it("does not retry a 200 whose body is not JSON", async () => {
    fetchMock.mockImplementation(async () => new Response("<html>oops</html>", { status: 200 }));

    const result = await settle(ludoyaGet("/locations"));

    expect(result).toMatchObject({ status: "rejected", reason: { code: "unknown", status: 200 } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("honours per-call attempts", async () => {
    fetchMock.mockImplementation(async () => jsonResponse({}, { status: 503 }));

    await settle(ludoyaGet("/locations", { attempts: 2 }));

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("skips a retry that cannot fit inside the total budget", async () => {
    fetchMock.mockImplementation(async () => {
      throw Object.assign(new Error("timed out"), { name: "TimeoutError" });
    });

    const result = await settle(ludoyaGet("/locations", { timeoutMs: 4_000, attempts: 3, budgetMs: 1_200 }));

    expect(result).toMatchObject({ status: "rejected", reason: { code: "timeout" } });
    // The 1 s backoff would leave under 500 ms, so there is no second attempt.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries while the budget allows it", async () => {
    fetchMock
      .mockImplementationOnce(async () => jsonResponse({}, { status: 503 }))
      .mockImplementationOnce(async () => jsonResponse({ ok: true }));

    const result = await settle(ludoyaGet("/locations", { attempts: 3, budgetMs: 8_000 }));

    expect(result).toMatchObject({ status: "fulfilled", value: { ok: true } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never leaks the API key in errors or logs", async () => {
    fetchMock.mockImplementation(async () => {
      throw new TypeError(`fetch failed for header ${KEY}`);
    });

    const result = await settle(ludoyaGet("/locations"));

    const reason = (result as PromiseRejectedResult).reason as Error;
    expect(reason.message).not.toContain(KEY);
    const logged = vi.mocked(console.warn).mock.calls.flat().join(" ");
    expect(logged).not.toContain(KEY);
  });

  describe("mock mode", () => {
    beforeEach(() => {
      vi.stubEnv("LUDOYA_MOCK", "1");
      vi.stubEnv("LUDOYA_API_KEY", "");
    });

    it("serves fixtures without a key or a network call", async () => {
      const events = await ludoyaGet<{ futureEvents: { elements: unknown[] } }>("/events?includeSubEvents=true");
      expect(events.futureEvents.elements.length).toBeGreaterThan(0);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("finds only the fixture username in user search", async () => {
      const found = await ludoyaGet<{ users: { elements: unknown[] } }>("/search/users?query=member-a&intent=PLAY");
      const empty = await ludoyaGet<{ users: { elements: unknown[] } }>("/search/users?query=nobody&intent=PLAY");
      expect(found.users.elements).toHaveLength(1);
      expect(empty.users.elements).toHaveLength(0);
    });

    it("rejects paths without a fixture", async () => {
      await expect(ludoyaGet("/campaigns")).rejects.toMatchObject({ code: "mock_missing" });
    });
  });
});
