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
  /** Ludoya game slug. The public API has no BGG id, so games are matched by name and year. */
  slug: string | null;
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
export interface LudoyaSessionPlay extends LudoyaPlannedPlay {
  id: string;
  startsAt: string;
  endsAt: string | null;
  place: LudoyaPlace | null;
  participantCount: number;
  capacity: number | null;
  minParticipants: number | null;
  /** Game master or teacher when the play names one. */
  organizerName: string | null;
  ludoyaUrl: string;
  /** A play has its own visibility, independent of its session's. */
  visibility: "PUBLIC" | "ONLY_GROUP";
}

/** What a sub-event is: a play, a tournament, or a meetup (a zone, a demo, a talk…). */
export type LudoyaSubEventKind = "play" | "tournament" | "meetup";

/** How people join: Ludoya sign-up, nothing, an outside link, or Ludoya tickets. */
export type LudoyaAttendance = "rsvp" | "none" | "external" | "tickets";

export type LudoyaTournamentFormat = "SWISS" | "MIXER" | "SINGLE_ELIM" | "DOUBLE_ELIM" | "TABLE_KNOCKOUT";

/** The game a sub-event is linked to on Ludoya. */
export interface LudoyaGameRef {
  name: string;
  yearPublished: number;
  imageUrl: string | null;
  slug: string | null;
}

/**
 * A published descendant of a session (child or grandchild). Drafts, cancelled,
 * friends-only and private nodes are left out together with their whole subtree.
 */
export interface LudoyaSubEvent {
  id: string;
  kind: LudoyaSubEventKind;
  title: string;
  /** Null when Ludoya gives no date (always-open demos). */
  startsAt: string | null;
  endsAt: string | null;
  alwaysOpen: boolean;
  game: LudoyaGameRef | null;
  imageUrl: string | null;
  place: LudoyaPlace | null;
  participantCount: number;
  capacity: number | null;
  minParticipants: number | null;
  organizerName: string | null;
  attendance: LudoyaAttendance;
  /** Tournaments only; null for an unknown or missing format. */
  tournamentFormat: LudoyaTournamentFormat | null;
  visibility: "PUBLIC" | "ONLY_GROUP";
  ludoyaUrl: string;
  /** Sorted by start, undated last. */
  children: LudoyaSubEvent[];
}

/** A regular session or special event with its seat data and plays. */
export interface LudoyaSession extends Omit<LudoyaEvent, "plannedPlays"> {
  /**
   * Who can see the event on Ludoya. The organisation's key also returns
   * group-only events; the public site must show `PUBLIC` ones only.
   */
  visibility: "PUBLIC" | "ONLY_GROUP";
  place: LudoyaPlace | null;
  participantCount: number;
  capacity: number | null;
  minParticipants: number | null;
  /** The public API does not expose the waiting list, so this is null today. */
  queuedParticipantCount: number | null;
  /** Game master or teacher when the event names one. */
  organizerName: string | null;
  /** Direct `PLANNED_PLAY` children only (the admin event images use them). */
  plannedPlays: LudoyaSessionPlay[];
  /** Every published descendant as a tree: plays, tournaments, meetup zones and demos. */
  subEvents: LudoyaSubEvent[];
}

/** A Ludoya account found through user search. */
export interface LudoyaUser {
  id: string;
  username: string;
  name: string;
}
