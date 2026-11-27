// scripts/restore-members.mjs
//
// Rebuilds the member list from a weekly backup Sheet (docs/features/member-backup/spec.md §7,
// runbook docs/operations/member-restore.md). For a NEW database after a loss: the Sheet is the
// source, and every member comes back with the same member number, names, e-mail, DNI/phone,
// postal code, usernames, role, newsletter choice, alta dates, baixa fields and badges.
//
// Not the Google Form import (scripts/migrate-members.mjs): that one cleans and merges form
// answers and gives new numbers; this one copies the Sheet exactly.
//
// ─── How it works ───────────────────────────────────────────────────────────
//
//   1. PARSE    The Sheet downloaded as CSV (File → Download → CSV). Columns are read by their
//               header names (src/lib/backup/sheet.ts BACKUP_HEADERS); every one must be there.
//   2. CHECK    Every row is validated. A row whose e-mail already has an account, or whose
//               member number already exists, is SKIPPED: this script is insert-only and never
//               changes an existing member, so it is safe to run again.
//   3. RESTORE  (--execute) Raises the member number sequence above the highest number in the
//               Sheet, then, in member number order:
//                 - a row with an e-mail: creates a confirmed auth user without a password
//                   (members sign in with the magic link or "Forgot password"), then fills the
//                   members row the sign-up trigger made; a former member's account is banned,
//                   as a baixa leaves it;
//                 - a row without an e-mail (an anonymised former member): inserts the members
//                   row alone;
//                 - re-awards the badges whose key exists in the badge catalogue. Missing keys
//                   are listed: create them in /admin/badges and award them by hand.
//               A member that fails half-way is removed again, so a re-run retries it.
//
// Not restored: passwords, sessions, card tokens (new ones are generated), role dates, the
// audit log, the badge catalogue and the member benefits.
//
// ─── Usage ──────────────────────────────────────────────────────────────────
//
//   npm run restore -- <file.csv>              # Dry run: reads the database, writes nothing
//   npm run restore -- <file.csv> --execute    # Restores the members
//
// Environment (.env.local / .env): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and
// ENCRYPTION_KEY of the NEW deployment (the Sheet holds the plain values, so any valid key works).
//
// Output names member numbers only, never names, e-mails, DNIs or phones.
//
// ─── Exit codes ─────────────────────────────────────────────────────────────
//
//   0 — Success   1 — Fatal error (environment, file, columns)   2 — Some members failed

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";
import { encryptForMember, parseKey } from "./reencrypt-member-secrets.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const EXIT_CODES = Object.freeze({ ok: 0, fatal: 1, partial: 2 });

/** Mirror of BACKUP_HEADERS in src/lib/backup/sheet.ts (pinned by a test). */
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
];

const ILLEGIBLE = "(illegible)";
const MEMBER_NUMBER = /^000-(\d{3,})$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BADGE_KEY = /^[a-z0-9_]{1,64}$/;
const ROLES = new Set(["member", "board", "superadmin"]);
const LEFT_BY = { Soci: "self", Junta: "board" };
/** The Sheet writes a leading apostrophe before a value a spreadsheet would run as a formula. */
const NEUTRALISED = /^'[=+\-@\t\r]/;
/** Long enough to never expire, as a baixa does (banned_until = now() + 100 years). */
const BAN_DURATION = "876000h";

const cell = (value) => {
  const text = typeof value === "string" ? value.trim() : "";
  return NEUTRALISED.test(text) ? text.slice(1) : text;
};
const orNull = (text) => (text === "" ? null : text);

// ---------------------------------------------------------------------------
// Parsing and validation (pure)
// ---------------------------------------------------------------------------

/**
 * Parses the CSV of a backup Sheet. `fatal` is set when the file is not a backup Sheet
 * (missing columns); then `records` is empty.
 */
export function parseBackupCsv(text) {
  let rows;
  try {
    rows = parse(text, { columns: true, bom: true, skip_empty_lines: true, relax_column_count: true });
  } catch {
    return { records: [], fatal: "the file is not a readable CSV" };
  }
  const headers = rows.length > 0 ? Object.keys(rows[0]) : parseHeaderLine(text);
  const missing = BACKUP_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length > 0) return { records: [], fatal: `missing columns: ${missing.join(", ")}` };
  return { records: rows.map((row, index) => toRecord(row, index + 2)), fatal: null };
}

function parseHeaderLine(text) {
  try {
    const [first] = parse(text, { bom: true, to_line: 1 });
    return first ?? [];
  } catch {
    return [];
  }
}

/** One Sheet row as the values to restore, with its problems. `line` is the CSV line number. */
export function toRecord(row, line) {
  const get = (header) => cell(row[header]);
  const errors = [];
  const warnings = [];

  const memberNumber = get("Número");
  const match = MEMBER_NUMBER.exec(memberNumber);
  if (!match) errors.push("member number");

  const email = get("Email").toLowerCase();
  if (email && !EMAIL.test(email)) errors.push("e-mail");

  const secret = (header) => {
    const value = get(header);
    if (value === ILLEGIBLE) {
      warnings.push(`${header} was illegible in the backup`);
      return null;
    }
    return orNull(value);
  };

  const date = (header) => {
    const value = get(header);
    if (value && !DATE.test(value)) errors.push(header);
    return orNull(value);
  };

  const role = get("Rol") || "member";
  if (!ROLES.has(role)) errors.push("role");

  const newsletter = get("Newsletter");
  if (newsletter !== "Sí" && newsletter !== "No" && newsletter !== "") errors.push("newsletter");

  // Both alta dates are NOT NULL in the database: a row without them could not be restored.
  for (const header of ["Primera alta", "Alta actual"]) if (!get(header)) errors.push(header);

  const leftOn = date("Data de baixa");
  const leftByLabel = get("Baixa per");
  const leftBy = leftByLabel ? (LEFT_BY[leftByLabel] ?? null) : null;
  if (leftByLabel && !leftBy) errors.push("baixa per");
  if (leftOn && !leftBy) errors.push("baixa per");
  if (!leftOn && leftBy) errors.push("data de baixa");
  if (leftOn && role !== "member") errors.push("a former member cannot hold a role");
  const state = get("Estat");
  if ((state === "Exsoci") !== Boolean(leftOn)) warnings.push("Estat does not match Data de baixa");
  if (!email && !leftOn) errors.push("an active member needs an e-mail");

  const badges = [];
  for (const part of get("Insígnies").split(";").map((p) => p.trim()).filter(Boolean)) {
    const [key, day] = part.split("@");
    // A key twice would fail the insert (UNIQUE member_id, badge_key) half-way through a member.
    if (BADGE_KEY.test(key ?? "") && DATE.test(day ?? "") && !badges.some((b) => b.key === key)) {
      badges.push({ key, date: day });
    } else errors.push("insígnies");
  }

  return {
    line,
    memberNumber,
    numeric: match ? Number(match[1]) : null,
    email: orNull(email),
    firstName: orNull(get("Nom")),
    lastName: orNull(get("Cognoms")),
    phone: secret("Telèfon"),
    dni: secret("DNI/NIE"),
    postalCode: orNull(get("CP")),
    ludoya: orNull(get("Ludoya")),
    bgg: orNull(get("BGG")),
    role,
    newsletter: newsletter === "Sí",
    membershipStartDate: date("Primera alta"),
    currentJoinedOn: date("Alta actual"),
    leftOn,
    leftBy,
    leaveReason: orNull(get("Motiu de baixa")),
    anonymisedAt: date("Anonimitzat"),
    badges,
    errors: [...new Set(errors)],
    warnings,
  };
}

/**
 * What to do with each record, in member number order: `create`, `skip` (e-mail or number
 * already in the database, or repeated in the file) or `invalid`. `existing` holds lowercase
 * e-mails, member numbers and badge keys of the target database.
 */
export function planRestore(records, existing) {
  const seenEmails = new Set();
  const seenNumbers = new Set();
  const missingBadges = new Set();
  const sorted = [...records].sort((a, b) => (a.numeric ?? Infinity) - (b.numeric ?? Infinity) || a.line - b.line);

  const steps = sorted.map((record) => {
    let step;
    if (record.errors.length > 0) step = { action: "invalid", reason: record.errors.join(", ") };
    else if (seenNumbers.has(record.memberNumber) || (record.email && seenEmails.has(record.email)))
      step = { action: "invalid", reason: "repeated in the file" };
    else if (existing.numbers.has(record.memberNumber)) step = { action: "skip", reason: "member number exists" };
    else if (record.email && existing.emails.has(record.email)) step = { action: "skip", reason: "e-mail has an account" };
    else step = { action: "create" };

    seenNumbers.add(record.memberNumber);
    if (record.email) seenEmails.add(record.email);
    if (step.action === "create") {
      for (const badge of record.badges) if (!existing.badgeKeys.has(badge.key)) missingBadges.add(badge.key);
    }
    return { record, ...step };
  });

  const created = steps.filter((s) => s.action === "create");
  return {
    steps,
    maxNumeric: created.reduce((max, s) => Math.max(max, s.record.numeric), 0),
    missingBadges: [...missingBadges].sort(),
  };
}

/**
 * The members row values of a record; DNI/phone encrypted for the row `id`. The role is always
 * `member` here: restoreOne sets the real role as its last step, because a superadmin's row
 * cannot be demoted or deleted while fewer than two other superadmins exist (BR-10, BR-12), so a
 * failed later step could not be undone.
 */
export function memberColumns(record, id, key) {
  return {
    member_number: record.memberNumber,
    // NOT NULL columns: an anonymised member may come without names.
    first_name: record.firstName ?? "",
    last_name: record.lastName ?? "",
    dni_nie_encrypted: record.dni ? encryptForMember(record.dni, id, key) : null,
    phone_encrypted: record.phone ? encryptForMember(record.phone, id, key) : null,
    postal_code: record.postalCode,
    ludoya_username: record.ludoya,
    bgg_username: record.bgg,
    role: "member",
    newsletter_accepted: record.newsletter,
    membership_start_date: record.membershipStartDate,
    current_joined_on: record.currentJoinedOn,
    left_on: record.leftOn,
    left_by: record.leftBy,
    leave_reason: record.leaveReason,
    anonymised_at: record.anonymisedAt ? `${record.anonymisedAt}T12:00:00Z` : null,
  };
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

async function loadExisting(supabase) {
  const emails = new Set();
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`cannot list accounts (${error.status ?? "error"})`);
    for (const user of data.users) if (user.email) emails.add(user.email.toLowerCase());
    if (data.users.length < 1000) break;
  }

  const numbers = new Set();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("members").select("member_number").range(from, from + 999);
    if (error) throw new Error(`cannot read members (${error.code ?? "error"})`);
    for (const row of data) numbers.add(row.member_number);
    if (data.length < 1000) break;
  }

  const { data: badges, error } = await supabase.from("badges").select("key");
  if (error) throw new Error(`cannot read the badge catalogue (${error.code ?? "error"})`);
  return { emails, numbers, badgeKeys: new Set(badges.map((b) => b.key)) };
}

async function restoreOne(supabase, key, record, badgeKeys) {
  let id = null;
  let createdAccount = false;
  try {
    if (record.email) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: record.email,
        email_confirm: true,
        user_metadata: { first_name: record.firstName ?? "", last_name: record.lastName ?? "" },
      });
      if (error || !data?.user) throw new Error(`account (${error?.status ?? "no user"})`);
      id = data.user.id;
      createdAccount = true;
      const { error: updateError } = await supabase.from("members").update(memberColumns(record, id, key)).eq("id", id);
      if (updateError) throw new Error(`member row (${updateError.code ?? "error"})`);
      if (record.leftOn) {
        const { error: banError } = await supabase.auth.admin.updateUserById(id, { ban_duration: BAN_DURATION });
        if (banError) throw new Error(`ban (${banError.status ?? "error"})`);
      }
    } else {
      id = randomUUID();
      const { error: insertError } = await supabase.from("members").insert({ id, ...memberColumns(record, id, key) });
      if (insertError) {
        id = null;
        throw new Error(`member row (${insertError.code ?? "error"})`);
      }
    }

    const badges = record.badges
      .filter((b) => badgeKeys.has(b.key))
      .map((b) => ({ member_id: id, badge_key: b.key, awarded_at: `${b.date}T12:00:00Z` }));
    if (badges.length > 0) {
      const { error: badgeError } = await supabase.from("member_badges").insert(badges);
      if (badgeError) throw new Error(`badges (${badgeError.code ?? "error"})`);
    }

    // Last: after this, the row may be impossible to undo (see memberColumns).
    if (record.role !== "member") {
      const { error: roleError } = await supabase.from("members").update({ role: record.role }).eq("id", id);
      if (roleError) throw new Error(`role (${roleError.code ?? "error"})`);
    }
    return { ok: true };
  } catch (error) {
    // Undo the half-restored member so a re-run creates it again instead of skipping it.
    const reason = error instanceof Error ? error.message : "unknown error";
    const undone = id ? await undoMember(supabase, id, createdAccount) : true;
    return { ok: false, reason: undone ? reason : `${reason}; NOT UNDONE, remove it by hand before a re-run` };
  }
}

/**
 * Removes a member restoreOne created, before its role was set: the row first (a former
 * member's row outlives its account), then the account. supabase-js returns errors instead of
 * throwing, so each one is checked. True when everything was removed.
 */
async function undoMember(supabase, id, createdAccount) {
  try {
    const { error: rowError } = await supabase.from("members").delete().eq("id", id);
    if (rowError) return false;
    if (createdAccount) {
      const { error: accountError } = await supabase.auth.admin.deleteUser(id);
      if (accountError) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Dry run or restore; returns the counts and the exit code. Logs member numbers only. */
export async function run({ supabase, key, csvText, apply, log = console.log }) {
  const { records, fatal } = parseBackupCsv(csvText);
  if (fatal) {
    log(`FATAL: ${fatal}`);
    return { exitCode: EXIT_CODES.fatal, counts: null };
  }

  const existing = await loadExisting(supabase);
  const plan = planRestore(records, existing);
  const counts = { create: 0, skip: 0, invalid: 0, created: 0, errors: 0 };

  for (const step of plan.steps) {
    const label = step.record.memberNumber || `line ${step.record.line}`;
    counts[step.action] += 1;
    for (const warning of step.record.warnings) log(`  ⚠ ${label}: ${warning}`);
    if (step.action === "invalid") log(`  ✗ ${label}: invalid (${step.reason}), line ${step.record.line}`);
    else if (step.action === "skip") log(`  [=] ${label}: skipped (${step.reason})`);
    else if (!apply) log(`  [DRY] ${label}: WOULD RESTORE`);
  }
  if (plan.missingBadges.length > 0) {
    log(`  ⚠ badge keys missing from the catalogue (create them, then award by hand): ${plan.missingBadges.join(", ")}`);
  }

  if (!apply) {
    log(`DRY RUN: ${counts.create} would restore, ${counts.skip} skipped, ${counts.invalid} invalid. Run with --execute.`);
    return { exitCode: counts.invalid > 0 ? EXIT_CODES.partial : EXIT_CODES.ok, counts };
  }

  if (plan.maxNumeric > 0) {
    const { error } = await supabase.rpc("restore_raise_member_number_seq", { p_floor: plan.maxNumeric });
    if (error) {
      log(`FATAL: cannot raise the member number sequence (${error.code ?? "error"})`);
      return { exitCode: EXIT_CODES.fatal, counts };
    }
  }

  for (const step of plan.steps.filter((s) => s.action === "create")) {
    const result = await restoreOne(supabase, key, step.record, existing.badgeKeys);
    if (result.ok) {
      counts.created += 1;
      log(`  [+] ${step.record.memberNumber}: restored`);
    } else {
      counts.errors += 1;
      log(`  ERROR ${step.record.memberNumber}: ${result.reason}`);
    }
  }

  log(`RESULTS: ${counts.created} restored, ${counts.skip} skipped, ${counts.invalid} invalid, ${counts.errors} errors`);
  return { exitCode: counts.errors > 0 || counts.invalid > 0 ? EXIT_CODES.partial : EXIT_CODES.ok, counts };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const envPath = path.join(ROOT, file);
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const name = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
      if (!process.env[name]) process.env[name] = value;
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--execute");
  const file = args.find((a) => !a.startsWith("--"));
  if (!file || args.some((a) => a.startsWith("--") && a !== "--execute")) {
    console.error("Usage: npm run restore -- <backup.csv> [--execute]");
    process.exit(EXIT_CODES.fatal);
  }
  loadEnv();
  for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ENCRYPTION_KEY"]) {
    if (!process.env[name]) {
      console.error(`Missing ${name} (.env.local)`);
      process.exit(EXIT_CODES.fatal);
    }
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  console.log(`Restoring members (${apply ? "EXECUTE" : "DRY RUN"}) on ${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host}`);
  const { exitCode } = await run({
    supabase,
    key: parseKey(process.env.ENCRYPTION_KEY),
    csvText: fs.readFileSync(path.resolve(file), "utf-8"),
    apply,
  });
  process.exit(exitCode);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((err) => {
    // Never print the error object: a driver error could echo a value.
    console.error(`FATAL: ${err instanceof Error ? err.message.slice(0, 120) : "unknown error"}`);
    process.exit(EXIT_CODES.fatal);
  });
}
