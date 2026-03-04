"use client";

import * as m from "motion/react-client";
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
  const shouldAnimate = games.length <= 48;

  if (viewMode === "list") {
    return (
      <div className="mt-4 flex flex-col gap-3">
        {games.map((game, i) => (
          <m.div
            key={game.id}
            initial={shouldAnimate ? LIST_INITIAL : false}
            animate={GRID_ANIMATE}
            transition={shouldAnimate ? gridTransition(i) : undefined}
          >
            <GameListRow game={game} onClick={() => onSelectGame(game)} />
          </m.div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-4 grid grid-cols-2 gap-4 min-[1200px]:grid-cols-3">
      {games.map((game, i) => (
        <m.div
          key={game.id}
          initial={shouldAnimate ? GRID_INITIAL : false}
          animate={GRID_ANIMATE}
          transition={shouldAnimate ? gridTransition(i) : undefined}
        >
          <GameCard game={game} onClick={() => onSelectGame(game)} />
        </m.div>
      ))}
    </div>
  );
}
