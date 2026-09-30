import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchUpcomingEvents } from "@/lib/ludoya";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
  vi.stubEnv("LUDOYA_MOCK", "1");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchUpcomingEvents", () => {
  it("splits regular and special events, sorted by start, with plays attached", async () => {
    const { regularEvents, specialEvents, error } = await fetchUpcomingEvents();

    expect(error).toBeUndefined();
    expect(regularEvents).toHaveLength(4);
    expect(specialEvents.map((e) => e.title)).toEqual(["Juguem a El Cartón Peleón!", "Egara Juga 2026"]);
    const starts = regularEvents.map((e) => new Date(e.startsAt).getTime());
    expect(starts).toEqual([...starts].sort((a, b) => a - b));

    const friday = regularEvents[0];
    expect(friday.plannedPlayCount).toBe(4);
    expect(friday.plannedPlays[0]).toEqual({
      gameName: "Emberleaf",
      imageUrl: expect.stringMatching(/^https:\/\/ludoya-images/),
      yearPublished: 0,
      slug: "emberleaf",
    });
  });

  it("keeps the existing LudoyaEvent contract and no member-area data in the props", async () => {
    const { regularEvents } = await fetchUpcomingEvents();
    expect(Object.keys(regularEvents[0]).sort()).toEqual(
      [
        "description", "endsAt", "id", "imageUrl", "ludoyaUrl", "plannedPlayCount", "plannedPlays",
        "startsAt", "thumbnailUrl", "timeZone", "title", "type",
      ].sort()
    );
    expect(regularEvents[0].ludoyaUrl).toBe(`https://app.ludoya.com/events/${regularEvents[0].id}`);
  });

  it("uses the long cache and only lists PUBLIC events", async () => {
    vi.stubEnv("LUDOYA_MOCK", "");
    vi.stubEnv("LUDOYA_API_KEY", "ldy_test");
    const event = (id: string, visibility: string) => ({
      id, type: "MEETUP", title: id, visibility,
      startsAt: "2026-11-01T10:00:00Z", endsAt: "2026-11-01T12:00:00Z",
    });
    const fetchMock = vi.fn<typeof fetch>(async (input) =>
      new Response(
        JSON.stringify(
          String(input).includes("/locations")
            ? { locations: [] }
            : { futureEvents: { elements: [event("open", "PUBLIC"), event("club", "ONLY_GROUP")] }, pastEvents: { elements: [] } }
        ),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const { specialEvents } = await fetchUpcomingEvents();

    expect(specialEvents.map((e) => e.id)).toEqual(["open"]);
    const eventsCall = fetchMock.mock.calls.find(([u]) => String(u).includes("/events"))!;
    expect((eventsCall[1] as { next?: unknown }).next).toEqual({ revalidate: 86_400 });
  });

  it("keeps ONLY_GROUP plays out of the public projection and its count", async () => {
    vi.stubEnv("LUDOYA_MOCK", "");
    vi.stubEnv("LUDOYA_API_KEY", "ldy_test");
    const play = (id: string, visibility: string) => ({
      id, type: "PLANNED_PLAY", parentId: "s", title: id, visibility, game: { name: `Game ${id}` },
      startsAt: "2026-11-01T10:00:00Z", endsAt: "2026-11-01T11:00:00Z",
    });
    const body = {
      futureEvents: {
        elements: [
          { id: "s", type: "MEETUP", title: "S", visibility: "PUBLIC", startsAt: "2026-11-01T10:00:00Z", endsAt: "2026-11-01T12:00:00Z" },
          play("open", "PUBLIC"),
          play("club", "ONLY_GROUP"),
          play("secret", "PRIVATE"),
        ],
      },
      pastEvents: { elements: [] },
    };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) =>
      new Response(JSON.stringify(String(input).includes("/locations") ? { locations: [] } : body), { status: 200 })
    ));

    const { specialEvents } = await fetchUpcomingEvents();

    expect(specialEvents[0].plannedPlays.map((p) => p.gameName)).toEqual(["Game open"]);
    expect(specialEvents[0].plannedPlayCount).toBe(1);
  });

  it("returns an error state instead of throwing", async () => {
    vi.stubEnv("LUDOYA_MOCK", "");
    vi.stubEnv("LUDOYA_API_KEY", "ldy_test");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ code: "forbidden" }), { status: 403 })));
    expect(await fetchUpcomingEvents()).toEqual({ regularEvents: [], specialEvents: [], error: "api_error" });

    vi.stubEnv("LUDOYA_API_KEY", "");
    expect((await fetchUpcomingEvents()).error).toBe("api_error");
  });

  it("flags a timeout", async () => {
    vi.stubEnv("LUDOYA_MOCK", "");
    vi.stubEnv("LUDOYA_API_KEY", "ldy_test");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => { throw Object.assign(new Error("t"), { name: "TimeoutError" }); }));
    const pending = fetchUpcomingEvents();
    await vi.runAllTimersAsync();
    expect((await pending).error).toBe("timeout");
  });
});
