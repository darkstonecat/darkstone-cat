"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { MdClose, MdGroup, MdSchedule, MdStar, MdPsychology, MdPerson } from "react-icons/md";
import { useLenis } from "@/components/SmoothScroll";
import type { BggGame } from "@/lib/bgg";

interface GameDetailModalProps {
  game: BggGame;
  allGames: Map<string, BggGame>;
  onClose: () => void;
}

export default function GameDetailModal({
  game: initialGame,
  allGames,
  onClose,
}: GameDetailModalProps) {
  const t = useTranslations("ludoteca");
  const lenis = useLenis();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [game, setGame] = useState(initialGame);

  const baseGame = useMemo(() => {
    if (game.subtype !== "boardgameexpansion") return null;
    for (const g of allGames.values()) {
      if (g.expansions.some((exp) => exp.id === game.id)) return g;
    }
    return null;
  }, [game, allGames]);

  const navigateTo = useCallback((gameId: string) => {
    const target = allGames.get(gameId);
    if (!target) return;
    setGame(target);
    dialogRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [allGames]);

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
      aria-describedby="game-modal-desc"
    >
      <motion.div
        ref={dialogRef}
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
        data-lenis-prevent
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
          <MdClose className="h-5 w-5" />
        </button>

        {/* Image */}
        {game.image && (
          <div className="relative aspect-16/10 w-full overflow-hidden bg-stone-100">
            <Image
              src={game.image}
              alt={`${game.originalName ?? game.name} — board game cover`}
              fill
              className="object-contain mt-4 "
              sizes="(max-width: 672px) 100vw, 672px"
              priority
              quality={60}
            />
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
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
              <p id="game-modal-desc" className="sr-only">
                {t("detail_players")}: {game.minPlayers}–{game.maxPlayers}, {t("detail_time")}: {game.playingTime}min
              </p>
            </div>
            <a
              href={bggUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-xl bg-stone-800 px-4 py-1.5 transition-colors hover:bg-stone-700"
              aria-label={t("detail_bgg_link")}
            >
              <Image
                src="/images/icons/bgg_logo.svg"
                alt="BoardGameGeek"
                width={86}
                height={45}
                className="h-10 w-auto"
              />
            </a>
          </div>

          {/* Stats grid */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {game.minPlayers > 0 && (
              <StatItem
                icon={<MdGroup className="h-4 w-4" />}
                label={t("detail_players")}
                value={playersText}
              />
            )}
            {game.playingTime > 0 && (
              <StatItem
                icon={<MdSchedule className="h-4 w-4" />}
                label={t("detail_duration")}
                value={`${game.playingTime} min`}
              />
            )}
            {game.rating > 0 && (
              <StatItem
                icon={<MdStar className="h-4 w-4" />}
                label={t("detail_rating")}
                value={game.rating.toFixed(1)}
              />
            )}
            {game.weight > 0 && (
              <StatItem
                icon={<MdPsychology className="h-4 w-4" />}
                label={t("detail_weight")}
                value={`${game.weight.toFixed(1)} / 5`}
              />
            )}
            {game.minAge > 0 && (
              <StatItem
                icon={<MdPerson className="h-4 w-4" />}
                label={t("detail_age")}
                value={`${game.minAge}+`}
              />
            )}
          </div>

          {/* Rank types, Categories & Mechanics */}
          {(game.rankTypes.length > 0 || baseGame?.rankTypes.length) && (
            <div className="mt-5">
              <h3 className="text-xs font-semibold text-stone-400">{t("detail_rank_types")}</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(game.rankTypes.length > 0 ? game.rankTypes : baseGame?.rankTypes ?? []).map((rank) => (
                  <span key={rank} className="rounded-full bg-brand-orange/10 px-3 py-1 text-xs font-medium text-brand-orange">{t(`filter_rank_${rank}`)}</span>
                ))}
              </div>
            </div>
          )}
          {game.categories.length > 0 && (
            <div className="mt-5">
              <h3 className="text-xs font-semibold text-stone-400">{t("detail_categories")}</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {game.categories.map((cat) => (
                  <span key={cat} className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">{cat}</span>
                ))}
              </div>
            </div>
          )}
          {game.mechanics.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold text-stone-400">{t("detail_mechanics")}</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {game.mechanics.map((mec) => (
                  <span key={mec} className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">{mec}</span>
                ))}
              </div>
            </div>
          )}

          {/* Base game */}
          {baseGame && (
            <div className="mt-6 border-t border-stone-200 pt-5">
              <h3 className="text-sm font-semibold text-stone-700">
                {t("base_game_title")}
              </h3>
              <div className="mt-3">
                <button
                  onClick={() => navigateTo(baseGame.id)}
                  aria-label={`${t("base_game_title")}: ${baseGame.name}`}
                  className="group flex w-full items-center gap-3 overflow-hidden rounded-xl bg-stone-100 text-left transition-transform duration-300 hover:scale-[1.02]"
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden bg-stone-100">
                    {baseGame.thumbnail ? (
                      <Image
                        src={baseGame.thumbnail}
                        alt={baseGame.name}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-110"
                        sizes="56px"
                        quality={60}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-stone-300">
                        <MdStar className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <span className="line-clamp-1 text-sm text-stone-700">
                    {baseGame.name}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Expansions */}
          {game.expansions.length > 0 && (
            <div className="mt-6 border-t border-stone-200 pt-5">
              <h3 className="text-sm font-semibold text-stone-700">
                {t("expansions_title")} ({game.expansions.length})
              </h3>
              <ul className="mt-3 space-y-2">
                {game.expansions.map((exp) => (
                  <li key={exp.id}>
                    <button
                      onClick={() => navigateTo(exp.id)}
                      aria-label={`${t("expansions_title")}: ${exp.name}`}
                      className="group flex w-full items-center gap-3 overflow-hidden rounded-xl bg-stone-100 text-left transition-transform duration-300 hover:scale-[1.02]"
                    >
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden bg-stone-100">
                        {exp.thumbnail ? (
                          <Image
                            src={exp.thumbnail}
                            alt={exp.name}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-110"
                            sizes="56px"
                            quality={60}
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-stone-300">
                            <MdStar className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                      <span className="line-clamp-1 text-sm text-stone-700">
                        {exp.name}
                      </span>
                    </button>
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
      <span className="text-stone-500">{icon}</span>
      <div>
        <p className="text-xs text-stone-500">{label}</p>
        <p className="text-sm font-semibold text-stone-700">{value}</p>
      </div>
    </div>
  );
}
