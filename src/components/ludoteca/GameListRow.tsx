"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Users, Clock, Star, Baby } from "lucide-react";
import type { BggGame } from "@/lib/bgg";

interface GameListRowProps {
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

export default function GameListRow({ game, onClick }: GameListRowProps) {
  const t = useTranslations("ludoteca");

  const playersText =
    game.minPlayers === game.maxPlayers
      ? `${game.minPlayers}`
      : `${game.minPlayers}–${game.maxPlayers}`;

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-xl bg-white p-3 text-left shadow-sm transition-shadow hover:shadow-md"
      aria-label={`${game.name} — ${t("card_aria")}`}
    >
      {/* Thumbnail */}
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-stone-100">
        {game.thumbnail ? (
          <Image
            src={game.thumbnail}
            alt={`${game.originalName ?? game.name} — board game cover`}
            fill
            className="object-cover"
            sizes="80px"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-stone-300">
            <Star className="h-8 w-8" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-sm font-semibold text-stone-800">
            {game.name}
          </h3>
          {game.expansions.length > 0 && (
            <span className="shrink-0 rounded-full bg-stone-custom/90 px-2 py-0.5 text-xs font-semibold text-brand-white">
              +{game.expansions.length}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
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
          {game.weight > 0 && <WeightBar weight={game.weight} />}
        </div>
      </div>
    </button>
  );
}
