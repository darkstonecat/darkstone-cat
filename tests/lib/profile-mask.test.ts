import { describe, expect, it } from "vitest";
import { maskDni, maskPhone } from "@/lib/profile/mask";
import { normalizeUsername } from "@/lib/profile/username-pattern";

describe("maskDni", () => {
  it("shows a fixed number of bullets and only the last 4 characters", () => {
    expect(maskDni("12345678z")).toEqual({ masked: "•••••678Z", tail: "678Z" });
    expect(maskDni("X1234567L")).toEqual({ masked: "•••••567L", tail: "567L" });
  });

  it("ignores spaces and hyphens, and hides everything for a short value", () => {
    expect(maskDni("1234 5678-Z")?.masked).toBe("•••••678Z");
    expect(maskDni("1234567")).toEqual({ masked: "•••••", tail: "" });
  });

  it("does not leak the full value or its length", () => {
    const masked = maskDni("12345678Z")!.masked;
    expect(masked).not.toContain("1234");
    expect(maskDni("X1234567LLLL")!.masked.length).toBe(masked.length);
  });

  it("returns null for empty values", () => {
    expect(maskDni(null)).toBeNull();
    expect(maskDni("  ")).toBeNull();
  });
});

describe("maskPhone", () => {
  it("shows only the last 3 digits", () => {
    expect(maskPhone("+34 612 345 412")).toEqual({ masked: "••• ••• 412", tail: "412" });
  });

  it("hides everything when there are fewer than 7 digits", () => {
    expect(maskPhone("12345")).toEqual({ masked: "••• •••", tail: "" });
  });

  it("returns null when there are no digits", () => {
    expect(maskPhone("")).toBeNull();
    expect(maskPhone(undefined)).toBeNull();
    expect(maskPhone("abc")).toBeNull();
  });
});

describe("normalizeUsername", () => {
  it("trims and drops a leading @", () => {
    expect(normalizeUsername("  @laia_serra ")).toBe("laia_serra");
  });

  it("accepts letters of any script, digits, dot, dash and inner spaces", () => {
    expect(normalizeUsername("Zoë.Ñ-1 b")).toBe("Zoë.Ñ-1 b");
  });

  it("rejects empty, oversized, unsafe and non-string input", () => {
    for (const bad of ["", "   ", "@", "a".repeat(65), "a/b", "a?b=c", "<script>", "a\nb", undefined, null, 4, {}]) {
      expect(normalizeUsername(bad)).toBeNull();
    }
  });
});
