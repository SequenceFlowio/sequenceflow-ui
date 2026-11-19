import type { Metadata } from "next";

import { ContactContent } from "@/components/marketing/ContactContent";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  path: "/en/contact",
  dutchPath: "/nl/contact",
  lang: "en",
  variant: "contact",
  title: "Contact | SequenceFlow",
  shareTitle: "Get to know Support One | SequenceFlow",
  description: "Questions about Support One? Message us on WhatsApp, email hallo@sequenceflow.io or tell us in three short steps how we can help.",
});

export default function ContactPage() {
  return <ContactContent lang="en" />;
}
