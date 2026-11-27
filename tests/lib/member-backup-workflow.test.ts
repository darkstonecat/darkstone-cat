import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Static checks on .github/workflows/member-backup.yml (docs/features/member-backup/spec.md §6).
// No YAML parser is installed, so these read the text.

const workflow = readFileSync(path.resolve(import.meta.dirname, "../../.github/workflows/member-backup.yml"), "utf8");
/** The workflow without comment lines (the header comment names the keys it does NOT hold). */
const code = workflow
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("#"))
  .join("\n");

describe(".github/workflows/member-backup.yml", () => {
  it("runs every Monday and by hand", () => {
    expect(workflow).toMatch(/^on:\n {2}schedule:\n {4}(?:#.*\n {4})*- cron: "\d+ \d+ \* \* 1"\n {2}workflow_dispatch:\n/m);
  });

  it("has no repository permissions and never runs twice at once", () => {
    expect(workflow).toMatch(/^permissions: \{\}$/m);
    expect(workflow).toMatch(/^concurrency:\n {2}group: member-backup\n {2}cancel-in-progress: false$/m);
  });

  it("calls production from main with the cron secret and a timeout, and holds no Google credential", () => {
    expect(workflow).toContain("if: github.ref == 'refs/heads/main'");
    expect(workflow).toContain(
      'curl -fsS --max-time 120 -H "Authorization: Bearer $CRON_SECRET" https://www.darkstone.cat/api/cron/backup'
    );
    expect(workflow).toContain("CRON_SECRET: ${{ secrets.CRON_SECRET }}");
    expect(code.match(/secrets\./g)).toHaveLength(1);
    expect(code).not.toMatch(/GOOGLE|ENCRYPTION_KEY|SUPABASE/);
  });
});
