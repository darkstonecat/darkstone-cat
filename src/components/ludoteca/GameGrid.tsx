"use client";

import { motion } from "motion/react";
import type { BggGame } from "@/lib/bgg";
import GameCard from "./GameCard";
import GameListRow from "./GameListRow";

interface GameGridProps {
  games: BggGame[];
  viewMode: "grid" | "list";
  onSelectGame: (game: BggGame) => void;
}

export default function GameGrid({ games, viewMode, onSelectGame }: GameGridProps) {
  if (viewMode === "list") {
    return (
      <div className="mt-4 flex flex-col gap-3">
        {games.map((game, i) => (
          <motion.div
            key={game.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.4) }}
          >
            <GameListRow game={game} onClick={() => onSelectGame(game)} />
          </motion.div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
      {games.map((game, i) => (
        <motion.div
          key={game.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.4) }}
        >
          <GameCard game={game} onClick={() => onSelectGame(game)} />
        </motion.div>
      ))}
    </div>
  );
}
