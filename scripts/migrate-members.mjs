// scripts/migrate-members.mjs
//
// Migrates existing members from a Google Forms CSV export to Supabase Auth +
// public.members. Designed to import the founding members of the association
// who registered via Google Forms before the website had its own auth system.
//
// ─── How it works ───────────────────────────────────────────────────────────
//
// 1. PARSE     Reads `data/llista_membres.csv` (Google Forms export, UTF-8).
//              Expects columns: member_number, timestamp, email, (empty),
//              full_name, phone, DNI/NIE, postal_code, conduct, privacy, newsletter.
//
// 2. DEDUP     Groups rows by email (case-insensitive). When the same email
//              appears more than once (a member re-registered with updated data),
//              the script merges them automatically:
//                - Keeps the FIRST occurrence's member_number and timestamp
//                  (original registration date and member ID).
//                - Takes ALL other fields from the LAST occurrence
//                  (most recent / corrected data: name, phone, DNI, postal code,
//                  newsletter preference, etc.).
//                - Discards intermediate duplicates.
//
// 3. CLEAN     Normalizes every field:
//                - Names  → properCase with particle awareness
//                          (i, de, del, la, d', etc. stay lowercase).
//                - Email  → lowercase, trimmed.
//                - DNI    → uppercase, trimmed.
//                - Phone  → trimmed.
//                - Dates  → "DD/MM/YYYY H:MM:SS" → ISO 8601.
//                - Bools  → "Sí" / "Accepto." → true, else false.
//              Emits non-blocking warnings for unusual formats.
//
// 4. IMPORT    INSERT-ONLY. A row whose email (auth user) already exists in Supabase
//              is SKIPPED and never touched: the database is the source of truth, so
//              data members edited on the web, leaves and roles are never overwritten.
//              A row whose email is new but whose DNI already belongs to a member is
//              also SKIPPED (probably the same person with a new email): fix it by hand.
//              New members are created in sheet date order. For each one:
//                a) Creates a Supabase Auth user (email_confirm: true, no password).
//                   → Members must use the magic link or "Forgot password".
//                b) The DB trigger `handle_new_user` auto-creates a `members` row and
//                   gives it the next number of `member_number_seq`, like a web sign-up.
//                c) UPDATEs that new row with the encrypted DNI/phone (AES-256-GCM v2),
//                   postal_code, consents, and dates (membership_start_date and
//                   current_joined_on = the sheet date).
//
// Member numbers (since 2026-11-12): the sheet's own number column is IGNORED for new
// members. Production was renumbered on 2026-11-03 to 000-001 … 000-202 in sheet order, so
// sheet numbers no longer match production numbers, and a sheet number could collide with a
// web sign-up's number. Match members by email (and DNI), never by number.
// See odd/tasks/admin-panel.md, "Member list import and renumbering".
//
// ─── Modes ──────────────────────────────────────────────────────────────────
//
//   Dry-run (default):  Parses, cleans, and shows what WOULD happen. No writes.
//   --execute:          Creates the new members only.
//
//   The old `--clean` mode (delete every member) was removed: the database now holds
//   production data, the audit log and the roles.
//
// ─── Idempotency ────────────────────────────────────────────────────────────
//
//   Safe to re-run: members already imported are skipped.
//
// ─── Environment variables (read from .env.local / .env) ────────────────────
//
//   NEXT_PUBLIC_SUPABASE_URL   — Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY  — Service role key (admin access)
//   ENCRYPTION_KEY             — 64-char hex string for AES-256-GCM encryption
//
// ─── Usage ──────────────────────────────────────────────────────────────────
//
//   npm run migrate                    # Dry-run
//   npm run migrate -- --execute       # Import the new members
//
// ─── Exit codes ─────────────────────────────────────────────────────────────
//
//   0 — Success
//   1 — Fatal error (missing env vars, CSV not found, etc.)
//   2 — Partial success (some members failed to import)
//

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";
import { decryptForMember, encryptForMember, parseKey } from "./reencrypt-member-secrets.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NAME_PARTICLES = ["i", "de", "del", "la", "las", "los", "el", "d'"];

// ---------------------------------------------------------------------------
// Load .env.local / .env (same pattern as updateMockData.mjs)
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
      const key = trimmed.slice(0, idx).trim();
      // Strip one pair of surrounding quotes, as dotenv does.
      const val = trimmed.slice(idx + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

// ---------------------------------------------------------------------------
// Encryption: v2 of src/lib/encryption.ts (AES-256-GCM, AAD "member:<uuid>"), bound to the
// member's row. The database only accepts that shape (members_ciphertext_guard).
// ---------------------------------------------------------------------------

let encryptionKey = null;

function encrypt(plainText, memberId) {
  encryptionKey ??= parseKey(process.env.ENCRYPTION_KEY);
  return encryptForMember(plainText, memberId, encryptionKey);
}

// Null when the stored value cannot be read (legacy or foreign ciphertext).
function decryptOrNull(value, memberId) {
  encryptionKey ??= parseKey(process.env.ENCRYPTION_KEY);
  try {
    return decryptForMember(value, memberId, encryptionKey);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// CSV Parsing
// ---------------------------------------------------------------------------

function parseCSV() {
  const csvPath = path.join(ROOT, "data", "llista_membres.csv");
  if (!fs.existsSync(csvPath)) {
    console.error(`ERROR: CSV not found at ${csvPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(csvPath, "utf-8");
  const allRows = parse(raw, { columns: false, relax_column_count: true });

  // Skip header (index 0), filter out empty rows (where timestamp col[1] is empty)
  const rows = allRows.slice(1).filter((row) => row[1] && row[1].trim() !== "");

  return rows.map((row) => ({
    member_number: (row[0] || "").trim(),
    timestamp_raw: (row[1] || "").trim(),
    email: (row[2] || "").trim(),
    full_name: (row[4] || "").trim(),
    phone: (row[5] || "").trim(),
    dni: (row[6] || "").trim(),
    postal_code: (row[7] || "").trim(),
    conduct_raw: (row[8] || "").trim(),
    privacy_raw: (row[9] || "").trim(),
    newsletter_raw: (row[10] || "").trim(),
  }));
}

// ---------------------------------------------------------------------------
// Name normalization
// ---------------------------------------------------------------------------

function properCase(word) {
  if (!word) return word;
  // Handle d' prefix (e.g., d'Alguna)
  if (word.toLowerCase().startsWith("d'") && word.length > 2) {
    return "d'" + word.charAt(2).toUpperCase() + word.slice(3).toLowerCase();
  }
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function normalizeName(fullName) {
  const tokens = fullName.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { first_name: "", last_name: "" };
  if (tokens.length === 1) return { first_name: properCase(tokens[0]), last_name: "" };

  const firstName = properCase(tokens[0]);
  const lastNameTokens = tokens.slice(1);

  const processedLastName = lastNameTokens.map((token, idx) => {
    const lower = token.toLowerCase();
    // Check if this token is a name particle
    const isParticle = NAME_PARTICLES.includes(lower);
    if (isParticle && idx > 0) {
      // Particle not at the start of last_name → keep lowercase
      return lower;
    }
    if (isParticle && idx === 0) {
      // Particle at the start of last_name → still lowercase (e.g., "del Olmo")
      return lower;
    }
    return properCase(token);
  });

  return { first_name: firstName, last_name: processedLastName.join(" ") };
}

// ---------------------------------------------------------------------------
// Timestamp parsing: "DD/MM/YYYY HH:MM:SS" → { date: "YYYY-MM-DD", iso: "..." }
// ---------------------------------------------------------------------------

function parseTimestamp(raw) {
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!match) return { date: null, iso: null };
  const [, dd, mm, yyyy, hh, min, ss] = match;
  const pad = (s) => s.padStart(2, "0");
  return {
    date: `${yyyy}-${pad(mm)}-${pad(dd)}`,
    iso: `${yyyy}-${pad(mm)}-${pad(dd)}T${pad(hh)}:${min}:${ss}`,
  };
}

// ---------------------------------------------------------------------------
// Boolean parsing
// ---------------------------------------------------------------------------

function parseBool(raw) {
  const val = raw.toLowerCase().trim();
  return val === "sí" || val === "accepto.";
}

// ---------------------------------------------------------------------------
// Data cleaning pipeline
// ---------------------------------------------------------------------------

function cleanData(rows) {
  // Auto-detect duplicate emails: group rows by email (case-insensitive)
  const byEmail = new Map();
  for (const row of rows) {
    const email = row.email.toLowerCase().trim();
    if (!byEmail.has(email)) byEmail.set(email, []);
    byEmail.get(email).push(row);
  }

  // Build deduplicated list: for duplicates, keep first's member_number + timestamp,
  // take all other fields from the most recent (last) occurrence
  const deduped = new Map();
  for (const [email, group] of byEmail) {
    if (group.length === 1) {
      deduped.set(group[0].member_number, group[0]);
      continue;
    }
    // first = original registration, last = most recent data
    const first = group[0];
    const last = group[group.length - 1];
    const merged = {
      ...last,
      member_number: first.member_number,
      timestamp_raw: first.timestamp_raw,
    };
    deduped.set(first.member_number, merged);
    const skipped = group.slice(1).map((r) => r.member_number).join(", ");
    console.log(`  MERGE: ${email} — keep ${first.member_number}, merge data from ${last.member_number}, skip [${skipped}]`);
  }

  // Clean each member
  const cleaned = [];
  const warnings = [];

  for (const [memberNumber, row] of deduped) {
    const email = row.email.toLowerCase().trim();
    const dni = row.dni.toUpperCase().trim();
    const phone = row.phone.trim();
    const postalCode = row.postal_code.trim();
    const { first_name, last_name } = normalizeName(row.full_name);
    const { date: membershipStartDate, iso: timestampIso } = parseTimestamp(row.timestamp_raw);
    const newsletterAccepted = parseBool(row.newsletter_raw);

    // Validation warnings
    if (!/^000-\d{3,}$/.test(memberNumber)) {
      warnings.push(`${memberNumber}: invalid member_number format`);
    }
    if (!email.includes("@")) {
      warnings.push(`${memberNumber}: invalid email "${email}"`);
    }
    if (!first_name) {
      warnings.push(`${memberNumber}: empty first_name`);
    }
    if (!last_name) {
      warnings.push(`${memberNumber}: empty last_name`);
    }
    if (phone && !/^\d{9,12}$/.test(phone.replace(/\s/g, ""))) {
      warnings.push(`${memberNumber}: unusual phone "${phone}"`);
    }
    if (dni && !/^[XYZ]?\d{7,8}[A-Z]?$/i.test(dni)) {
      warnings.push(`${memberNumber}: unusual DNI "${dni}"`);
    }
    if (postalCode && !/^\d{5}$/.test(postalCode)) {
      warnings.push(`${memberNumber}: unusual postal_code "${postalCode}"`);
    }

    cleaned.push({
      member_number: memberNumber,
      email,
      first_name,
      last_name,
      phone,
      dni,
      postal_code: postalCode,
      membership_start_date: membershipStartDate,
      timestamp_iso: timestampIso,
      newsletter_accepted: newsletterAccepted,
    });
  }

  return { members: cleaned, warnings };
}

// ---------------------------------------------------------------------------
// Fetch existing state (for idempotency)
// ---------------------------------------------------------------------------

async function fetchExistingState(supabase) {
  // Fetch all auth users (paginated)
  const usersByEmail = new Map();
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data: { users }, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Failed to list users: ${error.message}`);
    for (const u of users) {
      usersByEmail.set(u.email.toLowerCase(), u.id);
    }
    if (users.length < perPage) break;
    page++;
  }

  // Fetch all members (paginated: PostgREST caps a response at max_rows)
  const membersById = new Map();
  const membersByDni = new Map();
  let unreadableDni = 0;
  for (let from = 0; ; from += perPage) {
    const { data: members, error: membersError } = await supabase
      .from("members")
      .select("id, member_number, left_on, dni_nie_encrypted")
      .order("member_number")
      .range(from, from + perPage - 1);
    if (membersError) throw new Error(`Failed to list members: ${membersError.message}`);
    for (const m of members) {
      membersById.set(m.id, { member_number: m.member_number, left_on: m.left_on });
      if (!m.dni_nie_encrypted) continue;
      const dni = decryptOrNull(m.dni_nie_encrypted, m.id);
      if (dni === null) unreadableDni++;
      else membersByDni.set(normalizeDni(dni), m.member_number);
    }
    if (members.length < perPage) break;
  }

  return { usersByEmail, membersById, membersByDni, unreadableDni };
}

// ---------------------------------------------------------------------------
// Import a single member
// ---------------------------------------------------------------------------

// Same comparison form for sheet and stored DNIs.
function normalizeDni(dni) {
  return dni.toUpperCase().replace(/[\s.-]/g, "");
}

// Why a member is not imported, or null when it is new.
function skipReason(member, existingState) {
  const userId = existingState.usersByEmail.get(member.email);
  if (userId) {
    const stored = existingState.membersById.get(userId);
    if (!stored) return "email exists (auth user without a members row)";
    const former = stored.left_on ? `, FORMER member since ${stored.left_on}` : "";
    return `email exists as ${stored.member_number}${former}`;
  }
  const dniOwner = member.dni ? existingState.membersByDni.get(normalizeDni(member.dni)) : null;
  if (dniOwner) return `DNI already belongs to ${dniOwner}, new email: check by hand`;
  return null;
}

async function importMember(supabase, member, existingState) {
  // Create auth user (no password — they must use "Forgot password")
  const { data, error } = await supabase.auth.admin.createUser({
    email: member.email,
    email_confirm: true,
    user_metadata: { first_name: member.first_name, last_name: member.last_name },
  });

  if (error) {
    // Created between our check and now: leave it alone (insert-only).
    if (error.message.includes("already") || error.message.includes("duplicate")) {
      return { status: "skipped", reason: "email exists" };
    }
    return { status: "error", error: error.message };
  }

  const userId = data.user.id;
  existingState.usersByEmail.set(member.email, userId);

  // The trigger handle_new_user creates the members row; give it a moment.
  await sleep(100);

  // member_number stays the one the trigger took from member_number_seq.
  const updateData = {
    first_name: member.first_name,
    last_name: member.last_name,
    postal_code: member.postal_code,
    newsletter_accepted: member.newsletter_accepted,
    membership_start_date: member.membership_start_date,
    // Defaults to today; a member imported now joined on the sheet's date.
    current_joined_on: member.membership_start_date,
  };

  // Only encrypt and set DNI/phone if they have values
  if (member.dni) {
    updateData.dni_nie_encrypted = encrypt(member.dni, userId);
  }
  if (member.phone) {
    updateData.phone_encrypted = encrypt(member.phone, userId);
  }

  const { data: updated, error: updateError } = await supabase
    .from("members")
    .update(updateData)
    .eq("id", userId)
    .select("member_number")
    .single();

  if (updateError) {
    // The auth user exists but its row kept the defaults: fix it by hand.
    return { status: "error", error: `UPDATE failed for user ${userId}: ${updateError.message}` };
  }

  return { status: "ok", userId, memberNumber: updated.member_number };
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryOnError(fn, retries = 1, delayMs = 2000) {
  try {
    return await fn();
  } catch (err) {
    if (retries > 0 && (err.status === 429 || err.status >= 500)) {
      console.warn(`  Retrying after ${delayMs}ms...`);
      await sleep(delayMs);
      return retryOnError(fn, retries - 1, delayMs * 2);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const executeMode = args.includes("--execute");
  if (args.includes("--clean")) {
    console.error("ERROR: --clean was removed (it deleted every member). Nothing was done.");
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("  Darkstone Catalunya — Member Migration Script (insert-only)");
  console.log("  Mode:", executeMode ? "EXECUTE" : "DRY-RUN");
  console.log("=".repeat(60));

  // 1. Load environment
  loadEnv();
  const requiredVars = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ENCRYPTION_KEY"];
  for (const v of requiredVars) {
    if (!process.env[v]) {
      console.error(`\nERROR: Missing environment variable: ${v}`);
      process.exit(1);
    }
  }

  // 2. Parse CSV
  console.log("\nParsing CSV...");
  const rawRows = parseCSV();
  console.log(`  Found ${rawRows.length} rows with data`);

  // 3. Clean data
  console.log("\nCleaning data...");
  const { members, warnings } = cleanData(rawRows);
  console.log(`  Cleaned: ${members.length} members`);

  if (warnings.length > 0) {
    console.log(`\n  ⚠ ${warnings.length} validation warnings:`);
    for (const w of warnings) {
      console.log(`    - ${w}`);
    }
  }

  // Print a few examples
  console.log("\n  Sample members:");
  for (const m of members.slice(0, 5)) {
    console.log(`    ${m.member_number}: ${m.first_name} ${m.last_name} <${m.email}> (${m.membership_start_date})`);
  }

  // 4. Create Supabase admin client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // 5. Fetch existing state
  console.log("\nFetching existing state...");
  const existingState = await fetchExistingState(supabase);
  console.log(`  Auth users: ${existingState.usersByEmail.size}`);
  console.log(`  Members: ${existingState.membersById.size}`);
  if (existingState.unreadableDni > 0) {
    console.log(`  ⚠ ${existingState.unreadableDni} stored DNIs could not be decrypted (not compared)`);
  }

  // Sheet rows sharing a DNI under different emails: the same person signed up twice.
  const sheetDni = new Map();
  for (const m of members) {
    if (!m.dni) continue;
    const key = normalizeDni(m.dni);
    if (sheetDni.has(key)) console.log(`  ⚠ sheet ${sheetDni.get(key)} and ${m.member_number} share a DNI (different emails)`);
    else sheetDni.set(key, m.member_number);
  }

  // New members get sequence numbers in sheet date order.
  members.sort((a, b) => (a.timestamp_iso ?? "").localeCompare(b.timestamp_iso ?? ""));

  // 6. Import the new members only
  console.log("\nImporting new members (sheet number shown for reference only)...\n");

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const member of members) {
    const label = `sheet ${member.member_number} ${member.first_name} ${member.last_name} <${member.email}>`;
    const reason = skipReason(member, existingState);
    if (reason) {
      console.log(`  [=] ${label} → skipped (${reason})`);
      skipped++;
      continue;
    }

    if (!executeMode) {
      console.log(`  [DRY] ${label} (${member.membership_start_date}) → WOULD CREATE with the next free number`);
      created++;
      continue;
    }

    const result = await retryOnError(() => importMember(supabase, member, existingState));

    if (result.status === "error") {
      console.error(`  ERROR: ${label} — ${result.error}`);
      errors++;
    } else if (result.status === "skipped") {
      console.log(`  [=] ${label} → skipped (${result.reason})`);
      skipped++;
    } else {
      console.log(`  [+] ${label} → created as ${result.memberNumber}`);
      created++;
    }

    await sleep(50);
  }

  // 7. Summary
  console.log("\n" + "=".repeat(60));
  if (executeMode) {
    console.log(`  RESULTS: ${created} created, ${skipped} skipped, ${errors} errors`);
    if (errors > 0) {
      console.log(`  ⚠ Some errors occurred. Review output above.`);
      process.exit(2);
    }
  } else {
    console.log(`  DRY-RUN: ${created} would create, ${skipped} skipped (already in Supabase)`);
    console.log(`  Run with --execute to apply changes.`);
  }
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("\nFATAL ERROR:", err.message || err);
  process.exit(1);
});
