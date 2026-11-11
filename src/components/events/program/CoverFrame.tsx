import Image from "next/image";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { MdOutlineCasino } from "react-icons/md";

interface CoverFrameProps {
  href: string;
  coverUrl: string | null;
  /** Shown on the dark strip at the bottom. */
  title?: string;
  time?: string | null;
  subtitle?: string | null;
  /** Pills and badges laid over the top of the cover. */
  top?: ReactNode;
  sizes: string;
}

/**
 * The cover every program card shares: the image (or the dice placeholder),
 * an optional slot on top and the dark strip with time, title and subtitle.
 * It links to Ludoya but stays out of the tab order: the button or caption
 * next to it is the keyboard target.
 */
export default function CoverFrame({ href, coverUrl, title, time, subtitle, top, sizes }: CoverFrameProps) {
  const t = useTranslations("events.program");
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      tabIndex={-1}
      data-item-cover
      className="group relative block aspect-[3/4] overflow-hidden rounded-[14px] bg-stone-custom"
    >
      {coverUrl ? (
        <Image
          src={coverUrl}
          alt=""
          fill
          quality={60}
          sizes={sizes}
          className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
        />
      ) : (
        <span
          data-cover-placeholder
          aria-hidden="true"
          className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-stone-white-base/50"
        >
          <MdOutlineCasino size={40} />
          <span className="text-[11px] font-bold">{t("cover_none")}</span>
        </span>
      )}
      {top && <div className="absolute top-2 right-2 left-2 flex flex-col items-start gap-1.5">{top}</div>}
      {title && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-[3px] bg-[rgba(28,25,23,0.8)] p-2.5 text-stone-white-hover">
          {time && <span className="text-[11px] font-bold text-brand-orange-light">{time}</span>}
          <span className="line-clamp-2 text-sm leading-tight font-extrabold">{title}</span>
          {subtitle && <span className="line-clamp-1 text-[11px] leading-tight text-stone-white-base">{subtitle}</span>}
        </div>
      )}
    </a>
  );
}
