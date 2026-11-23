import type { Metadata } from "next";
import Link from "next/link";

import { ReplyBankView } from "@/components/marketing/ReplyBankView";
import { SitePage } from "@/components/marketing/SitePage";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  path: "/nl/academy/antwoordenbank",
  englishPath: "/en/academy/reply-bank",
  title: "De Antwoordenbank: 30 klantmails voor je webshop | SequenceFlow",
  shareTitle: "Gratis: 30 kant-en-klare klantmails voor je webshop",
  description: "30 gratis antwoorden op de klantvragen die elke webshop krijgt: waar is mijn pakket, retour, kapot product, factuur, boze klant. Kopiëren, invullen, versturen.",
});

export default function ReplyBankPage() {
  return (
    <SitePage>
      <header className="mk-site-intro">
        <div className="mk-eyebrow"><span /><Link href="/nl/academy">ACADEMY</Link> · BONUS: ANTWOORDENBANK</div>
        <h1>30 klantmails die je morgen al kunt versturen.</h1>
        <p>De vragen die elke webshop elke week krijgt, met een antwoord dat het in één keer oplost. Kopieer, vul de <mark className="rb-mark">[haakjes]</mark> in en klaar. Bij elk antwoord staat waarom het werkt.</p>
      </header>
      <ReplyBankView lang="nl" />
    </SitePage>
  );
}
