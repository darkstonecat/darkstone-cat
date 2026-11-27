import { describe, expect, it } from "vitest";
import ca from "@/messages/ca.json";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

// Privacy texts of the member backup (docs/features/member-backup/spec.md §4, §9): every locale
// names Google Workspace as processor, the 4 kept copies and the 5-week bound.

const locales = { ca, es, en } as const;

describe.each(Object.entries(locales))("member backup privacy texts (%s)", (_, messages) => {
  it("the data protection policy names the processor, the 4 copies and the 5-week bound", () => {
    const text = messages.data_protection.data_sharing_backup;
    expect(text).toContain("Google Workspace");
    expect(text).toMatch(/\b4\b/);
    expect(text).toMatch(/\b5\b/);
  });

  it("the site privacy policy names the processor and the 5-week bound", () => {
    const text = messages.privacy_policy.third_parties_text;
    expect(text).toContain("Google Workspace");
    expect(text).toMatch(/\b5\b/);
  });

  it("procedure P-8 repeats the 5-week bound", () => {
    expect(messages.admin.procedures.p8.s3).toMatch(/\b5\b/);
  });
});
