import type { Metadata } from "next";

import { AiDataEthicsContent } from "@/components/marketing/legal/en/AiDataEthicsContent";
import { SitePage } from "@/components/marketing/SitePage";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  path: "/en/ai-and-data-ethics",
  dutchPath: "/nl/ai-data-ethiek",
  lang: "en",
  title: "AI & Data Ethics | SequenceFlow",
  description: "How SequenceFlow handles AI models and customer data.",
});

export default function Page() {
  return (
    <SitePage narrow lang="en">
      <div className="mk-legal">
        <AiDataEthicsContent />
      </div>
    </SitePage>
  );
}
