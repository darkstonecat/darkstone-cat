// Cell values of the weekly member backup Sheet (docs/features/member-backup/spec.md §3).
// Pure: the rows come from `backup_member_rows()` and the decryption is passed in, so the job
// owns the key and this module can be tested without it.

import { neutralizeFormula } from "@/lib/csv";
import { madridDay } from "@/lib/events/madrid-day";

/** One row of `public.backup_member_rows()`. */
export type BackupMemberRow = {
  id: string;
  member_number: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  dni_nie_encrypted: string | null;
  phone_encrypted: string | null;
  postal_code: string | null;
  ludoya_username: string | null;
  bgg_username: string | null;
  role: string | null;
  newsletter_accepted: boolean | null;
  membership_start_date: string | null;
  current_joined_on: string | null;
  left_on: string | null;
  left_by: string | null;
  leave_reason: string | null;
  anonymised_at: string | null;
  created_at: string | null;
  badges: string | null;
};

/**
 * Header row. The restore (`scripts/restore-members.mjs`, which keeps a pinned copy) reads the
 * columns by these names: renaming one breaks it.
 */
export const BACKUP_HEADERS = [
  "Número",
  "Estat",
  "Nom",
  "Cognoms",
  "Email",
  "Telèfon",
  "DNI/NIE",
  "CP",
  "Ludoya",
  "BGG",
  "Rol",
  "Newsletter",
  "Primera alta",
  "Alta actual",
  "Data de baixa",
  "Baixa per",
  "Motiu de baixa",
  "Anonimitzat",
  "Insígnies",
  "Creat",
] as const;

/** Written instead of a DNI or phone that cannot be decrypted. */
export const ILLEGIBLE = "(illegible)";

const LEFT_BY_LABELS: Record<string, string> = { self: "Soci", board: "Junta" };

export type Reveal = (ciphertext: string, memberId: string) => string;

export type BackupSheet = {
  /** Header row first; every cell is a string, written to the Sheet as-is (RAW). */
  values: string[][];
  rows: number;
  /** DNI/phone cells that could not be decrypted. */
  illegible: number;
};

const day = (instant: string | null): string => (instant ? madridDay(instant) : "");

export function buildBackupSheet(members: readonly BackupMemberRow[], reveal: Reveal): BackupSheet {
  let illegible = 0;

  const secret = (ciphertext: string | null, memberId: string): string => {
    if (!ciphertext) return "";
    try {
      return reveal(ciphertext, memberId);
    } catch {
      illegible += 1;
      return ILLEGIBLE;
    }
  };

  const rows = members.map((m) =>
    [
      m.member_number,
      m.left_on ? "Exsoci" : "Actiu",
      m.first_name ?? "",
      m.last_name ?? "",
      m.email ?? "",
      secret(m.phone_encrypted, m.id),
      secret(m.dni_nie_encrypted, m.id),
      m.postal_code ?? "",
      m.ludoya_username ?? "",
      m.bgg_username ?? "",
      m.role ?? "",
      m.newsletter_accepted ? "Sí" : "No",
      m.membership_start_date ?? "",
      m.current_joined_on ?? "",
      m.left_on ?? "",
      m.left_by ? (LEFT_BY_LABELS[m.left_by] ?? m.left_by) : "",
      m.leave_reason ?? "",
      day(m.anonymised_at),
      m.badges ?? "",
      day(m.created_at),
    ].map(neutralizeFormula)
  );

  return { values: [[...BACKUP_HEADERS], ...rows], rows: rows.length, illegible };
}
