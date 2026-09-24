"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, Check, Mail, Pause, Play, RotateCcw, Send } from "lucide-react";
import { SequenceMark } from "./SequenceMark";
import { useReducedMotion } from "./useReducedMotion";

const examples = [
  { name: "Bezorging", subject: "Waar blijft mijn bestelling?", question: "Hoi, mijn bestelling #4521 is nog niet binnen. Kunnen jullie kijken waar mijn pakket is?", source: "Bestelling #4521 · je webshop", facts: ["Bestelling gevonden", "Status: onderweg", "Bezorgmoment nog niet bevestigd"], draft: "Hoi Jan, ik heb je bestelling erbij gepakt. Je pakket is onderweg. Er is nog geen bevestigd bezorgmoment beschikbaar. Via de track & trace bij je bestelling kun je de laatste verzendstatus bekijken.", note: "Een verzendstatus wordt geen bezorgbelofte." },
  { name: "Retourvraag", subject: "Kan ik mijn bestelling retourneren?", question: "Ik heb mijn bestelling vorige week ontvangen, maar wil deze graag terugsturen. Hoe werkt dat?", source: "Retourbeleid · voorbeeldwinkel", facts: ["Retourtermijn: 30 dagen", "Bestelnummer ontbreekt", "Eerst de bestelling opvragen"], draft: "Hoi Sanne, volgens ons retourbeleid kun je je retour binnen 30 dagen aanmelden. Wil je je bestelnummer doorgeven? Dan kunnen we je bestelling erbij pakken en je verder helpen met de retouraanmelding.", note: "Jouw voorwaarden bepalen het antwoord." },
  { name: "Productvraag", subject: "Mag dit product in de wasmachine?", question: "Ik heb jullie kussen gekocht. Kan het hele kussen in de wasmachine, of alleen de hoes?", source: "Productinformatie · voorbeeldwinkel", facts: ["Hoes: wasbaar op 30 °C", "Kern: niet machinewasbaar", "Productinformatie als context"], draft: "Hoi Alex, de afneembare hoes kun je op 30 °C wassen. De kern van het kussen mag niet in de wasmachine. Haal de hoes dus eerst van het kussen en volg het waslabel voor het drogen.", note: "Een specifiek antwoord op een specifieke vraag." },
];

/** Scripted examples only: no customer data, requests or mail delivery. */
export function LiveInboxDemo() {
  const [selected, setSelected] = useState(0);
  const [stage, setStage] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState(false);
  const [approved, setApproved] = useState(false);
  const [draft, setDraft] = useState(examples[0].draft);
  // Zolang niemand iets aanklikt, loopt de demo vanzelf door de voorbeelden.
  // De eerste klik geeft de bezoeker de regie; daarna springt hij niet meer weg.
  const [interacted, setInteracted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const reduced = useReducedMotion();
  const shown = reduced ? 3 : stage;
  const example = examples[selected];

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .15 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || paused || reduced || stage >= 3) return;
    const timer = window.setTimeout(() => setStage(value => value + 1), stage === 0 ? 600 : 1100);
    return () => window.clearTimeout(timer);
  }, [visible, paused, reduced, stage]);

  useEffect(() => {
    if (!visible || paused || reduced || interacted || approved || stage < 3) return;
    const timer = window.setTimeout(() => {
      const next = (selected + 1) % examples.length;
      setSelected(next); setDraft(examples[next].draft); setStage(0);
    }, 4800);
    return () => window.clearTimeout(timer);
  }, [visible, paused, reduced, interacted, approved, stage, selected]);

  function choose(index: number) {
    setInteracted(true);
    setSelected(index); setDraft(examples[index].draft); setStage(0);
    setApproved(false); setEditing(false); setPaused(false);
  }

  function restart() {
    choose(selected);
    setInteracted(false);
  }

  const autoplaying = !reduced && !interacted;

  return (
    <div className="so-example" ref={ref} id="voorbeelden">
      {/* De demo staat direct onder de H1; zonder deze kop sprong de structuur van H1 naar H3. */}
      <h2 className="so-sr-only">Voorbeeld: van klantvraag naar antwoordconcept</h2>
      <div className="so-example-toolbar">
        <div className="so-scenarios" role="group" aria-label="Kies een voorbeeldvraag">
          {examples.map((item, index) => <button type="button" key={item.name} aria-pressed={selected === index} aria-controls={id} onClick={() => choose(index)}>{item.name}</button>)}
        </div>
        <div className="so-playback">
          <span>{autoplaying ? "Speelt automatisch af" : "Interactieve demo"}</span>
          {!reduced && (shown < 3 || autoplaying) ? <button type="button" onClick={() => setPaused(!paused)} aria-label={paused ? "Demo hervatten" : "Demo pauzeren"}>{paused ? <Play size={15} /> : <Pause size={15} />}</button> : <button type="button" onClick={restart} aria-label="Demo opnieuw bekijken"><RotateCcw size={15} /></button>}
        </div>
      </div>
      <div className="so-demo-window" id={id}>
        <div className="so-demo-top"><SequenceMark size={26} state={shown >= 3 ? "happy" : "reading"} title="" /><strong>Support One</strong><span>Voorbeeldwerkruimte</span></div>
        <div className="so-demo-columns">
          <div className="so-demo-incoming"><span className="so-label"><Mail size={14} /> KLANTVRAAG</span><h3>{example.subject}</h3><p>{example.question}</p><div className="so-demo-context"><span className="so-label">BESCHIKBARE CONTEXT</span><strong>{example.source}</strong><ul>{example.facts.map((fact, index) => <li key={fact} className={shown >= 1 ? "is-revealed" : ""} style={{ transitionDelay: `${index * 130}ms` }}><Check size={14} />{fact}</li>)}</ul></div></div>
          <div className={`so-demo-reply ${approved ? "so-demo-reply--sent" : ""}`}>
            {approved ? (
              <div className="so-send-result">
                <div className="so-send-result__icon" aria-hidden><Send size={25} /><span><Check size={12} /></span></div>
                <span className="so-label">ZO ZIET VERSTUREN ERUIT</span>
                <h3>Antwoord onderweg.<br />Volgende klantvraag?</h3>
                <p>Jij hebt het laatste woord. Support One neemt het voorbereidende werk uit handen.</p>
                <div className="so-sent-message"><span><Check size={13} /> Verzonden · simulatie</span><p>{draft}</p></div>
              </div>
            ) : (
              <>
                <div className="so-reply-heading"><span className="so-label">ANTWOORDCONCEPT</span><span className="so-state">{shown >= 3 ? "Klaar voor controle" : paused ? "Gepauzeerd" : "Wordt voorbereid"}</span></div>
                <div className={`so-reply-content ${shown >= 2 ? "is-revealed" : ""}`}>
                  {editing ? <textarea aria-label="Pas het voorbeeldantwoord aan" value={draft} onChange={event => setDraft(event.target.value)} /> : <p>{draft}</p>}
                </div>
              </>
            )}
            <div className="so-demo-bottom">
              {!approved && <p>{example.note}</p>}
              <div className="so-demo-actions">
                <button type="button" className="so-action-primary" disabled={shown < 3 || (!approved && !draft.trim())} onClick={() => {
                  if (approved) {
                    choose((selected + 1) % examples.length);
                    ref.current?.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
                  }
                  else { setInteracted(true); setApproved(true); setEditing(false); }
                }}>{approved ? <ArrowRight size={15} /> : <Send size={15} />}{approved ? "Volgende klantvraag" : "Goedkeuren & versturen"}</button>
                {!approved && <button type="button" disabled={shown < 3} onClick={() => { setInteracted(true); setEditing(!editing); }}>{editing ? "Aanpassing bewaren" : "Aanpassen"}</button>}
              </div>
              <p className="so-demo-feedback" role="status">{approved ? "Voorbeeldantwoord verstuurd in de demo. Er is geen echte e-mail verzonden." : "Probeer het zelf · dit is een simulatie"}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="so-demo-caption"><Send size={14} /><span>Van klantvraag naar concept. Jij hebt het laatste woord.</span></div>
    </div>
  );
}
