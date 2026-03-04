import { ImageResponse } from "next/og";

const OG_STRINGS: Record<string, { alt: string; subtitle: string; friday: string; saturday: string }> = {
  ca: {
    alt: "Darkstone Catalunya — Associacio de jocs de taula i rol",
    subtitle: "Associacio de jocs de taula i rol · Terrassa",
    friday: "Divendres 16–20:30h",
    saturday: "Dissabtes 10–13:30h",
  },
  es: {
    alt: "Darkstone Catalunya — Asociacion de juegos de mesa y rol",
    subtitle: "Asociacion de juegos de mesa y rol · Terrassa",
    friday: "Viernes 16–20:30h",
    saturday: "Sabados 10–13:30h",
  },
  en: {
    alt: "Darkstone Catalunya — Board games & RPG association",
    subtitle: "Board games & RPG association · Terrassa",
    friday: "Fridays 4–8:30 PM",
    saturday: "Saturdays 10 AM–1:30 PM",
  },
};

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export async function generateImageMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const strings = OG_STRINGS[locale] ?? OG_STRINGS.ca;
  return [{ id: "og", alt: strings.alt, size, contentType }];
}

export default async function OgImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const strings = OG_STRINGS[locale] ?? OG_STRINGS.ca;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1C1917",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Top accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background: "linear-gradient(to right, #A61A1A, #C05600)",
          }}
        />

        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://darkstone.cat/images/darkstone_logo_768px.webp"
          alt=""
          width={180}
          height={180}
          style={{ marginBottom: 32 }}
        />

        {/* Title */}
        <div
          style={{
            fontSize: 52,
            fontWeight: 700,
            color: "#EEE8DC",
            letterSpacing: "-0.02em",
          }}
        >
          Darkstone Catalunya
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 26,
            color: "#D6D3D1",
            marginTop: 16,
          }}
        >
          {strings.subtitle}
        </div>

        {/* Schedule badge */}
        <div
          style={{
            display: "flex",
            gap: 24,
            marginTop: 40,
            fontSize: 18,
            color: "#D6D3D1",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "8px 20px",
              borderRadius: 8,
              border: "1px solid #C05600",
            }}
          >
            {strings.friday}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "8px 20px",
              borderRadius: 8,
              border: "1px solid #C05600",
            }}
          >
            {strings.saturday}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
