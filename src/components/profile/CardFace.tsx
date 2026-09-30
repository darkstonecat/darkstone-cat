import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { formatCalendarDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";

type CardFaceProps = {
  variant: "landscape" | "portrait";
  fullName: string;
  memberNumber: string;
  membershipStartDate: string | null;
  /** The QR tile (static on desktop, a button that opens the full-screen overlay on mobile). */
  qr: React.ReactNode;
  className?: string;
};

function Brand({ size }: { size: number }) {
  const t = useTranslations("profile.card");
  return (
    <div className="flex items-center gap-3">
      <Image
        src="/images/darkstone_logo_128px_bg.webp"
        alt=""
        width={size}
        height={size}
        quality={60}
        sizes={`${size}px`}
        className="shrink-0 rounded-full"
      />
      <div className="flex flex-col">
        <span className={cn("font-bold tracking-tight", size > 40 ? "text-lg" : "text-[15px]")}>{t("brand")}</span>
        <span className={cn("text-stone-custom/65", size > 40 ? "text-[13px]" : "text-xs")}>{t("tagline")}</span>
      </div>
    </div>
  );
}

/**
 * The member card as HTML (the PNG from `/api/members/card` is only for download).
 * Landscape = 540x340 desktop card, QR on the right; portrait = mobile card, QR centred on top.
 */
export default function CardFace({
  variant,
  fullName,
  memberNumber,
  membershipStartDate,
  qr,
  className,
}: CardFaceProps) {
  const t = useTranslations("profile");
  const tc = useTranslations("profile.card");
  const locale = useLocale();
  const since = membershipStartDate ? `${t("hero_since")} ${formatCalendarDate(membershipStartDate, locale)}` : null;

  if (variant === "portrait") {
    return (
      <div
        className={cn(
          "flex flex-col gap-[22px] rounded-3xl bg-brand-beige p-6 text-stone-custom shadow-[0_20px_40px_rgba(0,0,0,.4)]",
          className
        )}
      >
        <Brand size={40} />
        <div className="self-center">{qr}</div>
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-[26px] font-bold leading-tight tracking-tight">{fullName}</p>
          <p className="font-mono text-lg font-semibold text-brand-orange-text">{memberNumber}</p>
          {since && <p className="text-[13px] text-stone-custom/65">{since}</p>}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-[340px] w-[540px] max-w-full shrink-0 flex-col justify-between rounded-3xl bg-brand-beige p-8 text-stone-custom shadow-[0_28px_56px_rgba(0,0,0,.4)]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <Brand size={48} />
        <span className="text-xs font-bold tracking-[0.2em] text-brand-orange-text">{tc("badge")}</span>
      </div>
      <div className="flex items-end justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-[32px] font-bold leading-tight tracking-tight">{fullName}</p>
          <p className="font-mono text-xl font-semibold text-brand-orange-text">{memberNumber}</p>
          {since && <p className="text-[13px] text-stone-custom/65">{since}</p>}
        </div>
        {qr}
      </div>
    </div>
  );
}
