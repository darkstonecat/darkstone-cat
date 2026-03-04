import LegalPageContent from "./LegalPageContent";

const SECTIONS = [
  {
    titleKey: "owner_title",
    paragraphs: ["owner_name", "owner_email", "owner_website"],
  },
  {
    titleKey: "purpose_title",
    paragraphs: ["purpose_text"],
  },
  {
    titleKey: "ip_title",
    paragraphs: ["ip_text"],
  },
  {
    titleKey: "liability_title",
    paragraphs: ["liability_text"],
  },
  {
    titleKey: "links_title",
    paragraphs: ["links_text"],
  },
  {
    titleKey: "law_title",
    paragraphs: ["law_text"],
  },
] as const;

export default function LegalContent() {
  return (
    <LegalPageContent
      namespace="legal_notice"
      titleKey="title"
      introKey="intro"
      sections={SECTIONS}
    />
  );
}
