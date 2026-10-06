/**
 * Browser side of the admin exports (A-11, A-16, S-4): error classification and file saving.
 * The routes answer `{ "error": <code> }` with 401/403/400/413/500; the dialogs map the result
 * to a translated message through `admin.members.export_errors.<kind>`.
 */

export type ExportErrorKind =
  | "forbidden_origin"
  | "unauthenticated"
  | "forbidden"
  | "reason_required"
  | "reason_too_long"
  | "failed";

/** Maps a failed export response to a stable kind (never shows server text to the user). */
export async function classifyExportError(res: Response): Promise<ExportErrorKind> {
  let code: unknown;
  try {
    const body = (await res.json()) as { error?: unknown };
    code = body?.error;
  } catch {
    code = undefined;
  }
  if (code === "forbidden_origin") return "forbidden_origin";
  if (code === "reason_required") return "reason_required";
  if (code === "reason_too_long") return "reason_too_long";
  if (res.status === 401) return "unauthenticated";
  if (res.status === 403) return "forbidden";
  return "failed";
}

/** Saves a successful response body as a file (filename from Content-Disposition, else the fallback). */
export async function saveResponseAsFile(res: Response, fallbackName: string): Promise<void> {
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const match = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/);
  a.download = match?.[1] ?? fallbackName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** POST with a JSON body, as every export route requires (same-origin, no GET). */
export function postExport(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
