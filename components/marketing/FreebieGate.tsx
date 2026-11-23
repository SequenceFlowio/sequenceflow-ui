"use client";

import { ArrowRight, Check, Lock } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Turnstile } from "@/components/Turnstile";
import { findFreebie, type FreebieId } from "@/lib/marketing/freebies/catalog";

import { trackFreebieLead } from "./TrackingTags";

/**
 * E-mailgate voor een gratis download. Na invullen gaat de inhoud direct
 * open op de pagina (en blijft open in deze browser). Verstuurt naar
 * /api/marketing/lead.
 */

const COPY = {
  nl: {
    title: "Krijg direct toegang", sub: "Vul je e-mail in en de rest opent meteen hieronder. Gratis, zonder account.",
    name: "Voornaam", email: "E-mail", store: "Webshop", optional: "(optioneel)", storePlaceholder: "jouwwinkel.nl",
    marketing: "Stuur me ook af en toe praktische tips voor mijn webshop. Afmelden kan altijd.",
    send: "Open de download", sending: "Even geduld…", failed: "Dat lukte niet. Probeer het nog eens.",
    privacy: "Geen spam, en we delen je gegevens met niemand", privacyLink: "privacyverklaring",
  },
  en: {
    title: "Get instant access", sub: "Enter your email and the rest opens right below. Free, no account needed.",
    name: "First name", email: "Email", store: "Store", optional: "(optional)", storePlaceholder: "yourstore.com",
    marketing: "Also send me practical tips for my store now and then. Unsubscribe anytime.",
    send: "Open the download", sending: "One moment…", failed: "That didn't work. Please try again.",
    privacy: "No spam, and we never share your details", privacyLink: "privacy statement",
  },
};

const storageKey = (id: FreebieId) => `sf-freebie-${id}`;

function readUnlocked(id: FreebieId) {
  try {
    return window.localStorage.getItem(storageKey(id)) === "1";
  } catch {
    return false;
  }
}

export function FreebieGate({ freebie: id, lang = "nl", teaser, lockedNote, title, sub, button, children }: {
  freebie: FreebieId;
  lang?: "nl" | "en";
  /** Korte regel boven het formulier over wat er nog achter zit, bijvoorbeeld "Nog 27 antwoorden". */
  lockedNote?: string;
  /** Eigen kop, uitleg en knoptekst (bijvoorbeeld voor de wachtlijst van de Academy). */
  title?: string;
  sub?: string;
  button?: string;
  /** Wat iedereen al ziet zolang de gate dicht is (een voorproefje, ook voor Google). */
  teaser?: ReactNode;
  children: ReactNode;
}) {
  const t = COPY[lang];
  const keyword = findFreebie(id)?.keyword ?? id.toUpperCase();
  const [unlocked, setUnlocked] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openedAt = useRef<number | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);

  useEffect(() => {
    // Pas na het laden lezen, anders verschilt de server-HTML van de browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (readUnlocked(id)) { setUnlocked(true); return; }
    // Downloadlink uit de mail (?t=…): na controle op de server direct open, ook op een ander apparaat.
    const token = new URLSearchParams(window.location.search).get("t");
    if (!token) return;
    fetch("/api/marketing/lead/unlock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: token }) })
      .then((response) => {
        if (!response.ok) return;
        try { window.localStorage.setItem(storageKey(id), "1"); } catch { /* privévenster */ }
        setUnlocked(true);
      })
      .catch(() => undefined);
  }, [id]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/marketing/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          freebie: id, lang,
          email: form.get("email"),
          name: form.get("name"),
          store: form.get("store"),
          marketing: form.get("marketing") === "on",
          company: form.get("company"),
          captchaToken: captcha,
          source: window.location.search.slice(1, 300),
          elapsedMs: openedAt.current ? Date.now() - openedAt.current : 0,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t.failed);
      try {
        window.localStorage.setItem(storageKey(id), "1");
      } catch {
        // Privévenster: dan staat het alleen voor dit bezoek open.
      }
      trackFreebieLead(keyword);
      setUnlocked(true);
      // Het voorproefje verdwijnt; begin bovenaan de volledige lijst.
      window.requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t.failed);
      // Een token is één keer bruikbaar: haal een nieuw voor de volgende poging.
      setCaptchaReset((value) => value + 1);
    } finally {
      setSending(false);
    }
  }

  if (unlocked) return <div ref={top} className="fb-unlocked">{children}</div>;

  return (
    <div className="fb-gate" ref={top}>
      {teaser ? <div className="fb-gate-teaser">{teaser}</div> : null}
      <form className="fb-gate-card cx-card" onSubmit={submit} onFocus={() => { if (openedAt.current === null) openedAt.current = Date.now(); }} noValidate>
        <span className="fb-gate-lock" aria-hidden><Lock size={18} /></span>
        {lockedNote ? <p className="fb-note">{lockedNote}</p> : null}
        <h2>{title ?? t.title}</h2>
        <p className="cx-sub">{sub ?? t.sub}</p>
        <div className="cx-fields">
          <label><span>{t.name} <small>{t.optional}</small></span><input name="name" maxLength={120} autoComplete="given-name" /></label>
          <label><span>{t.email}</span><input name="email" type="email" required maxLength={200} autoComplete="email" /></label>
          <label className="fb-wide"><span>{t.store} <small>{t.optional}</small></span><input name="store" maxLength={200} placeholder={t.storePlaceholder} /></label>
        </div>
        <label className="fb-check"><input type="checkbox" name="marketing" /><span><Check size={12} strokeWidth={3} aria-hidden /></span>{t.marketing}</label>
        {/* Honeypot: mensen zien dit veld niet, bots vullen het wel in. */}
        <label className="mk-meet-hp" aria-hidden="true"><span>Bedrijf</span><input name="company" tabIndex={-1} autoComplete="off" /></label>
        <Turnstile onToken={setCaptcha} resetKey={captchaReset} lang={lang} />
        {error ? <p className="cx-error" role="alert">{error}</p> : null}
        <button type="submit" className="mk-button mk-button--primary fb-submit" disabled={sending}>{sending ? t.sending : <>{button ?? t.send} <ArrowRight size={15} /></>}</button>
        <p className="fb-privacy">{t.privacy}{" · "}<a href={lang === "en" ? "/en/privacy-statement" : "/nl/privacyverklaring"}>{t.privacyLink}</a></p>
      </form>
    </div>
  );
}
