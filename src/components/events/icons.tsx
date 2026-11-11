import { cn } from "@/lib/utils";

/**
 * Inline icons of /events, drawn in `currentColor` and decorative (`aria-hidden`):
 * the link text, plus an `sr-only` note, names the action.
 * Material Symbols Outlined (weight 400, fill 0, grade 0, optical size 24) and the
 * Ludoya mark of `public/images/icons/ludoya.svg`.
 * Default size is 1em, aligned with the text, so they also fit inside running text.
 */
type IconProps = { className?: string };

const BASE = "inline-block size-[1em] shrink-0 align-[-0.125em]";

function MaterialSymbol({ name, d, className }: IconProps & { name: string; d: string }) {
  return (
    <svg aria-hidden="true" focusable="false" data-icon={name} viewBox="0 -960 960 960" fill="currentColor" className={cn(BASE, className)}>
      <path d={d} />
    </svg>
  );
}

/** `arrow_outward`: a link that opens another site in a new tab. */
export function ArrowOutwardIcon({ className }: IconProps) {
  return <MaterialSymbol name="arrow_outward" className={className} d="m256-240-56-56 384-384H240v-80h480v480h-80v-344L256-240Z" />;
}

/** `app_registration`: sign up for an item (join, queue, tournament, tickets). */
export function RegisterIcon({ className }: IconProps) {
  return (
    <MaterialSymbol
      name="app_registration"
      className={className}
      d="M183.5-183.5Q160-207 160-240t23.5-56.5Q207-320 240-320t56.5 23.5Q320-273 320-240t-23.5 56.5Q273-160 240-160t-56.5-23.5Zm0-240Q160-447 160-480t23.5-56.5Q207-560 240-560t56.5 23.5Q320-513 320-480t-23.5 56.5Q273-400 240-400t-56.5-23.5Zm0-240Q160-687 160-720t23.5-56.5Q207-800 240-800t56.5 23.5Q320-753 320-720t-23.5 56.5Q273-640 240-640t-56.5-23.5Zm240 0Q400-687 400-720t23.5-56.5Q447-800 480-800t56.5 23.5Q560-753 560-720t-23.5 56.5Q513-640 480-640t-56.5-23.5Zm240 0Q640-687 640-720t23.5-56.5Q687-800 720-800t56.5 23.5Q800-753 800-720t-23.5 56.5Q753-640 720-640t-56.5-23.5Zm-240 240Q400-447 400-480t23.5-56.5Q447-560 480-560t56.5 23.5Q560-513 560-480t-23.5 56.5Q513-400 480-400t-56.5-23.5ZM520-160v-123l221-220q9-9 20-13t22-4q12 0 23 4.5t20 13.5l37 37q8 9 12.5 20t4.5 22q0 11-4 22.5T863-380L643-160H520Zm300-263-37-37 37 37ZM580-220h38l121-122-18-19-19-18-122 121v38Zm141-141-19-18 37 37-18-19Z"
    />
  );
}

/** `chat_info`: more information about an item. */
export function InfoIcon({ className }: IconProps) {
  return (
    <MaterialSymbol
      name="chat_info"
      className={className}
      d="M480-680q17 0 28.5-11.5T520-720q0-17-11.5-28.5T480-760q-17 0-28.5 11.5T440-720q0 17 11.5 28.5T480-680Zm-40 320h80v-240h-80v240ZM80-80v-720q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H240L80-80Zm126-240h594v-480H160v525l46-45Zm-46 0v-480 480Z"
    />
  );
}

/** The Ludoya mark: a link that opens Ludoya itself. */
export function LudoyaIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-icon="ludoya"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      className={cn(BASE, className)}
    >
      <rect width="20" height="20" x="2" y="2" rx="4" />
      <path d="M12 2v20M2 12h20M6 6v12h12" />
      <g fill="currentColor" stroke="none">
        <circle cx="6" cy="6" r="2" />
        <circle cx="6" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
        <circle cx="18" cy="6" r="2" />
      </g>
    </svg>
  );
}
