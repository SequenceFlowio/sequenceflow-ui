import type { Metadata } from "next";

import { FreebiesIndex } from "@/components/marketing/FreebiesIndex";
import { SitePage } from "@/components/marketing/SitePage";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  path: "/nl/gratis",
  englishPath: "/en/free",
  title: "Gratis tools voor webshops | SequenceFlow",
  shareTitle: "Gratis tools voor je webshop",
  description: "Gratis templates, checklists en rekentools voor webshops: klantmails, retouren, marges en meer. Direct te gebruiken.",
});

export default function FreebiesPage() {
  return <SitePage><FreebiesIndex lang="nl" /></SitePage>;
}
