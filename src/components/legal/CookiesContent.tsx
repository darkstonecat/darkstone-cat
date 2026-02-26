"use client";

import LegalPageContent from "./LegalPageContent";

const SECTIONS = [
  {
    titleKey: "what_title",
    paragraphs: ["what_text"],
  },
  {
    titleKey: "cookies_used_title",
    paragraphs: ["cookies_necessary", "cookies_analytics"],
  },
  {
    titleKey: "third_party_title",
    paragraphs: ["third_party_google", "third_party_vercel"],
  },
  {
    titleKey: "manage_title",
    paragraphs: ["manage_text"],
  },
  {
    titleKey: "updates_title",
    paragraphs: ["updates_text"],
  },
] as const;

export default function CookiesContent() {
  return (
    <LegalPageContent
      namespace="cookie_policy"
      titleKey="title"
      introKey="intro"
      sections={SECTIONS}
    />
  );
}
