import type { Metadata } from "next";

import { EnglishFooter, EnglishLanding, EnglishNav } from "@/components/marketing/EnglishSite";

export const metadata: Metadata = {
  title: "Support One · AI customer service for online stores",
  description: "Customer emails answered in your voice: Support One drafts replies with your order data and policies, and you approve. 14-day free trial, no credit card.",
  alternates: { canonical: "https://www.sequenceflow.io/en/support-one", languages: { "nl-NL": "https://support.sequenceflow.io/", en: "https://www.sequenceflow.io/en/support-one" } },
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
