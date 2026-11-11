"use client";

import type { MouseEvent, ReactNode } from "react";
import { documentHref, type DocumentKey } from "@/lib/documents";
import { useDocumentDialog } from "./document-context";

type DocumentLinkProps = {
  doc: DocumentKey;
  className?: string;
  children: ReactNode;
};

/**
 * Link that opens an association document in the dialog over the current page. It is a real
 * `<a href="?doc=…">`, so a modified click (new tab) or a click before hydration still opens the
 * document, on the same path (other query params are dropped in that case).
 */
export default function DocumentLink({ doc, className, children }: DocumentLinkProps) {
  const dialog = useDocumentDialog();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!dialog || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    dialog.openDocument(doc, event.currentTarget);
  }

  return (
    <a href={documentHref(doc)} onClick={handleClick} aria-haspopup="dialog" className={className}>
      {children}
    </a>
  );
}
