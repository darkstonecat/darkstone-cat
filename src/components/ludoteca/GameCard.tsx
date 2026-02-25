"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { Users, Clock, Star } from "lucide-react";
import type { BggGame } from "@/lib/bgg";

interface GameCardProps {
  game: BggGame;
  onClick: () => void;
}

export default function GameCard({ game, onClick }: GameCardProps) {
  const t = useTranslations("ludoteca");

  const playersText =
    game.minPlayers === game.maxPlayers
      ? `${game.minPlayers}`
      : `${game.minPlayers}–${game.maxPlayers}`;

  return (
    <motion.button
      onClick={onClick}
      className="group flex w-full flex-col overflow-hidden rounded-xl bg-white text-left shadow-sm transition-shadow hover:shadow-md"
      whileHover={{ scale: 1.03 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      aria-label={`${game.name} — ${t("card_aria")}`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-square w-full overflow-hidden bg-stone-100">
        {game.thumbnail ? (
          <Image
            src={game.thumbnail}
            alt={`${game.originalName ?? game.name} — board game cover`}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-stone-300">
            <Star className="h-12 w-12" />
          </div>
        )}

        {/* Expansion badge */}
        {game.expansions.length > 0 && (
          <span className="absolute right-2 top-2 rounded-full bg-stone-custom/90 px-2 py-0.5 text-xs font-semibold text-brand-white">
            +{game.expansions.length}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-stone-800">
          {game.name}
        </h3>

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
          {game.minPlayers > 0 && (
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {playersText}
            </span>
          )}
          {game.playingTime > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {game.playingTime}&prime;
            </span>
          )}
          {game.rating > 0 && (
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5" />
              {game.rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
}
