"use client";

import LegalPageContent from "@/components/legal/LegalPageContent";

const SECTIONS = [
  {
    titleKey: "safe_space_title",
    paragraphs: ["safe_space_text", "safe_space_harassment", "safe_space_safety", "safe_space_protocol"],
  },
  {
    titleKey: "catalan_title",
    paragraphs: ["catalan_text"],
  },
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
  {
    titleKey: "collaboration_title",
    paragraphs: ["collaboration_text"],
  },
  {
    titleKey: "open_tables_title",
    paragraphs: ["open_tables_text"],
  },
] as const;

export default function ConductContent() {
  return (
    <LegalPageContent
      namespace="conduct"
      titleKey="title"
      introKey="intro"
      sections={SECTIONS}
    />
  );
}
