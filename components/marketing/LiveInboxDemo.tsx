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

const examplesEn: typeof examples = [
  { name: "Delivery", subject: "Where is my order?", question: "Hi, my order #4521 still hasn't arrived. Could you check where my parcel is?", source: "Order #4521 · your store", facts: ["Order found", "Status: in transit", "Delivery time not yet confirmed"], draft: "Hi Jan, I've looked up your order. Your parcel is on its way. There's no confirmed delivery time yet. The tracking link with your order shows the latest shipping status.", note: "A shipping status never becomes a delivery promise." },
  { name: "Return", subject: "Can I return my order?", question: "I received my order last week but would like to send it back. How does that work?", source: "Return policy · sample store", facts: ["Return window: 30 days", "Order number missing", "Ask for the order first"], draft: "Hi Sanne, under our return policy you can register a return within 30 days. Could you send us your order number? Then we can look up your order and help you with the return.", note: "Your terms decide the answer." },
  { name: "Product question", subject: "Can this go in the washing machine?", question: "I bought your pillow. Can the whole pillow go in the washing machine, or just the cover?", source: "Product information · sample store", facts: ["Cover: washable at 30 °C", "Insert: not machine washable", "Product information as context"], draft: "Hi Alex, the removable cover can be washed at 30 °C. The pillow insert can't go in the washing machine. So take the cover off first and follow the care label for drying.", note: "A specific answer to a specific question." },
];

/** Scripted examples only: no customer data, requests or mail delivery. */
export function LiveInboxDemo({ lang = "nl" }: { lang?: "nl" | "en" }) {
  const en = lang === "en";
  const list = en ? examplesEn : examples;
  const t = (nl: string, english: string) => en ? english : nl;
  const [selected, setSelected] = useState(0);
  const [stage, setStage] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState(false);
  const [approved, setApproved] = useState(false);
  const [draft, setDraft] = useState(list[0].draft);
  // Zolang niemand iets aanklikt, loopt de demo vanzelf door de voorbeelden.
  // De eerste klik geeft de bezoeker de regie; daarna springt hij niet meer weg.
  const [interacted, setInteracted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const reduced = useReducedMotion();
  const shown = reduced ? 3 : stage;
  const example = list[selected];

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
      const next = (selected + 1) % list.length;
      setSelected(next); setDraft(list[next].draft); setStage(0);
    }, 4800);
    return () => window.clearTimeout(timer);
  }, [visible, paused, reduced, interacted, approved, stage, selected, list]);

  function choose(index: number) {
    setInteracted(true);
    setSelected(index); setDraft(list[index].draft); setStage(0);
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
      <h2 className="so-sr-only">{t("Voorbeeld: van klantvraag naar antwoordconcept", "Example: from customer question to reply draft")}</h2>
      <div className="so-example-toolbar">
        <div className="so-scenarios" role="group" aria-label={t("Kies een voorbeeldvraag", "Choose an example question")}>
          {list.map((item, index) => <button type="button" key={item.name} aria-pressed={selected === index} aria-controls={id} onClick={() => choose(index)}>{item.name}</button>)}
        </div>
        <div className="so-playback">
          <span>{autoplaying ? t("Speelt automatisch af", "Playing automatically") : t("Interactieve demo", "Interactive demo")}</span>
          {!reduced && (shown < 3 || autoplaying) ? <button type="button" onClick={() => setPaused(!paused)} aria-label={paused ? t("Demo hervatten", "Resume demo") : t("Demo pauzeren", "Pause demo")}>{paused ? <Play size={15} /> : <Pause size={15} />}</button> : <button type="button" onClick={restart} aria-label={t("Demo opnieuw bekijken", "Watch the demo again")}><RotateCcw size={15} /></button>}
        </div>
      </div>
      <div className="so-demo-window" id={id}>
        <div className="so-demo-top"><SequenceMark size={26} state={shown >= 3 ? "happy" : "reading"} title="" /><strong>Support One</strong><span>{t("Voorbeeldwerkruimte", "Sample workspace")}</span></div>
        <div className="so-demo-columns">
          <div className="so-demo-incoming"><span className="so-label"><Mail size={14} /> {t("KLANTVRAAG", "CUSTOMER QUESTION")}</span><h3>{example.subject}</h3><p>{example.question}</p><div className="so-demo-context"><span className="so-label">{t("BESCHIKBARE CONTEXT", "AVAILABLE CONTEXT")}</span><strong>{example.source}</strong><ul>{example.facts.map((fact, index) => <li key={fact} className={shown >= 1 ? "is-revealed" : ""} style={{ transitionDelay: `${index * 130}ms` }}><Check size={14} />{fact}</li>)}</ul></div></div>
          <div className={`so-demo-reply ${approved ? "so-demo-reply--sent" : ""}`}>
            {approved ? (
              <div className="so-send-result">
                <div className="so-send-result__icon" aria-hidden><Send size={25} /><span><Check size={12} /></span></div>
                <span className="so-label">{t("ZO ZIET VERSTUREN ERUIT", "THIS IS WHAT SENDING LOOKS LIKE")}</span>
                <h3>{t("Antwoord onderweg.", "Reply on its way.")}<br />{t("Volgende klantvraag?", "Next customer question?")}</h3>
                <p>{t("Jij hebt het laatste woord. Support One neemt het voorbereidende werk uit handen.", "You have the final say. Support One takes the prep work off your hands.")}</p>
                <div className="so-sent-message"><span><Check size={13} /> {t("Verzonden · simulatie", "Sent · simulation")}</span><p>{draft}</p></div>
              </div>
            ) : (
              <>
                <div className="so-reply-heading"><span className="so-label">{t("ANTWOORDCONCEPT", "REPLY DRAFT")}</span><span className="so-state">{shown >= 3 ? t("Klaar voor controle", "Ready for review") : paused ? t("Gepauzeerd", "Paused") : t("Wordt voorbereid", "Being prepared")}</span></div>
                <div className={`so-reply-content ${shown >= 2 ? "is-revealed" : ""}`}>
                  {editing ? <textarea aria-label={t("Pas het voorbeeldantwoord aan", "Edit the sample reply")} value={draft} onChange={event => setDraft(event.target.value)} /> : <p>{draft}</p>}
                </div>
              </>
            )}
            <div className="so-demo-bottom">
              {!approved && <p>{example.note}</p>}
              <div className="so-demo-actions">
                <button type="button" className="so-action-primary" disabled={shown < 3 || (!approved && !draft.trim())} onClick={() => {
                  if (approved) {
                    choose((selected + 1) % list.length);
                    ref.current?.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
                  }
                  else { setInteracted(true); setApproved(true); setEditing(false); }
                }}>{approved ? <ArrowRight size={15} /> : <Send size={15} />}{approved ? t("Volgende klantvraag", "Next customer question") : t("Goedkeuren & versturen", "Approve & send")}</button>
                {!approved && <button type="button" disabled={shown < 3} onClick={() => { setInteracted(true); setEditing(!editing); }}>{editing ? t("Aanpassing bewaren", "Save edit") : t("Aanpassen", "Edit")}</button>}
              </div>
              <p className="so-demo-feedback" role="status">{approved ? t("Voorbeeldantwoord verstuurd in de demo. Er is geen echte e-mail verzonden.", "Sample reply sent in the demo. No real email was sent.") : t("Probeer het zelf · dit is een simulatie", "Try it yourself · this is a simulation")}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="so-demo-caption"><Send size={14} /><span>{t("Van klantvraag naar concept. Jij hebt het laatste woord.", "From customer question to draft. You have the final say.")}</span></div>
    </div>
  );
}
