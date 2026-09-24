"use client";

import { useRef, useState, useSyncExternalStore } from "react";

import { SequenceMark } from "./SequenceMark";

/**
 * Kennismaking plannen: bezoekers kiezen een voorkeursmoment en laten hun
 * gegevens achter; de aanvraag gaat als mail naar hallo@sequenceflow.io.
 * Er is geen koppeling met een echte agenda, dus we spreken van een
 * voorkeur en bevestigen het moment zelf.
 */

const SLOTS = ["10:00", "11:30", "14:00", "16:00"];
const VOLUMES = ["Minder dan 5", "5 tot 20", "20 tot 50", "Meer dan 50"];

function nextWorkdays(count: number) {
  const days: Date[] = [];
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  while (days.length < count) {
    cursor.setDate(cursor.getDate() + 1);
    const weekday = cursor.getDay();
    if (weekday !== 0 && weekday !== 6) days.push(new Date(cursor));
  }
  return days;
}

// De datum van vandaag alleen op de client, zodat server en browser niet
// verschillen rond middernacht.
const subscribe = () => () => undefined;
const getToday = () => new Date().toDateString();
const getServerToday = () => null;

type State = "idle" | "sending" | "sent" | "error";

export function MeetingRequest() {
  const today = useSyncExternalStore(subscribe, getToday, getServerToday);
  const days = today ? nextWorkdays(8) : [];
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const openedAt = useRef<number | null>(null);

  const dayLabel = (date: Date) => new Intl.DateTimeFormat("nl-NL", { weekday: "short", day: "numeric", month: "short" }).format(date);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!day || !slot) {
      setError("Kies een dag en een tijd.");
      return;
    }
    const form = new FormData(event.currentTarget);
    setState("sending");
    setError(null);
    try {
      const response = await fetch("/api/marketing/meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          store: form.get("store"),
          volume: form.get("volume"),
          message: form.get("message"),
          company: form.get("company"),
          day,
          slot,
          elapsedMs: openedAt.current ? Date.now() - openedAt.current : 0,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Versturen is niet gelukt. Probeer het opnieuw of mail naar hallo@sequenceflow.io.");
      setState("sent");
    } catch (submitError) {
      setState("error");
      setError(submitError instanceof Error ? submitError.message : "Versturen is niet gelukt.");
    }
  }

  return (
    <section className="mk-meet" id="kennismaking" aria-labelledby="mk-meet-title">
      <div className="mk-meet-copy">
        <div className="mk-eyebrow"><span />KENNISMAKEN</div>
        <h2 id="mk-meet-title">Plan een kennismaking.</h2>
        <p>Twintig minuten, online. We kijken samen naar hoe jouw klantvragen nu binnenkomen en wat Support One daar voor je kan doen.</p>
        <ul>
          <li>Geen verkooppraatje, wel een eerlijk beeld</li>
          <li>We bevestigen je moment binnen één werkdag</li>
          <li>Liever direct mailen? <a href="mailto:hallo@sequenceflow.io">hallo@sequenceflow.io</a></li>
        </ul>
      </div>

      <div className="mk-meet-card">
        {state === "sent" ? (
          <div className="mk-meet-done" role="status">
            <SequenceMark size={72} state="happy" title="" />
            <h3>Aanvraag ontvangen.</h3>
            <p>We bevestigen {day && slot ? `${day} om ${slot}` : "je moment"} binnen één werkdag per mail. Past het toch niet, dan stellen we een ander moment voor.</p>
          </div>
        ) : (
          <form onSubmit={submit} onFocus={() => { if (openedAt.current === null) openedAt.current = Date.now(); }} noValidate>
            <fieldset>
              <legend>Kies een dag</legend>
              <div className="mk-meet-days">
                {days.length ? days.map((date) => {
                  const label = dayLabel(date);
                  return <button type="button" key={label} className={day === label ? "is-selected" : ""} aria-pressed={day === label} onClick={() => setDay(label)}>{label}</button>;
                }) : Array.from({ length: 8 }).map((_, index) => <span key={index} className="mk-meet-skeleton" />)}
              </div>
            </fieldset>
            <fieldset>
              <legend>Kies een tijd <small>(Nederlandse tijd)</small></legend>
              <div className="mk-meet-slots">
                {SLOTS.map((value) => <button type="button" key={value} className={slot === value ? "is-selected" : ""} aria-pressed={slot === value} onClick={() => setSlot(value)}>{value}</button>)}
              </div>
            </fieldset>
            <div className="mk-meet-fields">
              <label><span>Naam</span><input name="name" required maxLength={120} autoComplete="name" /></label>
              <label><span>E-mail</span><input name="email" type="email" required maxLength={200} autoComplete="email" /></label>
              <label><span>Webshop <small>(optioneel)</small></span><input name="store" maxLength={200} placeholder="jouwwinkel.nl" /></label>
              <label><span>Klantvragen per dag</span><select name="volume" defaultValue="">{["", ...VOLUMES].map((value) => <option key={value} value={value}>{value || "Kies…"}</option>)}</select></label>
              <label className="mk-meet-wide"><span>Iets wat we vooraf moeten weten? <small>(optioneel)</small></span><textarea name="message" rows={3} maxLength={1500} /></label>
              {/* Honeypot: mensen zien dit veld niet, bots vullen het wel in. */}
              <label className="mk-meet-hp" aria-hidden="true"><span>Bedrijf</span><input name="company" tabIndex={-1} autoComplete="off" /></label>
            </div>
            {error ? <p className="mk-meet-error" role="alert">{error}</p> : null}
            <button type="submit" className="mk-button mk-button--primary" disabled={state === "sending"}>
              {state === "sending" ? "Versturen…" : day && slot ? `Vraag ${day} om ${slot} aan` : "Vraag kennismaking aan"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
