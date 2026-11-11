"use client";

import { useTranslations } from "next-intl";
import { MdChevronRight, MdHandshake, MdPrivacyTip } from "react-icons/md";
import { DOCUMENT_KEYS, type DocumentKey } from "@/lib/documents";
import DocumentLink from "./DocumentLink";
import { DOCUMENT_NAMESPACE } from "./DocumentBody";

const ICONS = { conduct: MdHandshake, "data-protection": MdPrivacyTip } as const satisfies Record<DocumentKey, unknown>;
const SUMMARY_KEY = {
  conduct: "conduct_summary",
  "data-protection": "data_protection_summary",
} as const satisfies Record<DocumentKey, string>;

/** One row per association document (icon, title, one-line summary); each opens its dialog. */
export default function DocumentList() {
  const t = useTranslations("documents");
  const tConduct = useTranslations(DOCUMENT_NAMESPACE.conduct);
  const tDataProtection = useTranslations(DOCUMENT_NAMESPACE["data-protection"]);
  const titles = { conduct: tConduct("title"), "data-protection": tDataProtection("title") };

  return (
    <ul className="flex flex-col gap-3">
      {DOCUMENT_KEYS.map((doc) => {
        const Icon = ICONS[doc];
        return (
          <li key={doc}>
            <DocumentLink
              doc={doc}
              className="group flex min-h-11 items-center gap-4 rounded-xl border border-stone-custom/10 px-4 py-3.5 transition-colors hover:bg-stone-custom/5"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-orange/10 text-brand-orange-text">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-stone-custom">{titles[doc]}</span>
                <span className="block text-sm text-stone-custom/65">{t(SUMMARY_KEY[doc])}</span>
              </span>
              <MdChevronRight
                aria-hidden="true"
                className="size-5 shrink-0 text-stone-custom/40 transition-transform group-hover:translate-x-0.5"
              />
            </DocumentLink>
          </li>
        );
      })}
    </ul>
  );
}
