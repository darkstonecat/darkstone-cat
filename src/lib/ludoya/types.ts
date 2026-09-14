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
  /** Ludoya classifies the game as a roleplaying book. */
  isRpg: boolean;
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
