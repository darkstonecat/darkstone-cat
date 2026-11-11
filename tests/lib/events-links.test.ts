import { describe, expect, it } from "vitest";
import { eventAnchor, eventIdFromHash } from "@/lib/events/links";

describe("eventIdFromHash", () => {
  it("reads the id of an #event- hash, with or without the #", () => {
    expect(eventIdFromHash("#event-abc")).toBe("abc");
    expect(eventIdFromHash(eventAnchor("a b"))).toBe("a b");
    expect(eventIdFromHash("#event-a%20b")).toBe("a b");
  });

  it("returns null for other hashes", () => {
    expect(eventIdFromHash("")).toBeNull();
    expect(eventIdFromHash("#event-")).toBeNull();
    expect(eventIdFromHash("#schedule")).toBeNull();
  });

  it("returns null instead of throwing on broken percent-encoding", () => {
    expect(eventIdFromHash("#event-%E0%A4%A")).toBeNull();
    expect(eventIdFromHash("#event-%")).toBeNull();
  });
});
