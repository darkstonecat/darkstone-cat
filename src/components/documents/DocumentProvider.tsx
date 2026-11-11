"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { useSearchParams } from "next/navigation";
import { DOCUMENT_PARAM, isDocumentKey, searchWithoutDocument, type DocumentKey } from "@/lib/documents";
import { DocumentContext } from "./document-context";
import DocumentDialog from "./DocumentDialog";

/**
 * Owns the one document dialog of the page. The open document lives in the URL (`?doc=<key>`):
 * a `DocumentLink` click pushes it as a history entry, so the browser Back button (or the mobile
 * back gesture) closes the dialog instead of leaving the page; a link from outside the site lands
 * with it already set. Closing goes back when this page pushed the entry, and otherwise drops the
 * param in place so a reload does not open it again.
 */
export default function DocumentProvider({ children }: { children: ReactNode }) {
  /** The open entry was pushed by `openDocument` (not loaded from an outside link). */
  const pushedRef = useRef(false);
  /** Link that opened the dialog: focus returns to it (Safari does not focus clicked links). */
  const triggerRef = useRef<HTMLElement | null>(null);

  const openDocument = useCallback((key: DocumentKey, trigger?: HTMLElement | null) => {
    triggerRef.current = trigger ?? null;
    const params = new URLSearchParams(window.location.search);
    if (params.get(DOCUMENT_PARAM) === key) return;
    params.set(DOCUMENT_PARAM, key);
    const { pathname, hash } = window.location;
    // `null` state, as the Next.js docs show: the router keeps its own state and syncs useSearchParams.
    window.history.pushState(null, "", `${pathname}?${params.toString()}${hash}`);
    pushedRef.current = true;
  }, []);

  const close = useCallback(() => {
    if (pushedRef.current) {
      pushedRef.current = false;
      window.history.back();
      return;
    }
    const { pathname, search, hash } = window.location;
    window.history.replaceState(null, "", `${pathname}${searchWithoutDocument(search)}${hash}`);
  }, []);

  const value = useMemo(() => ({ openDocument }), [openDocument]);

  return (
    <DocumentContext.Provider value={value}>
      {children}
      {/* useSearchParams needs a Suspense boundary; nothing renders while no document is open. */}
      <Suspense fallback={null}>
        <DocumentFromUrl onClose={close} pushedRef={pushedRef} triggerRef={triggerRef} />
      </Suspense>
    </DocumentContext.Provider>
  );
}

const noSubscription = () => () => {};

function DocumentFromUrl({
  onClose,
  pushedRef,
  triggerRef,
}: {
  onClose: () => void;
  pushedRef: RefObject<boolean>;
  triggerRef: RefObject<HTMLElement | null>;
}) {
  const requested = useSearchParams().get(DOCUMENT_PARAM);
  // A `?doc=` page load must not render the dialog on the server (it portals to <body>) nor during
  // hydration: it opens right after.
  const hydrated = useSyncExternalStore(noSubscription, () => true, () => false);
  const doc = hydrated && isDocumentKey(requested) ? requested : null;
  useEffect(() => {
    // Back/forward removed the param: the pushed entry is gone, closing must not go back again.
    if (!doc) pushedRef.current = false;
  }, [doc, pushedRef]);
  return <DocumentDialog doc={doc} onClose={onClose} returnFocus={triggerRef} />;
}
