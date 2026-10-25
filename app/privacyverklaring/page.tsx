import type { Metadata } from "next";

import { PrivacyverklaringContent } from "@/components/marketing/legal/PrivacyverklaringContent";
import { SitePage } from "@/components/marketing/SitePage";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  path: "/privacyverklaring",
  title: "Privacyverklaring | SequenceFlow",
  description: "Hoe SequenceFlow omgaat met persoonsgegevens.",
});

export default function Page() {
  return (
    <SitePage narrow>
      <div className="mk-legal">
        <PrivacyverklaringContent />
      </div>
    </SitePage>
  );
}
