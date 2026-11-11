// ---------------------------------------------------------------------------
// Event program — types
// ---------------------------------------------------------------------------
// The program is what happens inside one event: plays, tournaments, activities
// and always-open demos. These types are the domain's own: the input is a
// minimal structural shape (a Ludoya sub-event with a cover fits it), so the
// rules never depend on the adapter, and the output holds no display strings.

export type TournamentFormat = "SWISS" | "MIXER" | "SINGLE_ELIM" | "DOUBLE_ELIM" | "TABLE_KNOCKOUT";

/** Input: one node of an event's sub-event tree. */
export interface ProgramNode {
  id: string;
  kind: "play" | "tournament" | "meetup";
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  alwaysOpen: boolean;
  game: { name: string } | null;
  /** Resolved cover (BGG, Ludoya game, node image), or null for the placeholder. */
  coverUrl?: string | null;
  participantCount: number;
  capacity: number | null;
  minParticipants: number | null;
  attendance: string;
  tournamentFormat: TournamentFormat | null;
  visibility: string;
  ludoyaUrl: string;
  children: readonly ProgramNode[];
}

/** The event the program belongs to (its range decides "covers the whole event"). */
export interface ProgramEvent {
  startsAt: string;
  endsAt: string;
}

/** Timed items go to their day; always-open ones to the block without hours. */
export type Placement = "timed" | "alwaysOpen";

interface ItemBase {
  id: string;
  title: string;
  /** Title of the nearest meetup zone above the item, or null. */
  zone: string | null;
  coverUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  ludoyaUrl: string;
  placement: Placement;
}

export interface ItemSeats {
  participantCount: number;
  capacity: number | null;
  minParticipants: number | null;
}

export interface PlayItem extends ItemBase, ItemSeats {
  kind: "play";
  gameName: string | null;
}

export interface TournamentItem extends ItemBase, ItemSeats {
  kind: "tournament";
  gameName: string | null;
  format: TournamentFormat | null;
  /** Seats are sold through Ludoya tickets. */
  tickets: boolean;
}

/** A meetup without children that has hours (a talk, an open tournament). */
export interface ActivityItem extends ItemBase {
  kind: "activity";
}

/** An always-open meetup inside a zone (a game shown by an exhibitor). */
export interface DemoItem extends ItemBase {
  kind: "demo";
}

export type ProgramItem = PlayItem | TournamentItem | ActivityItem | DemoItem;

/** Items that carry a seat counter. */
export type SeatedItem = PlayItem | TournamentItem;

export interface ProgramCounts {
  plays: number;
  tournaments: number;
  activities: number;
  demos: number;
}

/** A start-time row (slots mode) or the whole day (grid mode, `startsAt` null). */
export interface ProgramGroup<T extends ProgramItem = ProgramItem> {
  startsAt: string | null;
  items: T[];
}

export interface ProgramDay<T extends ProgramItem = ProgramItem> {
  /** `YYYY-MM-DD` in Madrid. */
  day: string;
  mode: "grid" | "slots";
  groups: ProgramGroup<T>[];
  counts: ProgramCounts;
}

export interface AlwaysOpenGroup<T extends ProgramItem = ProgramItem> {
  /** Zone title, or null for "other activities". */
  zone: string | null;
  items: T[];
}

export interface ProgramLayout<T extends ProgramItem = ProgramItem> {
  /** The event spans more than one Madrid day: each day is its own section. */
  multiDay: boolean;
  days: ProgramDay<T>[];
  alwaysOpen: AlwaysOpenGroup<T>[];
  counts: ProgramCounts;
}
