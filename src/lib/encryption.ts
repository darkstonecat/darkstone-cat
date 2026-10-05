import "server-only";
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

/**
 * AES-256-GCM for member DNI/phone.
 *
 * Format v2 (written by `encrypt`): `v2:<member uuid>:<iv>:<tag>:<data>` (base64 parts,
 * 12-byte IV, 16-byte tag). The AAD is `member:<uuid>`, so a value only decrypts for the
 * member it was written for: a ciphertext copied into another row fails. The owner is also
 * stored in clear so the database can refuse a value written into the wrong row
 * (`members_ciphertext_guard`, migration 20261005100700); rewriting it breaks the tag.
 *
 * Legacy `iv:tag:data` values (no AAD) still decrypt as a transitional fallback until
 * production is re-encrypted (scripts/reencrypt-member-secrets.mjs); the database no longer
 * accepts new legacy writes.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const V2 = "v2";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string (32 bytes, characters 0-9 and a-f)"
    );
  }

  cachedKey = Buffer.from(hex, "hex");
  return cachedKey;
}

/** Lower-cased canonical UUID (Postgres prints uuids in lower case). */
function memberIdOf(memberId: unknown): string {
  const id = typeof memberId === "string" ? memberId.toLowerCase() : "";
  if (!UUID_RE.test(id)) throw new Error("Invalid member id: expected a UUID");
  return id;
}

function aadFor(memberId: string): Buffer {
  return Buffer.from(`member:${memberId}`, "utf8");
}

function open(ivB64: string, tagB64: string, dataB64: string, aad: Buffer | null): string {
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const encrypted = Buffer.from(dataB64, "base64");

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid ciphertext: IV must be ${IV_LENGTH} bytes`);
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`Invalid ciphertext: auth tag must be ${AUTH_TAG_LENGTH} bytes`);
  }

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  if (aad) decipher.setAAD(aad);
  decipher.setAuthTag(authTag);

  return decipher.update(encrypted, undefined, "utf8") + decipher.final("utf8");
}

/** Encrypts `plainText` for the member who owns the row (never the caller, unless they are the owner). */
export function encrypt(plainText: string, memberId: string): string {
  const id = memberIdOf(memberId);
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  cipher.setAAD(aadFor(id));

  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    V2,
    id,
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Decrypts a value stored in the row of `memberId`. A v2 value must be bound to that member
 * (embedded owner and AAD); a legacy value decrypts without AAD. Errors never carry the value.
 */
export function decrypt(encryptedText: string, memberId: string): string {
  const parts = typeof encryptedText === "string" ? encryptedText.split(":") : [];

  if (parts.length === 5 && parts[0] === V2) {
    const id = memberIdOf(memberId);
    if (parts[1] !== id) {
      throw new Error("Invalid ciphertext: bound to another member");
    }
    return open(parts[2], parts[3], parts[4], aadFor(id));
  }

  if (parts.length === 3) {
    return open(parts[0], parts[1], parts[2], null);
  }

  throw new Error(
    "Invalid ciphertext: expected v2:<member id>:<iv>:<tag>:<data> or legacy iv:tag:data"
  );
}

/**
 * The member a v2 value was written for, or null (legacy value, malformed input). Only for a
 * value read from the members row it belongs to: the database guarantees a stored v2 value
 * names its own row, so this equals the row id there.
 */
export function ciphertextOwner(encryptedText: string): string | null {
  if (typeof encryptedText !== "string") return null;
  const parts = encryptedText.split(":");
  if (parts.length !== 5 || parts[0] !== V2 || !UUID_RE.test(parts[1])) return null;
  return parts[1];
}
