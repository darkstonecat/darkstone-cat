import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchEventsAgenda: vi.fn(),
  fetchEventsCalendar: vi.fn(),
  formatAgenda: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/events/agenda", () => ({ fetchEventsAgenda: mocks.fetchEventsAgenda }));
vi.mock("@/lib/events/calendar", () => ({ fetchEventsCalendar: mocks.fetchEventsCalendar }));
vi.mock("@/lib/events/agenda-format", () => ({ formatAgenda: mocks.formatAgenda }));

import { buildEventJsonLd, loadEventsPageData } from "@/lib/events/page-data";

const now = new Date("2026-10-01T10:00:00Z");
const calendar = { title: "octubre de 2026" };
const rawAgenda = { weeks: [], specials: [] };
const event = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: `Event ${id}`,
  description: "",
  startsAt: "2026-10-03T14:00:00.000Z",
  endsAt: "2026-10-03T20:00:00.000Z",
  ludoyaUrl: `https://ludoya.com/e/${id}`,
  imageUrl: null,
  place: null,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchEventsCalendar.mockResolvedValue(calendar);
});

describe("loadEventsPageData", () => {
  it("loads the agenda and the current month once and formats the agenda", async () => {
    mocks.fetchEventsAgenda.mockResolvedValue({ agenda: rawAgenda });
    const formatted = { weeks: [{ events: [event("a"), event("b")] }, { events: [event("c")] }], specials: [], strip: [] };
    mocks.formatAgenda.mockReturnValue(formatted);

    const data = await loadEventsPageData("es", now);

    expect(mocks.fetchEventsAgenda).toHaveBeenCalledTimes(1);
    expect(mocks.fetchEventsAgenda).toHaveBeenCalledWith(now);
    expect(mocks.fetchEventsCalendar).toHaveBeenCalledTimes(1);
    expect(mocks.fetchEventsCalendar).toHaveBeenCalledWith({ year: 2026, month: 10 }, "es", now);
    expect(mocks.formatAgenda).toHaveBeenCalledWith(rawAgenda, "es", now);
    expect(data).toEqual({ agenda: formatted, calendar, loadedIds: ["a", "b", "c"], error: false });
  });

  it("flags a failed agenda", async () => {
    mocks.fetchEventsAgenda.mockResolvedValue({ agenda: rawAgenda, error: "timeout" });
    mocks.formatAgenda.mockReturnValue({ weeks: [], specials: [], strip: [] });

    const data = await loadEventsPageData("ca", now);

    expect(data.error).toBe(true);
    expect(data.loadedIds).toEqual([]);
  });
});

describe("buildEventJsonLd", () => {
  it("describes each event as a free offline Event at the usual venue by default", () => {
    const [ld] = buildEventJsonLd([event("a")] as never);

    expect(ld).toMatchObject({
      "@type": "Event",
      name: "Event a",
      description: "Event a",
      startDate: "2026-10-03T14:00:00.000Z",
      endDate: "2026-10-03T20:00:00.000Z",
      url: "https://ludoya.com/e/a",
      image: "https://www.darkstone.cat/images/darkstone_logo_768px.webp",
      offers: { price: "0", priceCurrency: "EUR", validFrom: "2026-09-03T14:00:00.000Z" },
      location: { "@type": "Place" },
    });
  });

  it("uses the event's own place and keeps at most 20 events", () => {
    const events = Array.from({ length: 25 }, (_, i) => event(String(i), { place: { name: "Casal", address: null } }));

    const ld = buildEventJsonLd(events as never);

    expect(ld).toHaveLength(20);
    expect(ld[0].location).toEqual({ "@type": "Place", name: "Casal", address: "Casal" });
  });
});
