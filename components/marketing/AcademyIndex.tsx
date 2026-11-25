import { PlayCircle } from "lucide-react";

import { ACADEMY, academyStats } from "@/lib/marketing/academy/catalog";

import { AcademyGate } from "./AcademyGate";

/**
 * SequenceFlow Academy op /nl/academy en /en/academy: de aanmelding. Je ziet
 * wat erin zit (de categorieën), maar de video's zelf staan pas op de
 * lessenpagina, na aanmelden (freebie "academy", keyword VIDEO).
 */
export function AcademyIndex({ lang = "nl" }: { lang?: "nl" | "en" }) {
  const nl = lang === "nl";
  const stats = academyStats();
  const ready = stats.ready[lang];
  return (
    <div className="ac-landing">
      <header className="mk-site-intro ac-intro">
        <div className="mk-eyebrow"><span />SEQUENCEFLOW ACADEMY · {nl ? "GRATIS" : "FREE"}</div>
        <h1>{nl ? "Korte uitlegvideo's voor webshopondernemers." : "Short explainer videos for online store owners."}</h1>
        <p>{nl
          ? `Elke les duurt 2 tot 5 minuten en gaat over één ding dat je meteen kunt toepassen. Van klantenservice tot marges, regels en groei.`
          : `Every lesson takes 2 to 5 minutes and covers one thing you can apply straight away. From customer service to margins, rules and growth.`}</p>
        {!nl ? <p className="ac-langnote">The videos are in Dutch for now. English versions are on their way.</p> : null}
      </header>

      <section className="ac-waitlist" aria-label={nl ? "Aanmelden" : "Sign up"}>
        <AcademyGate lang={lang} />
      </section>

      <section aria-labelledby="ac-inside">
        <h2 id="ac-inside" className="ac-inside-title">{nl ? `Wat erin zit${ready ? ` · ${ready} video's klaar` : ""}` : `What's inside${stats.ready.en ? ` · ${stats.ready.en} videos ready` : ""}`}</h2>
        <ul className="ac-overview">
          {ACADEMY.map((category) => {
            const count = category.lessons.filter((lesson) => lesson.status.nl === "ready").length;
            return (
              <li key={category.id} className="ac-category">
                <header>
                  <h3>{category[lang].title}</h3>
                  <p>{category[lang].description}</p>
                </header>
                <span className="ac-meta">
                  <PlayCircle size={12} aria-hidden />{" "}
                  {count
                    ? nl ? `${count} van ${category.lessons.length} video's klaar` : `${count} of ${category.lessons.length} videos ready`
                    : nl ? `${category.lessons.length} video's, binnenkort` : `${category.lessons.length} videos, coming soon`}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
