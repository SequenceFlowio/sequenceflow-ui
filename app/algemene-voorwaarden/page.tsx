import type { Metadata } from "next";

import { AlgemeneVoorwaardenContent } from "@/components/marketing/legal/AlgemeneVoorwaardenContent";
import { SitePage } from "@/components/marketing/SitePage";
import { SITE_ORIGIN } from "@/lib/site";

export const metadata: Metadata = {
  title: "Algemene voorwaarden | SequenceFlow",
  description: "De algemene voorwaarden van SequenceFlow.",
  alternates: { canonical: `${SITE_ORIGIN}/algemene-voorwaarden` },
};

export default function Page() {
  return (
    <SitePage narrow>
      <div className="mk-legal">
        <AlgemeneVoorwaardenContent />
      </div>
    </SitePage>
  );
}
