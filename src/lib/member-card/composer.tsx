// ---------------------------------------------------------------------------
// Member card PNG — landscape layout (same face as the /profile/card page), Satori via next/og.
// The QR encodes the public verify URL built from the member's card_token.
// ---------------------------------------------------------------------------

import { ImageResponse } from "next/og";
import { formatCalendarDate } from "@/lib/format-date";
import { buildQrMatrix, qrToSvg } from "./qr";
import { buildCardVerifyUrl } from "./verify-url";
import { getFontBelleza, getFontIntroBlackAlt } from "./assets";
import { LOGO_DATA_URI } from "./logo-data";

const CARD_W = 1011;
const CARD_H = 639;

const INK = "#1C1917";
const INK_MUTED = "rgba(28, 25, 23, 0.65)";
const ORANGE = "#A04500";
const BEIGE = "#EEE8DC";

export type MemberCardData = {
  fullName: string;
  memberNumber: string;
  /** `YYYY-MM-DD` (members.membership_start_date). */
  membershipStartDate: string | null;
  cardToken: string;
};

function nameFontSize(name: string): number {
  if (name.length > 26) return 38;
  if (name.length > 18) return 46;
  return 60;
}

export async function composeMemberCard({
  fullName,
  memberNumber,
  membershipStartDate,
  cardToken,
}: MemberCardData): Promise<ImageResponse> {
  const bellezaData = getFontBelleza();
  const introData = getFontIntroBlackAlt();

  const qr = buildQrMatrix(buildCardVerifyUrl(cardToken));
  const qrSrc = `data:image/svg+xml;utf8,${encodeURIComponent(qrToSvg(qr, 0))}`;
  const since = membershipStartDate ? formatCalendarDate(membershipStartDate, "ca") : null;

  const element = (
    <div
      style={{
        width: CARD_W,
        height: CARD_H,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 60,
        backgroundColor: BEIGE,
        color: INK,
        fontFamily: "Belleza",
      }}
    >
      {/* Brand row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center" }}>          <img src={LOGO_DATA_URI} alt="" width={90} height={90} style={{ marginRight: 20 }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: "IntroBlackAlt", fontSize: 36, lineHeight: 1.1 }}>
              Darkstone Catalunya
            </div>
            <div style={{ fontSize: 24, color: INK_MUTED, marginTop: 6 }}>
              Jocs de taula i rol · Terrassa
            </div>
          </div>
        </div>
        <div style={{ fontSize: 26, color: ORANGE, letterSpacing: "0.2em" }}>SOCI</div>
      </div>

      {/* Identity + QR */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, marginRight: 32 }}>
          <div
            style={{
              fontFamily: "IntroBlackAlt",
              fontSize: nameFontSize(fullName),
              lineHeight: 1.1,
            }}
          >
            {fullName}
          </div>
          <div style={{ fontSize: 40, color: ORANGE, marginTop: 14, letterSpacing: "0.04em" }}>
            {memberNumber}
          </div>
          {since && (
            <div style={{ fontSize: 24, color: INK_MUTED, marginTop: 10 }}>{`Membre des del ${since}`}</div>
          )}
        </div>
        <div
          style={{
            display: "flex",
            padding: 18,
            borderRadius: 22,
            backgroundColor: "#FFFFFF",
          }}
        >          <img src={qrSrc} alt="" width={236} height={236} />
        </div>
      </div>
    </div>
  );

  return new ImageResponse(element, {
    width: CARD_W,
    height: CARD_H,
    fonts: [
      { name: "Belleza", data: bellezaData, style: "normal", weight: 400 },
      { name: "IntroBlackAlt", data: introData, style: "normal", weight: 400 },
    ],
  });
}
