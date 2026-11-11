"use client";

import { createContext, useContext } from "react";
import type { DocumentKey } from "@/lib/documents";

export type DocumentContextValue = {
  /** Opens `doc` over the current page; focus returns to `trigger` on close. */
  openDocument: (doc: DocumentKey, trigger?: HTMLElement | null) => void;
};

export const DocumentContext = createContext<DocumentContextValue | null>(null);

/** `openDocument` of the nearest `DocumentProvider`, or `null` outside one (links then navigate to `?doc=`). */
export function useDocumentDialog(): DocumentContextValue | null {
  return useContext(DocumentContext);
}
