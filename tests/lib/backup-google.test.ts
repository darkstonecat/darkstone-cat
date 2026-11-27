import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  BACKUP_PROPERTY,
  connectGoogle,
  GoogleApiError,
  parseFolderId,
  parseServiceAccount,
  signAssertion,
} from "@/lib/backup/google";

// Google Drive + Sheets client of the member backup (docs/features/member-backup/spec.md §6).

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const account = { clientEmail: "backup@darkstone-backup.iam.gserviceaccount.com", privateKey };
const keyJson = JSON.stringify({ type: "service_account", client_email: account.clientEmail, private_key: privateKey });
const FOLDER = "1AbCdEfGhIjKlMnOpQrStUvWxYz";

type Call = { url: string; init: RequestInit };

/** A fetch that answers in order and records every call. */
function fakeFetch(responses: Response[]) {
  const calls: Call[] = [];
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = responses.shift();
    if (!next) throw new Error("unexpected call");
    return next;
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

const ok = (body: unknown = {}) => Response.json(body, { status: 200 });
const tokenOk = () => ok({ access_token: "ya29.token", expires_in: 3600 });

describe("parseServiceAccount", () => {
  it("reads a base64 key and a raw JSON key", () => {
    expect(parseServiceAccount(Buffer.from(keyJson).toString("base64"))).toEqual(account);
    expect(parseServiceAccount(keyJson)).toEqual(account);
  });

  it("returns null for a missing, empty, malformed or non service account value", () => {
    for (const raw of [undefined, "", "   ", "not-base64-json", Buffer.from('{"client_email":"x"}').toString("base64")]) {
      expect(parseServiceAccount(raw)).toBeNull();
    }
    expect(parseServiceAccount(JSON.stringify({ client_email: "x", private_key: "nope" }))).toBeNull();
  });
});

describe("parseFolderId", () => {
  it("accepts a Drive id and refuses anything that could break the list query", () => {
    expect(parseFolderId(` ${FOLDER} `)).toBe(FOLDER);
    for (const raw of [undefined, "", "short", "abc' or name contains 'x", `${FOLDER}/view`]) {
      expect(parseFolderId(raw)).toBeNull();
    }
  });
});

describe("signAssertion", () => {
  it("signs an RS256 JWT for the token endpoint with the Drive and Sheets scopes", () => {
    const jwt = signAssertion(account, 1_800_000_000);
    const [header, claims, signature] = jwt.split(".");
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    expect(JSON.parse(Buffer.from(claims, "base64url").toString())).toEqual({
      iss: account.clientEmail,
      scope: "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: 1_800_000_000,
      exp: 1_800_003_600,
    });
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${header}.${claims}`);
    expect(verifier.verify(publicKey, Buffer.from(signature, "base64url"))).toBe(true);
  });
});

describe("connectGoogle", () => {
  it("exchanges the assertion for a token, then uses it as a Bearer header", async () => {
    const { impl, calls } = fakeFetch([tokenOk(), ok({ id: "sheet-1" })]);
    const google = await connectGoogle(account, impl);
    expect(calls[0].url).toBe("https://oauth2.googleapis.com/token");
    const form = new URLSearchParams(String(calls[0].init.body));
    expect(form.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
    expect(form.get("assertion")?.split(".")).toHaveLength(3);

    expect(await google.createSpreadsheet(FOLDER, "Darkstone · Socis · 2026-11-30", "desc")).toBe("sheet-1");
    expect(calls[1].url).toBe("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id");
    expect((calls[1].init.headers as Record<string, string>).Authorization).toBe("Bearer ya29.token");
    expect(JSON.parse(String(calls[1].init.body))).toEqual({
      name: "Darkstone · Socis · 2026-11-30",
      description: "desc",
      mimeType: "application/vnd.google-apps.spreadsheet",
      parents: [FOLDER],
      appProperties: { [BACKUP_PROPERTY.key]: BACKUP_PROPERTY.value },
    });
  });

  it("writes the cells RAW so values are stored as the exact text", async () => {
    const { impl, calls } = fakeFetch([tokenOk(), ok()]);
    const google = await connectGoogle(account, impl);
    await google.writeValues("sheet-1", [["CP"], ["08221"]]);
    expect(calls[1].url).toBe("https://sheets.googleapis.com/v4/spreadsheets/sheet-1/values/A1?valueInputOption=RAW");
    expect(calls[1].init.method).toBe("PUT");
    expect(JSON.parse(String(calls[1].init.body))).toEqual({
      range: "A1",
      majorDimension: "ROWS",
      values: [["CP"], ["08221"]],
    });
  });

  it("lists only the job's files in the folder, newest first, and deletes permanently", async () => {
    const files = [
      { id: "old", createdTime: "2026-11-02T03:00:00Z" },
      { id: "new", createdTime: "2026-11-23T03:00:00Z" },
    ];
    const { impl, calls } = fakeFetch([tokenOk(), ok({ files }), new Response(null, { status: 204 })]);
    const google = await connectGoogle(account, impl);
    expect((await google.listBackups(FOLDER)).map((f) => f.id)).toEqual(["new", "old"]);
    const params = new URL(calls[1].url).searchParams;
    expect(params.get("q")).toBe(
      `'${FOLDER}' in parents and trashed = false and appProperties has { key='darkstoneBackup' and value='1' }`
    );
    expect(params.get("supportsAllDrives")).toBe("true");
    expect(params.get("includeItemsFromAllDrives")).toBe("true");

    await google.deleteFile("old");
    expect(calls[2].url).toBe("https://www.googleapis.com/drive/v3/files/old?supportsAllDrives=true");
    expect(calls[2].init.method).toBe("DELETE");
  });

  it("throws a short code per step and HTTP status, never the response body", async () => {
    const { impl } = fakeFetch([new Response("invalid_grant for backup@…", { status: 400 })]);
    await expect(connectGoogle(account, impl)).rejects.toMatchObject({ code: "google_auth_400", message: "google_auth_400" });

    const second = fakeFetch([tokenOk(), new Response("forbidden: Darkstone · Socis", { status: 403 })]);
    const google = await connectGoogle(account, second.impl);
    const error = await google.createSpreadsheet(FOLDER, "x", "y").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GoogleApiError);
    expect(error).toMatchObject({ code: "drive_create_403", message: "drive_create_403" });
  });

  it("maps a timeout and a network failure to their codes", async () => {
    const timeout = vi.fn(async () => {
      throw Object.assign(new Error("t"), { name: "TimeoutError" });
    }) as unknown as typeof fetch;
    await expect(connectGoogle(account, timeout)).rejects.toMatchObject({ code: "timeout" });
    const down = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(connectGoogle(account, down)).rejects.toMatchObject({ code: "network" });
  });

  it("refuses a key that cannot sign", async () => {
    const { impl } = fakeFetch([]);
    await expect(connectGoogle({ ...account, privateKey: "-----BEGIN PRIVATE KEY-----\nbad\n-----END PRIVATE KEY-----" }, impl)).rejects.toMatchObject({
      code: "google_key_invalid",
    });
  });
});
