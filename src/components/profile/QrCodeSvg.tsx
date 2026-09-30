import type { QrMatrix } from "@/lib/member-card/qr";
import { qrToPath } from "@/lib/member-card/qr";

type QrCodeSvgProps = {
  matrix: QrMatrix;
  /** Quiet-zone modules drawn inside the SVG (the tile around it adds more). */
  quiet?: number;
  /** Text alternative (e.g. "Codi QR del soci 000-042"). */
  label: string;
  className?: string;
};

/** Real QR as inline SVG: dark modules (`stone-custom`) on a transparent background, sized by `className`. */
export default function QrCodeSvg({ matrix, quiet = 2, label, className }: QrCodeSvgProps) {
  const dim = matrix.size + quiet * 2;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${dim} ${dim}`}
      shapeRendering="crispEdges"
      className={className}
    >
      <path className="fill-stone-custom" d={qrToPath(matrix, quiet)} />
    </svg>
  );
}
