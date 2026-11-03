"use client";

import { useState } from "react";
import { Check, ArrowRight, Mail, CalendarDays, Package } from "lucide-react";
import { SequenceMark } from "./SequenceMark";

/** Illustrative product states; never sends mail or publishes content. */
export function HubProductDemo({ mode = "switchable" }: { mode?: "switchable" | "support" | "content" }) {
  const [selected, setSelected] = useState<"support" | "content">("support");
  const product = mode === "switchable" ? selected : mode;
  return <div className="hp-demo">
    <div className="hp-toolbar">
      {mode === "switchable" ? <div className="hp-tabs" role="group" aria-label="Kies een productvoorbeeld">
        {(["support", "content"] as const).map(value => <button key={value} type="button" aria-pressed={product === value} onClick={() => { setSelected(value); }}>{value === "support" ? "Support One" : "Content One"}</button>)}
      </div> : <strong>{product === "support" ? "Support One" : "Content One"}</strong>}
      <span className="hp-example">{product === "support" ? "Interactief voorbeeld" : "Productconcept · early access"}</span>
    </div>
    <div className="hp-workspace" key={product}>
      <div className="hp-source">
        <span className="hp-label">{product === "support" ? <><Mail size={14} /> KLANTVRAAG</> : <><Package size={14} /> JOUW PRODUCT</>}</span>
        <h3>{product === "support" ? "Je inbox. Met een voorsprong." : "Een nieuw product. Een week aan ideeën."}</h3>
        <p>{product === "support" ? "Je klantvragen komen binnen. Support One gebruikt je winkelbeleid en beschikbare bestelgegevens om antwoorden voor te bereiden." : "Essential knit · Zand\nEen zachte knit voor frisse dagen. Gemaakt om eindeloos te combineren."}</p>
        <div className="hp-context"><span className="hp-label">{product === "support" ? "BESCHIKBARE CONTEXT" : "MERKAFSPRAKEN"}</span><span><Check size={15} />{product === "support" ? "Retourbeleid: aanmelden binnen 30 dagen" : "Rustige beelden, natuurlijke kleuren"}</span><span><Check size={15} />{product === "support" ? "Antwoordstijl: persoonlijk en helder" : "Persoonlijke captions, zonder verkooppraat"}</span></div>
      </div>
      <div className="hp-result">
        <div className="hp-result-head"><SequenceMark size={38} gear={product === "support" ? "headset" : "camera"} state="reading" title="" /><span className="hp-label">{product === "support" ? "KLAAR VOOR BEOORDELING" : "CONTENTVOORSTEL"}</span><span className="hp-status">Jij beslist</span></div>
        {product === "support" ? <div className="hp-calendar"><div><Mail size={17} /><span><small>BEZORGING</small><strong>Waar blijft mijn bestelling?</strong></span><span className="hp-dot" /></div><div><Package size={17} /><span><small>RETOUR</small><strong>Kan ik een andere maat krijgen?</strong></span><span className="hp-dot" /></div><p>Je klantvragen en voorbereide antwoorden op één plek. Bekijk de context en beslis wat de deur uitgaat.</p></div> : <div className="hp-calendar">{["Maandag", "Woensdag", "Vrijdag"].map((day, i) => <div key={day}><CalendarDays size={17} /><span><small>{day}</small><strong>{["Zo draag je de nieuwe knit", "Eén knit, drie combinaties", "Jouw favoriet voor frisse dagen"][i]}</strong></span><span className="hp-dot" /></div>)}<p>Drie invalshoeken vanuit hetzelfde product. Beoordeel de beelden en teksten voordat je plant.</p></div>}
        <div className="hp-demo-action"><a className="hp-approve" href="#producten">Bekijk hoe het werkt <ArrowRight size={16} /></a><small>Illustratieve productvoorbeelden</small></div>
      </div>
    </div>
    <div className="hp-demo-foot"><span>{product === "support" ? "Van klantvraag naar een antwoord dat jij controleert." : "Van productinformatie naar een concrete contentplanning."}</span><ArrowRight size={16} /></div>
  </div>;
}
