"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowRight, Check, Mail, Package, CalendarDays, TrendingDown } from "lucide-react";
import { SequenceMark } from "./SequenceMark";

export function SupportWorkflow() {
  const [step, setStep] = useState(0);
  return <div className="hs-support">
    <div className="hs-windowbar"><span><i /><i /><i /></span><small>Support One / Inbox</small><span className="hp-status">Voorbeeld</span></div>
    <div className="hs-mailrow"><Mail size={18} /><span><small>Nieuwe klantvraag · Sanne</small><strong>Waar blijft mijn bestelling?</strong></span></div>
    <div className="hs-workflow-body">
      <p>“Ik heb nog geen pakket ontvangen. Kunnen jullie de status van bestelling #1043 bekijken?”</p>
      <div className="hs-order"><Package size={20} /><span><small>Bestelling #1043</small><strong>Overgedragen aan de vervoerder</strong></span><Check size={16} /></div>
      {step > 0 && <div className="hs-answer"><SequenceMark size={32} state={step === 2 ? "happy" : "reading"} title="" /><p>Hoi Sanne, je bestelling is overgedragen aan de vervoerder. Een bezorgdatum is nog niet bevestigd. Je vindt de laatste status via je track & trace.</p></div>}
      {step === 2 && <div className="hs-done" role="status"><Check size={17} /> Goedgekeurd. In de app kun je het nu versturen.</div>}
      <div className="hs-workflow-actions"><button type="button" onClick={() => setStep(step === 2 ? 0 : step + 1)}>{["Bekijk het antwoordconcept", "Keur het voorbeeld goed", "Bekijk opnieuw"][step]}<ArrowRight size={15} /></button><small>Voorbeelddata · er wordt niets verstuurd</small></div>
    </div>
    <div className="hs-steps">{["Vraag", "Context & concept", "Jouw akkoord"].map((label, i) => <span key={label} className={step >= i ? "is-active" : ""}><b>{i + 1}</b>{label}</span>)}</div>
  </div>;
}

export function ContentCampaign({ brand = false }: { brand?: boolean }) {
  const [format, setFormat] = useState(0);
  const formats = ["Productpost", "Carrousel", "Story"];
  if (brand) return <div className="hs-brand-board"><div className="hs-brand-palette"><span>JOUW MERKSTIJL</span><i /><i /><i /><strong>Aa</strong></div><div className="hs-brand-posts">{["Jouw dagelijkse ritueel.", "Zacht voor je huid.", "Een moment voor jezelf."].map((title,i) => <div className={`hs-brand-post hs-brand-post--${i}`} key={title}><Image src="/media/site/content-product.jpg" alt="Product in een consistente voorbeeldmerkstijl" fill sizes="180px" /><div><small>JOUW MERK</small><strong>{title}</strong></div></div>)}</div><p>Eén beeldtaal. Drie invalshoeken.</p><small>Illustratie van de beoogde merkstudio · early access</small></div>;
  return <div className={`hs-campaign${brand ? " hs-campaign--brand" : ""}`}>
    <div className="hs-content-bar"><SequenceMark gear="camera" size={32} state="thinking" title="" /><span>Content One</span><small>Productconcept · early access</small></div>
    <div className="hs-campaign-stage">
      <div className="hs-product"><div className="hs-product-image"><Image src="/media/site/content-product.jpg" alt="Voorbeeldproduct voor een contentcampagne" fill sizes="160px" /></div><small>VANUIT JE CATALOGUS</small><strong>Jouw product</strong><span>Beeld + productinformatie</span></div>
      <ArrowRight className="hs-campaign-arrow" size={24} />
      <div className="hs-post" key={format}><Image src={`/media/site/${["content-post", "content-example-carousel", "content-example-ugc"][format]}.jpg`} alt={`Voorbeeld van een ${formats[format].toLowerCase()} voor je product`} fill sizes="(max-width:760px) 70vw, 350px" /><div className="hs-post-overlay"><span>NIEUW IN DE COLLECTIE</span><strong>{["Kleine momenten.\nGroot verschil.", "Drie manieren.\nHelemaal jouw stijl.", "Jouw dagelijkse\nfavoriet."][format]}</strong><small>JOUW MERK</small></div></div>
    </div>
    <div className="hs-format-picker" role="group" aria-label="Contentformat">{formats.map((label,i) => <button type="button" key={label} aria-pressed={format === i} onClick={() => setFormat(i)}>{label}</button>)}</div>
    <div className="hs-schedule"><CalendarDays size={16} /><span>{brand ? "Eén merkstijl, in elk format." : "Van product naar voorstel. Jij bepaalt wanneer het live gaat."}</span></div>
  </div>;
}

export function SupportInsight() {
  return <div className="hs-insight"><div className="hs-insight-head"><SequenceMark size={44} state="investigating" title="" /><span><strong>Vera kijkt met je mee.</strong><small>Voorraad & klantvragen · voorbeelddata</small></span></div><div className="hs-insight-number"><strong>9 <small>dagen</small></strong><span>tot maat M naar verwachting op is<br />bij de huidige verkoopsnelheid</span></div><div className="hs-stock-bars">{[["S",70],["M",18],["L",52]].map(([size,width]) => <div key={size}><span>{size}</span><i><b style={{width:`${width}%`}} /></i></div>)}</div><div className="hs-insight-note"><TrendingDown size={19} /><span><strong>Bestel bij vóór je misgrijpt.</strong><small>Bekijk het inkoopadvies en houd rekening met je levertijd.</small></span></div></div>;
}
