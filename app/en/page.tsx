import type { Metadata } from "next";

import { EnglishFooter, EnglishLanding, EnglishNav } from "@/components/marketing/EnglishSite";

export const metadata: Metadata = {
  title: "Support One · AI customer service for online stores",
  description: "Customer emails answered in your voice: Support One drafts replies with your order data and policies, and you approve. 14-day free trial, no credit card.",
  alternates: { canonical: "/en", languages: { "nl-NL": "/", en: "/en" } },
};

export default function EnglishHomePage() {
  return (
    <div className="mk-page" lang="en">
      <EnglishNav />
      <EnglishLanding />
      <EnglishFooter />
    </div>
  );
}
