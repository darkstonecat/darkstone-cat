import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "@/lib/seo";

describe("serializeJsonLd", () => {
  it("escapes < so upstream text cannot close the script tag", () => {
    const out = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("<");
    expect(out).toContain("\\u003c/script>");
  });

  it("stays valid JSON that parses back to the same value", () => {
    const data = [{ "@type": "Event", name: "A < B", description: "x</script>" }];
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });
});
