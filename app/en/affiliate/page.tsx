import type { Metadata } from "next";

import { AffiliateLanding } from "@/app/affiliate/AffiliateLanding";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  path: "/en/affiliate",
  dutchPath: "/nl/affiliate",
  lang: "en",
  title: "Affiliate programme | SequenceFlow",
  shareTitle: "Earn with SequenceFlow",
  description: "Send stores to SequenceFlow and earn 10% of what they pay, for as long as they stay customers. They get 10% off their first month. No account needed.",
});

// Leaderboard ververst elk uur
export const revalidate = 3600;

export default function AffiliatePage() {
  return <AffiliateLanding lang="en" />;
}
