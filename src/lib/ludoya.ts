// ---------------------------------------------------------------------------
// Ludoya API — fetch upcoming events for Darkstone Catalunya
// ---------------------------------------------------------------------------

const LUDOYA_API = "https://api.ludoya.com";
const GROUP_ID = "c801047e5d1d4d3295976ebd1e8b48ab";
const LUDOYA_APP = "https://app.ludoya.com";
const REQUEST_TIMEOUT = 15_000;

// Regular session schedules (Europe/Madrid local time)
const REGULAR_SCHEDULES = [
  { day: 5, startHour: 16, startMinute: 0, endHour: 20, endMinute: 30 }, // Friday
  { day: 6, startHour: 10, startMinute: 0, endHour: 13, endMinute: 30 }, // Saturday
] as const;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface LudoyaPlannedPlay {
  gameName: string;
}

export interface LudoyaEvent {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  plannedPlayCount: number;
  ludoyaUrl: string;
  type: "regular" | "special";
  plannedPlays: LudoyaPlannedPlay[];
}

export interface LudoyaEventsResult {
  regularEvents: LudoyaEvent[];
  specialEvents: LudoyaEvent[];
  error?: "api_error" | "timeout";
}

// ---------------------------------------------------------------------------
// Internal API types (raw responses)
// ---------------------------------------------------------------------------

interface RawImage {
  url: string;
  previewUrl: string;
  thumbnailUrl?: string;
}

interface RawMeetup {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  image: RawImage | null;
  canceled: boolean;
  plannedPlayCount: number;
}

interface RawMeetupsResponse {
  futureMeetups: {
    elements: RawMeetup[];
  };
}

interface RawPlannedPlay {
  game: {
    name: string;
  };
}

interface RawPlannedPlaysResponse {
  list: RawPlannedPlay[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isRegularEvent(startsAt: string, endsAt: string, timeZone: string): boolean {
  const fmt = (date: string, part: "weekday" | "hour" | "minute") => {
    const opts: Intl.DateTimeFormatOptions = { timeZone };
    if (part === "weekday") opts.weekday = "short";
    if (part === "hour") { opts.hour = "numeric"; opts.hour12 = false; }
    if (part === "minute") { opts.minute = "numeric"; }
    return new Intl.DateTimeFormat("en-US", opts).format(new Date(date));
  };

  const startDate = new Date(startsAt);

  // Get day of week (0=Sun, 6=Sat) in the event timezone
  const dayOfWeek = new Date(
    startDate.toLocaleString("en-US", { timeZone })
  ).getDay();

  const startHour = parseInt(fmt(startsAt, "hour"));
  const startMinute = parseInt(fmt(startsAt, "minute"));
  const endHour = parseInt(fmt(endsAt, "hour"));
  const endMinute = parseInt(fmt(endsAt, "minute"));

  return REGULAR_SCHEDULES.some(
    (s) =>
      s.day === dayOfWeek &&
      s.startHour === startHour &&
      s.startMinute === startMinute &&
      s.endHour === endHour &&
      s.endMinute === endMinute
  );
}

function isWithin12Months(dateStr: string): boolean {
  const date = new Date(dateStr);
  const limit = new Date();
  limit.setMonth(limit.getMonth() + 12);
  return date <= limit;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`Ludoya API ${res.status}: ${url}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Main fetch function
// ---------------------------------------------------------------------------

export async function fetchUpcomingEvents(): Promise<LudoyaEventsResult> {
  try {
    const meetupsData = await fetchJson<RawMeetupsResponse>(
      `${LUDOYA_API}/groups/${GROUP_ID}/meetups?onlyFuture=true`
    );

    const activeMeetups = meetupsData.futureMeetups.elements.filter(
      (m) => !m.canceled
    );

    // Classify events
    const classified = activeMeetups.map((m): LudoyaEvent | null => {
      const tz = m.timeZone || "Europe/Madrid";
      const regular = isRegularEvent(m.startsAt, m.endsAt, tz);

      if (!regular && !isWithin12Months(m.startsAt)) return null;

      return {
        id: m.id,
        title: m.title,
        description: m.description,
        startsAt: m.startsAt,
        endsAt: m.endsAt,
        timeZone: tz,
        imageUrl: m.image?.url ?? m.image?.previewUrl ?? null,
        thumbnailUrl: m.image?.previewUrl ?? m.image?.thumbnailUrl ?? null,
        plannedPlayCount: m.plannedPlayCount,
        ludoyaUrl: `${LUDOYA_APP}/meetups/${m.id}`,
        type: regular ? "regular" : "special",
        plannedPlays: [],
      };
    }).filter((e): e is LudoyaEvent => e !== null);

    // Fetch planned plays in parallel for events that have them
    const eventsWithPlays = classified.filter((e) => e.plannedPlayCount > 0);
    if (eventsWithPlays.length > 0) {
      const playsResults = await Promise.all(
        eventsWithPlays.map((e) =>
          fetchJson<RawPlannedPlaysResponse>(
            `${LUDOYA_API}/meetups/${e.id}/planned-plays`
          ).catch(() => ({ list: [] }) as RawPlannedPlaysResponse)
        )
      );

      eventsWithPlays.forEach((event, i) => {
        event.plannedPlays = playsResults[i].list
          .filter((pp) => pp.game != null)
          .map((pp) => ({
            gameName: pp.game.name,
          }));
      });
    }

    // Sort by date
    const sortByDate = (a: LudoyaEvent, b: LudoyaEvent) =>
      new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();

    return {
      regularEvents: classified.filter((e) => e.type === "regular").sort(sortByDate),
      specialEvents: classified.filter((e) => e.type === "special").sort(sortByDate),
    };
  } catch (error) {
    console.error("[Ludoya] Failed to fetch events:", error);
    const isTimeout =
      error instanceof DOMException && error.name === "TimeoutError";
    return {
      regularEvents: [],
      specialEvents: [],
      error: isTimeout ? "timeout" : "api_error",
    };
  }
}
