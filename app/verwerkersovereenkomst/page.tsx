import type { Metadata } from "next";

import { VerwerkersovereenkomstContent } from "@/components/marketing/legal/VerwerkersovereenkomstContent";
import { SitePage } from "@/components/marketing/SitePage";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  path: "/verwerkersovereenkomst",
  title: "Verwerkersovereenkomst | SequenceFlow",
  description: "De standaardvoorwaarden voor de verwerking van persoonsgegevens door SequenceFlow (art. 28 AVG).",
});

export default function Page() {
  return (
    <SitePage narrow>
      <div className="mk-legal">
        <VerwerkersovereenkomstContent />
      </div>
    </SitePage>
  );
}
