"use client";

import { useState, memo } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { MdGroup, MdSchedule, MdStar, MdChildCare } from "react-icons/md";
import type { BggGame } from "@/lib/bgg";

interface GameCardProps {
  game: BggGame;
  onClick: () => void;
  priority?: boolean;
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

const IMAGE_SIZES = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw";

function ProgressiveGameImage({ game, priority = false }: { game: BggGame; priority?: boolean }) {
  const [hiLoaded, setHiLoaded] = useState(false);
  const [hiVisible, setHiVisible] = useState(false);
  const alt = `${game.originalName ?? game.name} — board game cover`;
  const hasHiRes = !!game.image;

  return (
    <>
      {/* Low-res thumbnail — visible until high-res fade-in completes */}
      {!hiVisible && (
        <Image
          src={game.thumbnail}
          alt={alt}
          fill
          quality={60}
          className="object-cover transition-transform duration-300 group-hover:scale-110"
          sizes={IMAGE_SIZES}
          {...(priority && { priority: true, loading: "eager" as const })}
        />
      )}
      {/* High-res image — fades in over the thumbnail, then hides it */}
      {hasHiRes && (
        <Image
          src={game.image}
          alt={alt}
          fill
          quality={60}
          className={`object-cover transition duration-300 group-hover:scale-110 ${
            hiLoaded ? "opacity-100" : "opacity-0"
          }`}
          sizes={IMAGE_SIZES}
          onLoad={() => setHiLoaded(true)}
          onTransitionEnd={() => { if (hiLoaded) setHiVisible(true); }}
        />
      )}
    </>
  );
}

const GameCard = memo(function GameCard({ game, onClick, priority = false }: GameCardProps) {
  const t = useTranslations("ludoteca");

  const playersText =
    game.minPlayers === game.maxPlayers
      ? `${game.minPlayers}`
      : `${game.minPlayers}–${game.maxPlayers}`;

  return (
    <button
      onClick={onClick}
      className="group flex w-full flex-col overflow-hidden rounded-2xl border border-stone-200/50 bg-white text-left transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-md"
      aria-label={t("card_aria", { name: game.name })}
    >
      {/* Image — ~60% of card height, progressive: thumbnail → full image */}
      <div className="relative aspect-4/5 w-full overflow-hidden bg-stone-100">
        {game.thumbnail ? (
          <ProgressiveGameImage game={game} priority={priority} />
        ) : (
          <div className="flex h-full items-center justify-center text-stone-300">
            <MdStar className="h-12 w-12" />
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
        <p className="line-clamp-2 text-sm font-semibold leading-tight text-stone-800">
          {game.name}
        </p>

        <div className="mt-auto flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-600">
            {game.minPlayers > 0 && (
              <span className="flex items-center gap-1">
                <MdGroup className="h-3 w-3" aria-hidden="true" />
                <span className="sr-only">{t("detail_players")}:</span>
                {playersText}
              </span>
            )}
            {game.playingTime > 0 && (
              <span className="flex items-center gap-1">
                <MdSchedule className="h-3 w-3" aria-hidden="true" />
                <span className="sr-only">{t("detail_duration")}:</span>
                {game.playingTime}&prime;
              </span>
            )}
            {game.minAge > 0 && (
              <span className="flex items-center gap-1">
                <MdChildCare className="h-3 w-3" aria-hidden="true" />
                <span className="sr-only">{t("detail_age")}:</span>
                +{game.minAge}
              </span>
            )}
            {game.rating > 0 && (
              <span className="flex items-center gap-1">
                <MdStar className="h-3 w-3" aria-hidden="true" />
                <span className="sr-only">{t("detail_rating")}:</span>
                {game.rating.toFixed(1)}
              </span>
            )}
          </div>
          {game.weight > 0 && <WeightBar weight={game.weight} />}
        </div>
      </div>
    </button>
  );
});

export default GameCard;
