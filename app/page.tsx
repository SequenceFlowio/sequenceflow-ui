import type { Metadata } from "next";

import { LandingPage } from "@/components/marketing/LandingPage";
import { LANDING_PAGES } from "@/lib/marketing/landingPages";
import { DEFAULT_APP_ORIGIN } from "@/lib/brand";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  path: "/",
  origin: DEFAULT_APP_ORIGIN,
  variant: "support",
  title: "SequenceFlow Support One | AI-klantenservice voor e-commerce",
  shareTitle: "Support One | Je AI-collega voor de supportinbox",
  description: "Verwerk klantmails sneller met AI-concepten op basis van je eigen beleid. Start 14 dagen gratis, met menselijke controle als standaard.",
});

export default function HomePage() {
  return <LandingPage content={LANDING_PAGES.general} />;
}
