"use client";

import { useState } from "react";
import { Check, ArrowRight, Mail, CalendarDays, Package } from "lucide-react";
import { SequenceMark } from "./SequenceMark";

/** Illustrative product states; never sends mail or publishes content. */
export function HubProductDemo({ mode = "switchable" }: { mode?: "switchable" | "support" | "content" }) {
  const [selected, setSelected] = useState<"support" | "content">("support");
  const [approved, setApproved] = useState(false);
  const product = mode === "switchable" ? selected : mode;
  return <div className="hp-demo">
    <div className="hp-toolbar">
      {mode === "switchable" ? <div className="hp-tabs" role="group" aria-label="Kies een productvoorbeeld">
        {(["support", "content"] as const).map(value => <button key={value} type="button" aria-pressed={product === value} onClick={() => { setSelected(value); setApproved(false); }}>{value === "support" ? "Support One" : "Content One"}</button>)}
      </div> : <strong>{product === "support" ? "Support One" : "Content One"}</strong>}
      <span className="hp-example">{product === "support" ? "Interactief voorbeeld" : "Productconcept · early access"}</span>
    </div>
    <div className="hp-workspace" key={product}>
      <div className="hp-source">
        <span className="hp-label">{product === "support" ? <><Mail size={14} /> KLANTVRAAG</> : <><Package size={14} /> JOUW PRODUCT</>}</span>
        <h3>{product === "support" ? "Kan ik mijn bestelling ruilen?" : "Een nieuw product. Een week aan ideeën."}</h3>
        <p>{product === "support" ? "Hoi! De trui zit net te ruim. Kan ik maat M omruilen voor een S? Groetjes, Sanne" : "Essential knit · Zand\nEen zachte knit voor frisse dagen. Gemaakt om eindeloos te combineren."}</p>
        <div className="hp-context"><span className="hp-label">{product === "support" ? "BESCHIKBARE CONTEXT" : "MERKAFSPRAKEN"}</span><span><Check size={15} />{product === "support" ? "Retourbeleid: aanmelden binnen 30 dagen" : "Rustige beelden, natuurlijke kleuren"}</span><span><Check size={15} />{product === "support" ? "Antwoordstijl: persoonlijk en helder" : "Persoonlijke captions, zonder verkooppraat"}</span></div>
      </div>
      <div className="hp-result">
        <div className="hp-result-head"><SequenceMark size={38} gear={product === "support" ? "headset" : "camera"} state={approved ? "happy" : "reading"} title="" /><span className="hp-label">{product === "support" ? "ANTWOORDCONCEPT" : "CONTENTVOORSTEL"}</span><span className="hp-status">{approved ? "Goedgekeurd" : "Jij beslist"}</span></div>
        {product === "support" ? <p className="hp-reply">Hoi Sanne,<br /><br />Je kunt je retour binnen 30 dagen aanmelden. Geef daarbij aan dat je de trui graag voor maat S wilt ruilen. We controleren dan of die maat beschikbaar is en helpen je verder.<br /><br />Groet, het supportteam</p> : <div className="hp-calendar">{["Maandag", "Woensdag", "Vrijdag"].map((day, i) => <div key={day}><CalendarDays size={17} /><span><small>{day}</small><strong>{["Zo draag je de nieuwe knit", "Eén knit, drie combinaties", "Jouw favoriet voor frisse dagen"][i]}</strong></span><span className="hp-dot" /></div>)}<p>Drie invalshoeken vanuit hetzelfde product. Beoordeel de beelden en teksten voordat je plant.</p></div>}
        <div className="hp-demo-action">{approved ? <div className="hp-success" role="status"><Check size={18} /><span><strong>{product === "support" ? "Klaar om te versturen." : "Klaar om in te plannen."}</strong><small>Dit is een voorbeeld. Er is niets verstuurd of gepubliceerd.</small></span><button type="button" onClick={() => setApproved(false)}>Opnieuw</button></div> : <><button type="button" className="hp-approve" onClick={() => setApproved(true)}><Check size={17} />{product === "support" ? "Keur het voorbeeld goed" : "Keur het voorstel goed"}</button><small>Probeer het · er wordt niets verstuurd</small></>}</div>
      </div>
    </div>
    <div className="hp-demo-foot"><span>{product === "support" ? "Van klantvraag naar een antwoord dat jij controleert." : "Van productinformatie naar een concrete contentplanning."}</span><ArrowRight size={16} /></div>
  </div>;
}
