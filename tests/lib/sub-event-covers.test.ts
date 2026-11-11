import { describe, expect, it } from "vitest";
import type { LudoyaSubEvent } from "@/lib/ludoya/types";
import { applyCovers, collectCoverRequests } from "@/lib/sub-event-covers";

const node = (over: Partial<LudoyaSubEvent> & Pick<LudoyaSubEvent, "id">): LudoyaSubEvent => ({
  kind: "meetup",
  title: over.id,
  startsAt: null,
  endsAt: null,
  alwaysOpen: true,
  game: null,
  imageUrl: null,
  place: null,
  participantCount: 0,
  capacity: null,
  minParticipants: null,
  organizerName: null,
  attendance: "none",
  tournamentFormat: null,
  visibility: "PUBLIC",
  ludoyaUrl: `https://ludoya.example/${over.id}`,
  children: [],
  ...over,
});

const GAME = { name: "Root", yearPublished: 2018, imageUrl: "https://ludoya.example/game.jpg", slug: "root" };

describe("collectCoverRequests", () => {
  it("asks for games by name and year, and for image-less nodes by title, depth first", () => {
    const tree = [
      node({
        id: "zone",
        imageUrl: "https://ludoya.example/zone.jpg",
        children: [node({ id: "play", kind: "play", game: GAME }), node({ id: "demo", title: "Fjords" })],
      }),
      node({ id: "talk", imageUrl: "https://ludoya.example/talk.jpg" }),
    ];
    expect(collectCoverRequests(tree)).toEqual([
      { id: "play", gameName: "Root", yearPublished: 2018, imageUrl: "https://ludoya.example/game.jpg", slug: "root" },
      { id: "demo", gameName: "Fjords", yearPublished: 0, imageUrl: null, slug: null },
    ]);
  });

  it("never asks for a non-public node or anything under it", () => {
    const tree = [
      node({
        id: "group",
        visibility: "ONLY_GROUP",
        children: [node({ id: "group-play", kind: "play", game: GAME }), node({ id: "group-demo" })],
      }),
      node({ id: "public-demo", title: "Fjords" }),
    ];
    expect(collectCoverRequests(tree).map((r) => r.id)).toEqual(["public-demo"]);
  });

  it("falls back to the node image when the game has none", () => {
    const [req] = collectCoverRequests([node({ id: "p", game: { ...GAME, imageUrl: null }, imageUrl: "https://ludoya.example/node.jpg" })]);
    expect(req.imageUrl).toBe("https://ludoya.example/node.jpg");
  });
});

describe("applyCovers", () => {
  it("puts the resolved cover, else game image, else node image, else null on every node", () => {
    const tree = [
      node({
        id: "zone",
        children: [
          node({ id: "bgg", game: GAME }),
          node({ id: "game", game: GAME }),
          node({ id: "own", imageUrl: "https://ludoya.example/own.jpg" }),
          node({ id: "none" }),
        ],
      }),
    ];
    const [zone] = applyCovers(tree, new Map([["bgg", "https://bgg.example/root.jpg"], ["none", null]]));
    expect(zone.coverUrl).toBeNull();
    expect(zone.children.map((c) => c.coverUrl)).toEqual([
      "https://bgg.example/root.jpg",
      "https://ludoya.example/game.jpg",
      "https://ludoya.example/own.jpg",
      null,
    ]);
  });
});
