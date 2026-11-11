// ---------------------------------------------------------------------------
// Events — seat counter of a play (pure)
// ---------------------------------------------------------------------------
// Decides how the seat pill on a play cover is drawn and what its status line
// and screen-reader label say. Reference sheet: odd/tasks/events-redesign-mockup/
// seats.dc.html. Texts are picked by the component from the kinds returned here.

/** Chairs that fit on one line of the pill. */
export const CHAIRS_MAX_DESKTOP = 6;
export const CHAIRS_MAX_MOBILE = 5;
/** Up to this many seats are drawn as chairs. */
const CHAIRS_UP_TO = 8;
/** Up to this many seats are drawn as one segment each; above it, a plain bar. */
const SEGMENTS_UP_TO = 20;

export type SeatMode = "chairs" | "segments" | "bar" | "open";
/** taken = someone signed up; needed = free but still needed to reach the minimum. */
export type SeatKind = "taken" | "needed" | "free";

export type SeatStatus =
  | { kind: "full" }
  | { kind: "needed"; count: number }
  | { kind: "last" }
  | { kind: "free"; count: number }
  | { kind: "unlimited" };

export type SeatAria =
  | { kind: "seats"; taken: number; capacity: number; needed: number }
  | { kind: "open"; taken: number; needed: number };

export interface SeatCounter {
  mode: SeatMode;
  taken: number;
  capacity: number | null;
  /** Chairs to draw (chairs mode), already cut to fit. */
  chairs: SeatKind[];
  /** True when chairs were cut and an ellipsis follows them. */
  truncated: boolean;
  /** One entry per seat (segments mode). */
  segments: SeatKind[];
  /** Taken share of the bar, 0-100 (bar mode). */
  fillPercent: number;
  full: boolean;
  status: SeatStatus;
  aria: SeatAria;
}

export interface SeatInput {
  participantCount: number;
  capacity: number | null;
  minParticipants: number | null;
}

function seatKinds(capacity: number, taken: number, needed: number): SeatKind[] {
  return Array.from({ length: capacity }, (_, i) => (i < taken ? "taken" : i < taken + needed ? "needed" : "free"));
}

/**
 * Seat counter of a play. `maxChairs` is how many chairs fit on the pill; a
 * play with more chairs shows the first `maxChairs - 1` and an ellipsis.
 */
export function seatCounter({ participantCount, capacity: rawCapacity, minParticipants }: SeatInput, maxChairs: number): SeatCounter {
  const taken = Math.max(participantCount, 0);
  const capacity = rawCapacity !== null && rawCapacity > 0 ? rawCapacity : null;
  const free = capacity === null ? null : Math.max(capacity - taken, 0);
  const missing = minParticipants !== null ? Math.max(minParticipants - taken, 0) : 0;
  const needed = free === null ? missing : Math.min(missing, free);
  const full = free === 0;

  const status: SeatStatus = full
    ? { kind: "full" }
    : needed > 0
      ? { kind: "needed", count: needed }
      : free === null
        ? { kind: "unlimited" }
        : free === 1
          ? { kind: "last" }
          : { kind: "free", count: free };

  const base = { taken, capacity, chairs: [], truncated: false, segments: [], fillPercent: 0, full, status };

  if (capacity === null) {
    return { ...base, mode: "open", aria: { kind: "open", taken, needed } };
  }

  const aria: SeatAria = { kind: "seats", taken, capacity, needed };
  const kinds = seatKinds(capacity, Math.min(taken, capacity), needed);

  if (capacity <= CHAIRS_UP_TO) {
    const truncated = capacity > maxChairs;
    return { ...base, mode: "chairs", chairs: truncated ? kinds.slice(0, maxChairs - 1) : kinds, truncated, aria };
  }
  if (capacity <= SEGMENTS_UP_TO) {
    return { ...base, mode: "segments", segments: kinds, aria };
  }
  return { ...base, mode: "bar", fillPercent: Math.min(Math.round((taken / capacity) * 100), 100), aria };
}
