import { describe, expect, it } from "vitest";
import { CHAIRS_MAX_DESKTOP, CHAIRS_MAX_MOBILE, seatCounter } from "@/lib/events/seat-counter";

const seats = (taken: number, capacity: number | null, minParticipants: number | null = null) => ({
  participantCount: taken,
  capacity,
  minParticipants,
});

describe("seatCounter: modes", () => {
  it("draws chairs up to 8 seats, segments from 9 to 20, a bar above 20, an icon without limit", () => {
    expect(seatCounter(seats(0, 4), 6).mode).toBe("chairs");
    expect(seatCounter(seats(3, 8), 6).mode).toBe("chairs");
    expect(seatCounter(seats(3, 9), 6).mode).toBe("segments");
    expect(seatCounter(seats(12, 20), 6).mode).toBe("segments");
    expect(seatCounter(seats(45, 21), 6).mode).toBe("bar");
    expect(seatCounter(seats(21, null), 6).mode).toBe("open");
  });

  it("uses 6 chairs on desktop and 5 on mobile", () => {
    expect(CHAIRS_MAX_DESKTOP).toBe(6);
    expect(CHAIRS_MAX_MOBILE).toBe(5);
  });
});

describe("seatCounter: the reference cases (seats.dc.html)", () => {
  it("Buida: 0/4, all free", () => {
    const c = seatCounter(seats(0, 4), 6);
    expect(c.chairs).toEqual(["free", "free", "free", "free"]);
    expect(c.truncated).toBe(false);
    expect(c.status).toEqual({ kind: "free", count: 4 });
    expect(c.aria).toEqual({ kind: "seats", taken: 0, capacity: 4, needed: 0 });
  });

  it("Mínim no assolit: 2/4 with minimum 3, one chair still needed", () => {
    const c = seatCounter(seats(2, 4, 3), 6);
    expect(c.chairs).toEqual(["taken", "taken", "needed", "free"]);
    expect(c.status).toEqual({ kind: "needed", count: 1 });
    expect(c.aria).toEqual({ kind: "seats", taken: 2, capacity: 4, needed: 1 });
  });

  it("Queda 1: 3/4", () => {
    const c = seatCounter(seats(3, 4), 6);
    expect(c.chairs).toEqual(["taken", "taken", "taken", "free"]);
    expect(c.status).toEqual({ kind: "last" });
  });

  it("Completa: 5/5", () => {
    const c = seatCounter(seats(5, 5), 6);
    expect(c.chairs).toEqual(Array(5).fill("taken"));
    expect(c.status).toEqual({ kind: "full" });
    expect(c.full).toBe(true);
  });

  it("Taula de rol: 3/8 is cut to 5 chairs and an ellipsis on desktop, 4 on mobile", () => {
    const desktop = seatCounter(seats(3, 8), CHAIRS_MAX_DESKTOP);
    expect(desktop.chairs).toEqual(["taken", "taken", "taken", "free", "free"]);
    expect(desktop.truncated).toBe(true);
    expect(desktop.status).toEqual({ kind: "free", count: 5 });

    const mobile = seatCounter(seats(3, 8), CHAIRS_MAX_MOBILE);
    expect(mobile.chairs).toEqual(["taken", "taken", "taken", "free"]);
    expect(mobile.truncated).toBe(true);
  });

  it("Rol, sense mínim: 1/6 with minimum 3 keeps every chair on desktop, cuts on mobile", () => {
    const desktop = seatCounter(seats(1, 6, 3), CHAIRS_MAX_DESKTOP);
    expect(desktop.chairs).toEqual(["taken", "needed", "needed", "free", "free", "free"]);
    expect(desktop.truncated).toBe(false);
    expect(desktop.status).toEqual({ kind: "needed", count: 2 });

    const mobile = seatCounter(seats(1, 6, 3), CHAIRS_MAX_MOBILE);
    expect(mobile.chairs).toEqual(["taken", "needed", "needed", "free"]);
    expect(mobile.truncated).toBe(true);
  });

  it("9-20 places: 12/16 gives one segment per seat", () => {
    const c = seatCounter(seats(12, 16), 6);
    expect(c.segments).toEqual([...Array(12).fill("taken"), ...Array(4).fill("free")]);
    expect(c.chairs).toEqual([]);
    expect(c.status).toEqual({ kind: "free", count: 4 });
  });

  it("9-20, gairebé plena: 17/18", () => {
    const c = seatCounter(seats(17, 18), 6);
    expect(c.segments.filter((s) => s === "taken")).toHaveLength(17);
    expect(c.status).toEqual({ kind: "last" });
  });

  it("Més de 20: 45/60 fills 75 % of the bar", () => {
    const c = seatCounter(seats(45, 60), 6);
    expect(c.fillPercent).toBe(75);
    expect(c.segments).toEqual([]);
    expect(c.status).toEqual({ kind: "free", count: 15 });
  });

  it("Sense límit: 21 people", () => {
    const c = seatCounter(seats(21, null), 6);
    expect(c.status).toEqual({ kind: "unlimited" });
    expect(c.aria).toEqual({ kind: "open", taken: 21, needed: 0 });
    expect(c.full).toBe(false);
  });
});

describe("seatCounter: edge cases", () => {
  it("marks needed seats in the segments too", () => {
    expect(seatCounter(seats(2, 10, 4), 6).segments.slice(0, 5)).toEqual(["taken", "taken", "needed", "needed", "free"]);
  });

  it("puts the minimum before 'unlimited' when there is no limit", () => {
    expect(seatCounter(seats(1, null, 3), 6).status).toEqual({ kind: "needed", count: 2 });
  });

  it("caps the needed seats at the free seats when the minimum exceeds the capacity", () => {
    const c = seatCounter(seats(2, 4, 9), 6);
    expect(c.chairs).toEqual(["taken", "taken", "needed", "needed"]);
    expect(c.status).toEqual({ kind: "needed", count: 2 });
  });

  it("shows an over-booked play as full, with a full bar", () => {
    const chairs = seatCounter(seats(6, 4), 6);
    expect(chairs.chairs).toEqual(Array(4).fill("taken"));
    expect(chairs.status).toEqual({ kind: "full" });
    expect(seatCounter(seats(70, 60), 6).fillPercent).toBe(100);
  });

  it("treats a zero or negative capacity as no limit", () => {
    expect(seatCounter(seats(2, 0), 6).mode).toBe("open");
  });

  it("is full before it needs people", () => {
    expect(seatCounter(seats(2, 2, 3), 6).status).toEqual({ kind: "full" });
  });
});
