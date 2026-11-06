"use client";

import { useEffect, useRef, useState } from "react";
import { Mail, RotateCcw } from "lucide-react";

import { SequenceMark } from "./SequenceMark";
import { useReducedMotion } from "./useReducedMotion";

/**
 * Pijnpunten op de supportsite: losse klantvragen komen binnen, groeperen
 * zich tot één thema met een teller, en daarna verschijnt het advies regel
 * voor regel. Het speelt het blok "Pijnpunten: waar klanten tegenaan lopen"
 * uit de app na (samenvatting, thema met aantal en percentage, advies).
 *
 * Speelt één keer zodra de sectie in beeld komt; bij "minder beweging" staat
 * meteen het eindbeeld er.
 */

type Phase = "idle" | "incoming" | "grouping" | "advice" | "done";

const QUESTIONS = [
  { from: "Sanne", text: "Er zitten maar drie wieltjes aan de racewagen" },
  { from: "Daan", text: "Wieltje kwijt, kan ik er los een krijgen?" },
  { from: "Fatima", text: "De auto kwam binnen zonder voorwiel" },
  { from: "Joris", text: "Mijn zoon is verdrietig, er mist een wiel" },
  { from: "Lotte", text: "Doos was dicht, maar het wieltje zit er niet in" },
];

const THEME_COUNT = 14;
const TOTAL = 31;

const OTHERS = [
  { name: "Levertijd naar België", count: 9 },
  { name: "Batterijen niet meegeleverd", count: 5 },
];

const ADVICE = [
  "Open steekproefsgewijs een paar dozen en controleer of alles compleet is.",
  "Vraag je leverancier de volgende levering extra te controleren.",
  "Zet in de productbeschrijving hoeveel wieltjes er in de doos horen, zodat klanten het meteen kunnen nakijken.",
];

const TIMELINE: Array<[Phase, number]> = [
  ["incoming", 0],
  ["grouping", 2600],
  ["advice", 4400],
  ["done", 4400 + ADVICE.length * 450 + 500],
];

export function PainPointsShowcase() {
  const ref = useRef<HTMLDivElement | null>(null);
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("idle");
  const [count, setCount] = useState(0);
  const [run, setRun] = useState(0);

  // Starten zodra de kaart in beeld komt.
  useEffect(() => {
    const node = ref.current;
    if (!node || reducedMotion) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setRun((value) => (value === 0 ? 1 : value));
      observer.disconnect();
    }, { threshold: 0.35 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [reducedMotion]);

  // De tijdlijn van één afspeelronde.
  useEffect(() => {
    if (!run || reducedMotion) return;
    setCount(0);
    const timers = TIMELINE.map(([next, at]) => window.setTimeout(() => setPhase(next), at));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [run, reducedMotion]);

  // De teller loopt op terwijl de vragen samenkomen.
  useEffect(() => {
    if (phase !== "grouping") return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 1500);
      setCount(Math.round(THEME_COUNT * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  const shown: Phase = reducedMotion ? "done" : phase;
  const shownCount = reducedMotion || phase === "advice" || phase === "done" ? THEME_COUNT : count;
  const grouped = shown === "grouping" || shown === "advice" || shown === "done";
  const advising = shown === "advice" || shown === "done";

  return (
    <div className={`pp-panel is-${shown}`} ref={ref} aria-label="Voorbeeld: klantvragen van een speelgoedwinkel worden gebundeld tot één pijnpunt met advies">
      <div className="pp-head">
        <div>
          <strong>Pijnpunten: waar klanten tegenaan lopen</strong>
          <small>Voorbeeld · speelgoedwinkel · deze maand</small>
        </div>
        <span className="pp-badge">Growth</span>
      </div>

      <div className="pp-stage">
        <ul className="pp-inbox" aria-hidden={grouped}>
          {QUESTIONS.map((question, index) => (
            <li key={question.from} style={{ ["--i" as string]: index }}>
              <Mail size={14} />
              <span><b>{question.from}</b>{question.text}</span>
            </li>
          ))}
        </ul>

        <article className="pp-theme" aria-hidden={!grouped}>
          <ToyCar />
          <div className="pp-theme-copy">
            <h3>Wieltjes ontbreken bij de speelgoedauto</h3>
            <p>Klanten melden dat er bij levering één of meer wieltjes missen.</p>
          </div>
          <div className="pp-count">
            <strong aria-live="polite">{shownCount}</strong>
            <small>vragen</small>
            <small>{Math.round(THEME_COUNT / TOTAL * 100)}% van alles</small>
          </div>
        </article>
      </div>

      <div className="pp-others">
        {OTHERS.map((other) => (
          <div key={other.name}>
            <span>{other.name}</span>
            <i><em style={{ width: `${other.count / THEME_COUNT * 100}%` }} /></i>
            <b>{other.count}</b>
          </div>
        ))}
      </div>

      <div className="pp-advice">
        <p className="pp-advice-label"><SequenceMark size={26} title="" /> ✦ AI-advies</p>
        <ol>
          {ADVICE.map((line, index) => (
            <li key={line} style={{ ["--i" as string]: index }} className={advising ? "is-shown" : ""}>{line}</li>
          ))}
        </ol>
      </div>

      {!reducedMotion && shown === "done" ? (
        <button type="button" className="pp-replay" onClick={() => { setPhase("idle"); setRun((value) => value + 1); }}>
          <RotateCcw size={13} /> Opnieuw afspelen
        </button>
      ) : null}
    </div>
  );
}

/** Een speelgoedauto van opzij, met één leeg wielvak. */
function ToyCar() {
  return (
    <svg className="pp-car" viewBox="0 0 120 70" width="96" height="56" aria-hidden="true">
      <path d="M14 46 L14 34 Q14 30 18 30 L36 30 L48 16 Q50 14 54 14 L80 14 Q84 14 86 17 L96 30 L104 31 Q110 32 110 38 L110 46 Z" fill="#c7f56f" />
      <path d="M52 19 L78 19 L88 30 L44 30 Z" fill="#0c0d0c" opacity=".55" />
      <line x1="66" y1="19" x2="66" y2="30" stroke="#c7f56f" strokeWidth="2.5" />
      <circle cx="104" cy="38" r="2.5" fill="#fff6c8" />
      {/* Achterwiel: aanwezig */}
      <g className="pp-wheel">
        <circle cx="34" cy="48" r="10" fill="#10160e" />
        <circle cx="34" cy="48" r="4" fill="#9da29f" />
      </g>
      {/* Voorwiel: ontbreekt */}
      <circle className="pp-missing" cx="88" cy="48" r="10" fill="none" stroke="#f5c458" strokeWidth="2" strokeDasharray="4 3" />
      <text className="pp-missing-mark" x="88" y="52" textAnchor="middle" fontSize="11" fontWeight="700" fill="#f5c458">?</text>
    </svg>
  );
}

/** De volledige sectie voor de supportsite: uitleg links, de animatie rechts. */
export function PainPointsSection() {
  return (
    <section className="so-feature so-pain" id="pijnpunten">
      <div className="so-feature-copy">
        <span className="so-label">07 / PIJNPUNTEN</span>
        <h2>Zie waar klanten<br />op vastlopen.</h2>
        <p>Support One bundelt losse klantvragen tot thema&apos;s. Je ziet welk probleem het vaakst terugkomt en krijgt advies over wat je eraan kunt doen. Zo los je het op bij de bron, en komt dezelfde vraag minder vaak binnen.</p>
        <span className="so-inline-proof">Inbegrepen vanaf Growth</span>
      </div>
      <div className="so-visual"><PainPointsShowcase /></div>
    </section>
  );
}
