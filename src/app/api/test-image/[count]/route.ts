import { NextResponse } from "next/server";
import type { LudoyaEvent } from "@/lib/ludoya";
import type { ResolvedGame } from "@/lib/game-matching";
import { composeEventImage } from "@/lib/event-image/composer";

export const maxDuration = 30;

// ---------------------------------------------------------------------------
// Mock game pool — 8 games with varied types and weights
// ---------------------------------------------------------------------------

const MOCK_GAMES: ResolvedGame[] = [
  {
    name: "Catan",
    bggId: "13",
    imageUrl: "https://cf.geekdo-images.com/0XODRpReiZBFUffEcqT5-Q__original/img/oRc0AomWA9ZtFqQDZiZbIyKE1j0=/0x0/filters:format(png)/pic9156909.png",
    weight: 2.3,
    type: "boardgame",
    frame: "green",
  },
  {
    name: "Gloomhaven",
    bggId: "174430",
    imageUrl: "https://cf.geekdo-images.com/sZYp_3BTDGjh2unaZfZmuA__original/img/7d-lj5Gd1e8PFnD97LYFah2c45M=/0x0/filters:format(jpeg)/pic2437871.jpg",
    weight: 3.9,
    type: "boardgame",
    frame: "red",
  },
  {
    name: "Ticket to Ride",
    bggId: "9209",
    imageUrl: "https://cf.geekdo-images.com/kdWYkW-7AqG63HhqPL6ekA__original/img/rWF8r4JXXCQQ7QhiWHhmT-rQ3Pc=/0x0/filters:format(jpeg)/pic8937637.jpg",
    weight: 1.8,
    type: "boardgame",
    frame: "green",
  },
  {
    name: "D&D Roleplaying Game Dice",
    bggId: "85048",
    imageUrl: "https://cf.geekdo-images.com/PPlRj60Pn5KHlBeHpwpEvg__original/img/cQnJAh-JdGtH6P1NSRHTIyXJpFU=/0x0/filters:format(jpeg)/pic1022479.jpg",
    weight: 0,
    type: "rpg",
    frame: "rpg",
  },
  {
    name: "Terraforming Mars",
    bggId: "167791",
    imageUrl: "https://cf.geekdo-images.com/wg9oOLcsKvDesSUdZQ4rxw__original/img/thIqWDnH9utKuoKVEUqveDixprI=/0x0/filters:format(jpeg)/pic3536616.jpg",
    weight: 3.2,
    type: "boardgame",
    frame: "orange",
  },
  {
    name: "Pandemic",
    bggId: "30549",
    imageUrl: "https://cf.geekdo-images.com/S3ybV1LAp-8SnHIXLLjVqA__original/img/IsrvRLpUV1TEyZsO5rC-btXaPz0=/0x0/filters:format(jpeg)/pic1534148.jpg",
    weight: 2.4,
    type: "boardgame",
    frame: "green",
  },
  {
    name: "Azul",
    bggId: "230802",
    imageUrl: "https://cf.geekdo-images.com/aPSHJO0d0XOpQR5X-wJonw__original/img/AkbtYVc6xXJF3c9EUrakklcclKw=/0x0/filters:format(png)/pic6973671.png",
    weight: 1.8,
    type: "boardgame",
    frame: "green",
  },
  {
    name: "Forbidden Lands",
    bggId: "267223",
    imageUrl: "https://cf.geekdo-images.com/f0s95zy0Y4ff5rB1Fhs4OQ__original/img/mlSZ4SDVE_qXx8kOConesQKd0x4=/0x0/filters:format(jpeg)/pic5498135.jpg",
    weight: 0,
    type: "rpg",
    frame: "rpg",
  },
];

// ---------------------------------------------------------------------------
// Mock event
// ---------------------------------------------------------------------------

function buildMockEvent(count: number): LudoyaEvent {
  return {
    id: `test-${count}`,
    title: `Test ${count} jocs`,
    description: "",
    startsAt: "2026-03-14T09:00:00Z",
    endsAt: "2026-03-14T12:30:00Z",
    timeZone: "Europe/Madrid",
    imageUrl: null,
    thumbnailUrl: null,
    plannedPlayCount: count,
    ludoyaUrl: "",
    type: "regular",
    plannedPlays: MOCK_GAMES.slice(0, count).map((g) => ({
      gameName: g.name,
      imageUrl: null,
      yearPublished: 0,
      slug: null,
      isRpg: g.type === "rpg",
    })),
  };
}

// ---------------------------------------------------------------------------
// GET /api/test-image/[count]
// ---------------------------------------------------------------------------

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ count: string }> }
) {
  const { count: countStr } = await params;
  const count = parseInt(countStr, 10);

  if (isNaN(count) || count < 1 || count > 8) {
    return NextResponse.json(
      { error: "count must be between 1 and 8" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const mockEvent = buildMockEvent(count);
    const mockGames = MOCK_GAMES.slice(0, count);
    const response = await composeEventImage(mockEvent, mockGames);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (err) {
    console.error("[TestImage] Generation failed:", err);
    return NextResponse.json(
      { error: "generation_failed" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
