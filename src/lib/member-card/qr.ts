import { encode } from "uqr";

export type QrMatrix = {
  /** Modules per side (no quiet zone). */
  size: number;
  /** `modules[row][col]` is true for a dark module. */
  modules: boolean[][];
};

/**
 * Encodes `text` as a QR module matrix (pure JS, runs on the server, in the browser and in Satori
 * renderers). Error correction M keeps the matrix small enough to scan from a phone screen.
 */
export function buildQrMatrix(text: string): QrMatrix {
  const { size, data } = encode(text, { ecc: "M", border: 0 });
  return { size, modules: data };
}

/**
 * SVG path (`M x y h1 v1 h-1 z` per dark module, merged per horizontal run) in module units.
 * Draw it in a viewBox of `size + 2 * quiet` with the path translated by `quiet`.
 */
export function qrToPath(matrix: QrMatrix, offset = 0): string {
  const parts: string[] = [];
  for (let y = 0; y < matrix.size; y++) {
    let x = 0;
    while (x < matrix.size) {
      if (!matrix.modules[y][x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < matrix.size && matrix.modules[y][x]) x++;
      parts.push(`M${start + offset} ${y + offset}h${x - start}v1h-${x - start}z`);
    }
  }
  return parts.join("");
}

/** Standalone SVG document (dark modules only, transparent background) with `quiet` modules of margin. */
export function qrToSvg(matrix: QrMatrix, quiet = 0, color = "#1C1917"): string {
  const dim = matrix.size + quiet * 2;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges">` +
    `<path fill="${color}" d="${qrToPath(matrix, quiet)}"/></svg>`
  );
}
