import { NextResponse } from "next/server";
import { fetchUpcomingEvents } from "@/lib/ludoya";
import { fetchBggCollection } from "@/lib/bgg";
import { generateEventImage } from "@/lib/event-image/generator";
import { getAdminAccess } from "@/lib/admin/guard";

// Allow up to 30s for image generation (BGG image fetches can be slow)
export const maxDuration = 30;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  // Only the admin tool `/events/images` uses this route. Rendering is expensive
  // (BGG and Ludoya fetches + Satori), so it must not be open to anonymous traffic.
  const access = await getAdminAccess("board");
  if (access.status === "unauthenticated") {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (access.status !== "ok") {
    return NextResponse.json(
      { error: "forbidden" },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { eventId } = await params;

  // Validate eventId
  if (!eventId || typeof eventId !== "string" || eventId.trim().length === 0) {
    return NextResponse.json(
      { error: "invalid_event_id" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    // Fetch events and BGG collection in parallel
    const [eventsResult, bggResult] = await Promise.all([
      fetchUpcomingEvents(),
      fetchBggCollection(),
    ]);

    // Find the event by ID across both regular and special events
    const allEvents = [
      ...eventsResult.regularEvents,
      ...eventsResult.specialEvents,
    ];
    const event = allEvents.find((e) => e.id === eventId);

    if (!event) {
      return NextResponse.json(
        { error: "event_not_found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Generate the image (returns ImageResponse with PNG body)
    const response = await generateEventImage(event, bggResult.games);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (err) {
    console.error("[EventImage] Generation failed:", err);
    return NextResponse.json(
      { error: "generation_failed" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
