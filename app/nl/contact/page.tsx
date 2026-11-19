import type { Metadata } from "next";

import { ContactContent } from "@/components/marketing/ContactContent";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  path: "/nl/contact",
  englishPath: "/en/contact",
  variant: "contact",
  title: "Contact | SequenceFlow",
  shareTitle: "Kennismaken met Support One | SequenceFlow",
  description: "Vragen over Support One? App ons op WhatsApp, mail hallo@sequenceflow.io of vertel in drie korte stappen waar we je mee kunnen helpen.",
});

export default function ContactPage() {
  return <ContactContent lang="nl" />;
}
