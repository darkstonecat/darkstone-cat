// ---------------------------------------------------------------------------
// Event program — classify the sub-event tree into items
// ---------------------------------------------------------------------------
// Rules (odd/tasks/events-sub-events.md, S1-S6):
// - Only PUBLIC nodes show; a hidden node hides its whole subtree.
// - A meetup with children is a zone: not an item, it names its descendants.
// - A play or tournament is an item of its kind.
// - A meetup leaf is an activity when it has hours, or, when it is always open,
//   a demo inside a zone and an activity outside one.
// - Always open: the `alwaysOpen` flag, no start date, or (meetups only) a range
//   that covers the whole event. A play spanning a whole session stays timed.

import type { Placement, ProgramEvent, ProgramItem, ProgramNode } from "./types";

const PUBLIC = "PUBLIC";

function coversEvent(node: ProgramNode, event: ProgramEvent): boolean {
  if (node.startsAt === null || node.endsAt === null) return false;
  return Date.parse(node.startsAt) <= Date.parse(event.startsAt) && Date.parse(node.endsAt) >= Date.parse(event.endsAt);
}

function placementOf(node: ProgramNode, event: ProgramEvent): Placement {
  if (node.alwaysOpen || node.startsAt === null) return "alwaysOpen";
  return node.kind === "meetup" && coversEvent(node, event) ? "alwaysOpen" : "timed";
}

function toItem(node: ProgramNode, zone: string | null, event: ProgramEvent): ProgramItem {
  const placement = placementOf(node, event);
  const base = {
    id: node.id,
    title: node.title,
    zone,
    coverUrl: node.coverUrl ?? null,
    startsAt: node.startsAt,
    endsAt: node.endsAt,
    ludoyaUrl: node.ludoyaUrl,
    placement,
  };
  const seats = { participantCount: node.participantCount, capacity: node.capacity, minParticipants: node.minParticipants };
  switch (node.kind) {
    case "play":
      return { ...base, ...seats, kind: "play", gameName: node.game?.name ?? null };
    case "tournament":
      return {
        ...base,
        ...seats,
        kind: "tournament",
        gameName: node.game?.name ?? null,
        format: node.tournamentFormat,
        tickets: node.attendance === "tickets",
      };
    case "meetup":
      return placement === "alwaysOpen" && zone !== null ? { ...base, kind: "demo" } : { ...base, kind: "activity" };
  }
}

/** Every visible item of an event's tree, depth first in tree order. */
export function classifyProgram(nodes: readonly ProgramNode[], event: ProgramEvent, zone: string | null = null): ProgramItem[] {
  return nodes.flatMap((node) => {
    if (node.visibility !== PUBLIC) return [];
    if (node.kind === "meetup" && node.children.length > 0) return classifyProgram(node.children, event, node.title);
    return [toItem(node, zone, event)];
  });
}
