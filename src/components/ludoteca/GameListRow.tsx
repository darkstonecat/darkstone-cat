"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { MdGroup, MdSchedule, MdStar, MdChildCare } from "react-icons/md";
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
      className="group flex w-full items-stretch gap-4 overflow-hidden rounded-2xl border border-stone-200/50 bg-white pr-3 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-md"
      aria-label={t("card_aria", { name: game.name })}
    >
      {/* Thumbnail */}
      <div className="relative aspect-square w-20 shrink-0 overflow-hidden bg-stone-100">
        {game.thumbnail ? (
          <Image
            src={game.thumbnail}
            alt={`${game.originalName ?? game.name} — board game cover`}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-115"
            sizes="80px"
            quality={60}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-stone-300">
            <MdStar className="h-8 w-8" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-3">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-1 text-sm font-semibold text-stone-800">
            {game.name}
          </p>
          {game.expansions.length > 0 && (
            <span className="shrink-0 rounded-full bg-stone-custom/90 px-2 py-0.5 text-xs font-semibold text-brand-white">
              +{game.expansions.length}
            </span>
          )}
        </div>

        <div className="flex items-center text-xs text-stone-500">
          <span className="flex w-14 items-center gap-1">
            <MdGroup className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="sr-only">{t("detail_players")}:</span>
            {game.minPlayers > 0 ? playersText : "–"}
          </span>
          <span className="flex w-14 items-center gap-1">
            <MdSchedule className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="sr-only">{t("detail_duration")}:</span>
            {game.playingTime > 0 ? <>{game.playingTime}&prime;</> : "–"}
          </span>
          <span className="flex w-12 items-center gap-1">
            <MdChildCare className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="sr-only">{t("detail_age")}:</span>
            {game.minAge > 0 ? `+${game.minAge}` : "–"}
          </span>
          <span className="flex w-12 items-center gap-1">
            <MdStar className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="sr-only">{t("detail_rating")}:</span>
            {game.rating > 0 ? game.rating.toFixed(1) : "–"}
          </span>
          {game.weight > 0 && <WeightBar weight={game.weight} />}
        </div>
      </div>
    </button>
  );
}
