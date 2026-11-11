// ---------------------------------------------------------------------------
// Events — the agenda's "now"
// ---------------------------------------------------------------------------

/**
 * Current time for the /events agenda and calendar. With the Ludoya fixtures
 * (`LUDOYA_MOCK=1`), `LUDOYA_MOCK_NOW` pins it so the fixtures' fixed dates stay
 * upcoming (the E2E server sets it). Production never runs on fixtures.
 */
export function agendaNow(): Date {
  const pinned = process.env.LUDOYA_MOCK === "1" ? process.env.LUDOYA_MOCK_NOW : undefined;
  const date = pinned ? new Date(pinned) : null;
  return date && !Number.isNaN(date.getTime()) ? date : new Date();
}
