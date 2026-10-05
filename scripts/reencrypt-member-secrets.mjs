// scripts/reencrypt-member-secrets.mjs
//
// Re-encrypts members' legacy DNI/phone ciphertext ("iv:tag:data", AES-256-GCM without AAD)
// into the v2 format of src/lib/encryption.ts: "v2:<member uuid>:<iv>:<tag>:<data>" with AAD
// "member:<uuid>", bound to the row the value is stored in.
//
// Usage:
//   node scripts/reencrypt-member-secrets.mjs            # dry run (default): reads, decrypts, reports
//   node scripts/reencrypt-member-secrets.mjs --apply    # writes the v2 values
//   node --env-file=.env.test.local scripts/reencrypt-member-secrets.mjs   # pick the env file
//
// Environment (process env first, then .env.local / .env, like migrate-members.mjs):
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ENCRYPTION_KEY (the key that wrote the
//   legacy values; the same key writes v2).
//
// Safe to re-run: v2 values are skipped. Each update only applies if the column still holds
// the value that was read (a concurrent edit wins and is reported). A legacy value stored in
// more than one place is reported as a duplicate and left alone: with random IVs that only
// happens when a ciphertext was copied between rows (the T7 defect), so a person must decide
// which row it belongs to. Output carries member ids, column names and reason codes only:
// never plaintext or ciphertext.
//
// Needs migration 20261005100700_lock_down_member_secrets.sql (its trigger only accepts v2
// values bound to the row, which is what this writes).

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PAGE_SIZE = 500;
export const COLUMNS = ["dni_nie_encrypted", "phone_encrypted"];

// ---------------------------------------------------------------------------
// Crypto (mirrors src/lib/encryption.ts, which is server-only TypeScript)
// ---------------------------------------------------------------------------

export function parseKey(hex) {
  if (!hex || !/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

function memberIdOf(memberId) {
  const id = typeof memberId === "string" ? memberId.toLowerCase() : "";
  if (!UUID_RE.test(id)) throw new Error("invalid_member_id");
  return id;
}

const aadFor = (id) => Buffer.from(`member:${id}`, "utf8");

function open(key, ivB64, tagB64, dataB64, aad) {
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  if (iv.length !== IV_LENGTH || tag.length !== AUTH_TAG_LENGTH) throw new Error("malformed");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  if (aad) decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  return decipher.update(Buffer.from(dataB64, "base64"), undefined, "utf8") + decipher.final("utf8");
}

/** "legacy" (iv:tag:data), "v2", or "invalid". */
export function formatOf(value) {
  if (typeof value !== "string") return "invalid";
  const parts = value.split(":");
  if (parts.length === 5 && parts[0] === "v2") return "v2";
  if (parts.length === 3) return "legacy";
  return "invalid";
}

export function decryptLegacy(value, key) {
  const [iv, tag, data] = value.split(":");
  return open(key, iv, tag, data, null);
}

export function encryptForMember(plainText, memberId, key) {
  const id = memberIdOf(memberId);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  cipher.setAAD(aadFor(id));
  const data = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  return ["v2", id, iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

export function decryptForMember(value, memberId, key) {
  const id = memberIdOf(memberId);
  const parts = value.split(":");
  if (parts.length !== 5 || parts[0] !== "v2" || parts[1] !== id) throw new Error("not_bound");
  return open(key, parts[2], parts[3], parts[4], aadFor(id));
}

// ---------------------------------------------------------------------------
// Plan and run
// ---------------------------------------------------------------------------

/**
 * Pure: decides what to do with every stored value. Returns the updates (with the v2 value) and
 * per-value findings; never returns plaintext.
 */
export function planReencryption(rows, key) {
  const seen = new Map(); // legacy ciphertext -> number of places it is stored
  for (const row of rows) {
    for (const column of COLUMNS) {
      const value = row[column];
      if (formatOf(value) === "legacy") seen.set(value, (seen.get(value) ?? 0) + 1);
    }
  }

  const updates = [];
  const findings = [];
  const counts = { already_v2: 0, legacy: 0, duplicates: 0, errors: 0 };

  for (const row of rows) {
    for (const column of COLUMNS) {
      const value = row[column];
      if (value === null || value === undefined || value === "") continue;
      const format = formatOf(value);
      if (format === "v2") {
        counts.already_v2 += 1;
        continue;
      }
      if (format === "invalid") {
        counts.errors += 1;
        findings.push({ id: row.id, column, reason: "unknown_format" });
        continue;
      }
      counts.legacy += 1;
      if (seen.get(value) > 1) {
        counts.duplicates += 1;
        findings.push({ id: row.id, column, reason: "duplicate_ciphertext" });
        continue;
      }
      try {
        const plain = decryptLegacy(value, key);
        const next = encryptForMember(plain, row.id, key);
        if (decryptForMember(next, row.id, key) !== plain) throw new Error("verify_failed");
        if (next.length > 512) throw new Error("too_long");
        updates.push({ id: row.id, column, from: value, to: next });
      } catch (err) {
        counts.errors += 1;
        const reason = err instanceof Error && /^[a-z_]+$/.test(err.message) ? err.message : "decrypt_failed";
        findings.push({ id: row.id, column, reason });
      }
    }
  }

  return { updates, findings, counts };
}

async function fetchRows(supabase) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("members")
      .select("id, dni_nie_encrypted, phone_encrypted")
      .or("dni_nie_encrypted.not.is.null,phone_encrypted.not.is.null")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`read failed code=${error.code ?? "unknown"}`);
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

export async function run({ supabase, key, apply, log = console.log }) {
  const rows = await fetchRows(supabase);
  const { updates, findings, counts } = planReencryption(rows, key);
  let written = 0;

  for (const update of updates) {
    if (!apply) continue;
    // Compare-and-set: only if the column still holds the value that was read.
    const { data, error } = await supabase
      .from("members")
      .update({ [update.column]: update.to })
      .eq("id", update.id)
      .eq(update.column, update.from)
      .select("id");
    if (error) {
      counts.errors += 1;
      findings.push({ id: update.id, column: update.column, reason: `write_failed:${error.code ?? "unknown"}` });
    } else if (!data || data.length === 0) {
      findings.push({ id: update.id, column: update.column, reason: "changed_concurrently" });
    } else {
      written += 1;
    }
  }

  for (const f of findings) log(`  ! member=${f.id} column=${f.column} reason=${f.reason}`);
  const summary =
    `Summary: mode=${apply ? "apply" : "dry-run"} rows=${rows.length} already_v2=${counts.already_v2} ` +
    `legacy=${counts.legacy} ${apply ? `reencrypted=${written}` : `would_reencrypt=${updates.length}`} ` +
    `duplicates=${counts.duplicates} errors=${counts.errors}`;
  log(summary);
  return { rows: rows.length, written, planned: updates.length, findings, counts, summary };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function loadEnv(root) {
  for (const file of [".env.local", ".env"]) {
    const envPath = path.join(root, file);
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const k = trimmed.slice(0, idx).trim();
      if (!process.env[k]) process.env[k] = trimmed.slice(idx + 1).trim();
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  if (apply && args.includes("--dry-run")) {
    console.error("Choose one of --dry-run (default) and --apply.");
    process.exit(2);
  }

  loadEnv(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
  for (const v of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ENCRYPTION_KEY"]) {
    if (!process.env[v]) {
      console.error(`Missing environment variable: ${v}`);
      process.exit(2);
    }
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  console.log(`Re-encrypting member secrets (${apply ? "APPLY" : "DRY RUN"}) on ${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host}`);
  const result = await run({ supabase, key: parseKey(process.env.ENCRYPTION_KEY), apply });
  process.exit(result.counts.errors > 0 ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((err) => {
    // Never print the error object: a driver error could echo a value.
    console.error(`Failed: ${err instanceof Error ? err.message.slice(0, 120) : "unknown error"}`);
    process.exit(1);
  });
}
