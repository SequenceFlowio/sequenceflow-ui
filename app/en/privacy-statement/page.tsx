import type { Metadata } from "next";

import { PrivacyStatementContent } from "@/components/marketing/legal/en/PrivacyStatementContent";
import { SitePage } from "@/components/marketing/SitePage";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  path: "/en/privacy-statement",
  dutchPath: "/nl/privacyverklaring",
  lang: "en",
  title: "Privacy Statement | SequenceFlow",
  description: "How SequenceFlow handles personal data.",
});

export default function Page() {
  return (
    <SitePage narrow lang="en">
      <div className="mk-legal">
        <PrivacyStatementContent />
      </div>
    </SitePage>
  );
}
