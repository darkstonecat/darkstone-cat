// Minimal Google Drive + Sheets client for the member backup (docs/features/member-backup/spec.md §6).
//
// Auth: a service account JSON key; the access token comes from a JWT signed here with Node
// crypto (no googleapis dependency). Scopes: Drive (create, list and delete in the shared drive)
// and Sheets (write the cells). The service account only reaches the shared drive it is a member
// of, so the Drive scope is bounded by that membership.
//
// The Sheet is created empty through Drive and filled through the Sheets API with
// valueInputOption=RAW: every cell is stored as the exact text sent. A CSV upload converted by
// Drive would parse values instead (postal code 08221 → 8221, "+34 600…" → a number).
//
// Errors are GoogleApiError with a short code (`drive_create_403`, `timeout`) and never the
// response body, which can echo file names or values.

import { createSign } from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_FILES = "https://www.googleapis.com/drive/v3/files";
const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";
const SCOPES = ["https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/spreadsheets"].join(" ");
/** Per call; a run makes up to 6 calls and the route has 60 s (maxDuration). */
const TIMEOUT_MS = 8_000;

/** Drive app property that marks the files this job made; clean-up never touches other files. */
export const BACKUP_PROPERTY = { key: "darkstoneBackup", value: "1" } as const;
const FOLDER_ID = /^[A-Za-z0-9_-]{10,200}$/;

export class GoogleApiError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "GoogleApiError";
  }
}

export type ServiceAccount = { clientEmail: string; privateKey: string };

/**
 * The service account from `GOOGLE_BACKUP_SERVICE_ACCOUNT`: the JSON key, base64-encoded (raw
 * JSON is accepted too). Null when it is missing or not a service account key.
 */
export function parseServiceAccount(raw: string | undefined): ServiceAccount | null {
  const text = raw?.trim();
  if (!text) return null;
  try {
    const json = text.startsWith("{") ? text : Buffer.from(text, "base64").toString("utf8");
    const key = JSON.parse(json) as { client_email?: unknown; private_key?: unknown };
    if (typeof key.client_email !== "string" || typeof key.private_key !== "string") return null;
    if (!key.private_key.includes("PRIVATE KEY")) return null;
    return { clientEmail: key.client_email, privateKey: key.private_key };
  } catch {
    return null;
  }
}

/** The backup folder id from `GOOGLE_BACKUP_FOLDER_ID`; null when missing or malformed. */
export function parseFolderId(raw: string | undefined): string | null {
  const id = raw?.trim();
  return id && FOLDER_ID.test(id) ? id : null;
}

const base64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

/** A signed JWT assertion for the OAuth token endpoint (RS256, valid one hour). */
export function signAssertion(account: ServiceAccount, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({ iss: account.clientEmail, scope: SCOPES, aud: TOKEN_URL, iat: nowSeconds, exp: nowSeconds + 3600 })
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  return `${header}.${claims}.${base64url(signer.sign(account.privateKey))}`;
}

export type BackupFile = { id: string; createdTime: string };

export type GoogleClient = {
  createSpreadsheet(folderId: string, name: string, description: string): Promise<string>;
  writeValues(spreadsheetId: string, values: string[][]): Promise<void>;
  formatHeader(spreadsheetId: string): Promise<void>;
  /** Files this job made in the folder, newest first. */
  listBackups(folderId: string): Promise<BackupFile[]>;
  /** Permanent delete (skips the trash). */
  deleteFile(fileId: string): Promise<void>;
};

type FetchLike = typeof fetch;

async function call(fetchImpl: FetchLike, step: string, url: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    const name = (error as { name?: string } | null)?.name;
    throw new GoogleApiError(name === "TimeoutError" || name === "AbortError" ? "timeout" : "network");
  }
  if (!res.ok) throw new GoogleApiError(`${step}_${res.status}`);
  return res;
}

/** Signs in as the service account and returns a client bound to that token. */
export async function connectGoogle(account: ServiceAccount, fetchImpl: FetchLike = fetch): Promise<GoogleClient> {
  let assertion: string;
  try {
    assertion = signAssertion(account);
  } catch {
    throw new GoogleApiError("google_key_invalid");
  }
  const tokenRes = await call(fetchImpl, "google_auth", TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
  });
  const token = ((await tokenRes.json()) as { access_token?: unknown }).access_token;
  if (typeof token !== "string" || !token) throw new GoogleApiError("google_auth_no_token");

  const auth = { Authorization: `Bearer ${token}` };
  const jsonHeaders = { ...auth, "Content-Type": "application/json" };

  return {
    async createSpreadsheet(folderId, name, description) {
      const res = await call(fetchImpl, "drive_create", `${DRIVE_FILES}?supportsAllDrives=true&fields=id`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          name,
          description,
          mimeType: "application/vnd.google-apps.spreadsheet",
          parents: [folderId],
          appProperties: { [BACKUP_PROPERTY.key]: BACKUP_PROPERTY.value },
        }),
      });
      const id = ((await res.json()) as { id?: unknown }).id;
      if (typeof id !== "string" || !id) throw new GoogleApiError("drive_create_no_id");
      return id;
    },

    async writeValues(spreadsheetId, values) {
      await call(
        fetchImpl,
        "sheets_write",
        `${SHEETS}/${encodeURIComponent(spreadsheetId)}/values/A1?valueInputOption=RAW`,
        { method: "PUT", headers: jsonHeaders, body: JSON.stringify({ range: "A1", majorDimension: "ROWS", values }) }
      );
    },

    async formatHeader(spreadsheetId) {
      // Sheet id 0 is the first tab of a new spreadsheet.
      await call(fetchImpl, "sheets_format", `${SHEETS}/${encodeURIComponent(spreadsheetId)}:batchUpdate`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          requests: [
            {
              updateSheetProperties: {
                properties: { sheetId: 0, gridProperties: { frozenRowCount: 1 } },
                fields: "gridProperties.frozenRowCount",
              },
            },
            {
              repeatCell: {
                range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
                cell: { userEnteredFormat: { textFormat: { bold: true } } },
                fields: "userEnteredFormat.textFormat.bold",
              },
            },
          ],
        }),
      });
    },

    async listBackups(folderId) {
      if (!FOLDER_ID.test(folderId)) throw new GoogleApiError("drive_folder_invalid");
      const q =
        `'${folderId}' in parents and trashed = false and ` +
        `appProperties has { key='${BACKUP_PROPERTY.key}' and value='${BACKUP_PROPERTY.value}' }`;
      const params = new URLSearchParams({
        q,
        orderBy: "createdTime desc",
        fields: "files(id,createdTime)",
        pageSize: "100",
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
      });
      const res = await call(fetchImpl, "drive_list", `${DRIVE_FILES}?${params}`, { headers: auth });
      const files = ((await res.json()) as { files?: unknown }).files;
      if (!Array.isArray(files)) return [];
      return files
        .filter(
          (f): f is BackupFile =>
            !!f && typeof f.id === "string" && typeof (f as { createdTime?: unknown }).createdTime === "string"
        )
        .sort((a, b) => b.createdTime.localeCompare(a.createdTime));
    },

    async deleteFile(fileId) {
      await call(fetchImpl, "drive_delete", `${DRIVE_FILES}/${encodeURIComponent(fileId)}?supportsAllDrives=true`, {
        method: "DELETE",
        headers: auth,
      });
    },
  };
}
