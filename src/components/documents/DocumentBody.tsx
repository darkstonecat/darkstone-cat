"use client";

import { useTranslations } from "next-intl";
import type { DocumentKey } from "@/lib/documents";

const PROTOCOL_URL =
  "https://drive.google.com/file/d/1U2EmCWP29o__MMTpdcJb7e2OaEqzVCc2/view?usp=sharing";

type Section = { titleKey: string; paragraphs: readonly string[] };

const CONDUCT_SECTIONS: readonly Section[] = [
  {
    titleKey: "safe_space_title",
    paragraphs: ["safe_space_text", "safe_space_harassment", "safe_space_safety", "safe_space_protocol"],
  },
  { titleKey: "catalan_title", paragraphs: ["catalan_text"] },
  {
    titleKey: "communication_title",
    paragraphs: [
      "communication_respectful",
      "communication_patient",
      "communication_understand",
      "communication_concise",
      "communication_topics",
    ],
  },
  { titleKey: "collaboration_title", paragraphs: ["collaboration_text"] },
  { titleKey: "open_tables_title", paragraphs: ["open_tables_text"] },
];

const DATA_PROTECTION_SECTIONS: readonly Section[] = [
  { titleKey: "user_info_title", paragraphs: ["user_info_p1", "user_info_p2", "user_info_p3"] },
  { titleKey: "contact_title", paragraphs: ["contact_name", "contact_email"] },
  {
    titleKey: "principles_title",
    paragraphs: [
      "principles_intro",
      "principles_legality",
      "principles_minimization",
      "principles_purpose",
      "principles_security",
      "principles_access",
      "principles_retention",
      "principles_marketing",
    ],
  },
  { titleKey: "data_collection_title", paragraphs: ["data_collection_p1", "data_collection_p2"] },
  { titleKey: "legitimacy_title", paragraphs: ["legitimacy_p1", "legitimacy_consent", "legitimacy_legal"] },
  { titleKey: "data_sharing_title", paragraphs: ["data_sharing_text"] },
  {
    titleKey: "rights_title",
    paragraphs: [
      "rights_intro",
      "rights_access",
      "rights_rectification",
      "rights_erasure",
      "rights_restriction",
      "rights_portability",
      "rights_objection",
      "rights_withdrawal",
      "rights_exercise",
      "rights_complaint",
    ],
  },
  { titleKey: "legal_info_title", paragraphs: ["legal_info_p1", "legal_info_p2"] },
];

/** Translation namespace of each document: `title` plus the section keys above. */
export const DOCUMENT_NAMESPACE = {
  conduct: "conduct",
  "data-protection": "data_protection",
} as const satisfies Record<DocumentKey, string>;

/** Line under the dialog title (conduct: its intro; data protection: last update). */
export const DOCUMENT_SUBTITLE_KEY = {
  conduct: "intro",
  "data-protection": "last_updated",
} as const satisfies Record<DocumentKey, string>;

/** Text of a document, without page chrome: the dialog provides the title and the scroll. */
export default function DocumentBody({ doc }: { doc: DocumentKey }) {
  const t = useTranslations(DOCUMENT_NAMESPACE[doc]);
  const sections = doc === "conduct" ? CONDUCT_SECTIONS : DATA_PROTECTION_SECTIONS;

  return (
    <div className="flex flex-col gap-8">
      {sections.map((section) => (
        <section key={section.titleKey}>
          <h3 className="mb-3 text-lg font-bold text-stone-custom sm:text-xl">{t(section.titleKey)}</h3>
          <div className="space-y-3">
            {section.paragraphs.map((key) => (
              <p key={key} className="text-[15px] leading-relaxed text-stone-custom/80">
                {key === "safe_space_protocol"
                  ? t.rich(key, {
                      link: (chunks) => (
                        <a
                          href={PROTOCOL_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-brand-orange-text underline transition-colors hover:text-brand-orange"
                        >
                          {chunks}
                        </a>
                      ),
                    })
                  : t(key)}
              </p>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
