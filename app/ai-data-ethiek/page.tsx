import type { Metadata } from "next";

import { AiDataEthiekContent } from "@/components/marketing/legal/AiDataEthiekContent";
import { SitePage } from "@/components/marketing/SitePage";
import { SITE_ORIGIN } from "@/lib/site";

export const metadata: Metadata = {
  title: "AI- en data-ethiek | SequenceFlow",
  description: "Hoe SequenceFlow AI en klantdata verantwoord inzet.",
  alternates: { canonical: `${SITE_ORIGIN}/ai-data-ethiek` },
};

export default function Page() {
  return (
    <SitePage narrow>
      <div className="mk-legal">
        <AiDataEthiekContent />
      </div>
    </SitePage>
  );
}
