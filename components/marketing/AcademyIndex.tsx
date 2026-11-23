import { Clock, PlayCircle } from "lucide-react";

import { ACADEMY, academyStats } from "@/lib/marketing/academy/catalog";

import { FreebieGate } from "./FreebieGate";

/**
 * SequenceFlow Academy op /nl/academy en /en/academy: uitlegvideo's per
 * categorie. Zolang er nog geen video's zijn: "binnenkort" met een wachtlijst
 * (dezelfde e-mailgate als de downloads, freebie "academy", keyword VIDEO).
 */
export function AcademyIndex({ lang = "nl" }: { lang?: "nl" | "en" }) {
  const nl = lang === "nl";
  const stats = academyStats();
  return (
    <>
      <header className="mk-site-intro ac-intro">
        <div className="mk-eyebrow"><span />SEQUENCEFLOW ACADEMY · {nl ? "BINNENKORT" : "COMING SOON"}</div>
        <h1>{nl ? "Korte uitlegvideo's voor webshopondernemers." : "Short explainer videos for online store owners."}</h1>
        <p>{nl
          ? `Elke les duurt zo'n 5 minuten en gaat over één ding dat je meteen kunt toepassen. ${stats.categories} categorieën, ${stats.lessons} lessen, van klantenservice tot een webshop die verkoopt.`
          : `Every lesson takes around 5 minutes and covers one thing you can apply straight away. ${stats.categories} categories, ${stats.lessons} lessons, from customer service to a store that sells.`}</p>
      </header>

      <section className="ac-waitlist" aria-label={nl ? "Wachtlijst" : "Waitlist"}>
        <FreebieGate
          freebie="academy"
          lang={lang}
          lockedNote={nl ? "Gratis · als eerste toegang zodra de eerste video's live staan" : "Free · first access as soon as the first videos go live"}
          title={nl ? "Zet jezelf op de lijst" : "Put yourself on the list"}
          sub={nl ? "Je krijgt een mail zodra de eerste video's online staan. Gratis, en afmelden kan altijd." : "You'll get an email as soon as the first videos are online. Free, and you can unsubscribe anytime."}
          button={nl ? "Zet me op de lijst" : "Put me on the list"}
        >
          <div className="ac-onlist cx-card" role="status">
            <h2>{nl ? "Je staat op de lijst." : "You're on the list."}</h2>
            <p>{nl ? "Zodra de eerste video's online staan, krijg je een mail. Check ook je inbox: daar staat al een bevestiging." : "As soon as the first videos are online, you'll get an email. Check your inbox: there's already a confirmation."}</p>
          </div>
        </FreebieGate>
      </section>

      <div className="ac-categories">
        {ACADEMY.map((category) => (
          <section key={category.id} className="ac-category" aria-labelledby={`ac-${category.id}`}>
            <header>
              <h2 id={`ac-${category.id}`}>{category[lang].title}</h2>
              <p>{category[lang].description}</p>
            </header>
            <ol className="ac-lessons">
              {category.lessons.map((lesson, index) => {
                const ready = lesson.status[lang] === "ready";
                return (
                  <li key={lesson.id} className={ready ? "is-ready" : "is-soon"}>
                    <span className="ac-thumb" aria-hidden>{ready ? <PlayCircle size={22} /> : <span>{index + 1}</span>}</span>
                    <div>
                      <strong>{lesson[lang].title}</strong>
                      <small>{lesson[lang].description}</small>
                    </div>
                    <span className="ac-meta">{ready ? `${lesson.minutes} min` : <><Clock size={11} aria-hidden /> {nl ? "Binnenkort" : "Soon"}</>}</span>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </>
  );
}
