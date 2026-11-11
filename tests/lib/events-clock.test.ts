import { afterEach, describe, expect, it, vi } from "vitest";
import { agendaNow } from "@/lib/events/clock";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("agendaNow", () => {
  it("is the real time by default", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-11T11:00:00Z"));
    vi.stubEnv("LUDOYA_MOCK", "");
    vi.stubEnv("LUDOYA_MOCK_NOW", "2026-10-01T10:00:00Z");
    expect(agendaNow().toISOString()).toBe("2026-11-11T11:00:00.000Z");
  });

  it("uses LUDOYA_MOCK_NOW only with the Ludoya fixtures", () => {
    vi.stubEnv("LUDOYA_MOCK", "1");
    vi.stubEnv("LUDOYA_MOCK_NOW", "2026-10-01T10:00:00Z");
    expect(agendaNow().toISOString()).toBe("2026-10-01T10:00:00.000Z");
  });

  it("ignores an invalid LUDOYA_MOCK_NOW", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-11T11:00:00Z"));
    vi.stubEnv("LUDOYA_MOCK", "1");
    vi.stubEnv("LUDOYA_MOCK_NOW", "soon");
    expect(agendaNow().toISOString()).toBe("2026-11-11T11:00:00.000Z");
  });
});
