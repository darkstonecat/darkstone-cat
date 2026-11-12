import { describe, expect, it } from "vitest";
import { madridLastDay, NIGHT_END_HOUR, secondsUntilMadridMidnight } from "@/lib/events/madrid-day";

// Madrid is UTC+1 in November and UTC+2 until the last Sunday of October (2026-10-25).
describe("madridLastDay", () => {
  it.each([
    ["ends the same evening", "2026-11-13T16:00:00Z", "2026-11-13T22:00:00Z", "2026-11-13"],
    ["ends at 00:00", "2026-11-13T16:00:00Z", "2026-11-13T23:00:00Z", "2026-11-13"],
    ["ends at 02:00", "2026-11-13T16:00:00Z", "2026-11-14T01:00:00Z", "2026-11-13"],
    ["ends at 05:59", "2026-11-13T16:00:00Z", "2026-11-14T04:59:00Z", "2026-11-13"],
    ["ends at 06:00, the cut-off itself", "2026-11-13T16:00:00Z", "2026-11-14T05:00:00Z", "2026-11-14"],
    ["a two-day event ending in the afternoon", "2026-11-28T09:00:00Z", "2026-11-29T15:00:00Z", "2026-11-29"],
    ["a two-day event ending before 06:00 of a third day", "2026-11-28T09:00:00Z", "2026-11-30T02:00:00Z", "2026-11-29"],
    ["starts after midnight and ends before 06:00: never before its first day", "2026-11-14T00:30:00Z", "2026-11-14T03:00:00Z", "2026-11-14"],
    ["ends at 00:00 summer time", "2026-10-02T15:00:00Z", "2026-10-02T22:00:00Z", "2026-10-02"],
  ])("%s", (_name, startsAt, endsAt, expected) => {
    expect(madridLastDay(startsAt, endsAt)).toBe(expected);
  });

  it("uses a 06:00 cut-off", () => {
    expect(NIGHT_END_HOUR).toBe(6);
  });
});

describe("secondsUntilMadridMidnight", () => {
  it.each([
    ["noon", "2026-11-11T11:00:00Z", 12 * 3600],
    ["23:59:00", "2026-11-11T22:59:00Z", 60],
    ["23:59:59", "2026-11-11T22:59:59Z", 1],
    ["00:00 itself", "2026-11-11T23:00:00Z", 24 * 3600],
    ["23:58 summer time", "2026-10-02T21:58:00Z", 120],
  ])("at %s Madrid", (_name, now, expected) => {
    expect(secondsUntilMadridMidnight(new Date(now))).toBe(expected);
  });
});
