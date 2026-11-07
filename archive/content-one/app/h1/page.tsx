import type { Metadata } from "next";

import { HomeVariantH1 } from "@/components/marketing/HomeVariantH1";
import { pageMetadata } from "@/lib/marketing/seo";

// Testvariant van de homepage. Niet indexeren en canoniek naar /, zodat
// zoekmachines hem niet als tweede homepage zien.
export const metadata: Metadata = {
  ...pageMetadata({
    path: "/",
    variant: "hub",
    title: "SequenceFlow | AI-collega's voor je webshop",
    description: "SequenceFlow bouwt AI-agents voor webshops. Support One beantwoordt je klantmails in jouw stijl; Content One komt binnenkort.",
  }),
  robots: { index: false, follow: true },
};

export default function HomeH1Page() {
  return <HomeVariantH1 />;
}
