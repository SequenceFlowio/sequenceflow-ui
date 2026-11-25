import type { Metadata } from "next";

import { AcademyIndex } from "@/components/marketing/AcademyIndex";
import { MarketingAttribution } from "@/components/marketing/MarketingAttribution";
import { SitePage } from "@/components/marketing/SitePage";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  path: "/en/academy",
  dutchPath: "/nl/academy",
  lang: "en",
  title: "SequenceFlow Academy: explainer videos for online stores | SequenceFlow",
  shareTitle: "SequenceFlow Academy: short explainer videos for online store owners",
  description: "Short explainer videos of 2 to 5 minutes on customer service, margins, rules, growth and a store that sells. Free, watch straight away after signing up.",
});

export default function AcademyPage() {
  return <SitePage lang="en"><MarketingAttribution page="/en/academy" /><AcademyIndex lang="en" /></SitePage>;
}
