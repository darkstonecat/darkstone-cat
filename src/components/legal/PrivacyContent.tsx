"use client";

import LegalPageContent from "./LegalPageContent";

const SECTIONS = [
  {
    titleKey: "controller_title",
    paragraphs: ["controller_text"],
  },
  {
    titleKey: "data_title",
    paragraphs: ["data_form", "data_analytics"],
  },
  {
    titleKey: "legal_basis_title",
    paragraphs: ["legal_basis_consent", "legal_basis_interest"],
  },
  {
    titleKey: "retention_title",
    paragraphs: ["retention_text"],
  },
  {
    titleKey: "rights_title",
    paragraphs: ["rights_text"],
  },
  {
    titleKey: "third_parties_title",
    paragraphs: ["third_parties_text"],
  },
  {
    titleKey: "updates_title",
    paragraphs: ["updates_text"],
  },
] as const;

export default function PrivacyContent() {
  return (
    <LegalPageContent
      namespace="privacy_policy"
      titleKey="title"
      introKey="intro"
      sections={SECTIONS}
    />
  );
}
