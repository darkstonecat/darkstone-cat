"use client";

import { useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { X, Users, Clock, Star, Brain, User, ExternalLink } from "lucide-react";
import { useLenis } from "@/components/SmoothScroll";
import type { BggGame } from "@/lib/bgg";

interface GameDetailModalProps {
  game: BggGame;
  onClose: () => void;
}

export default function GameDetailModal({
  game,
  onClose,
}: GameDetailModalProps) {
  const t = useTranslations("ludoteca");
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

  const playersText =
    game.minPlayers === game.maxPlayers
      ? `${game.minPlayers}`
      : `${game.minPlayers}–${game.maxPlayers}`;

  const bggUrl = `https://boardgamegeek.com/boardgame/${game.id}`;

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
      aria-labelledby="game-modal-title"
    >
      <motion.div
        ref={dialogRef}
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
          aria-label={t("modal_close")}
        >
          <X className="h-5 w-5" />
        </button>

        {/* Image */}
        {game.image && (
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-t-2xl bg-stone-100">
            <Image
              src={game.image}
              alt={`${game.originalName ?? game.name} — board game cover`}
              fill
              className="object-contain"
              sizes="(max-width: 672px) 100vw, 672px"
              priority
            />
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          <h2
            id="game-modal-title"
            className="text-2xl font-bold text-stone-900"
          >
            {game.name}
          </h2>
          {game.originalName && game.originalName !== game.name && (
            <p className="mt-1 text-sm text-stone-500">{game.originalName}</p>
          )}
          {game.year > 0 && (
            <p className="mt-1 text-sm text-stone-400">{game.year}</p>
          )}

          {/* Stats grid */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {game.minPlayers > 0 && (
              <StatItem
                icon={<Users className="h-4 w-4" />}
                label={t("detail_players")}
                value={playersText}
              />
            )}
            {game.playingTime > 0 && (
              <StatItem
                icon={<Clock className="h-4 w-4" />}
                label={t("detail_duration")}
                value={`${game.playingTime} min`}
              />
            )}
            {game.rating > 0 && (
              <StatItem
                icon={<Star className="h-4 w-4" />}
                label={t("detail_rating")}
                value={game.rating.toFixed(1)}
              />
            )}
            {game.weight > 0 && (
              <StatItem
                icon={<Brain className="h-4 w-4" />}
                label={t("detail_weight")}
                value={`${game.weight.toFixed(1)} / 5`}
              />
            )}
            {game.minAge > 0 && (
              <StatItem
                icon={<User className="h-4 w-4" />}
                label={t("detail_age")}
                value={`${game.minAge}+`}
              />
            )}
          </div>

          {/* BGG link */}
          <a
            href={bggUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-stone-100 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-200"
          >
            {t("detail_bgg_link")}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>

          {/* Expansions */}
          {game.expansions.length > 0 && (
            <div className="mt-6 border-t border-stone-200 pt-5">
              <h3 className="text-sm font-semibold text-stone-700">
                {t("expansions_title")} ({game.expansions.length})
              </h3>
              <ul className="mt-3 space-y-2">
                {game.expansions.map((exp) => (
                  <li key={exp.id}>
                    <a
                      href={`https://boardgamegeek.com/boardgameexpansion/${exp.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-stone-50"
                    >
                      <span className="text-stone-700">{exp.name}</span>
                      {exp.year > 0 && (
                        <span className="ml-2 text-xs text-stone-400">
                          {exp.year}
                        </span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function StatItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-stone-50 p-3">
      <span className="text-stone-400">{icon}</span>
      <div>
        <p className="text-xs text-stone-400">{label}</p>
        <p className="text-sm font-semibold text-stone-700">{value}</p>
      </div>
    </div>
  );
}
