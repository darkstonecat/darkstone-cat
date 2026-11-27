import { describe, expect, it } from "vitest";
import * as restore from "../../scripts/restore-members.mjs";
import { parseKey } from "../../scripts/reencrypt-member-secrets.mjs";
import { BACKUP_HEADERS } from "@/lib/backup/sheet";
import { decrypt } from "@/lib/encryption";

// scripts/restore-members.mjs, pure part (docs/features/member-backup/spec.md §7). The database
// part is covered by tests/integration/member-restore.test.ts.

const { BACKUP_HEADERS: SCRIPT_HEADERS, parseBackupCsv, planRestore, memberColumns } = restore;

type Row = Partial<Record<(typeof BACKUP_HEADERS)[number], string>>;

const quote = (v: string) => `"${v.replace(/"/g, '""')}"`;
function csv(rows: Row[], headers: readonly string[] = BACKUP_HEADERS): string {
  const lines = rows.map((row) => headers.map((h) => quote((row as Record<string, string>)[h] ?? "")).join(","));
  return [headers.map(quote).join(","), ...lines].join("\n");
}

const active: Row = {
  Número: "000-012",
  Estat: "Actiu",
  Nom: "Anna",
  Cognoms: "Puig",
  Email: "Anna@Example.com",
  Telèfon: "+34 600 123 456",
  "DNI/NIE": "12345678Z",
  CP: "08221",
  Ludoya: "anna_l",
  BGG: "anna_b",
  Rol: "board",
  Newsletter: "Sí",
  "Primera alta": "2020-03-01",
  "Alta actual": "2024-05-10",
  Insígnies: "ludoteca_donor@2025-01-15; volunteer_egara_joga@2026-03-02",
  Creat: "2020-03-01",
};
const former: Row = {
  Número: "000-003",
  Estat: "Exsoci",
  Nom: "Pere",
  Email: "pere@example.com",
  "DNI/NIE": "X1234567L",
  Rol: "member",
  Newsletter: "No",
  "Data de baixa": "2026-09-20",
  "Baixa per": "Junta",
  "Motiu de baixa": "'=ha marxat",
};

const empty = { emails: new Set<string>(), numbers: new Set<string>(), badgeKeys: new Set(["ludoteca_donor"]) };

describe("headers", () => {
  it("mirror the backup Sheet's header row", () => {
    expect(SCRIPT_HEADERS).toEqual([...BACKUP_HEADERS]);
  });
});

describe("parseBackupCsv", () => {
  it("reads an active member with every field, lowercasing the e-mail", () => {
    const { records, fatal } = parseBackupCsv(csv([active]));
    expect(fatal).toBeNull();
    expect(records[0]).toMatchObject({
      line: 2,
      memberNumber: "000-012",
      numeric: 12,
      email: "anna@example.com",
      firstName: "Anna",
      lastName: "Puig",
      phone: "+34 600 123 456",
      dni: "12345678Z",
      postalCode: "08221",
      ludoya: "anna_l",
      bgg: "anna_b",
      role: "board",
      newsletter: true,
      membershipStartDate: "2020-03-01",
      currentJoinedOn: "2024-05-10",
      leftOn: null,
      leftBy: null,
      badges: [
        { key: "ludoteca_donor", date: "2025-01-15" },
        { key: "volunteer_egara_joga", date: "2026-03-02" },
      ],
      errors: [],
      warnings: [],
    });
  });

  it("maps a former member's baixa and removes the formula apostrophe the Sheet added", () => {
    const [record] = parseBackupCsv(csv([former])).records;
    expect(record).toMatchObject({ leftOn: "2026-09-20", leftBy: "board", leaveReason: "=ha marxat", newsletter: false });
    expect(record.errors).toEqual([]);
  });

  it("restores an illegible secret as empty, with a warning", () => {
    const [record] = parseBackupCsv(csv([{ ...active, "DNI/NIE": "(illegible)" }])).records;
    expect(record.dni).toBeNull();
    expect(record.warnings).toEqual(["DNI/NIE was illegible in the backup"]);
  });

  it("refuses a file without every backup column, even with no rows", () => {
    const headers = BACKUP_HEADERS.filter((h) => h !== "Rol" && h !== "Email");
    for (const text of [csv([active], headers), csv([], headers)]) {
      expect(parseBackupCsv(text)).toEqual({ records: [], fatal: "missing columns: Email, Rol" });
    }
  });

  it("flags rows the database would refuse or the restore cannot rebuild", () => {
    const bad: [Row, string][] = [
      [{ ...active, Número: "12" }, "member number"],
      [{ ...active, Email: "not-an-email" }, "e-mail"],
      [{ ...active, Rol: "admin" }, "role"],
      [{ ...active, Newsletter: "Potser" }, "newsletter"],
      [{ ...active, "Primera alta": "01/03/2020" }, "Primera alta"],
      [{ ...former, Rol: "board" }, "a former member cannot hold a role"],
      [{ ...former, "Baixa per": "" }, "baixa per"],
      [{ ...active, "Baixa per": "Soci" }, "data de baixa"],
      [{ ...active, Email: "" }, "an active member needs an e-mail"],
      [{ ...active, Insígnies: "Bad Key@2025-01-01" }, "insígnies"],
    ];
    for (const [row, error] of bad) {
      expect(parseBackupCsv(csv([row])).records[0].errors, error).toContain(error);
    }
  });

  it("warns when Estat does not match the baixa date", () => {
    const [record] = parseBackupCsv(csv([{ ...active, Estat: "Exsoci" }])).records;
    expect(record.warnings).toContain("Estat does not match Data de baixa");
    expect(record.errors).toEqual([]);
  });
});

describe("planRestore", () => {
  it("orders by member number, skips what exists and lists missing badge keys", () => {
    const records = parseBackupCsv(
      csv([active, former, { ...active, Número: "000-020", Email: "taken@example.com" }, { ...active, Número: "000-007", Email: "n7@example.com" }])
    ).records;
    const plan = planRestore(records, { ...empty, emails: new Set(["taken@example.com"]), numbers: new Set(["000-007"]) });
    expect(plan.steps.map((s: { record: { memberNumber: string }; action: string }) => [s.record.memberNumber, s.action])).toEqual([
      ["000-003", "create"],
      ["000-007", "skip"],
      ["000-012", "create"],
      ["000-020", "skip"],
    ]);
    expect(plan.maxNumeric).toBe(12);
    expect(plan.missingBadges).toEqual(["volunteer_egara_joga"]);
  });

  it("marks a number or e-mail repeated in the file as invalid, keeping the first in number order", () => {
    // 000-003 takes anna@ first; then 000-012 repeats that e-mail, and the second 000-012 the number.
    const records = parseBackupCsv(csv([active, { ...active, Email: "other@example.com" }, { ...former, Email: "anna@example.com" }])).records;
    const actions = planRestore(records, empty).steps.map((s: { record: { memberNumber: string }; action: string; reason?: string }) => [
      s.record.memberNumber,
      s.action,
      s.reason,
    ]);
    expect(actions).toEqual([
      ["000-003", "create", undefined],
      ["000-012", "invalid", "repeated in the file"],
      ["000-012", "invalid", "repeated in the file"],
    ]);
  });
});

describe("memberColumns", () => {
  it("encrypts DNI and phone for the row so the site can read them", () => {
    const id = "11111111-2222-4333-8444-555555555555";
    const [record] = parseBackupCsv(csv([active])).records;
    const columns = memberColumns(record, id, parseKey(process.env.ENCRYPTION_KEY));
    expect(decrypt(columns.dni_nie_encrypted!, id)).toBe("12345678Z");
    expect(decrypt(columns.phone_encrypted!, id)).toBe("+34 600 123 456");
    expect(columns).toMatchObject({ member_number: "000-012", role: "board", left_on: null, anonymised_at: null });
  });
});
