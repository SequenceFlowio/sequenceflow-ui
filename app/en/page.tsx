import type { Metadata } from "next";

import { EnglishFooter, EnglishLanding, EnglishNav } from "@/components/marketing/EnglishSite";

// /en is de Engelse Support One-pagina, zoals /support-one in het Nederlands.
export const metadata: Metadata = {
  title: "Support One · AI customer service for online stores",
  description: "Customer emails answered in your voice: Support One drafts replies with your order data and policies, and you approve. 14-day free trial, no credit card.",
  alternates: { canonical: "https://www.sequenceflow.io/en", languages: { "nl-NL": "https://www.sequenceflow.io/support-one", en: "https://www.sequenceflow.io/en" } },
};

export default function EnglishSupportPage() {
  return (
    <div className="mk-page" lang="en">
      <EnglishNav />
      <EnglishLanding />
      <EnglishFooter />
    </div>
  );
}
