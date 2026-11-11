"use client";

import { useId, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import { MdClose } from "react-icons/md";
import type { DocumentKey } from "@/lib/documents";
import { useModalDialog } from "@/hooks/useModalDialog";
import { cn } from "@/lib/utils";
import DocumentBody, { DOCUMENT_NAMESPACE, DOCUMENT_SUBTITLE_KEY } from "./DocumentBody";

type DocumentDialogProps = {
  /** Document to show; `null` closes the dialog. */
  doc: DocumentKey | null;
  onClose: () => void;
  /** Element that gets focus back on close (the link that opened it). */
  returnFocus?: RefObject<HTMLElement | null>;
};

/**
 * Reads an association document over the current page: a large centred dialog on desktop and a
 * bottom sheet on mobile, with the text scrolling inside it. Modal (focus trap, Escape, backdrop
 * click, page locked behind it), portalled to <body> so `#main-content` can be made inert.
 */
export default function DocumentDialog({ doc, onClose, returnFocus }: DocumentDialogProps) {
  return (
    <AnimatePresence>
      {doc && <DocumentPanel key={doc} doc={doc} onClose={onClose} returnFocus={returnFocus} />}
    </AnimatePresence>
  );
}

function DocumentPanel({ doc, onClose, returnFocus }: { doc: DocumentKey } & Omit<DocumentDialogProps, "doc">) {
  const t = useTranslations(DOCUMENT_NAMESPACE[doc]);
  const tDocs = useTranslations("documents");
  // Safe here (unlike scroll effects): the panel only mounts on the client, after a click or a
  // `?doc=` read, never in the server HTML (so `document` exists for the portal too).
  const reduced = useReducedMotion() ?? false;
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const subtitleId = useId();
  const isPresent = useIsPresent();

  useModalDialog({ active: isPresent, panelRef, onEscape: onClose, returnFocus });

  const fade = { duration: reduced ? 0 : 0.2 };

  return createPortal(
    <motion.div
      data-testid="document-dialog-backdrop"
      className={cn(
        "fixed inset-0 z-50 flex items-end justify-center bg-stone-custom/60 sm:items-center sm:p-6",
        !isPresent && "pointer-events-none",
      )}
      initial={{ opacity: reduced ? 1 : 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: reduced ? 1 : 0 }}
      transition={fade}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitleId}
        tabIndex={-1}
        inert={!isPresent || undefined}
        className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-brand-beige shadow-[0_24px_64px_rgba(12,10,9,0.35)] outline-none sm:max-h-[calc(100dvh-3rem)] sm:w-[760px] sm:max-w-[calc(100vw-3rem)] sm:rounded-2xl"
        initial={reduced ? { opacity: 1 } : { opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduced ? { opacity: 1 } : { opacity: 0, y: 40 }}
        transition={fade}
      >
        <span aria-hidden="true" className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-stone-custom/20 sm:hidden" />
        <div className="flex items-start justify-between gap-4 border-b border-stone-custom/10 px-5 pt-4 pb-4 sm:px-8 sm:pt-7 sm:pb-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[22px] font-bold tracking-tight text-stone-custom sm:text-[26px]">
              {t("title")}
            </h2>
            <p id={subtitleId} className="mt-1 text-sm leading-snug text-stone-custom/65">
              {t(DOCUMENT_SUBTITLE_KEY[doc])}
            </p>
          </div>
          <button
            type="button"
            data-autofocus
            onClick={onClose}
            aria-label={tDocs("close")}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-stone-custom/15 text-stone-custom transition-colors hover:bg-stone-custom/5"
          >
            <MdClose aria-hidden="true" className="size-5" />
          </button>
        </div>
        {/* Focusable so the text can be scrolled with the keyboard; Lenis must not take its wheel events. */}
        <div
          data-lenis-prevent
          tabIndex={0}
          role="region"
          aria-labelledby={titleId}
          className="flex-1 overflow-y-auto overscroll-contain px-5 pt-5 pb-10 outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-orange sm:px-8 sm:pt-6"
        >
          <DocumentBody doc={doc} />
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
