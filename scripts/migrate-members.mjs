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
// 4. IMPORT    For each cleaned member:
//                a) Creates a Supabase Auth user (email_confirm: true, no password).
//                   → Members must use "Forgot password" to set their first password.
//                b) The DB trigger `handle_new_user` auto-creates a `members` row.
//                c) UPDATEs that row with the original member_number, encrypted
//                   DNI/phone (AES-256-GCM), postal_code, consents, and dates.
//
// 5. SEQUENCE  Resets `member_number_seq` to the highest existing number so the
//              next web registration gets the correct sequential ID.
//
// ─── Modes ──────────────────────────────────────────────────────────────────
//
//   Dry-run (default):  Parses, cleans, and shows what WOULD happen. No writes.
//   --execute:          Actually creates users and updates member rows.
//   --clean --execute:  Deletes ALL existing auth users + members, resets the
//                       sequence, then performs a fresh import. Useful during
//                       development to start from a clean slate.
//
// ─── Idempotency ────────────────────────────────────────────────────────────
//
//   Safe to re-run. If an auth user already exists for a given email, the script
//   skips creation and updates the member row with the CSV data. This means you
//   can run `--execute` multiple times without creating duplicates.
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
//   npm run migrate -- --execute       # Import
//   npm run migrate -- --clean --execute   # Wipe + reimport
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
import { encryptForMember, parseKey } from "./reencrypt-member-secrets.mjs";

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
      const val = trimmed.slice(idx + 1).trim();
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
    if (!/^000-\d{3}$/.test(memberNumber)) {
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

  // Fetch all members
  const membersByNumber = new Map();
  const { data: members, error: membersError } = await supabase
    .from("members")
    .select("id, member_number");
  if (membersError) throw new Error(`Failed to list members: ${membersError.message}`);
  for (const m of members) {
    membersByNumber.set(m.member_number, m.id);
  }

  return { usersByEmail, membersByNumber };
}

// ---------------------------------------------------------------------------
// Import a single member
// ---------------------------------------------------------------------------

async function importMember(supabase, member, existingUsers) {
  const { usersByEmail } = existingUsers;
  let userId = usersByEmail.get(member.email);
  let action;

  if (!userId) {
    // Create auth user (no password — they must use "Forgot password")
    const { data, error } = await supabase.auth.admin.createUser({
      email: member.email,
      email_confirm: true,
      user_metadata: { first_name: member.first_name, last_name: member.last_name },
    });

    if (error) {
      // Fallback: maybe user was created between our check and now
      if (error.message.includes("already") || error.message.includes("duplicate")) {
        const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        const found = users.find((u) => u.email.toLowerCase() === member.email);
        if (found) {
          userId = found.id;
          action = "fallback-found";
        } else {
          return { status: "error", error: error.message };
        }
      } else {
        return { status: "error", error: error.message };
      }
    } else {
      userId = data.user.id;
      action = "created";
    }

    // Add to map so subsequent lookups work
    usersByEmail.set(member.email, userId);
  } else {
    action = "existing";
  }

  // UPDATE member row (trigger handle_new_user already created a row for new users)
  // Small delay to let the trigger execute for newly created users
  if (action === "created") {
    await sleep(100);
  }

  const updateData = {
    member_number: member.member_number,
    first_name: member.first_name,
    last_name: member.last_name,
    postal_code: member.postal_code,
    newsletter_accepted: member.newsletter_accepted,
    membership_start_date: member.membership_start_date,
  };

  // Only encrypt and set DNI/phone if they have values
  if (member.dni) {
    updateData.dni_nie_encrypted = encrypt(member.dni, userId);
  }
  if (member.phone) {
    updateData.phone_encrypted = encrypt(member.phone, userId);
  }

  const { error: updateError } = await supabase
    .from("members")
    .update(updateData)
    .eq("id", userId);

  if (updateError) {
    return { status: "error", error: `UPDATE failed: ${updateError.message}`, action };
  }

  return { status: "ok", action: action === "created" ? "created" : "updated", userId };
}

// ---------------------------------------------------------------------------
// Clean mode: delete all members except developer, reset sequence
// ---------------------------------------------------------------------------

async function cleanMode(supabase) {
  console.log("\n  CLEAN MODE: removing all members...\n");

  const { data: members, error } = await supabase
    .from("members")
    .select("id, member_number");
  if (error) throw new Error(`Failed to fetch members: ${error.message}`);

  let deleted = 0;

  for (const member of members) {
    const { error: deleteError } = await supabase.auth.admin.deleteUser(member.id);
    if (deleteError) {
      console.error(`  ERROR deleting ${member.member_number}: ${deleteError.message}`);
    } else {
      console.log(`  DELETED: ${member.member_number}`);
      deleted++;
    }
    await sleep(50);
  }

  // Reset sequence to 0 (will be set correctly after import)
  await executeSQL(supabase, "SELECT setval('member_number_seq', 0, true)");

  console.log(`\n  Clean complete: ${deleted} deleted`);
}

// ---------------------------------------------------------------------------
// Execute raw SQL via Supabase
// ---------------------------------------------------------------------------

async function executeSQL(supabase, sql) {
  // Use the Supabase REST API to execute SQL via the pg_net extension or rpc
  // Since we're using service_role, we can use the rpc endpoint
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/`;

  // Try using supabase.rpc first — but the function may not exist
  // Fallback: use the SQL endpoint directly
  const response = await fetch(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  if (!response.ok) {
    // If rpc doesn't work, log it — the sequence will be reset post-import via
    // the MCP tool or manually
    console.warn(`  WARNING: Could not execute SQL directly. Run manually:`);
    console.warn(`  ${sql}`);
  }
}

// ---------------------------------------------------------------------------
// Reset sequence after import
// ---------------------------------------------------------------------------

async function resetSequence(supabase) {
  const sql = `SELECT setval('member_number_seq',
    (SELECT COALESCE(MAX(CAST(SPLIT_PART(member_number, '-', 2) AS INTEGER)), 0)
     FROM public.members)
  , true)`;

  console.log("\nResetting member_number_seq...");
  await executeSQL(supabase, sql);
  console.log("  Sequence reset command sent. Verify with: SELECT last_value FROM member_number_seq;");
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
  const cleanFlag = args.includes("--clean");

  console.log("=".repeat(60));
  console.log("  Darkstone Catalunya — Member Migration Script");
  console.log("  Mode:", executeMode ? "EXECUTE" : "DRY-RUN");
  if (cleanFlag) console.log("  Clean:", "YES (will delete all members first)");
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
  let existingState = await fetchExistingState(supabase);
  console.log(`  Auth users: ${existingState.usersByEmail.size}`);
  console.log(`  Members: ${existingState.membersByNumber.size}`);

  // 6. Clean mode
  if (cleanFlag && executeMode) {
    await cleanMode(supabase);
    // Re-fetch state after clean
    existingState = await fetchExistingState(supabase);
    console.log(`\n  After clean — Auth users: ${existingState.usersByEmail.size}, Members: ${existingState.membersByNumber.size}`);
  } else if (cleanFlag && !executeMode) {
    console.log("\n  [DRY] --clean flag detected but not in --execute mode. Would delete all members.");
  }

  // 7. Import members
  console.log("\nImporting members...\n");

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const member of members) {
    if (!executeMode) {
      const exists = existingState.usersByEmail.has(member.email);
      console.log(`  [DRY] ${member.member_number} ${member.first_name} ${member.last_name} <${member.email}> → ${exists ? "WOULD UPDATE" : "WOULD CREATE"}`);
      continue;
    }

    // Execute mode
    const result = await retryOnError(() => importMember(supabase, member, existingState));

    if (result.status === "error") {
      console.error(`  ERROR: ${member.member_number} <${member.email}> — ${result.error}`);
      errors++;
    } else {
      const icon = result.action === "created" ? "+" : "~";
      console.log(`  [${icon}] ${member.member_number} ${member.first_name} ${member.last_name} <${member.email}> → ${result.action}`);
      if (result.action === "created") created++;
      else updated++;
    }

    await sleep(50);
  }

  // 8. Reset sequence (only in execute mode)
  if (executeMode) {
    await resetSequence(supabase);
  }

  // 9. Summary
  console.log("\n" + "=".repeat(60));
  if (executeMode) {
    console.log(`  RESULTS: ${created} created, ${updated} updated, ${errors} errors`);
    if (errors > 0) {
      console.log(`  ⚠ Some errors occurred. Review output above.`);
      process.exit(2);
    }
  } else {
    const wouldCreate = members.filter(
      (m) => !existingState.usersByEmail.has(m.email)
    ).length;
    const wouldUpdate = members.filter(
      (m) => existingState.usersByEmail.has(m.email)
    ).length;
    console.log(`  DRY-RUN: ${wouldCreate} would create, ${wouldUpdate} would update`);
    console.log(`  Run with --execute to apply changes.`);
  }
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("\nFATAL ERROR:", err.message || err);
  process.exit(1);
});
