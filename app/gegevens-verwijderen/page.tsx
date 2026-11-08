import type { Metadata } from "next";

import { SitePage } from "@/components/marketing/SitePage";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  path: "/gegevens-verwijderen",
  title: "Gegevens verwijderen | SequenceFlow",
  description: "Zo verwijder je de gegevens die SequenceFlow via Instagram en Facebook heeft ontvangen.",
});

/** Instructies voor gegevensverwijdering (Meta: Data Deletion Instructions URL), plus de status na een verzoek. */
export default async function Page({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  return (
    <SitePage narrow>
      <div className="mk-legal">
        <h1>Gegevens verwijderen</h1>
        {code ? (
          <p>
            Je verzoek is ontvangen en verwerkt. De koppeling met Instagram en Facebook en alle bijbehorende tokens en
            accountgegevens zijn verwijderd. Bevestigingscode: <strong>{code.replace(/[^a-f0-9]/gi, "").slice(0, 32)}</strong>.
          </p>
        ) : null}
        <h2>Gegevens van Instagram en Facebook</h2>
        <p>
          Als je Instagram en Facebook koppelt aan SequenceFlow, bewaren wij je naam en Facebook-ID, de pagina&apos;s die
          je beheert met hun toegangstokens (versleuteld), het gekoppelde Instagram-account en de cijfers van posts die je
          via SequenceFlow plaatst. Zo verwijder je deze gegevens:
        </p>
        <ol>
          <li><strong>In SequenceFlow:</strong> kies bij de koppeling met Instagram en Facebook voor &quot;Ontkoppelen&quot;. Wij trekken de rechten in bij Meta en wissen alle tokens en accountgegevens direct.</li>
          <li><strong>Via Facebook:</strong> ga naar Instellingen en privacy → Instellingen → Apps en websites, kies SequenceFlow en klik op Verwijderen. Meta laat ons dat weten en wij wissen de gegevens automatisch.</li>
          <li><strong>Per mail:</strong> mail <a href="mailto:hallo@sequenceflow.io">hallo@sequenceflow.io</a> met het verzoek. Wij verwijderen je gegevens binnen 30 dagen en bevestigen dat per mail.</li>
        </ol>
        <p>Posts die al op Instagram of Facebook zijn geplaatst, blijven daar staan; die verwijder je zelf in Instagram of Facebook.</p>
        <p>Meer over hoe wij met gegevens omgaan, lees je in onze <a href="/privacyverklaring">privacyverklaring</a>.</p>
      </div>
    </SitePage>
  );
}
