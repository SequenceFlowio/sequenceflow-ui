import type { Metadata } from "next";

import { DataProcessingAgreementContent } from "@/components/marketing/legal/en/DataProcessingAgreementContent";
import { SitePage } from "@/components/marketing/SitePage";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  path: "/en/data-processing-agreement",
  dutchPath: "/nl/verwerkersovereenkomst",
  lang: "en",
  title: "Data Processing Agreement | SequenceFlow",
  description: "The standard data processing agreement (GDPR Art. 28) between SequenceFlow and its customers.",
});

export default function Page() {
  return (
    <SitePage narrow lang="en">
      <div className="mk-legal">
        <DataProcessingAgreementContent />
      </div>
    </SitePage>
  );
}
