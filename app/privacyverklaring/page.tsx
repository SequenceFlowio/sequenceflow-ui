import type { Metadata } from "next";

import { PrivacyverklaringContent } from "@/components/marketing/legal/PrivacyverklaringContent";
import { SitePage } from "@/components/marketing/SitePage";
import { SITE_ORIGIN } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacyverklaring | SequenceFlow",
  description: "Hoe SequenceFlow omgaat met persoonsgegevens.",
  alternates: { canonical: `${SITE_ORIGIN}/privacyverklaring` },
};

export default function Page() {
  return (
    <SitePage narrow>
      <div className="mk-legal">
        <PrivacyverklaringContent />
      </div>
    </SitePage>
  );
}
