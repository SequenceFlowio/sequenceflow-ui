"use client";

import { useRef, useState, useSyncExternalStore } from "react";

import { SequenceMark } from "./SequenceMark";
import { amsterdamToday, formatMeetingDay, nextMeetingWorkdays } from "@/lib/marketing/meetingDates";

/**
 * Kennismaking plannen: bezoekers kiezen een voorkeursmoment en laten hun
 * gegevens achter; de aanvraag gaat als mail naar hallo@sequenceflow.io.
 * Er is geen koppeling met een echte agenda, dus we spreken van een
 * voorkeur en bevestigen het moment zelf.
 */

const SLOTS = ["10:00", "11:30", "14:00", "16:00"];
const VOLUMES = ["Minder dan 5", "5 tot 20", "20 tot 50", "Meer dan 50"];

// Tick while the page stays open, so a date never remains bookable after midnight.
const subscribe = (onChange: () => void) => {
  const timer = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(timer);
};
const getToday = () => amsterdamToday();
const getServerToday = () => null;

type State = "idle" | "sending" | "sent" | "error";

export type MeetingTopic = { id: string; label: string };

type Props = {
  id?: string;
  eyebrow?: string;
  title?: string;
  intro?: string;
  bullets?: string[];
  /** Meer dan één onderwerp: de bezoeker kiest er één in het formulier. */
  topics?: MeetingTopic[];
  /** Tekst op de knop zolang er nog geen moment gekozen is. */
  submitLabel?: string;
};

const DEFAULT_TOPICS: MeetingTopic[] = [{ id: "kennismaking", label: "Kennismaking" }];

export function MeetingRequest({
  id = "kennismaking",
  eyebrow = "KENNISMAKEN",
  title = "Plan een kennismaking.",
  intro = "Twintig minuten, online. We kijken samen naar hoe jouw klantvragen nu binnenkomen en wat Support One daar voor je kan doen.",
  bullets = ["Geen verkooppraatje, wel een eerlijk beeld", "We bevestigen je moment binnen één werkdag"],
  topics = DEFAULT_TOPICS,
  submitLabel = "Vraag kennismaking aan",
}: Props) {
  const today = useSyncExternalStore(subscribe, getToday, getServerToday);
  const days = today ? nextMeetingWorkdays(today) : [];
  const [day, setDay] = useState<string | null>(null);
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const selectedDay = day && days.includes(day) ? day : null;
  const [slot, setSlot] = useState<string | null>(null);
  const [topic, setTopic] = useState(topics[0].id);
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const openedAt = useRef<number | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDay || !slot) {
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
          topic,
          day: selectedDay,
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
    <section className="mk-meet" id={id} aria-labelledby={`${id}-title`}>
      <div className="mk-meet-copy">
        <div className="mk-eyebrow"><span />{eyebrow}</div>
        <h2 id={`${id}-title`}>{title}</h2>
        <p>{intro}</p>
        <ul>
          {bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
          <li>Liever direct mailen? <a href="mailto:hallo@sequenceflow.io">hallo@sequenceflow.io</a></li>
        </ul>
      </div>

      <div className="mk-meet-card">
        {state === "sent" ? (
          <div className="mk-meet-done" role="status">
            <SequenceMark size={72} state="happy" title="" />
            <h3>Aanvraag ontvangen.</h3>
            <p>We bevestigen {day && slot ? `${formatMeetingDay(day)} om ${slot}` : "je moment"} binnen één werkdag per mail. Past het toch niet, dan stellen we een ander moment voor.</p>
          </div>
        ) : (
          <form onSubmit={submit} onFocus={() => { if (openedAt.current === null) openedAt.current = Date.now(); }} noValidate>
            {topics.length > 1 ? (
              <fieldset>
                <legend>Waarover?</legend>
                <div className="mk-meet-slots">
                  {topics.map((option) => <button type="button" key={option.id} className={topic === option.id ? "is-selected" : ""} aria-pressed={topic === option.id} onClick={() => setTopic(option.id)}>{option.label}</button>)}
                </div>
              </fieldset>
            ) : null}
            <fieldset className="mk-meet-day-fieldset">
              <legend>Kies een dag</legend>
              <button type="button" className="mk-meet-day-toggle" aria-expanded={dayPickerOpen} aria-controls={`${id}-days`} onClick={() => setDayPickerOpen(open => !open)}>
                <span>{selectedDay ? formatMeetingDay(selectedDay) : "Bekijk beschikbare dagen"}</span><span aria-hidden="true">{dayPickerOpen ? "−" : "+"}</span>
              </button>
              {dayPickerOpen && <div className="mk-meet-days" id={`${id}-days`}>
                {days.length ? days.map((date) => <button type="button" key={date} className={selectedDay === date ? "is-selected" : ""} aria-pressed={selectedDay === date} onClick={() => { setDay(date); setSlot(null); setError(null); setDayPickerOpen(false); }}>{formatMeetingDay(date)}</button>) : Array.from({ length: 8 }).map((_, index) => <span key={index} className="mk-meet-skeleton" />)}
              </div>}
            </fieldset>
            {selectedDay && <fieldset>
              <legend>Kies een tijd <small>(Nederlandse tijd)</small></legend>
              <div className="mk-meet-slots">
                {SLOTS.map((value) => <button type="button" key={value} className={slot === value ? "is-selected" : ""} aria-pressed={slot === value} onClick={() => setSlot(value)}>{value}</button>)}
              </div>
            </fieldset>}
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
              {state === "sending" ? "Versturen…" : selectedDay && slot ? `Vraag ${formatMeetingDay(selectedDay)} om ${slot} aan` : submitLabel}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
