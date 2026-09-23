import type { Metadata } from "next";

import { LandingPage } from "@/components/marketing/LandingPage";
import { LANDING_PAGES } from "@/lib/marketing/landingPages";

export const metadata: Metadata = {
  title: "SequenceFlow Support One | AI-klantenservice voor e-commerce",
  alternates: { canonical: "/" },
  openGraph: { title: "Support One | Je AI-collega voor de supportinbox", description: "Koppel je supportmailbox en bereid antwoorden voor met je eigen beleid. Voeg met een webshopkoppeling actuele bestelcontext toe.", url: "/", siteName: "SequenceFlow Support One", locale: "nl_NL", type: "website" },
  twitter: { card: "summary_large_image", title: "Support One | Je AI-collega voor de supportinbox", description: "AI-concepten voor klantvragen, met je eigen beleid en menselijke controle." },
  description: "Verwerk klantmails sneller met AI-concepten op basis van je eigen beleid. Start 14 dagen gratis, met menselijke controle als standaard.",
};

export default function HomePage() {
  return <LandingPage content={LANDING_PAGES.general} />;
}
