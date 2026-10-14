import type { Metadata } from "next";

import { AcceptableUsePolicyContent } from "@/components/marketing/legal/AcceptableUsePolicyContent";
import { SitePage } from "@/components/marketing/SitePage";
import { SITE_ORIGIN } from "@/lib/site";

export const metadata: Metadata = {
  title: "Acceptable use policy | SequenceFlow",
  description: "Regels voor verantwoord gebruik van de diensten van SequenceFlow.",
  alternates: { canonical: `${SITE_ORIGIN}/acceptable-use-policy` },
};

export default function Page() {
  return (
    <SitePage narrow>
      <div className="mk-legal">
        <AcceptableUsePolicyContent />
      </div>
    </SitePage>
  );
}
