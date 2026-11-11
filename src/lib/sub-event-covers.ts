// ---------------------------------------------------------------------------
// Covers for the sub-event tree (pure)
// ---------------------------------------------------------------------------
// Turns the tree into cover requests for `resolvePlayCovers` and writes the
// answers back. Order of a cover (odd/tasks/events-sub-events.md, S4):
// - a node with a game: BGG (name + year), else the game's Ludoya image, else
//   the node image;
// - a node without a game: its own image; only when it has none, a BGG lookup
//   by title (year 0, so only an exact name match is accepted);
// - nothing found: null, and the UI draws the placeholder.

import type { LudoyaPlannedPlay, LudoyaSubEvent } from "./ludoya/types";

export interface CoverRequest extends LudoyaPlannedPlay {
  id: string;
}

export interface CoveredSubEvent extends Omit<LudoyaSubEvent, "children"> {
  coverUrl: string | null;
  children: CoveredSubEvent[];
}

const fallbackCover = (node: LudoyaSubEvent) => node.game?.imageUrl ?? node.imageUrl;

function request(node: LudoyaSubEvent): CoverRequest | null {
  if (node.game) {
    return { id: node.id, gameName: node.game.name, yearPublished: node.game.yearPublished, imageUrl: fallbackCover(node), slug: node.game.slug };
  }
  // Its own image wins over a title match, so no lookup is needed.
  if (node.imageUrl) return null;
  return { id: node.id, gameName: node.title, yearPublished: 0, imageUrl: null, slug: null };
}

/**
 * One request per node that may get a BGG cover, depth first. A non-public
 * node never shows, so neither it nor its subtree is sent to BGG.
 */
export function collectCoverRequests(nodes: readonly LudoyaSubEvent[]): CoverRequest[] {
  return nodes.flatMap((node) => {
    if (node.visibility !== "PUBLIC") return [];
    const own = request(node);
    return [...(own ? [own] : []), ...collectCoverRequests(node.children)];
  });
}

/** The tree with a cover on every node: the resolved one, else the fallback order above. */
export function applyCovers(nodes: readonly LudoyaSubEvent[], covers: ReadonlyMap<string, string | null>): CoveredSubEvent[] {
  return nodes.map((node) => ({
    ...node,
    coverUrl: covers.get(node.id) ?? fallbackCover(node),
    children: applyCovers(node.children, covers),
  }));
}
