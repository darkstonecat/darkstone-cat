import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Static checks on .github/workflows/retention.yml (T12): the job must stay a dry run unless
// someone opts in explicitly. No YAML parser is installed, so these read the text.

const workflow = readFileSync(path.resolve(import.meta.dirname, "../../.github/workflows/retention.yml"), "utf8");

describe(".github/workflows/retention.yml", () => {
  it("runs daily and by hand, with an apply input that defaults to false", () => {
    expect(workflow).toMatch(/^on:\n {2}schedule:\n {4}(?:#.*\n {4})?- cron: "\d+ \d+ \* \* \*"/m);
    expect(workflow).toMatch(/workflow_dispatch:\n {4}inputs:\n {6}apply:\n(?: {8}.*\n)*? {8}type: boolean\n/);
    expect(workflow).toMatch(/ {6}apply:\n(?: {8}.*\n)*? {8}default: false\n/);
  });

  it("applies only on a ticked manual run or with RETENTION_APPLY=true on a schedule", () => {
    expect(workflow).toContain('if [ "$INPUT_APPLY" = "true" ]; then query="?apply=1"; fi');
    expect(workflow).toContain('elif [ "$RETENTION_APPLY" = "true" ]; then');
    expect(workflow).toContain("RETENTION_APPLY: ${{ vars.RETENTION_APPLY }}");
    expect(workflow.match(/apply=1/g)).toHaveLength(2);
  });

  it("calls production from main with the cron secret and a timeout", () => {
    expect(workflow).toContain("if: github.ref == 'refs/heads/main'");
    expect(workflow).toContain('curl -fsS --max-time 120 -H "Authorization: Bearer $CRON_SECRET"');
    expect(workflow).toContain('"https://www.darkstone.cat/api/cron/retention$query"');
    expect(workflow).toContain("CRON_SECRET: ${{ secrets.CRON_SECRET }}");
  });
});
