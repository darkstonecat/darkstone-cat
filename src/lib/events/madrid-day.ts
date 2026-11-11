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
