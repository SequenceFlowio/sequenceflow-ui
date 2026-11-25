"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ACADEMY, academyMedia } from "@/lib/marketing/academy/catalog";

import { AcademyLesson } from "./AcademyLesson";

/**
 * Alle lessen, na aanmelden (/nl/academy/lessen, /en/academy/lessons).
 * Nog niet aangemeld in deze browser? Dan terug naar de aanmelding.
 */
export function AcademyLibrary({ lang }: { lang: "nl" | "en" }) {
  const nl = lang === "nl";
  const router = useRouter();
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => {
    let ok = false;
    try { ok = window.localStorage.getItem("sf-freebie-academy") === "1"; } catch { /* privévenster */ }
    if (!ok) { router.replace(nl ? "/nl/academy" : "/en/academy"); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
  }, [router, nl]);

  if (!open) return <p className="ac-loading">{nl ? "Even geduld…" : "One moment…"}</p>;

  return (
    <>
      <header className="mk-site-intro ac-intro">
        <div className="mk-eyebrow"><span />SEQUENCEFLOW ACADEMY</div>
        <h1>{nl ? "Alle lessen." : "All lessons."}</h1>
        <p>{nl ? "Kies een les en kijk hem meteen. Elke les gaat over één ding dat je vandaag nog kunt toepassen." : "Pick a lesson and watch it straight away. Each one covers one thing you can apply today."}</p>
        {!nl ? <p className="ac-langnote">The videos are in Dutch for now. English versions are on their way.</p> : null}
      </header>
      <div className="ac-categories">
        {ACADEMY.map((category) => (
          <section key={category.id} className="ac-category" aria-labelledby={`ac-${category.id}`}>
            <header>
              <h2 id={`ac-${category.id}`}>{category[lang].title}</h2>
              <p>{category[lang].description}</p>
            </header>
            <ol className="ac-lessons">
              {category.lessons.map((lesson, index) => {
                // Engelse video's komen later; tot die tijd de Nederlandse.
                const file = lesson.status[lang] === "ready" ? lesson.video?.[lang] : lesson.status.nl === "ready" ? lesson.video?.nl : undefined;
                const poster = lesson.poster?.[lang] ?? lesson.poster?.nl;
                return (
                  <AcademyLesson key={lesson.id} index={index} lang={lang} title={lesson[lang].title} description={lesson[lang].description}
                    minutes={lesson.minutes} video={academyMedia(file)} poster={poster} />
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </>
  );
}
