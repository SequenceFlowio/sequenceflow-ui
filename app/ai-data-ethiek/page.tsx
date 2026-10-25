import type { Metadata } from "next";

import { AiDataEthiekContent } from "@/components/marketing/legal/AiDataEthiekContent";
import { SitePage } from "@/components/marketing/SitePage";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  path: "/ai-data-ethiek",
  title: "AI- en data-ethiek | SequenceFlow",
  description: "Hoe SequenceFlow AI en klantdata verantwoord inzet.",
});

export default function Page() {
  return (
    <SitePage narrow>
      <div className="mk-legal">
        <AiDataEthiekContent />
      </div>
    </SitePage>
  );
}
