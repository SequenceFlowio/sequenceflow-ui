import type { Metadata } from "next";

import { SlaEnglishContent } from "@/components/marketing/legal/en/SlaEnglishContent";
import { SitePage } from "@/components/marketing/SitePage";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  path: "/en/service-level-agreement",
  dutchPath: "/nl/service-level-agreement",
  lang: "en",
  title: "Service Level Agreement | SequenceFlow",
  description: "The service levels SequenceFlow guarantees for the flows it manages.",
});

export default function Page() {
  return (
    <SitePage narrow lang="en">
      <div className="mk-legal">
        <SlaEnglishContent />
      </div>
    </SitePage>
  );
}
