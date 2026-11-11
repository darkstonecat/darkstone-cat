/**
 * Association documents that open in a dialog over the current page (no page of their own).
 * `?doc=<key>` on any URL opens one, so a link from outside the site (the sign-up form, an
 * e-mail) can point at e.g. `https://www.darkstone.cat/?doc=conduct`.
 */
export const DOCUMENT_KEYS = ["conduct", "data-protection"] as const;

export type DocumentKey = (typeof DOCUMENT_KEYS)[number];

/** Search param that opens a document dialog. */
export const DOCUMENT_PARAM = "doc";

export function isDocumentKey(value: unknown): value is DocumentKey {
  return typeof value === "string" && (DOCUMENT_KEYS as readonly string[]).includes(value);
}

/** Relative link that opens the document on the current page (works without JavaScript too). */
export function documentHref(key: DocumentKey): string {
  return `?${DOCUMENT_PARAM}=${key}`;
}

/** `search` (with or without `?`) without the document param; `""` when nothing else is left. */
export function searchWithoutDocument(search: string): string {
  const params = new URLSearchParams(search);
  params.delete(DOCUMENT_PARAM);
  const rest = params.toString();
  return rest ? `?${rest}` : "";
}
