"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { Users, Clock, Star, Baby } from "lucide-react";
import type { BggGame } from "@/lib/bgg";

interface GameCardProps {
  game: BggGame;
  onClick: () => void;
}

function WeightBar({ weight }: { weight: number }) {
  const level = Math.round(weight);
  return (
    <div className="flex gap-0.5" aria-label={`${weight.toFixed(1)} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`h-1.5 w-3 rounded-sm ${
            i <= level ? "bg-brand-orange" : "bg-stone-200"
          }`}
        />
      ))}
    </div>
  );
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
      className="group flex w-full flex-col overflow-hidden rounded-2xl border border-stone-200/50 bg-white text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      aria-label={`${game.name} — ${t("card_aria")}`}
    >
      {/* Image — ~60% of card height */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-stone-100">
        {game.thumbnail ? (
          <Image
            src={game.thumbnail}
            alt={`${game.originalName ?? game.name} — board game cover`}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
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

      {/* Info — ~40% */}
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-stone-800">
          {game.name}
        </h3>

        <div className="mt-auto flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
            {game.minPlayers > 0 && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {playersText}
              </span>
            )}
            {game.playingTime > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {game.playingTime}&prime;
              </span>
            )}
            {game.minAge > 0 && (
              <span className="flex items-center gap-1">
                <Baby className="h-3 w-3" />
                +{game.minAge}
              </span>
            )}
            {game.rating > 0 && (
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3" />
                {game.rating.toFixed(1)}
              </span>
            )}
          </div>
          {game.weight > 0 && <WeightBar weight={game.weight} />}
        </div>
      </div>
    </motion.button>
  );
}
