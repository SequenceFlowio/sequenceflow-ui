"use client";

import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useRef, useState } from "react";

import { CONTACT_INTAKE, whatsappLink } from "@/lib/marketing/contactIntake";

import { SequenceMark } from "./SequenceMark";

/**
 * De vragenlijst op /contact: drie korte stappen in plaats van één groot
 * formulier. Stap 1 is één klik, stap 2 alleen keuzeknoppen, pas in stap 3
 * vragen we om gegevens. Zo blijft het laagdrempelig, en weten we bij het
 * eerste antwoord al waar iemand staat. Verstuurt naar /api/marketing/intake.
 */

type Goal = (typeof CONTACT_INTAKE.goals)[number]["id"];
type Reach = (typeof CONTACT_INTAKE.reach)[number]["id"];
type State = "idle" | "sending" | "sent";

const STEPS = ["Waarmee?", "Je webshop", "Je gegevens"];

export function ContactIntake() {
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
          goal, platforms, volume, reach,
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
      if (!response.ok) throw new Error(data.error || "Versturen is niet gelukt.");
      setState("sent");
    } catch (submitError) {
      setState("idle");
      setError(submitError instanceof Error ? submitError.message : "Versturen is niet gelukt.");
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
          <h2 id="cx-title">Dank je, we hebben het.</h2>
          <p>We nemen binnen één werkdag contact op{reach === "whatsapp" ? " via WhatsApp" : reach === "call" ? " door je te bellen" : " per mail"}. Haast? <a href={whatsappLink()} target="_blank" rel="noopener noreferrer">App ons direct</a>.</p>
        </div>
      ) : step === 0 ? (
        <div className="cx-step" key="0">
          <h2 id="cx-title">Waar kunnen we je mee helpen?</h2>
          <p className="cx-sub">Eén klik, dan nog twee korte vragen.</p>
          <div className="cx-goals">
            {CONTACT_INTAKE.goals.map((option) => (
              <button type="button" key={option.id} className={goal === option.id ? "is-selected" : ""} onClick={() => pickGoal(option.id)}>
                <strong>{option.label}</strong><small>{option.hint}</small><ArrowRight size={16} />
              </button>
            ))}
          </div>
        </div>
      ) : step === 1 ? (
        <div className="cx-step" key="1">
          <h2 id="cx-title">Vertel kort over je webshop.</h2>
          <p className="cx-sub">Zo kunnen we je meteen gericht helpen. Weet je het niet zeker, sla het gerust over.</p>
          <fieldset>
            <legend>Waar verkoop je? <small>Meer keuzes mag</small></legend>
            <div className="cx-chips">
              {CONTACT_INTAKE.platforms.map((option) => <button type="button" key={option.id} aria-pressed={platforms.includes(option.id)} className={platforms.includes(option.id) ? "is-selected" : ""} onClick={() => togglePlatform(option.id)}>{platforms.includes(option.id) && <Check size={13} strokeWidth={3} />}{option.label}</button>)}
            </div>
          </fieldset>
          <fieldset>
            <legend>Hoeveel klantmails krijg je per dag?</legend>
            <div className="cx-chips">
              {CONTACT_INTAKE.volumes.map((option) => <button type="button" key={option.id} aria-pressed={volume === option.id} className={volume === option.id ? "is-selected" : ""} onClick={() => setVolume(volume === option.id ? null : option.id)}>{option.label}</button>)}
            </div>
          </fieldset>
          <div className="cx-nav">
            <button type="button" className="cx-back" onClick={() => setStep(0)}><ArrowLeft size={15} /> Terug</button>
            <button type="button" className="mk-button mk-button--primary" onClick={() => setStep(2)}>Volgende <ArrowRight size={15} /></button>
          </div>
        </div>
      ) : (
        <form className="cx-step" key="2" onSubmit={submit} noValidate>
          <h2 id="cx-title">Hoe bereiken we je?</h2>
          <p className="cx-sub">We reageren binnen één werkdag. Geen nieuwsbrief, geen spam.</p>
          <div className="cx-fields">
            <label><span>Naam</span><input name="name" required maxLength={120} autoComplete="name" /></label>
            <label><span>E-mail</span><input name="email" type="email" required maxLength={200} autoComplete="email" /></label>
            <label><span>Webshop <small>(optioneel)</small></span><input name="store" maxLength={200} placeholder="jouwwinkel.nl" /></label>
            <label><span>Telefoon <small>{reach === "email" ? "(optioneel)" : ""}</small></span><input name="phone" type="tel" maxLength={40} autoComplete="tel" placeholder="06 12345678" required={reach !== "email"} /></label>
          </div>
          <fieldset>
            <legend>Hoe wil je dat we contact opnemen?</legend>
            <div className="cx-chips">
              {CONTACT_INTAKE.reach.map((option) => <button type="button" key={option.id} aria-pressed={reach === option.id} className={reach === option.id ? "is-selected" : ""} onClick={() => setReach(option.id)}>{option.label}</button>)}
            </div>
          </fieldset>
          <label className="cx-wide"><span>Nog iets wat we moeten weten? <small>(optioneel)</small></span><textarea name="message" rows={3} maxLength={1500} /></label>
          {/* Honeypot: mensen zien dit veld niet, bots vullen het wel in. */}
          <label className="mk-meet-hp" aria-hidden="true"><span>Bedrijf</span><input name="company" tabIndex={-1} autoComplete="off" /></label>
          {error ? <p className="cx-error" role="alert">{error}</p> : null}
          <div className="cx-nav">
            <button type="button" className="cx-back" onClick={() => setStep(1)}><ArrowLeft size={15} /> Terug</button>
            <button type="submit" className="mk-button mk-button--primary" disabled={state === "sending"}>{state === "sending" ? "Versturen…" : <>Versturen <ArrowRight size={15} /></>}</button>
          </div>
        </form>
      )}
    </section>
  );
}
