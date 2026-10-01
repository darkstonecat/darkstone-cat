import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchSessions,
  madridDay,
  sessionsInMonth,
  sessionsInNextDays,
} from "@/lib/ludoya/sessions";
import { parseSessionsResponse } from "@/lib/ludoya/normalize";
import fs from "node:fs";
import path from "node:path";

const fixture = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/mock/ludoya/v1", name), "utf-8"));

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("madridDay", () => {
  it("uses the Madrid calendar day, not UTC", () => {
    expect(madridDay("2026-10-02T22:30:00Z")).toBe("2026-10-03");
    expect(madridDay("2026-12-31T23:30:00Z")).toBe("2027-01-01");
    expect(madridDay("2026-10-02T14:00:00Z")).toBe("2026-10-02");
  });
});

describe("time windows", () => {
  const sessions = parseSessionsResponse(fixture("events.json"));

  it("sessionsInNextDays keeps the next 7 Madrid days, in-progress sessions included", () => {
    vi.setSystemTime(new Date("2026-10-02T15:00:00Z")); // Friday, inside the 14:00–18:30Z session
    const week = sessionsInNextDays(sessions, new Date());
    expect(week.map((s) => madridDay(s.startsAt))).toEqual(["2026-10-02", "2026-10-03"]);
  });

  it("drops sessions that already ended today", () => {
    const week = sessionsInNextDays(sessions, new Date("2026-10-02T19:00:00Z"));
    expect(week.map((s) => madridDay(s.startsAt))).toEqual(["2026-10-03"]);
  });

  it("keeps a multi-day event that started earlier and is still running", () => {
    const multiDay = parseSessionsResponse({
      futureEvents: {
        elements: [
          {
            id: "fair", type: "MEETUP", title: "Fair", visibility: "PUBLIC",
            startsAt: "2026-10-01T08:00:00Z", endsAt: "2026-10-04T18:00:00Z", timeZone: "Europe/Madrid",
          },
        ],
      },
    });
    expect(sessionsInNextDays(multiDay, new Date("2026-10-02T10:00:00Z")).map((s) => s.id)).toEqual(["fair"]);
    expect(sessionsInNextDays(multiDay, new Date("2026-10-05T10:00:00Z"))).toEqual([]);
  });

  it("includes the seventh day and excludes the eighth", () => {
    const seventh = sessionsInNextDays(sessions, new Date("2026-09-26T08:00:00Z")); // window to Oct 2
    expect(seventh.map((s) => madridDay(s.startsAt))).toEqual(["2026-10-02"]);
  });

  it("sessionsInMonth filters by Madrid month", () => {
    expect(sessionsInMonth(sessions, 2026, 10).length).toBeGreaterThan(2);
    expect(sessionsInMonth(sessions, 2026, 11).map((s) => s.title)).toContain("Egara Juga 2026");
    expect(sessionsInMonth(sessions, 2026, 9)).toEqual([]);
  });
});

describe("fetchSessions", () => {
  it("in mock mode returns sorted sessions with the usual venue flagged", async () => {
    vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
    vi.stubEnv("LUDOYA_MOCK", "1");

    const sessions = await fetchSessions({ revalidate: 60 });

    const starts = sessions.map((s) => new Date(s.startsAt).getTime());
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    expect(sessions.find((s) => s.place?.name === "Centre Cívic Ca N’Aurell")?.place?.isUsual).toBe(true);
    expect(sessions.find((s) => s.title.startsWith("Juguem"))?.place?.isUsual).toBe(false);
  });

  it("requests sub-events with the given cache lifetime, and past events only when asked", async () => {
    vi.stubEnv("LUDOYA_API_KEY", "ldy_test");
    vi.stubEnv("LUDOYA_MOCK", "");
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      const body = url.includes("/locations")
        ? { locations: [] }
        : { futureEvents: { elements: [] }, pastEvents: { elements: [] } };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchSessions({ revalidate: 60 });
    await fetchSessions({ revalidate: 60, includePast: true });

    const eventCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes("/events"));
    expect(String(eventCalls[0][0])).toBe("https://api.ludoya.com/public/v1/events?includeSubEvents=true");
    expect((eventCalls[0][1] as { next?: unknown }).next).toEqual({ revalidate: 60, tags: ["ludoya"] });
    expect(String(eventCalls[1][0])).toContain("pastLimit=200");
  });

  it("still returns sessions when locations fail", async () => {
    vi.stubEnv("LUDOYA_API_KEY", "ldy_test");
    vi.stubEnv("LUDOYA_MOCK", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input) =>
        String(input).includes("/locations")
          ? new Response(JSON.stringify({ code: "forbidden" }), { status: 403 })
          : new Response(JSON.stringify(fixture("events.json")), { status: 200 })
      )
    );
    vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));

    const sessions = await fetchSessions({ revalidate: 60 });

    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions.every((s) => !s.place?.isUsual)).toBe(true);
  });
});
