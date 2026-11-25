import type { Metadata } from "next";

import { AlgemeneVoorwaardenContent } from "@/components/marketing/legal/AlgemeneVoorwaardenContent";
import { SitePage } from "@/components/marketing/SitePage";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  path: "/nl/algemene-voorwaarden",
  englishPath: "/en/terms-and-conditions",
  title: "Algemene voorwaarden | SequenceFlow",
  description: "De algemene voorwaarden van SequenceFlow.",
});

export default function Page() {
  return (
    <SitePage narrow>
      <div className="mk-legal">
        <AlgemeneVoorwaardenContent />
      </div>
    </SitePage>
  );
}
