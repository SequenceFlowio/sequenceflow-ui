import type { Metadata } from "next";

import { TermsAndConditionsContent } from "@/components/marketing/legal/en/TermsAndConditionsContent";
import { SitePage } from "@/components/marketing/SitePage";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  path: "/en/terms-and-conditions",
  dutchPath: "/nl/algemene-voorwaarden",
  lang: "en",
  title: "Terms and Conditions | SequenceFlow",
  description: "The general terms and conditions of SequenceFlow.",
});

export default function Page() {
  return (
    <SitePage narrow lang="en">
      <div className="mk-legal">
        <TermsAndConditionsContent />
      </div>
    </SitePage>
  );
}
