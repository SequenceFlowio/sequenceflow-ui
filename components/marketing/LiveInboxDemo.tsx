"use client";

import { useEffect, useRef, useState } from "react";

import { SequenceMark, type MarkState } from "./SequenceMark";
import { useReducedMotion } from "./useReducedMotion";

/**
 * LiveInboxDemo — de productdemo die zichzelf afspeelt.
 *
 * Bewust géén videobestand. Een gescripte DOM-sequentie is scherp op elk
 * scherm, weegt niets, is in één regel aan te passen als de copy verandert,
 * en leest voor een screenreader als gewone tekst. Een mp4 kan dat allemaal
 * niet.
 *
 * De sequentie loopt eeuwig door en start pas wanneer de demo in beeld komt
 * (IntersectionObserver) — buiten beeld draait er niets.
 */

type Phase =
  | "idle"
  | "arriving"
  | "reading"
  | "context"
  | "drafting"
  | "typing"
  | "ready";

type Step = { phase: Phase; hold: number };

/** Eén volledige ronde. `hold` is hoe lang de fase zichtbaar blijft (ms). */
const SCRIPT: Step[] = [
  { phase: "idle", hold: 900 },
  { phase: "arriving", hold: 1100 },
  { phase: "reading", hold: 1500 },
  { phase: "context", hold: 1700 },
  { phase: "drafting", hold: 1200 },
  { phase: "typing", hold: 2600 },
  { phase: "ready", hold: 3200 },
];

const DRAFT_TEXT =
  "Hoi Jan, je pakket is onderweg en wordt vandaag nog bezorgd. Volgens PostNL is het om 09:14 gescand in het sorteercentrum in Utrecht. Je ontvangt vanzelf een bericht zodra de bezorger onderweg is.";

/** Stappen die de agent zichtbaar zet terwijl hij de context ophaalt. */
const CONTEXT_STEPS = [
  { label: "Klant herkend", detail: "jan.bakker@gmail.com" },
  { label: "Bestelling gekoppeld", detail: "#4521 · WooCommerce" },
  { label: "Verzendstatus opgehaald", detail: "PostNL · onderweg" },
  { label: "Beleid toegepast", detail: "Bezorgbelofte 1-2 werkdagen" },
];

const PHASE_TO_MARK: Record<Phase, MarkState> = {
  idle: "idle",
  arriving: "idle",
  reading: "reading",
  context: "thinking",
  drafting: "thinking",
  typing: "reading",
  ready: "happy",
};

const PHASE_STATUS: Record<Phase, string> = {
  idle: "Wacht op nieuwe vragen",
  arriving: "Nieuwe klantvraag binnengekomen",
  reading: "Vraag wordt gelezen",
  context: "Context ophalen uit je webshop",
  drafting: "Antwoord voorbereiden",
  typing: "Antwoord voorbereiden",
  ready: "Concept klaar — jij beslist",
};

export function LiveInboxDemo() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  // De getypte tekst wordt bewaard mét de stap waar hij bij hoort. Zonder die
  // koppeling toont een nieuwe ronde één frame lang de volledige tekst van de
  // vorige ronde voordat de eerste interval-tick hem leeggooit.
  const [typed, setTyped] = useState<{ step: number; text: string }>({ step: -1, text: "" });
  const [active, setActive] = useState(false);

  // Bij reduced motion tonen we direct het eindresultaat in plaats van de
  // animatie — de informatie is dezelfde, alleen zonder beweging.
  const reducedMotion = useReducedMotion();

  const phase = SCRIPT[stepIndex].phase;

  // Alleen animeren wanneer de demo daadwerkelijk zichtbaar is.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // De sequentie zelf.
  useEffect(() => {
    if (!active || reducedMotion) return;
    const timer = window.setTimeout(
      () => setStepIndex((index) => (index + 1) % SCRIPT.length),
      SCRIPT[stepIndex].hold,
    );
    return () => window.clearTimeout(timer);
  }, [stepIndex, active, reducedMotion]);

  // Typemachine-effect voor het concept.
  useEffect(() => {
    if (reducedMotion || phase !== "typing") return;
    let index = 0;
    const interval = window.setInterval(() => {
      index += 2;
      setTyped({ step: stepIndex, text: DRAFT_TEXT.slice(0, index) });
      if (index >= DRAFT_TEXT.length) window.clearInterval(interval);
    }, 18);
    return () => window.clearInterval(interval);
  }, [phase, stepIndex, reducedMotion]);

  const shown = reducedMotion ? "ready" : phase;

  // Alleen tijdens het opstellen is het concept onaf. In alle andere fasen
  // tonen we de volledige tekst — ook terwijl het blok uitfadet, want tekst
  // die halverwege een fade leegklapt leest als een bug.
  const composing = shown === "drafting" || shown === "typing";
  const draftText = !composing
    ? DRAFT_TEXT
    : shown === "typing" && typed.step === stepIndex
      ? typed.text
      : "";

  const ticketVisible = shown !== "idle";
  const contextVisible = ["context", "drafting", "typing", "ready"].includes(shown);
  const draftVisible = ["drafting", "typing", "ready"].includes(shown);
  const contextCount = contextVisible ? CONTEXT_STEPS.length : 0;

  return (
    <div className="sq-demo" ref={containerRef} data-phase={shown}>
      <div className="sq-demo__chrome">
        <span className="sq-demo__dot" />
        <span className="sq-demo__dot" />
        <span className="sq-demo__dot" />
        <div className="sq-demo__status">
          <SequenceMark size={22} state={PHASE_TO_MARK[shown]} title="" />
          <span key={shown}>{PHASE_STATUS[shown]}</span>
        </div>
      </div>

      <div className="sq-demo__body">
        <aside className="sq-demo__list">
          <div className="sq-demo__list-head">
            <b>Inbox</b>
            <span className={ticketVisible ? "is-live" : ""}>{ticketVisible ? "1 nieuw" : "0 open"}</span>
          </div>

          <div className={`sq-demo__ticket ${ticketVisible ? "is-in" : ""} ${shown !== "idle" ? "is-active" : ""}`}>
            <i className="sq-demo__pip" />
            <div>
              <b>Bestelling nog niet ontvangen</b>
              <small>Jan Bakker · zojuist</small>
            </div>
          </div>

          <div className="sq-demo__ticket is-muted">
            <i className="sq-demo__pip sq-demo__pip--grey" />
            <div>
              <b>Retour aanmelden</b>
              <small>Sanne de Vries · 12 min</small>
            </div>
          </div>
          <div className="sq-demo__ticket is-muted">
            <i className="sq-demo__pip sq-demo__pip--grey" />
            <div>
              <b>Welke maat heb ik nodig?</b>
              <small>Peter Mol · 34 min</small>
            </div>
          </div>
        </aside>

        <div className="sq-demo__detail">
          <div className={`sq-demo__question ${ticketVisible ? "is-in" : ""}`}>
            <span className="sq-demo__label">KLANTVRAAG</span>
            <h3>Bestelling #4521 nog niet ontvangen</h3>
            <p>
              Hoi, mijn pakket zou gisteren bezorgd worden maar ik heb nog niets
              ontvangen. Kunnen jullie dit controleren?
            </p>
          </div>

          <div className={`sq-demo__context ${contextVisible ? "is-in" : ""}`}>
            {CONTEXT_STEPS.map((step, index) => (
              <div
                key={step.label}
                className={`sq-demo__context-row ${index < contextCount ? "is-in" : ""}`}
                style={{ transitionDelay: `${index * 160}ms` }}
              >
                <span className="sq-demo__check" aria-hidden>✓</span>
                <b>{step.label}</b>
                <small>{step.detail}</small>
              </div>
            ))}
          </div>

          <div className={`sq-demo__draft ${draftVisible ? "is-in" : ""}`}>
            <div className="sq-demo__draft-head">
              <span>CONCEPT</span>
              <strong className={composing ? "" : "is-ready"}>
                {composing ? "opstellen…" : "96% zeker"}
              </strong>
            </div>
            <p>
              {draftText}
              {shown === "typing" && <span className="sq-demo__caret" aria-hidden />}
            </p>
            <div className={`sq-demo__actions ${composing ? "" : "is-in"}`}>
              <button type="button" tabIndex={-1}>Goedkeuren en versturen</button>
              <button type="button" tabIndex={-1} className="is-ghost">Aanpassen</button>
            </div>
          </div>
        </div>
      </div>

      {/* Screenreaders krijgen de uitkomst, niet de animatiestappen. */}
      <p className="sq-demo__sr">
        Voorbeeld: een klant vraagt waar bestelling 4521 blijft. Support herkent de klant,
        koppelt de bestelling, haalt de verzendstatus op en zet een concept klaar dat jij
        goedkeurt of aanpast.
      </p>
    </div>
  );
}
