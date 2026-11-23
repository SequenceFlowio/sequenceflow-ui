import { ArrowRight, Clock } from "lucide-react";
import Link from "next/link";

import { FREEBIES } from "@/lib/marketing/freebies/catalog";

/** Overzicht van de gratis downloads op /nl/gratis en /en/free. */
export function FreebiesIndex({ lang = "nl" }: { lang?: "nl" | "en" }) {
  const nl = lang === "nl";
  return (
    <>
      <header className="mk-site-intro">
        <div className="mk-eyebrow"><span />{nl ? "GRATIS" : "FREE"}</div>
        <h1>{nl ? "Gratis tools voor je webshop." : "Free tools for your online store."}</h1>
        <p>{nl
          ? "Templates, checklists en rekentools die je meteen kunt gebruiken. Gemaakt bij de tips die we op Instagram en TikTok delen."
          : "Templates, checklists and calculators you can use straight away. Made to go with the tips we share on Instagram and TikTok."}</p>
      </header>
      <ul className="fb-grid">
        {FREEBIES.map((freebie) => {
          const copy = freebie[lang];
          const inner = (
            <>
              <span className="so-state">{freebie.live ? copy.format : <><Clock size={11} aria-hidden /> {nl ? "Binnenkort" : "Coming soon"}</>}</span>
              <h2>{copy.title}</h2>
              <p>{copy.description}</p>
              {freebie.live ? <span className="fb-open">{nl ? "Gratis openen" : "Open for free"} <ArrowRight size={15} /></span> : null}
            </>
          );
          return (
            <li key={freebie.id}>
              {freebie.live
                ? <Link href={copy.path} className="fb-card">{inner}</Link>
                : <div className="fb-card is-soon">{inner}</div>}
            </li>
          );
        })}
      </ul>
    </>
  );
}
