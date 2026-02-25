"use client";

import { motion } from "motion/react";
import type { BggGame } from "@/lib/bgg";
import GameCard from "./GameCard";

interface GameGridProps {
  games: BggGame[];
  onSelectGame: (game: BggGame) => void;
}

export default function GameGrid({ games, onSelectGame }: GameGridProps) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {games.map((game, i) => (
        <motion.div
          key={game.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.5) }}
        >
          <GameCard game={game} onClick={() => onSelectGame(game)} />
        </motion.div>
      ))}
    </div>
  );
}
