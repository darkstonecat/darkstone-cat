import { describe, expect, it } from "vitest";
import { getClientIp } from "@/lib/client-ip";

describe("getClientIp", () => {
  it("prefers x-real-ip", () => {
    const h = new Headers({ "x-real-ip": " 203.0.113.5 ", "x-forwarded-for": "1.1.1.1" });
    expect(getClientIp(h)).toBe("203.0.113.5");
  });

  it("falls back to the first x-forwarded-for hop", () => {
    expect(getClientIp(new Headers({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" }))).toBe("198.51.100.1");
  });

  it("returns unknown without either header or with blank values", () => {
    expect(getClientIp(new Headers())).toBe("unknown");
    expect(getClientIp(new Headers({ "x-real-ip": " ", "x-forwarded-for": " " }))).toBe("unknown");
  });
});
