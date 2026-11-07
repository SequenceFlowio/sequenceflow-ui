import type { Metadata } from "next";

import { SupportOneS1 } from "@/components/marketing/SupportOneS1";
import { DEFAULT_APP_ORIGIN } from "@/lib/brand";
import { pageMetadata } from "@/lib/marketing/seo";

// Testvariant van de Support One-landing. Niet indexeren en canoniek naar /.
export const metadata: Metadata = {
  ...pageMetadata({
    path: "/",
    origin: DEFAULT_APP_ORIGIN,
    variant: "support",
    title: "SequenceFlow Support One | AI-klantenservice voor e-commerce",
    shareTitle: "Support One | Je klantmails, al voorbereid",
    description: "Support One zet bij elke klantvraag een antwoord klaar, met jouw beleid en de bestelling erbij. Jij keurt goed. Start 14 dagen gratis.",
  }),
  robots: { index: false, follow: true },
};

export default function SupportS1Page() {
  return <SupportOneS1 />;
}
