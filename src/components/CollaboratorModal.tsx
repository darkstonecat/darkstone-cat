"use client";

import { useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { MdClose, MdOpenInNew } from "react-icons/md";
import { cn } from "@/lib/utils";
import { useLenis } from "@/components/SmoothScroll";
import type { Collaborator } from "@/data/collaborators";

interface CollaboratorModalProps {
  collaborator: Collaborator;
  onClose: () => void;
}

export default function CollaboratorModal({
  collaborator,
  onClose,
}: CollaboratorModalProps) {
  const t = useTranslations("collaborators");
  const lenis = useLenis();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Lock scroll
  useEffect(() => {
    lenis?.stop();
    return () => {
      lenis?.start();
    };
  }, [lenis]);

  // Escape to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Focus trap
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;

    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length > 0) focusable[0].focus();
  }, []);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="collaborator-modal-title"
      aria-describedby="collaborator-modal-desc"
    >
      <motion.div
        ref={dialogRef}
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        data-lenis-prevent
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-sm transition-colors hover:bg-black/40"
          aria-label={t("close")}
        >
          <MdClose className="h-5 w-5" />
        </button>

        {/* Logo */}
        <div
          className="flex items-center justify-center px-8 py-10"
          style={{ backgroundColor: collaborator.brandColor ?? "#f5f5f4" }}
        >
          <div className="relative h-24 w-48">
            <Image
              src={collaborator.logo}
              alt={t("logo_alt", { name: collaborator.name })}
              fill
              className={cn("object-contain", collaborator.invertLogo && "brightness-0 invert")}
              sizes="192px"
              quality={60}
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <h2
            id="collaborator-modal-title"
            className="text-xl font-bold text-stone-900"
          >
            {collaborator.name}
          </h2>

          {/* Category badge */}
          <span className="mt-2 inline-block rounded-full bg-brand-orange/10 px-3 py-1 text-xs font-medium text-brand-orange">
            {t(`categories.${collaborator.category}`)}
          </span>

          {/* Description */}
          <p id="collaborator-modal-desc" className="mt-4 text-sm leading-relaxed text-stone-600">
            {t(`descriptions.${collaborator.slug}`)}
          </p>

          {/* Visit website */}
          <a
            href={collaborator.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-700"
          >
            {t("visit_website")}
            <MdOpenInNew className="h-4 w-4" />
          </a>
        </div>
      </motion.div>
    </motion.div>
  );
}
