import { describe, expect, it } from "vitest";
import { formatAgenda } from "@/lib/events/agenda-format";
import type { Agenda, AgendaEvent, AgendaPlay } from "@/lib/events/agenda-view";

const play = (over: Partial<AgendaPlay> = {}): AgendaPlay => ({
  id: "p1",
  gameName: "Emberleaf",
  coverUrl: null,
  startsAt: "2026-11-13T15:15:00Z",
  endsAt: null,
  place: null,
  participantCount: 1,
  capacity: 4,
  minParticipants: null,
  ludoyaUrl: "https://ludoya.test/p1",
  ...over,
});

const event = (over: Partial<AgendaEvent> = {}): AgendaEvent => ({
  id: "e1",
  title: "Divendres de jocs!",
  description: "",
  startsAt: "2026-11-13T15:00:00Z",
  endsAt: "2026-11-13T19:30:00Z",
  type: "regular",
  imageUrl: null,
  ludoyaUrl: "https://ludoya.test/e1",
  place: null,
  participantCount: 0,
  capacity: null,
  countdown: null,
  plays: [play()],
  ...over,
});

const special = event({
  id: "egara",
  title: "Egara Juga 2026",
  type: "special",
  startsAt: "2026-11-28T09:00:00Z",
  endsAt: "2026-11-29T16:00:00Z",
  countdown: { kind: "days", days: 17 },
  plays: [],
});

const agenda = (): Agenda => ({
  weeks: [
    { start: "2026-11-09", end: "2026-11-15", isCurrent: true, events: [event()] },
    { start: "2026-11-23", end: "2026-11-29", isCurrent: false, events: [special] },
    { start: "2026-11-30", end: "2026-12-06", isCurrent: false, events: [] },
    { start: "2026-12-07", end: "2026-12-13", isCurrent: false, events: [] },
  ],
  specials: [special],
});

describe("formatAgenda", () => {
  it("formats a one-day session in Madrid time (Catalan)", () => {
    const [friday] = formatAgenda(agenda(), "ca").weeks[0].events;

    expect(friday.tile).toEqual({ weekday: "DV", day: "13" });
    expect(friday.dates).toBe("Divendres 13 de novembre");
    expect(friday.time).toBe("16:00 – 20:30");
    expect(friday.when).toBe("Divendres 13 de novembre · 16:00 – 20:30");
    expect(friday.plays[0].time).toBe("16:15");
  });

  it("formats a multi-day special with both weekdays on the tile", () => {
    const egara = formatAgenda(agenda(), "ca").weeks[1].events[0];

    expect(egara.tile).toEqual({ weekday: "DS–DG", day: "28" });
    expect(egara.dates).toBe("Ds., 28 – dg., 29 de novembre");
    expect(egara.time).toBe("10:00 – 17:00");
  });

  it("formats the same special in Spanish and English", () => {
    expect(formatAgenda(agenda(), "es").specials[0].tile).toEqual({ weekday: "SÁB–DOM", day: "28" });
    expect(formatAgenda(agenda(), "en").specials[0].dates).toBe("Sat 28 November – Sun 29 November");
  });

  it("labels each week with its range and the parts of its title", () => {
    const weeks = formatAgenda(agenda(), "ca").weeks;

    expect(weeks[0].range).toBe("9–15 de novembre");
    expect(weeks[1].title).toEqual({ start: "23", end: "29 de novembre", startElided: "no", endElided: "no" });
    // A week across two months names both months.
    expect(weeks[2].title).toEqual({ start: "30 de novembre", end: "6 de desembre", startElided: "no", endElided: "no" });
  });

  it("marks Catalan elision for days 1 and 11 (de l'1, a l'11)", () => {
    const weeks = formatAgenda(
      { weeks: [{ start: "2027-03-01", end: "2027-03-07", isCurrent: false, events: [] }, { start: "2027-01-11", end: "2027-01-17", isCurrent: false, events: [] }], specials: [] },
      "ca"
    ).weeks;

    expect(weeks[0].title).toMatchObject({ start: "1", startElided: "yes", endElided: "no" });
    expect(weeks[1].title).toMatchObject({ start: "11", startElided: "yes" });
  });

  it("keeps the specials list formatted like the timeline", () => {
    const view = formatAgenda(agenda(), "ca");

    expect(view.specials[0]).toEqual(view.weeks[1].events[0]);
  });
});

describe("formatAgenda strip", () => {
  const NOW = new Date("2026-11-11T11:00:00Z");
  const saturday = event({ id: "sat", title: "Dissabtes de jocs!", startsAt: "2026-11-14T09:00:00Z", endsAt: "2026-11-14T12:30:00Z" });
  const sameDaySpecial = event({
    id: "carton",
    title: "El Cartón Peleón",
    type: "special",
    startsAt: "2026-11-14T14:30:00Z",
    endsAt: "2026-11-14T19:30:00Z",
  });
  const withStrip = (): Agenda => ({
    weeks: [
      { start: "2026-11-09", end: "2026-11-15", isCurrent: true, events: [event(), saturday, sameDaySpecial] },
      { start: "2026-11-23", end: "2026-11-29", isCurrent: false, events: [special] },
    ],
    specials: [sameDaySpecial, special],
  });

  it("lists each upcoming day with events once, grouped by week", () => {
    const { strip } = formatAgenda(withStrip(), "ca", NOW);

    expect(strip.map((w) => [w.start, w.current, w.label])).toEqual([
      ["2026-11-09", true, "9–15 de nov."],
      ["2026-11-23", false, "23–29 de nov."],
    ]);
    expect(strip[0].days.map((d) => [d.date, d.weekday, d.day, d.special, d.eventId])).toEqual([
      ["2026-11-13", "DV", "13", false, "e1"],
      // A day with a session and a special opens the special.
      ["2026-11-14", "DS", "14", true, "carton"],
    ]);
    expect(strip[0].days[1]).toMatchObject({ label: "Dissabte 14 de novembre", titles: ["Dissabtes de jocs!", "El Cartón Peleón"] });
  });

  it("repeats a multi-day special on each of its days", () => {
    const { strip } = formatAgenda(withStrip(), "ca", NOW);
    expect(strip[1].days.map((d) => [d.date, d.weekday, d.special, d.eventId])).toEqual([
      ["2026-11-28", "DS", true, "egara"],
      ["2026-11-29", "DG", true, "egara"],
    ]);
  });

  it("skips the days of a running special that are already past", () => {
    const running = event({
      id: "fest",
      type: "special",
      title: "Festa",
      startsAt: "2026-11-10T09:00:00Z",
      endsAt: "2026-11-12T18:00:00Z",
    });
    const { strip } = formatAgenda(
      { weeks: [{ start: "2026-11-09", end: "2026-11-15", isCurrent: true, events: [running] }], specials: [running] },
      "ca",
      NOW
    );
    expect(strip[0].days.map((d) => d.date)).toEqual(["2026-11-11", "2026-11-12"]);
  });

  it("drops weeks without events and labels them per locale", () => {
    expect(formatAgenda(agenda(), "es", NOW).strip.map((w) => w.label)).toEqual(["9–15 nov", "23–29 nov"]);
    expect(formatAgenda(agenda(), "en", NOW).strip.map((w) => w.label)).toEqual(["9–15 Nov", "23–29 Nov"]);
  });
});
