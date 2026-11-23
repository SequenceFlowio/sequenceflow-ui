import { ArrowRight, Clock, Gift, PlayCircle } from "lucide-react";
import Link from "next/link";

import { ACADEMY, academyStats } from "@/lib/marketing/academy/catalog";

import { FreebieGate } from "./FreebieGate";

/**
 * SequenceFlow Academy op /nl/academy en /en/academy: videocursussen per
 * categorie. Zolang er nog geen video's zijn: "binnenkort" met een wachtlijst
 * (dezelfde e-mailgate als de downloads, freebie "academy", keyword COURSE).
 */
export function AcademyIndex({ lang = "nl" }: { lang?: "nl" | "en" }) {
  const nl = lang === "nl";
  const stats = academyStats();
  return (
    <>
      <header className="mk-site-intro ac-intro">
        <div className="mk-eyebrow"><span />SEQUENCEFLOW ACADEMY · {nl ? "BINNENKORT" : "COMING SOON"}</div>
        <h1>{nl ? "Korte videocursussen voor webshopondernemers." : "Short video courses for online store owners."}</h1>
        <p>{nl
          ? `Elke les duurt zo'n 5 minuten en gaat over één ding dat je meteen kunt toepassen. ${stats.categories} categorieën, ${stats.lessons} lessen, van klantenservice tot een webshop die verkoopt.`
          : `Every lesson takes around 5 minutes and covers one thing you can apply straight away. ${stats.categories} categories, ${stats.lessons} lessons, from customer service to a store that sells.`}</p>
      </header>

      <section className="ac-waitlist" aria-label={nl ? "Wachtlijst" : "Waitlist"}>
        <FreebieGate
          freebie="academy"
          lang={lang}
          lockedNote={nl ? "Gratis · als eerste toegang zodra de eerste cursus live staat" : "Free · first access as soon as the first course goes live"}
          title={nl ? "Zet jezelf op de lijst" : "Put yourself on the list"}
          sub={nl ? "Je krijgt een mail zodra de eerste lessen online staan. De Antwoordenbank kun je nu al downloaden." : "You'll get an email as soon as the first lessons are online. The Reply Bank is already available to download."}
          button={nl ? "Zet me op de lijst" : "Put me on the list"}
        >
          <div className="ac-onlist cx-card" role="status">
            <h2>{nl ? "Je staat op de lijst." : "You're on the list."}</h2>
            <p>{nl ? "Zodra de eerste cursus online staat, krijg je een mail. Check ook je inbox: daar staat al een bevestiging." : "As soon as the first course is online, you'll get an email. Check your inbox: there's already a confirmation."}</p>
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
            {category.bonus ? (
              <Link href={category.bonus[lang].path} className="ac-bonus">
                <Gift size={16} aria-hidden /> <span>{category.bonus[lang].title}</span>
                <em>{nl ? "Nu beschikbaar" : "Available now"} <ArrowRight size={14} /></em>
              </Link>
            ) : null}
          </section>
        ))}
      </div>
    </>
  );
}
