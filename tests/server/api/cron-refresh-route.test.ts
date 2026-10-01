import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { runRefreshJobs } = vi.hoisted(() => ({ runRefreshJobs: vi.fn() }));
vi.mock("@/lib/cache-refresh", () => ({ runRefreshJobs }));

import { GET } from "@/app/api/cron/refresh/route";

const SECRET = "test-cron-secret";
const call = (authorization?: string) =>
  GET(new Request("https://www.darkstone.cat/api/cron/refresh", { headers: authorization ? { authorization } : {} }));

describe("GET /api/cron/refresh", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", SECRET);
    runRefreshJobs.mockResolvedValue([{ name: "ludoya", ok: true }]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns 500 without doing work when CRON_SECRET is unset or empty", async () => {
    for (const value of ["", "   "]) {
      vi.stubEnv("CRON_SECRET", value);
      const res = await call(`Bearer ${value}`);
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "not_configured" });
    }
    expect(runRefreshJobs).not.toHaveBeenCalled();
  });

  it("returns 401 for a missing, wrong or different-length token", async () => {
    for (const header of [undefined, "Bearer wrong-secret-xx", "Bearer x", SECRET]) {
      const res = await call(header);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "unauthorized" });
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
    expect(runRefreshJobs).not.toHaveBeenCalled();
  });

  it("returns 200 with the job results for the right token", async () => {
    const res = await call(`Bearer ${SECRET}`);

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true, jobs: [{ name: "ludoya", ok: true }] });
  });

  it("returns 502 with the failed job when a refresh fails", async () => {
    runRefreshJobs.mockResolvedValue([{ name: "ludoya", ok: false, error: "Ludoya API 503" }]);

    const res = await call(`Bearer ${SECRET}`);

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ ok: false, jobs: [{ name: "ludoya", ok: false, error: "Ludoya API 503" }] });
  });
});
