"use client";

import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useRef, useState } from "react";

import { CONTACT_INTAKE, WHATSAPP_TEXT_EN, whatsappLink } from "@/lib/marketing/contactIntake";

import { SequenceMark } from "./SequenceMark";

/**
 * De vragenlijst op /nl/contact en /en/contact: drie korte stappen in plaats van één groot
 * formulier. Stap 1 is één klik, stap 2 alleen keuzeknoppen, pas in stap 3
 * vragen we om gegevens. Zo blijft het laagdrempelig, en weten we bij het
 * eerste antwoord al waar iemand staat. Verstuurt naar /api/marketing/intake.
 */

type Goal = (typeof CONTACT_INTAKE.goals)[number]["id"];
type Reach = (typeof CONTACT_INTAKE.reach)[number]["id"];
type State = "idle" | "sending" | "sent";

const COPY = {
  nl: {
    steps: ["Waarmee?", "Je webshop", "Je gegevens"],
    failed: "Versturen is niet gelukt.",
    thanks: "Dank je, we hebben het.",
    within: "We nemen binnen één werkdag contact op",
    viaWhatsapp: " via WhatsApp", viaCall: " door je te bellen", viaEmail: " per mail",
    hurry: "Haast?", appDirect: "App ons direct",
    goalTitle: "Waar kunnen we je mee helpen?", goalSub: "Eén klik, dan nog twee korte vragen.",
    storeTitle: "Vertel kort over je webshop.", storeSub: "Zo kunnen we je meteen gericht helpen. Weet je het niet zeker, sla het gerust over.",
    platformLegend: "Waar verkoop je?", multiple: "Meer keuzes mag",
    volumeLegend: "Hoeveel klantmails krijg je per dag?",
    back: "Terug", next: "Volgende",
    reachTitle: "Hoe bereiken we je?", reachSub: "We reageren binnen één werkdag. Geen nieuwsbrief, geen spam.",
    name: "Naam", email: "E-mail", store: "Webshop", optional: "(optioneel)", storePlaceholder: "jouwwinkel.nl",
    phone: "Telefoon", phonePlaceholder: "06 12345678",
    reachLegend: "Hoe wil je dat we contact opnemen?",
    message: "Nog iets wat we moeten weten?",
    sending: "Versturen…", send: "Versturen",
  },
  en: {
    steps: ["What for?", "Your store", "Your details"],
    failed: "Sending failed.",
    thanks: "Thanks, we've got it.",
    within: "We'll get in touch within one working day",
    viaWhatsapp: " on WhatsApp", viaCall: " by phone", viaEmail: " by email",
    hurry: "In a hurry?", appDirect: "Message us directly",
    goalTitle: "What can we help you with?", goalSub: "One click, then two short questions.",
    storeTitle: "Tell us a bit about your store.", storeSub: "So we can help you right away. Not sure? Feel free to skip it.",
    platformLegend: "Where do you sell?", multiple: "Pick as many as apply",
    volumeLegend: "How many customer emails do you get per day?",
    back: "Back", next: "Next",
    reachTitle: "How can we reach you?", reachSub: "We reply within one working day. No newsletter, no spam.",
    name: "Name", email: "Email", store: "Store", optional: "(optional)", storePlaceholder: "yourstore.com",
    phone: "Phone", phonePlaceholder: "+44 7700 900123",
    reachLegend: "How would you like us to get in touch?",
    message: "Anything else we should know?",
    sending: "Sending…", send: "Send",
  },
};

export function ContactIntake({ lang = "nl" }: { lang?: "nl" | "en" }) {
  const t = COPY[lang];
  const en = lang === "en";
  const STEPS = t.steps;
  const text = (option: { label: string; en: { label: string } }) => (en ? option.en.label : option.label);
  const hint = (option: { hint: string; en: { hint: string } }) => (en ? option.en.hint : option.hint);
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [volume, setVolume] = useState<string | null>(null);
  const [reach, setReach] = useState<Reach>("email");
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const openedAt = useRef<number | null>(null);
  const progress = state === "sent" ? 100 : ((step + 1) / STEPS.length) * 100;

  function markOpened() {
    if (openedAt.current === null) openedAt.current = Date.now();
  }

  function pickGoal(id: Goal) {
    markOpened();
    setGoal(id);
    setStep(1);
  }

  function togglePlatform(id: string) {
    setPlatforms((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState("sending");
    setError(null);
    try {
      const response = await fetch("/api/marketing/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal, platforms, volume, reach, lang,
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone"),
          store: form.get("store"),
          message: form.get("message"),
          company: form.get("company"),
          elapsedMs: openedAt.current ? Date.now() - openedAt.current : 0,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t.failed);
      setState("sent");
    } catch (submitError) {
      setState("idle");
      setError(submitError instanceof Error ? submitError.message : t.failed);
    }
  }

  return (
    <section className="cx-card" aria-labelledby="cx-title">
      <div className="cx-progress" aria-hidden>
        <i style={{ width: `${progress}%` }} />
      </div>
      <div className="cx-steps" aria-hidden>
        {STEPS.map((label, index) => <span key={label} className={index < step || state === "sent" ? "is-done" : index === step ? "is-active" : ""}>{index < step || state === "sent" ? <Check size={12} strokeWidth={3} /> : index + 1} {label}</span>)}
      </div>

      {state === "sent" ? (
        <div className="cx-done" role="status">
          <SequenceMark size={72} state="happy" gear="headset" title="" />
          <h2 id="cx-title">{t.thanks}</h2>
          <p>{t.within}{reach === "whatsapp" ? t.viaWhatsapp : reach === "call" ? t.viaCall : t.viaEmail}. {t.hurry} <a href={en ? whatsappLink(WHATSAPP_TEXT_EN) : whatsappLink()} target="_blank" rel="noopener noreferrer">{t.appDirect}</a>.</p>
        </div>
      ) : step === 0 ? (
        <div className="cx-step" key="0">
          <h2 id="cx-title">{t.goalTitle}</h2>
          <p className="cx-sub">{t.goalSub}</p>
          <div className="cx-goals">
            {CONTACT_INTAKE.goals.map((option) => (
              <button type="button" key={option.id} className={goal === option.id ? "is-selected" : ""} onClick={() => pickGoal(option.id)}>
                <strong>{text(option)}</strong><small>{hint(option)}</small><ArrowRight size={16} />
              </button>
            ))}
          </div>
        </div>
      ) : step === 1 ? (
        <div className="cx-step" key="1">
          <h2 id="cx-title">{t.storeTitle}</h2>
          <p className="cx-sub">{t.storeSub}</p>
          <fieldset>
            <legend>{t.platformLegend} <small>{t.multiple}</small></legend>
            <div className="cx-chips">
              {CONTACT_INTAKE.platforms.map((option) => <button type="button" key={option.id} aria-pressed={platforms.includes(option.id)} className={platforms.includes(option.id) ? "is-selected" : ""} onClick={() => togglePlatform(option.id)}>{platforms.includes(option.id) && <Check size={13} strokeWidth={3} />}{text(option)}</button>)}
            </div>
          </fieldset>
          <fieldset>
            <legend>{t.volumeLegend}</legend>
            <div className="cx-chips">
              {CONTACT_INTAKE.volumes.map((option) => <button type="button" key={option.id} aria-pressed={volume === option.id} className={volume === option.id ? "is-selected" : ""} onClick={() => setVolume(volume === option.id ? null : option.id)}>{text(option)}</button>)}
            </div>
          </fieldset>
          <div className="cx-nav">
            <button type="button" className="cx-back" onClick={() => setStep(0)}><ArrowLeft size={15} /> {t.back}</button>
            <button type="button" className="mk-button mk-button--primary" onClick={() => setStep(2)}>{t.next} <ArrowRight size={15} /></button>
          </div>
        </div>
      ) : (
        <form className="cx-step" key="2" onSubmit={submit} noValidate>
          <h2 id="cx-title">{t.reachTitle}</h2>
          <p className="cx-sub">{t.reachSub}</p>
          <div className="cx-fields">
            <label><span>{t.name}</span><input name="name" required maxLength={120} autoComplete="name" /></label>
            <label><span>{t.email}</span><input name="email" type="email" required maxLength={200} autoComplete="email" /></label>
            <label><span>{t.store} <small>{t.optional}</small></span><input name="store" maxLength={200} placeholder={t.storePlaceholder} /></label>
            <label><span>{t.phone} <small>{reach === "email" ? t.optional : ""}</small></span><input name="phone" type="tel" maxLength={40} autoComplete="tel" placeholder={t.phonePlaceholder} required={reach !== "email"} /></label>
          </div>
          <fieldset>
            <legend>{t.reachLegend}</legend>
            <div className="cx-chips">
              {CONTACT_INTAKE.reach.map((option) => <button type="button" key={option.id} aria-pressed={reach === option.id} className={reach === option.id ? "is-selected" : ""} onClick={() => setReach(option.id)}>{text(option)}</button>)}
            </div>
          </fieldset>
          <label className="cx-wide"><span>{t.message} <small>{t.optional}</small></span><textarea name="message" rows={3} maxLength={1500} /></label>
          {/* Honeypot: mensen zien dit veld niet, bots vullen het wel in. */}
          <label className="mk-meet-hp" aria-hidden="true"><span>Bedrijf</span><input name="company" tabIndex={-1} autoComplete="off" /></label>
          {error ? <p className="cx-error" role="alert">{error}</p> : null}
          <div className="cx-nav">
            <button type="button" className="cx-back" onClick={() => setStep(1)}><ArrowLeft size={15} /> {t.back}</button>
            <button type="submit" className="mk-button mk-button--primary" disabled={state === "sending"}>{state === "sending" ? t.sending : <>{t.send} <ArrowRight size={15} /></>}</button>
          </div>
        </form>
      )}
    </section>
  );
}
