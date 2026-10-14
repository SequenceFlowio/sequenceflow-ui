import type { Metadata } from "next";

import { VerwerkersovereenkomstContent } from "@/components/marketing/legal/VerwerkersovereenkomstContent";
import { SitePage } from "@/components/marketing/SitePage";
import { SITE_ORIGIN } from "@/lib/site";

export const metadata: Metadata = {
  title: "Verwerkersovereenkomst | SequenceFlow",
  description: "De standaardvoorwaarden voor de verwerking van persoonsgegevens door SequenceFlow (art. 28 AVG).",
  alternates: { canonical: `${SITE_ORIGIN}/verwerkersovereenkomst` },
};

export default function Page() {
  return (
    <SitePage narrow>
      <div className="mk-legal">
        <VerwerkersovereenkomstContent />
      </div>
    </SitePage>
  );
}
