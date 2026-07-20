import type { Metadata } from "next";

import { LandingPage } from "@/components/marketing/LandingPage";
import { LANDING_PAGES } from "@/lib/marketing/landingPages";

export const metadata: Metadata = {
  title: "SequenceFlow | AI-klantenservice voor e-commerce",
  description: "Verwerk klantmails sneller met AI-concepten op basis van je eigen beleid. Start 14 dagen gratis, met menselijke controle als standaard.",
};

export default function HomePage() {
  return <LandingPage content={LANDING_PAGES.general} />;
}
