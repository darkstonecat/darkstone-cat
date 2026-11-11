"use client";

import { useEffect, useRef, type RefObject } from "react";
import { useLenis } from "@/components/SmoothScroll";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Lenis = { isStopped: boolean; stop: () => void; start: () => void };
type PageLock = { count: number; overflow: string; inert: boolean; lenis: Lenis | null };
let pageLock: PageLock | null = null;

/**
 * Locks the page behind the dialogs (body scroll, Lenis, `#main-content` inert). Shared by every
 * open dialog through a counter, so a dialog that opens while another one is closing keeps the page
 * locked, and the original overflow / inert state is restored only when the last one releases.
 */
export function lockPage(lenis: Lenis | null) {
  if (!pageLock) {
    const main = document.getElementById("main-content");
    const stopped = lenis && !lenis.isStopped ? lenis : null;
    // Lenis scrolls the page on wheel events regardless of body overflow: stop it while open, and
    // restart it on release only if a dialog is the one that stopped it.
    stopped?.stop();
    pageLock = {
      count: 0,
      overflow: document.body.style.overflow,
      inert: main?.hasAttribute("inert") ?? false,
      lenis: stopped,
    };
    document.body.style.overflow = "hidden";
    // Everything behind the dialog becomes inert (no focus, no clicks, hidden from assistive tech).
    main?.setAttribute("inert", "");
  }
  pageLock.count += 1;
  return function unlockPage() {
    const lock = pageLock;
    if (!lock) return;
    lock.count -= 1;
    if (lock.count > 0) return;
    pageLock = null;
    document.body.style.overflow = lock.overflow;
    lock.lenis?.start();
    if (!lock.inert) document.getElementById("main-content")?.removeAttribute("inert");
  };
}

type ModalDialogOptions = {
  /** True while the dialog is shown (false as soon as it starts closing). */
  active: boolean;
  /** The dialog element: focus is trapped inside it. */
  panelRef: RefObject<HTMLElement | null>;
  /** Escape was pressed. Return `false` to leave the key unhandled (e.g. while busy). */
  onEscape: () => void | boolean;
  /**
   * Element that gets focus back on close. Defaults to the element focused when the dialog opened,
   * which is `<body>` after a click in Safari (it does not focus clicked buttons), so pass the
   * trigger when it is known.
   */
  returnFocus?: RefObject<HTMLElement | null>;
};

/**
 * Modal behaviour shared by the site dialogs: locks the page, moves focus to the first
 * `[data-autofocus]` element (or the panel), traps Tab inside the panel, calls `onEscape` on
 * Escape, and returns focus to the element that had it when the dialog opened.
 */
export function useModalDialog({ active, panelRef, onEscape, returnFocus }: ModalDialogOptions) {
  const lenis = useLenis();
  // Kept in a ref so a new Lenis identity never re-runs the effect (and its cleanup) while open.
  const lenisRef = useRef(lenis);
  const escapeRef = useRef(onEscape);
  const returnFocusRef = useRef(returnFocus);
  useEffect(() => {
    lenisRef.current = lenis;
    escapeRef.current = onEscape;
    returnFocusRef.current = returnFocus;
  });

  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const unlockPage = lockPage(lenisRef.current);
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel;
    first?.focus();

    function onKeyDown(event: KeyboardEvent) {
      const root = panelRef.current;
      if (!root) return;
      if (event.key === "Escape") {
        if (escapeRef.current() !== false) event.preventDefault();
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
      const focused = document.activeElement;
      if (event.shiftKey && (focused === firstItem || focused === root || !root.contains(focused))) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && (focused === lastItem || !root.contains(focused))) {
        event.preventDefault();
        firstItem.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      unlockPage();
      const target = returnFocusRef.current?.current;
      (target?.isConnected ? target : previous)?.focus?.();
    };
  }, [active, panelRef]);
}
