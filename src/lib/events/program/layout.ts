// ---------------------------------------------------------------------------
// Event program — lay the items out
// ---------------------------------------------------------------------------
// Rules (odd/tasks/events-sub-events.md, S3, S7, S8):
// - Timed items go to the Madrid day they start on; a multi-day event shows one
//   section per day that has items.
// - Inside a day, more than PROGRAM_SLOT_THRESHOLD items are grouped by start
//   time; otherwise they form one grid sorted by start.
// - Always-open items are grouped by zone in tree order, zone-less ones last.

import { madridDay } from "../madrid-day";
import type { AlwaysOpenGroup, ProgramCounts, ProgramDay, ProgramEvent, ProgramItem, ProgramLayout, SeatedItem } from "./types";

/** More timed items than this in one day are grouped by start time. */
export const PROGRAM_SLOT_THRESHOLD = 8;

const MINUTE = 60_000;

export function countItems(items: readonly ProgramItem[]): ProgramCounts {
  const counts: ProgramCounts = { plays: 0, tournaments: 0, activities: 0, demos: 0 };
  for (const item of items) {
    if (item.kind === "play") counts.plays++;
    else if (item.kind === "tournament") counts.tournaments++;
    else if (item.kind === "activity") counts.activities++;
    else counts.demos++;
  }
  return counts;
}

const startOf = (item: ProgramItem) => Date.parse(item.startsAt!);

function groupByStart<T extends ProgramItem>(items: T[]): ProgramDay<T>["groups"] {
  const groups = new Map<number, T[]>();
  for (const item of items) {
    const minute = Math.floor(startOf(item) / MINUTE) * MINUTE;
    groups.set(minute, [...(groups.get(minute) ?? []), item]);
  }
  return [...groups.entries()].map(([minute, group]) => ({ startsAt: new Date(minute).toISOString().replace(".000Z", "Z"), items: group }));
}

function layoutDay<T extends ProgramItem>(day: string, items: T[]): ProgramDay<T> {
  const mode = items.length > PROGRAM_SLOT_THRESHOLD ? "slots" : "grid";
  return {
    day,
    mode,
    groups: mode === "slots" ? groupByStart(items) : [{ startsAt: null, items }],
    counts: countItems(items),
  };
}

function alwaysOpenGroups<T extends ProgramItem>(items: T[]): AlwaysOpenGroup<T>[] {
  const zones = new Map<string | null, T[]>();
  for (const item of items) zones.set(item.zone, [...(zones.get(item.zone) ?? []), item]);
  const groups = [...zones.entries()].map(([zone, group]) => ({ zone, items: group }));
  return [...groups.filter((g) => g.zone !== null), ...groups.filter((g) => g.zone === null)];
}

/** Days, rows and the always-open block of one event's items. */
export function layoutProgram<T extends ProgramItem>(items: readonly T[], event: ProgramEvent): ProgramLayout<T> {
  const timed = items.filter((item) => item.placement === "timed").sort((a, b) => startOf(a) - startOf(b));
  const byDay = new Map<string, T[]>();
  for (const item of timed) {
    const day = madridDay(item.startsAt!);
    byDay.set(day, [...(byDay.get(day) ?? []), item]);
  }
  return {
    multiDay: madridDay(event.startsAt) !== madridDay(event.endsAt),
    days: [...byDay.entries()].map(([day, dayItems]) => layoutDay(day, dayItems)),
    alwaysOpen: alwaysOpenGroups(items.filter((item) => item.placement === "alwaysOpen")),
    counts: countItems(items),
  };
}

/** Every item of a layout: the days in order, then the always-open block. */
export function programItems<T extends ProgramItem>(layout: ProgramLayout<T>): T[] {
  return [...layout.days.flatMap((d) => d.groups.flatMap((g) => g.items)), ...layout.alwaysOpen.flatMap((g) => g.items)];
}

/** The items that have seats (plays and tournaments). */
export function seatedItems<T extends ProgramItem>(layout: ProgramLayout<T>): Extract<T, SeatedItem>[] {
  return programItems(layout).filter((item): item is Extract<T, SeatedItem> => item.kind === "play" || item.kind === "tournament");
}
