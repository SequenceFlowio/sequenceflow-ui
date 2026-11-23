import type { Metadata } from "next";

import { AcademyIndex } from "@/components/marketing/AcademyIndex";
import { SitePage } from "@/components/marketing/SitePage";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  path: "/en/academy",
  dutchPath: "/nl/academy",
  lang: "en",
  title: "SequenceFlow Academy: video courses for online stores | SequenceFlow",
  shareTitle: "SequenceFlow Academy: short video courses for online store owners",
  description: "Short video courses of around 5 minutes on customer service, margins, rules, growth and a store that sells. Coming soon: put yourself on the list.",
});

export default function AcademyPage() {
  return <SitePage lang="en"><AcademyIndex lang="en" /></SitePage>;
}
