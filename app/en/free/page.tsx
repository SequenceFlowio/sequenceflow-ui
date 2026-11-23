import type { Metadata } from "next";

import { FreebiesIndex } from "@/components/marketing/FreebiesIndex";
import { SitePage } from "@/components/marketing/SitePage";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  path: "/en/free",
  dutchPath: "/nl/gratis",
  lang: "en",
  title: "Free tools for online stores | SequenceFlow",
  shareTitle: "Free tools for your online store",
  description: "Free templates, checklists and calculators for online stores: customer emails, returns, margins and more. Ready to use.",
});

export default function FreebiesPage() {
  return <SitePage lang="en"><FreebiesIndex lang="en" /></SitePage>;
}
