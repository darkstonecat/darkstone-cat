"use client";

import { motion } from "motion/react";
import type { BggGame } from "@/lib/bgg";
import GameCard from "./GameCard";
import GameListRow from "./GameListRow";

const GRID_INITIAL = { opacity: 0, y: 16 } as const;
const LIST_INITIAL = { opacity: 0, y: 12 } as const;
const GRID_ANIMATE = { opacity: 1, y: 0 } as const;

function gridTransition(i: number) {
  return { duration: 0.25, delay: Math.min(i * 0.02, 0.4) };
}

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
            initial={LIST_INITIAL}
            animate={GRID_ANIMATE}
            transition={gridTransition(i)}
          >
            <GameListRow game={game} onClick={() => onSelectGame(game)} />
          </motion.div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-4 grid grid-cols-2 gap-4 min-[1200px]:grid-cols-3">
      {games.map((game, i) => (
        <motion.div
          key={game.id}
          initial={GRID_INITIAL}
          animate={GRID_ANIMATE}
          transition={gridTransition(i)}
        >
          <GameCard game={game} onClick={() => onSelectGame(game)} />
        </motion.div>
      ))}
    </div>
  );
}
