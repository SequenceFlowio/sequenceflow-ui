"use client";

import { Check, Copy, Lightbulb, Printer } from "lucide-react";
import { useState } from "react";

import { REPLY_BANK, REPLY_PREVIEW_IDS, type Reply, type ReplyCategoryId } from "@/lib/marketing/freebies/replyBank";

import { FreebieGate } from "./FreebieGate";
import { MarketingCta } from "./MarketingCta";

/**
 * De Antwoordenbank op /nl/gratis/antwoordenbank en /en/free/reply-bank:
 * drie antwoorden open, de rest achter de e-mailgate. Elk antwoord kan
 * gekopieerd worden; de hele bank kan als pdf bewaard worden (printen).
 */

const COPY = {
  nl: {
    preview: "Drie voorbeelden", all: "Alles", subject: "Onderwerp", copy: "Kopieer", copied: "Gekopieerd",
    print: "Bewaar als pdf", count: (n: number) => `${n} antwoorden`,
    locked: (n: number) => `Nog ${n} antwoorden, plus een pdf-versie`,
    ctaTitle: "Deze mails voortaan niet meer zelf typen?",
    ctaText: "Seffy, de AI-collega in Support One, beantwoordt dit soort vragen in jouw toon en met de gegevens uit je webshop. Jij keurt goed, Seffy doet de rest.",
    ctaButton: "Probeer Support One 14 dagen gratis", ctaHref: "/login?intent=signup&source=antwoordenbank",
  },
  en: {
    preview: "Three examples", all: "All", subject: "Subject", copy: "Copy", copied: "Copied",
    print: "Save as PDF", count: (n: number) => `${n} replies`,
    locked: (n: number) => `${n} more replies, plus a PDF version`,
    ctaTitle: "Done typing these yourself?",
    ctaText: "Seffy, the AI teammate in Support One, answers questions like these in your tone, with the details from your store. You approve, Seffy does the rest.",
    ctaButton: "Try Support One free for 14 days", ctaHref: "/login?intent=signup&source=reply-bank",
  },
};

/** Tekst tussen [haken] is wat de webshop zelf invult: die maken we zichtbaar. */
function Placeholders({ text }: { text: string }) {
  return <>{text.split(/(\[[^\]\n]+\])/g).map((part, index) => (part.startsWith("[") && part.endsWith("]") ? <mark key={index}>{part}</mark> : part))}</>;
}

function ReplyCard({ reply, lang, label }: { reply: Reply; lang: "nl" | "en"; label: string }) {
  const t = COPY[lang];
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${t.subject}: ${reply.subject}\n\n${reply.body}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Geen klembord (oude browser of geen toestemming): tekst blijft selecteerbaar.
    }
  }

  return (
    <article className="rb-card" id={reply.id}>
      <header>
        <span className="rb-cat">{label}</span>
        <h3>{reply.title}</h3>
        <button type="button" className="rb-copy" onClick={copy} aria-label={`${t.copy}: ${reply.title}`}>
          {copied ? <><Check size={14} strokeWidth={3} /> {t.copied}</> : <><Copy size={14} /> {t.copy}</>}
        </button>
      </header>
      <p className="rb-subject"><span>{t.subject}</span> <Placeholders text={reply.subject} /></p>
      <div className="rb-body"><Placeholders text={reply.body} /></div>
      <p className="rb-tip"><Lightbulb size={15} aria-hidden /> {reply.tip}</p>
    </article>
  );
}

export function ReplyBankView({ lang = "nl" }: { lang?: "nl" | "en" }) {
  const t = COPY[lang];
  const bank = REPLY_BANK[lang];
  const [filter, setFilter] = useState<ReplyCategoryId | "all">("all");
  const labelOf = (id: ReplyCategoryId) => bank.categories.find((category) => category.id === id)?.label ?? "";
  const preview = REPLY_PREVIEW_IDS.map((id) => bank.replies.find((reply) => reply.id === id)!).filter(Boolean);
  const shown = bank.replies.filter((reply) => filter === "all" || reply.category === filter);

  const cta = (
    <aside className="rb-cta">
      <h2>{t.ctaTitle}</h2>
      <p>{t.ctaText}</p>
      <MarketingCta href={t.ctaHref}>{t.ctaButton}</MarketingCta>
    </aside>
  );

  return (
    <FreebieGate
      freebie="antwoord"
      lang={lang}
      lockedNote={t.locked(bank.replies.length - preview.length)}
      teaser={
        <>
          <h2 className="rb-section-title">{t.preview}</h2>
          <div className="rb-grid">{preview.map((reply) => <ReplyCard key={reply.id} reply={reply} lang={lang} label={labelOf(reply.category)} />)}</div>
        </>
      }
    >
      <div className="rb-toolbar">
        <div className="cx-chips" role="group">
          {[{ id: "all" as const, label: t.all }, ...bank.categories].map((category) => (
            <button type="button" key={category.id} aria-pressed={filter === category.id} className={filter === category.id ? "is-selected" : ""} onClick={() => setFilter(category.id)}>{category.label}</button>
          ))}
        </div>
        <span className="rb-count">{t.count(shown.length)}</span>
        <button type="button" className="mk-button mk-button--secondary rb-print" onClick={() => { setFilter("all"); window.setTimeout(() => window.print(), 50); }}><Printer size={15} /> {t.print}</button>
      </div>
      <div className="rb-grid">{shown.map((reply) => <ReplyCard key={reply.id} reply={reply} lang={lang} label={labelOf(reply.category)} />)}</div>
      {cta}
    </FreebieGate>
  );
}
