import { ImageResponse } from "next/og";

export const alt = "Darkstone Catalunya — Associació de jocs de taula i rol";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
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
          src="https://darkstone.cat/images/darkstone_logo.png"
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
          Associació de jocs de taula i rol · Terrassa
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
            Divendres 16–20:30h
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
            Dissabtes 10–13:30h
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
