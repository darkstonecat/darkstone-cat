// ---------------------------------------------------------------------------
// Member card — JSX composition with Satori (via next/og)
// ---------------------------------------------------------------------------

import { ImageResponse } from "next/og";
import { getFontBelleza, getFontIntroBlackAlt, getBackground } from "./assets";

const CARD_W = 1011;
const CARD_H = 639;

export async function composeMemberCard(
  fullName: string,
  memberNumber: string
): Promise<ImageResponse> {
  const bellezaData = getFontBelleza();
  const introData = getFontIntroBlackAlt();
  const bg = getBackground();

  const element = (
    <div
      style={{
        width: CARD_W,
        height: CARD_H,
        position: "relative",
        display: "flex",
      }}
    >
      {/* Background */}
      <img
        src={bg}
        alt=""
        width={CARD_W}
        height={CARD_H}
        style={{ position: "absolute", top: 0, left: 0 }}
      />

      {/* Member name — centered, upper area */}
      <div
        style={{
          position: "absolute",
          top: 340,
          left: 0,
          width: CARD_W,
          display: "flex",
          justifyContent: "center",
          fontFamily: "IntroBlackAlt",
          fontSize: 52,
          color: "#EEE8DC",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {fullName}
      </div>

      {/* Member number — centered, below name */}
      <div
        style={{
          position: "absolute",
          top: 420,
          left: 0,
          width: CARD_W,
          display: "flex",
          justifyContent: "center",
          fontFamily: "Belleza",
          fontSize: 30,
          color: "#EEE8DC",
          letterSpacing: "0.1em",
        }}
      >
        {memberNumber}
      </div>
    </div>
  );

  return new ImageResponse(element, {
    width: CARD_W,
    height: CARD_H,
    fonts: [
      {
        name: "Belleza",
        data: bellezaData,
        style: "normal",
        weight: 400,
      },
      {
        name: "IntroBlackAlt",
        data: introData,
        style: "normal",
        weight: 400,
      },
    ],
  });
}
