// ---------------------------------------------------------------------------
// Events — links and anchors shared by the /events components (pure)
// ---------------------------------------------------------------------------

import type { AgendaPlace, Countdown } from "./agenda-view";

/** The club's upcoming events list on Ludoya. */
export const LUDOYA_AGENDA_URL = "https://app.ludoya.com/groups/darkstonecat/events?view=LIST&tab=future";

const ANCHOR_PREFIX = "event-";

/** Element id (and URL hash without `#`) of an event card. */
export const eventAnchor = (eventId: string) => `${ANCHOR_PREFIX}${eventId}`;

/** Event id named by a `#event-<id>` hash, or null. */
export function eventIdFromHash(hash: string): string | null {
  const value = hash.startsWith("#") ? hash.slice(1) : hash;
  return value.startsWith(ANCHOR_PREFIX) && value.length > ANCHOR_PREFIX.length
    ? decodeURIComponent(value.slice(ANCHOR_PREFIX.length))
    : null;
}

/** Google Maps search for a place that is not the usual venue. */
export function directionsUrl(place: AgendaPlace): string {
  const query = place.address ? `${place.name}, ${place.address}` : place.name;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

type Translate = (key: string, values?: Record<string, number>) => string;

/** "Falten 17 dies", "Demà", "Avui", "En curs" from the `events` messages. */
export function countdownText(t: Translate, countdown: Countdown): string {
  return countdown.kind === "days" ? t("countdown_days", { count: countdown.days }) : t(`countdown_${countdown.kind}`);
}
