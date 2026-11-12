// Calendar day of an instant in Madrid, the association's time zone. Pure, so
// the agenda view model and the program layout share it.

export const MADRID_TIME_ZONE = "Europe/Madrid";

const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: MADRID_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** `YYYY-MM-DD` of an instant on the Madrid calendar. */
export function madridDay(instant: Date | string): string {
  return dayFormat.format(new Date(instant));
}

/**
 * An event that ends before this hour (Madrid) counts as ending the day before: an evening
 * session from 17:00 to 00:00 or 02:00 is one day on the agenda and the calendar.
 */
export const NIGHT_END_HOUR = 6;

const clockFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: MADRID_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Seconds since 00:00 of the Madrid day (wall clock). */
function madridSecondsOfDay(instant: Date | string): number {
  const [h, m, s] = clockFormat.format(new Date(instant)).split(":").map(Number);
  return h * 3600 + m * 60 + s;
}

const previousDay = (day: string) =>
  new Date(Date.parse(`${day}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

/**
 * Last Madrid day of an event, `YYYY-MM-DD`: the day it ends, or the day before when it ends
 * before NIGHT_END_HOUR, never earlier than the day it starts.
 */
export function madridLastDay(startsAt: Date | string, endsAt: Date | string): string {
  const first = madridDay(startsAt);
  const endDay = madridDay(endsAt);
  const last = madridSecondsOfDay(endsAt) < NIGHT_END_HOUR * 3600 ? previousDay(endDay) : endDay;
  return last < first ? first : last;
}

/**
 * Seconds until the next 00:00 in Madrid (1..86400), from the wall clock. Off by an hour only
 * between 00:00 and the DST switch at 02:00/03:00, far from midnight, where callers use it.
 */
export function secondsUntilMadridMidnight(now: Date): number {
  return 86_400 - madridSecondsOfDay(now);
}
