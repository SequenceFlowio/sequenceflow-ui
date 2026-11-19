import type { Metadata } from "next";

import { AcceptableUsePolicyEnglishContent } from "@/components/marketing/legal/en/AcceptableUsePolicyEnglishContent";
import { SitePage } from "@/components/marketing/SitePage";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  path: "/en/acceptable-use-policy",
  dutchPath: "/nl/acceptable-use-policy",
  lang: "en",
  title: "Acceptable Use Policy | SequenceFlow",
  description: "What counts as permitted and prohibited use of SequenceFlow's services.",
});

export default function Page() {
  return (
    <SitePage narrow lang="en">
      <div className="mk-legal">
        <AcceptableUsePolicyEnglishContent />
      </div>
    </SitePage>
  );
}
