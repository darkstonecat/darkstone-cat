// ---------------------------------------------------------------------------
// Ludoya integration — public types consumed by the rest of the site
// ---------------------------------------------------------------------------
// These types are the contract between the Ludoya adapter and the UI. They
// deliberately do not mirror Ludoya's raw API shapes so that an API change on
// Ludoya's side only touches `normalize.ts`, never the components.

export interface LudoyaPlannedPlay {
  gameName: string;
  imageUrl: string | null;
  yearPublished: number;
  /** Ludoya game slug, used to look up the game's BGG id. */
  slug: string | null;
  /**
   * The legacy API classified games as roleplaying books. The public API
   * carries no game type, so it is absent there and RPGs are detected by name
   * and by BGG type in `game-matching`.
   */
  isRpg?: boolean;
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

export type LudoyaFetchError = "api_error" | "timeout";

export interface LudoyaEventsResult {
  regularEvents: LudoyaEvent[];
  specialEvents: LudoyaEvent[];
  error?: LudoyaFetchError;
}

// ---------------------------------------------------------------------------
// Member-area data (public API)
// ---------------------------------------------------------------------------

/** Where a session or play happens, as Ludoya reports it. */
export interface LudoyaPlace {
  id: string;
  /** Shown as received; never rewritten. */
  name: string;
  address: string | null;
  /** True when this is the organisation's default location (the usual venue). */
  isUsual: boolean;
}

export interface LudoyaLocation {
  id: string;
  name: string;
  address: string | null;
  isDefault: boolean;
}

/** A planned play inside a session, with the seat data the member home shows. */
export interface LudoyaSessionPlay extends Omit<LudoyaPlannedPlay, "isRpg"> {
  id: string;
  startsAt: string;
  endsAt: string | null;
  place: LudoyaPlace | null;
  participantCount: number;
  capacity: number | null;
  minParticipants: number | null;
  ludoyaUrl: string;
}

/** A regular session or special event with its seat data and plays. */
export interface LudoyaSession extends Omit<LudoyaEvent, "plannedPlays"> {
  place: LudoyaPlace | null;
  participantCount: number;
  capacity: number | null;
  minParticipants: number | null;
  /** The public API does not expose the waiting list, so this is null today. */
  queuedParticipantCount: number | null;
  /** Game master or teacher when the event names one. */
  organizerName: string | null;
  plannedPlays: LudoyaSessionPlay[];
}

/** A Ludoya account found through user search. */
export interface LudoyaUser {
  id: string;
  username: string;
  name: string;
}
