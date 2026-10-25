import type { Metadata } from "next";

import { AcceptableUsePolicyContent } from "@/components/marketing/legal/AcceptableUsePolicyContent";
import { SitePage } from "@/components/marketing/SitePage";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  path: "/acceptable-use-policy",
  title: "Acceptable use policy | SequenceFlow",
  description: "Regels voor verantwoord gebruik van de diensten van SequenceFlow.",
});

export default function Page() {
  return (
    <SitePage narrow>
      <div className="mk-legal">
        <AcceptableUsePolicyContent />
      </div>
    </SitePage>
  );
}
