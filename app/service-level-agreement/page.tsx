import type { Metadata } from "next";

import { SlaContent } from "@/components/marketing/legal/SlaContent";
import { SitePage } from "@/components/marketing/SitePage";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  path: "/service-level-agreement",
  title: "Service level agreement | SequenceFlow",
  description: "Afspraken over beschikbaarheid en ondersteuning van SequenceFlow.",
});

export default function Page() {
  return (
    <SitePage narrow>
      <div className="mk-legal">
        <SlaContent />
      </div>
    </SitePage>
  );
}
