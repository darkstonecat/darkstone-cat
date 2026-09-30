"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { MdClose } from "react-icons/md";
import type { QrMatrix } from "@/lib/member-card/qr";
import { useLenis } from "@/components/SmoothScroll";
import QrCodeSvg from "./QrCodeSvg";

type CardQrOverlayProps = {
  matrix: QrMatrix;
  memberNumber: string;
};

/**
 * QR tile of the mobile card. Tapping it opens a full-screen dialog with a large QR on white so it
 * scans at the door. No screen-brightness API is used. Focus is trapped in the dialog, Escape and
 * the close button dismiss it, the page behind is made inert, body scroll is locked and focus returns to the tile.
 */
export default function CardQrOverlay({ matrix, memberNumber }: CardQrOverlayProps) {
  const t = useTranslations("profile.card");
  const lenis = useLenis();
  // Kept in a ref so a new Lenis identity never re-runs the effect (and its cleanup) while open.
  const lenisRef = useRef(lenis);
  useEffect(() => {
    lenisRef.current = lenis;
  }, [lenis]);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const label = t("qr_alt", { number: memberNumber });

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Only restart Lenis on close if this overlay is the one that stopped it.
    const current = lenisRef.current;
    const stoppedLenis = current && !current.isStopped ? current : null;
    stoppedLenis?.stop();
    // Everything behind the dialog becomes inert (no focus, no clicks, hidden from assistive tech).
    const main = document.getElementById("main-content");
    const wasInert = main?.hasAttribute("inert") ?? false;
    main?.setAttribute("inert", "");
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      } else if (event.key === "Tab") {
        // The close button is the only focusable element: keep focus on it.
        event.preventDefault();
        closeRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      stoppedLenis?.start();
      if (!wasInert) main?.removeAttribute("inert");
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={t("qr_open")}
        className="block rounded-2xl bg-brand-white p-2 focus-visible:outline-offset-2"
      >
        <QrCodeSvg matrix={matrix} quiet={4} label={label} className="size-[200px]" />
      </button>

      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            data-lenis-prevent
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-brand-white p-6 text-stone-custom"
          >
            <button
              ref={closeRef}
              type="button"
              onClick={close}
              aria-label={t("qr_close")}
              className="absolute top-4 right-4 flex size-11 items-center justify-center rounded-full bg-stone-custom/10 text-stone-custom transition-colors hover:bg-stone-custom/20"
            >
              <MdClose aria-hidden="true" size={24} />
            </button>
            <h2 id={titleId} className="text-lg font-bold">
              {t("qr_dialog")}
            </h2>
            <QrCodeSvg
              matrix={matrix}
              quiet={4}
              label={label}
              className="aspect-square w-[min(88vw,60dvh,480px)]"
            />
            <p className="font-mono text-lg font-semibold text-brand-orange-text">{memberNumber}</p>
          </div>,
          document.body
        )}
    </>
  );
}
