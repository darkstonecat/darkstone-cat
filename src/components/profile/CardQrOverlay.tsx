"use client";

import { useCallback, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { MdClose } from "react-icons/md";
import type { QrMatrix } from "@/lib/member-card/qr";
import { useModalDialog } from "@/hooks/useModalDialog";
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
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const label = t("qr_alt", { number: memberNumber });

  const close = useCallback(() => setOpen(false), []);

  useModalDialog({ active: open, panelRef, onEscape: close, returnFocus: triggerRef });

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
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            data-lenis-prevent
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-brand-white p-6 text-stone-custom"
          >
            <button
              data-autofocus
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
