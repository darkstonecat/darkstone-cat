// ---------------------------------------------------------------------------
// Event image — JSX composition with Satori (via next/og)
// ---------------------------------------------------------------------------

import { ImageResponse } from "next/og";
import type { ResolvedGame } from "../game-matching";
import type { FrameColor } from "../game-matching";
import { getFont, getImageAssets, loadRemoteImageAsDataUri, type ImageAssets } from "./assets";
import { formatEventDate, formatEventTime } from "./text";
import { getLayout } from "./layouts";
import type { LudoyaEvent } from "../ludoya";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CANVAS_SIZE = 1080;

// Frame base dimensions
const POLAROID_W = 300;
const POLAROID_H = 349;
const RPG_W = 300;
const RPG_H = 327;

// Inset areas (where game cover goes inside the frame)
const POLAROID_INSET = { x: 14, y: 14, w: 272, h: 256 };
const RPG_INSET = { x: 32, y: 22, w: 236, h: 261 };

// Icon base size
const ICON_SIZE = 64;

// Icon actual pixel dimensions (measured from PNGs)
const ICON_DIMENSIONS = {
  boardgame: { w: 113, h: 92 },
  rpg: { w: 105, h: 159 },
} as const;

// Icon position offsets (relative to frame center, cycled per game)
const ICON_OFFSETS = [
  { dx: -0.3, dy: 0.38 }, // bottom-left
  { dx: 0.0, dy: 0.4 }, // bottom-center
  { dx: 0.3, dy: 0.38 }, // bottom-right
];

// Text color
const DATE_COLOR = "#EEE8DC";

// Radians to degrees
const RAD_TO_DEG = 180 / Math.PI;

// ---------------------------------------------------------------------------
// Frame helpers
// ---------------------------------------------------------------------------

function getFrameDimensions(frame: FrameColor) {
  const isRpg = frame === "rpg";
  return {
    baseW: isRpg ? RPG_W : POLAROID_W,
    baseH: isRpg ? RPG_H : POLAROID_H,
    inset: isRpg ? RPG_INSET : POLAROID_INSET,
  };
}

function getFrameSrc(
  frame: FrameColor,
  assets: ImageAssets
): string {
  switch (frame) {
    case "green":
      return assets.frameGreen;
    case "orange":
      return assets.frameOrange;
    case "red":
      return assets.frameRed;
    case "rpg":
      return assets.frameRpg;
  }
}

// ---------------------------------------------------------------------------
// Icon size calculation (matches original canvas logic)
// ---------------------------------------------------------------------------

function getIconSize(
  game: ResolvedGame,
  scale: number
): { w: number; h: number } | null {
  if (game.type === "unknown") return null;

  const isRpg = game.frame === "rpg";
  const dims = isRpg ? ICON_DIMENSIONS.rpg : ICON_DIMENSIONS.boardgame;
  const dynamicIconSize = ICON_SIZE * scale;
  const iconScale = dynamicIconSize / Math.max(dims.w, dims.h);

  return {
    w: dims.w * iconScale,
    h: dims.h * iconScale,
  };
}

// ---------------------------------------------------------------------------
// Main composition
// ---------------------------------------------------------------------------

export async function composeEventImage(
  event: LudoyaEvent,
  resolvedGames: ResolvedGame[]
): Promise<ImageResponse> {
  const assets = getImageAssets();
  const fontData = getFont();

  // Load all game cover images in parallel as base64
  const gameImages = await Promise.all(
    resolvedGames.map((g) => loadRemoteImageAsDataUri(g.imageUrl))
  );

  // Date/time text
  const tz = event.timeZone || "Europe/Madrid";
  const dateStr = formatEventDate(event.startsAt, tz);
  const timeStr = formatEventTime(event.startsAt, event.endsAt, tz);

  // Layout for this number of games
  const layout = getLayout(resolvedGames.length);

  const element = (
    <div
      style={{
        width: CANVAS_SIZE,
        height: CANVAS_SIZE,
        position: "relative",
        display: "flex",
      }}
    >
      {/* Layer 1: Placeholder background */}
      <img
        alt=""
        src={assets.placeholder}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        style={{ position: "absolute", top: 0, left: 0 }}
      />

      {/* Layer 2: Date text */}
      <div
        style={{
          position: "absolute",
          top: 26,
          left: 44,
          fontFamily: "GloriaHallelujah",
          fontSize: 70,
          color: DATE_COLOR,
        }}
      >
        {dateStr}
      </div>

      {/* Layer 2b: Time text */}
      <div
        style={{
          position: "absolute",
          top: 125,
          left: 130,
          fontFamily: "GloriaHallelujah",
          fontSize: 40,
          color: DATE_COLOR,
        }}
      >
        {timeStr}
      </div>

      {/* Layer 3: Rotated frames with game covers */}
      {resolvedGames.map((game, i) => {
        const slot = layout[i];
        const { baseW, baseH, inset } = getFrameDimensions(game.frame);
        const scaledW = baseW * slot.scale;
        const scaledH = baseH * slot.scale;
        const frameSrc = getFrameSrc(game.frame, assets);
        const gameImage = gameImages[i];
        const rotDeg = slot.rotation * RAD_TO_DEG;

        return (
          <div
            key={`frame-${i}`}
            style={{
              position: "absolute",
              left: slot.x - scaledW / 2,
              top: slot.y - scaledH / 2,
              width: scaledW,
              height: scaledH,
              transform: `rotate(${rotDeg}deg)`,
              transformOrigin: "center center",
              display: "flex",
            }}
          >
            {/* Frame PNG (behind — black opaque center) */}
            <img
              alt=""
              src={frameSrc}
              width={scaledW}
              height={scaledH}
              style={{ position: "absolute", top: 0, left: 0 }}
            />

            {/* Game cover image (on top — covers the black inset area) */}
            {gameImage && (
              <div
                style={{
                  position: "absolute",
                  left: inset.x * slot.scale,
                  top: inset.y * slot.scale,
                  width: inset.w * slot.scale,
                  height: inset.h * slot.scale,
                  overflow: "hidden",
                  display: "flex",
                }}
              >
                <img
                  alt=""
                  src={gameImage}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              </div>
            )}
          </div>
        );
      })}

      {/* Layer 4: Icons (NOT rotated, positioned relative to frame center) */}
      {resolvedGames.map((game, i) => {
        const iconSize = getIconSize(game, layout[i].scale);
        if (!iconSize) return null;

        const slot = layout[i];
        const { baseW, baseH } = getFrameDimensions(game.frame);
        const scaledW = baseW * slot.scale;
        const scaledH = baseH * slot.scale;
        const offset = ICON_OFFSETS[i % ICON_OFFSETS.length];

        const iconX = slot.x + offset.dx * scaledW - iconSize.w / 2;
        const iconY = slot.y + offset.dy * scaledH - iconSize.h / 2;

        const isRpg = game.frame === "rpg";
        const iconSrc = isRpg ? assets.iconRpg : assets.iconBoardgame;

        return (
          <img
            alt=""
            key={`icon-${i}`}
            src={iconSrc}
            width={iconSize.w}
            height={iconSize.h}
            style={{
              position: "absolute",
              left: iconX,
              top: iconY,
            }}
          />
        );
      })}
    </div>
  );

  return new ImageResponse(element, {
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    fonts: [
      {
        name: "GloriaHallelujah",
        data: fontData,
        style: "normal",
        weight: 400,
      },
    ],
  });
}
