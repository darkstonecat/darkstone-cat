// ---------------------------------------------------------------------------
// Event image — Asset loading (fonts as ArrayBuffer, images as base64 data URI)
// ---------------------------------------------------------------------------
// Assets are embedded as base64 in asset-data.ts to avoid filesystem access,
// which is unreliable in Vercel serverless functions.
// ---------------------------------------------------------------------------

import {
  FONT_GLORIA_HALLELUJAH_BASE64,
  PLACEHOLDER_DATA_URI,
  FRAME_GREEN_DATA_URI,
  FRAME_ORANGE_DATA_URI,
  FRAME_RED_DATA_URI,
  FRAME_RPG_DATA_URI,
  ICON_BOARDGAME_DATA_URI,
  ICON_RPG_DATA_URI,
} from "./asset-data";

// ---------------------------------------------------------------------------
// Font loading (ArrayBuffer for Satori)
// ---------------------------------------------------------------------------

let cachedFont: ArrayBuffer | null = null;

export function getFont(): ArrayBuffer {
  if (cachedFont) return cachedFont;
  const binary = atob(FONT_GLORIA_HALLELUJAH_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  cachedFont = bytes.buffer;
  return cachedFont;
}

// ---------------------------------------------------------------------------
// Local image assets (already base64 data URIs from embedded data)
// ---------------------------------------------------------------------------

export interface ImageAssets {
  placeholder: string;
  frameGreen: string;
  frameOrange: string;
  frameRed: string;
  frameRpg: string;
  iconBoardgame: string;
  iconRpg: string;
}

const imageAssets: ImageAssets = {
  placeholder: PLACEHOLDER_DATA_URI,
  frameGreen: FRAME_GREEN_DATA_URI,
  frameOrange: FRAME_ORANGE_DATA_URI,
  frameRed: FRAME_RED_DATA_URI,
  frameRpg: FRAME_RPG_DATA_URI,
  iconBoardgame: ICON_BOARDGAME_DATA_URI,
  iconRpg: ICON_RPG_DATA_URI,
};

export function getImageAssets(): ImageAssets {
  return imageAssets;
}

// ---------------------------------------------------------------------------
// Remote image loading as base64 data URI (BGG and Ludoya game covers)
// ---------------------------------------------------------------------------

/** Detect the image format from its first bytes. */
function sniffImageType(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (buffer.length >= 6 && buffer.subarray(0, 4).toString("ascii") === "GIF8") return "image/gif";
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export async function loadRemoteImageAsDataUri(
  url: string
): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    // Ludoya's object storage serves images as application/octet-stream,
    // which Satori rejects. Trust the header only when it names an image.
    const header = res.headers.get("content-type")?.split(";")[0].trim();
    const contentType = header?.startsWith("image/") ? header : sniffImageType(buffer);
    if (!contentType) {
      console.warn("[EventImage] Unrecognised image format:", url, header);
      return null;
    }
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    console.warn("[EventImage] Failed to load remote image:", url);
    return null;
  }
}
