import type { Metadata } from "next";

import { SlaContent } from "@/components/marketing/legal/SlaContent";
import { SitePage } from "@/components/marketing/SitePage";
import { SITE_ORIGIN } from "@/lib/site";

export const metadata: Metadata = {
  title: "Service level agreement | SequenceFlow",
  description: "Afspraken over beschikbaarheid en ondersteuning van SequenceFlow.",
  alternates: { canonical: `${SITE_ORIGIN}/service-level-agreement` },
};

export default function Page() {
  return (
    <SitePage narrow>
      <div className="mk-legal">
        <SlaContent />
      </div>
    </SitePage>
  );
}
