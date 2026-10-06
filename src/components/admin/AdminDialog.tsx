"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MdClose, MdMenuBook } from "react-icons/md";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { adminButtonClass } from "./adminButtons";

export type AdminDialogReason = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Minimum length after trim before the confirm button enables. Default 5. */
  minLength?: number;
  /** Default 1000 (the audit reason column limit). */
  maxLength?: number;
  /** Extra help under the field, e.g. "El soci el rebrà per correu." */
  help?: string;
};

export type AdminDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  /** Line under the title, e.g. "Soci 000-203 · Laia Serra". Also the accessible description. */
  target?: string;
  /** `danger` makes the confirm button red (Dona de baixa, Anonimitza, Treu el rol...). */
  variant?: "neutral" | "danger";
  /** Shows the "Només superadmins" chip next to the title. */
  superadminOnly?: boolean;
  /** Procedure id such as "P-2": links to `/admin/procedures#p-2` in the footer. */
  procedure?: string;
  confirmLabel: string;
  /** Overrides the generic "Cancel·la". */
  cancelLabel?: string;
  /** Extra condition on top of the reason check (typed confirmation, checklist...). */
  confirmDisabled?: boolean;
  /** Visible text explaining `confirmDisabled`; linked to the button with aria-describedby. */
  confirmDisabledReason?: string;
  /** Request in flight: close, cancel and confirm are disabled, Escape and backdrop are ignored. */
  busy?: boolean;
  /** Error from the last attempt, announced as an alert. */
  error?: string;
  /** Optional required reason (audited). Shows the "no DNI or phone" hint. */
  reason?: AdminDialogReason;
  /** Backdrop click closes the dialog (default true). */
  closeOnBackdrop?: boolean;
  children?: ReactNode;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function isReasonValid(reason: AdminDialogReason | undefined) {
  if (!reason) return true;
  return reason.value.trim().length >= (reason.minLength ?? 5);
}

/**
 * Shared dialog shell of the admin panel (README §4 "Dialog shell"): modal, focus trap,
 * focus returns to the trigger, Escape closes unless busy, 44 px close button, footer with
 * the procedure link, cancel and confirm. Screens only provide the body and the confirm action.
 * The panel is portalled to <body> so the page behind (`#main-content`) can be made `inert` and
 * its scroll locked while open, like the card QR overlay.
 */
export default function AdminDialog(props: AdminDialogProps) {
  return <AnimatePresence>{props.open && <DialogPanel key="dialog" {...props} />}</AnimatePresence>;
}

function DialogPanel({
  onClose,
  onConfirm,
  title,
  target,
  variant = "neutral",
  superadminOnly,
  procedure,
  confirmLabel,
  cancelLabel,
  confirmDisabled,
  confirmDisabledReason,
  busy = false,
  error,
  reason,
  closeOnBackdrop = true,
  children,
}: AdminDialogProps) {
  const t = useTranslations("admin");
  // Safe here (unlike scroll effects): the dialog only mounts after a click, never in the server HTML.
  const reduced = useReducedMotion() ?? false;
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const targetId = useId();
  const reasonId = useId();
  const reasonHintId = useId();
  const explainId = useId();

  // Latest values for the document listener, which is attached once.
  const live = useRef({ busy, onClose });
  useEffect(() => {
    live.current = { busy, onClose };
  });

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Everything behind the dialog becomes inert (no focus, no clicks, hidden from assistive tech).
    const main = document.getElementById("main-content");
    const wasInert = main?.hasAttribute("inert") ?? false;
    main?.setAttribute("inert", "");
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel;
    first?.focus();

    function onKeyDown(event: KeyboardEvent) {
      const root = panelRef.current;
      if (!root) return;
      if (event.key === "Escape") {
        if (!live.current.busy) {
          event.preventDefault();
          live.current.onClose();
        }
        return;
      }
      if (event.key !== "Tab") return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === firstItem || active === root || !root.contains(active))) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && (active === lastItem || !root.contains(active))) {
        event.preventDefault();
        firstItem.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (!wasInert) main?.removeAttribute("inert");
      previous?.focus?.();
    };
  }, []);

  // The buttons disable while a request runs: keep focus inside the dialog instead of <body>.
  useEffect(() => {
    if (busy) panelRef.current?.focus();
  }, [busy]);

  const reasonInvalid = !isReasonValid(reason);
  const blocked = Boolean(confirmDisabled) || reasonInvalid;
  const explanation = confirmDisabled
    ? confirmDisabledReason
    : reasonInvalid
      ? t("dialog_reason_min", { min: reason?.minLength ?? 5 })
      : undefined;
  const showExplanation = !busy && blocked && Boolean(explanation);

  const motionProps = reduced
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 }, transition: { duration: 0 } }
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 20 },
        transition: { duration: 0.2 },
      };

  // Mounted only after a click, so `document` exists; the guard keeps an initially-open render safe.
  if (typeof document === "undefined") return null;

  return createPortal(
    <motion.div
      data-testid="admin-dialog-backdrop"
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-custom/60 sm:items-center sm:p-4"
      initial={{ opacity: reduced ? 1 : 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: reduced ? 1 : 0 }}
      transition={{ duration: reduced ? 0 : 0.2 }}
      onClick={(event) => {
        if (closeOnBackdrop && !busy && event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={target ? targetId : undefined}
        aria-busy={busy || undefined}
        tabIndex={-1}
        data-lenis-prevent
        className="flex max-h-[100dvh] w-full flex-col gap-5 overflow-y-auto rounded-t-2xl bg-brand-white p-5 shadow-[0_24px_64px_rgba(12,10,9,0.35)] outline-none sm:max-h-[calc(100dvh-2rem)] sm:w-[560px] sm:max-w-[calc(100vw-2rem)] sm:rounded-2xl sm:p-8"
        {...motionProps}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id={titleId} className="text-[22px] font-bold text-stone-custom">
                {title}
              </h2>
              {superadminOnly && (
                <span className="rounded-full bg-stone-custom px-2.5 py-1 text-xs font-bold text-brand-white">
                  {t("chip_superadmin_only")}
                </span>
              )}
            </div>
            {target && (
              <p id={targetId} className="mt-1 text-sm text-stone-custom/65">
                {target}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={t("dialog_close")}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-stone-custom/15 text-stone-custom transition-colors hover:bg-stone-custom/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MdClose aria-hidden="true" className="size-5" />
          </button>
        </div>

        {children}

        {reason && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={reasonId} className="text-sm font-semibold text-stone-custom">
              {reason.label} <span aria-hidden="true" className="text-brand-red">*</span>
            </label>
            <textarea
              id={reasonId}
              data-autofocus
              rows={3}
              required
              aria-required="true"
              disabled={busy}
              maxLength={reason.maxLength ?? 1000}
              value={reason.value}
              onChange={(event) => reason.onChange(event.target.value)}
              aria-describedby={reasonHintId}
              className="w-full resize-y rounded-xl border border-stone-custom/20 bg-brand-white px-3.5 py-3 text-base text-stone-custom outline-none focus-visible:outline-2 focus-visible:outline-brand-orange disabled:opacity-50"
            />
            <p id={reasonHintId} className="text-[13px] text-stone-custom/65">
              {reason.help ? `${reason.help} ` : ""}
              <span>{t("dialog_reason_hint")}</span>
            </p>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-brand-red">
            {error}
          </p>
        )}

        {showExplanation && (
          <p id={explainId} className="text-[13px] text-stone-custom/65">
            {explanation}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {procedure ? (
            <Link
              href={`/admin/procedures#${procedure.toLowerCase()}`}
              className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-orange-text"
            >
              <MdMenuBook aria-hidden="true" className="size-5" />
              {t("dialog_procedure", { id: procedure })}
            </Link>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className={adminButtonClass("secondary", "max-sm:w-full")}
            >
              {cancelLabel ?? t("dialog_cancel")}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy || blocked}
              aria-describedby={showExplanation ? explainId : undefined}
              className={adminButtonClass(variant === "danger" ? "danger" : "primary", cn("max-sm:w-full"))}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
