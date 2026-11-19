import type { Metadata } from "next";

import { SupportOneLanding } from "@/components/marketing/SupportOneLanding";
import { pageMetadata } from "@/lib/marketing/seo";

// De Engelse versie van /nl.
export const metadata: Metadata = pageMetadata({
  path: "/en",
  dutchPath: "/nl",
  lang: "en",
  variant: "support",
  title: "Support One | Your AI team for support and inventory",
  shareTitle: "Support One | Your AI team for support and inventory",
  description: "Seffy prepares a reply to every customer email with your policy and the order attached. Otis keeps an eye on your inventory. You approve. Try Support One free for 14 days.",
});

export default function SupportOneEnglishPage() {
  return <SupportOneLanding lang="en" />;
}
