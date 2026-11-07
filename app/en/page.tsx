import type { Metadata } from "next";

import { EnglishFooter, EnglishHub, EnglishNav } from "@/components/marketing/EnglishSite";

export const metadata: Metadata = {
  title: "SequenceFlow · AI agents for online stores",
  description: "SequenceFlow builds AI agents for e-commerce. Support One drafts replies to your customer emails, with your order data and policies. Content One is coming soon.",
  alternates: { canonical: "https://www.sequenceflow.io/en", languages: { "nl-NL": "https://www.sequenceflow.io/", en: "https://www.sequenceflow.io/en" } },
};

export default function EnglishHomePage() {
  return (
    <div className="mk-page" lang="en">
      <EnglishNav product="" nlHref="/" />
      <EnglishHub />
      <EnglishFooter />
    </div>
  );
}
