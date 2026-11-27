import { describe, expect, it } from "vitest";
import { BACKUP_HEADERS, buildBackupSheet, ILLEGIBLE, type BackupMemberRow } from "@/lib/backup/sheet";

// Cell values of the weekly member backup Sheet (docs/features/member-backup/spec.md §3).

const row = (over: Partial<BackupMemberRow> = {}): BackupMemberRow => ({
  id: "11111111-1111-4111-8111-111111111111",
  member_number: "000-001",
  first_name: "Anna",
  last_name: "Puig",
  email: "anna@example.com",
  dni_nie_encrypted: "cipher-dni",
  phone_encrypted: "cipher-phone",
  postal_code: "08221",
  ludoya_username: "anna_l",
  bgg_username: "anna_b",
  role: "member",
  newsletter_accepted: true,
  membership_start_date: "2020-03-01",
  current_joined_on: "2024-05-10",
  left_on: null,
  left_by: null,
  leave_reason: null,
  anonymised_at: null,
  created_at: "2020-03-01T23:30:00Z",
  badges: "ludoteca_donor@2025-01-15",
  ...over,
});

const plain: Record<string, string> = { "cipher-dni": "12345678Z", "cipher-phone": "+34 600 123 456" };
const reveal = (cipher: string) => {
  if (!(cipher in plain)) throw new Error("bad cipher");
  return plain[cipher];
};

describe("buildBackupSheet", () => {
  it("starts with the header row and maps an active member to every column", () => {
    const sheet = buildBackupSheet([row()], reveal);
    expect(sheet.values[0]).toEqual([...BACKUP_HEADERS]);
    expect(sheet.values[1]).toEqual([
      "000-001",
      "Actiu",
      "Anna",
      "Puig",
      "anna@example.com",
      "+34 600 123 456",
      "12345678Z",
      "08221",
      "anna_l",
      "anna_b",
      "member",
      "Sí",
      "2020-03-01",
      "2024-05-10",
      "",
      "",
      "",
      "",
      "ludoteca_donor@2025-01-15",
      "2020-03-02", // 23:30 UTC is the next day in Madrid
    ]);
    expect(sheet).toMatchObject({ rows: 1, illegible: 0 });
  });

  it("keeps a former member's baixa fields and DNI, with empty contact cells", () => {
    const former = row({
      phone_encrypted: null,
      postal_code: null,
      newsletter_accepted: false,
      left_on: "2026-09-20",
      left_by: "board",
      leave_reason: "Ha marxat",
      anonymised_at: "2026-10-01T10:00:00Z",
      badges: null,
    });
    const [, cells] = buildBackupSheet([former], reveal).values;
    const at = (header: (typeof BACKUP_HEADERS)[number]) => cells[BACKUP_HEADERS.indexOf(header)];
    expect(at("Estat")).toBe("Exsoci");
    expect(at("DNI/NIE")).toBe("12345678Z");
    expect(at("Telèfon")).toBe("");
    expect(at("CP")).toBe("");
    expect(at("Newsletter")).toBe("No");
    expect(at("Data de baixa")).toBe("2026-09-20");
    expect(at("Baixa per")).toBe("Junta");
    expect(at("Motiu de baixa")).toBe("Ha marxat");
    expect(at("Anonimitzat")).toBe("2026-10-01");
    expect(at("Insígnies")).toBe("");
  });

  it("writes (illegible) for a secret that does not decrypt and counts it", () => {
    const sheet = buildBackupSheet([row({ dni_nie_encrypted: "broken" }), row({ phone_encrypted: "broken" })], reveal);
    expect(sheet.values[1][BACKUP_HEADERS.indexOf("DNI/NIE")]).toBe(ILLEGIBLE);
    expect(sheet.values[2][BACKUP_HEADERS.indexOf("Telèfon")]).toBe(ILLEGIBLE);
    expect(sheet).toMatchObject({ rows: 2, illegible: 2 });
  });

  it("neutralises cells a spreadsheet would run as a formula, but not a plain phone", () => {
    const sheet = buildBackupSheet([row({ first_name: "=HYPERLINK(\"x\")", leave_reason: "@cmd" })], reveal);
    const cells = sheet.values[1];
    expect(cells[BACKUP_HEADERS.indexOf("Nom")]).toBe("'=HYPERLINK(\"x\")");
    expect(cells[BACKUP_HEADERS.indexOf("Motiu de baixa")]).toBe("'@cmd");
    expect(cells[BACKUP_HEADERS.indexOf("Telèfon")]).toBe("+34 600 123 456");
  });

  it("returns only the header for an empty list", () => {
    expect(buildBackupSheet([], reveal)).toEqual({ values: [[...BACKUP_HEADERS]], rows: 0, illegible: 0 });
  });
});
