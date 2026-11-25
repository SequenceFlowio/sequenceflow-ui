"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, MessageCircle } from "lucide-react";

import { SequenceMark } from "@/components/marketing/SequenceMark";
import { ASK_TEAM_EVENT } from "@/lib/assistants/team";
import { LOW_STOCK_LIMITS, suggestedDaysBelow, type LowStockKind, type Priority, type Seasonal } from "@/lib/inventory/otisProfile";

/**
 * Kennismaking met Otis bij het eerste bezoek aan de voorraadpagina: vijf korte
 * stappen, daarna verder praten in de chat. Alles is later te wijzigen onder
 * Instellingen; "Later" laat de standaardinstellingen staan.
 */

type Start = { leadTimeDays: number; coverWeeks: number; alertEmail: boolean; weeklyEmail: boolean };

const STEPS = 5;

export function OtisOnboarding({ nl, start, onDone }: { nl: boolean; start: Start; onDone: (saved: boolean) => void }) {
  const [step, setStep] = useState(0);
  const [leadTimeDays, setLeadTimeDays] = useState(String(start.leadTimeDays));
  const [coverWeeks, setCoverWeeks] = useState(String(start.coverWeeks));
  const [lowKind, setLowKind] = useState<LowStockKind>("days_below");
  const [thresholds, setThresholds] = useState<Record<LowStockKind, string>>({ days_below: String(suggestedDaysBelow(start.leadTimeDays)), stock_below: "10", percent_below: "20" });
  const [alertEmail, setAlertEmail] = useState(start.alertEmail);
  const [weeklyEmail, setWeeklyEmail] = useState(start.weeklyEmail);
  const [sells, setSells] = useState("");
  const [seasonal, setSeasonal] = useState<Seasonal>("some");
  const [priority, setPriority] = useState<Priority>("balanced");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lead = Number(leadTimeDays);
  const cover = Number(coverWeeks);
  const threshold = Number(thresholds[lowKind]);
  const limits = LOW_STOCK_LIMITS[lowKind];
  const stepValid = step === 1 ? Number.isInteger(lead) && lead >= 0 && lead <= 365 && Number.isInteger(cover) && cover >= 1 && cover <= 52
    : step === 2 ? Number.isInteger(threshold) && threshold >= limits.min && threshold <= limits.max
    : true;

  async function skip() {
    setBusy(true);
    await fetch("/api/inventory/onboarding", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ skip: true }) }).catch(() => undefined);
    setBusy(false);
    onDone(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/inventory/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadTimeDays: lead, coverWeeks: cover, lowStock: { kind: lowKind, threshold }, alertEmail, weeklyEmail, sells, seasonal, priority }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || (nl ? "Opslaan lukte niet." : "Saving failed."));
      setStep(5);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  function talk() {
    window.dispatchEvent(new CustomEvent(ASK_TEAM_EVENT, { detail: { send: true, text: nl ? "Otis, ik heb de kennismaking afgerond. Wat wil je nog weten over mijn winkel?" : "Otis, I finished the introduction. What else would you like to know about my shop?" } }));
    onDone(true);
  }

  const option = (kind: LowStockKind, title: string, unit: string, help: string, recommended?: boolean) => (
    <label className={`otis-choice${lowKind === kind ? " is-active" : ""}`}>
      <input type="radio" name="low-kind" checked={lowKind === kind} onChange={() => setLowKind(kind)} />
      <span className="otis-choice-body">
        <strong>{title}{recommended ? <em>{nl ? "Aanbevolen" : "Recommended"}</em> : null}</strong>
        <span className="otis-inline-input">
          <input type="number" inputMode="numeric" min={LOW_STOCK_LIMITS[kind].min} max={LOW_STOCK_LIMITS[kind].max} value={thresholds[kind]} onFocus={() => setLowKind(kind)} onChange={(event) => setThresholds({ ...thresholds, [kind]: event.target.value })} aria-label={title} />
          {unit}
        </span>
        <small>{help}</small>
      </span>
    </label>
  );

  return (
    <section className="otis-onboarding" aria-label={nl ? "Kennismaken met Otis" : "Meet Otis"}>
      <style>{ONBOARDING_CSS}</style>
      <div className="otis-onboarding-head">
        <span className="otis-onboarding-mark"><SequenceMark size={64} gear="analyst" state={busy ? "investigating" : "observing"} title="" /></span>
        <div>
          <span className="otis-eyebrow">OTIS · {nl ? "JE VOORRAADAGENT" : "YOUR STOCK AGENT"}</span>
          {step < 5 ? <div className="otis-progress" aria-label={nl ? `Stap ${Math.max(1, step)} van ${STEPS}` : `Step ${Math.max(1, step)} of ${STEPS}`}>{Array.from({ length: STEPS }, (_, index) => <i key={index} className={index < step ? "is-done" : ""} />)}</div> : null}
        </div>
      </div>

      {step === 0 ? (
        <div className="otis-step">
          <h2>{nl ? "Hoi, ik ben Otis." : "Hi, I'm Otis."}</h2>
          <p>{nl ? "Ik houd je voorraad per maat en kleur in de gaten en zeg op tijd wat je moet bijbestellen. Vijf korte vragen, dan weet ik hoe jij inkoopt en wanneer je van mij wilt horen. Duurt twee minuten." : "I watch your stock per size and colour and tell you in time what to reorder. Five short questions so I know how you buy and when you want to hear from me. Takes two minutes."}</p>
          <div className="otis-actions">
            <button type="button" className="settings-btn primary" onClick={() => setStep(1)}>{nl ? "Kennismaken" : "Get started"}<ArrowRight size={14} /></button>
            <button type="button" className="otis-link" disabled={busy} onClick={() => void skip()}>{nl ? "Later, gebruik de standaard" : "Later, use the defaults"}</button>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="otis-step">
          <h2>{nl ? "Hoe koop je in?" : "How do you buy?"}</h2>
          <div className="otis-fields">
            <label><span>{nl ? "Hoeveel dagen zit er tussen bestellen en binnen hebben?" : "Days between ordering and receiving?"}</span><span className="otis-inline-input"><input type="number" inputMode="numeric" min={0} max={365} value={leadTimeDays} onChange={(event) => { setLeadTimeDays(event.target.value); setThresholds((current) => ({ ...current, days_below: String(suggestedDaysBelow(Number(event.target.value) || 0)) })); }} />{nl ? "dagen" : "days"}</span><small>{nl ? "Verschilt het per leverancier? Vul het gemiddelde in; per leverancier stel je het later in." : "Differs per supplier? Use the average; set it per supplier later."}</small></label>
            <label><span>{nl ? "Voor hoeveel weken verkoop bestel je per keer?" : "How many weeks of sales do you order at once?"}</span><span className="otis-inline-input"><input type="number" inputMode="numeric" min={1} max={52} value={coverWeeks} onChange={(event) => setCoverWeeks(event.target.value)} />{nl ? "weken" : "weeks"}</span><small>{nl ? "Daarop baseer ik hoeveel ik je adviseer bij te bestellen." : "I base how much to reorder on this."}</small></label>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="otis-step">
          <h2>{nl ? "Wanneer wil je horen dat iets bijna op is?" : "When should I tell you something is running low?"}</h2>
          <div className="otis-choices">
            {option("days_below", nl ? "Als het binnen zoveel dagen op is" : "When it runs out within", nl ? "dagen" : "days", nl ? `Kijkt naar hoe snel het verkoopt. Met je levertijd van ${lead || 0} dagen raad ik ${suggestedDaysBelow(lead || 0)} aan: dan heb je nog een week speling.` : `Looks at how fast it sells. With your lead time of ${lead || 0} days I suggest ${suggestedDaysBelow(lead || 0)}: a week to spare.`, true)}
            {option("stock_below", nl ? "Als er nog zoveel stuks liggen" : "When this many units are left", nl ? "stuks" : "units", nl ? "Simpel, maar hetzelfde getal voor een snelle en een trage variant." : "Simple, but the same number for fast and slow variants.")}
            {option("percent_below", nl ? "Als er nog zoveel over is van de laatste levering" : "When this share of the last delivery is left", "%", nl ? "100% is je voorraad direct na de laatste levering. Was er nog geen levering, dan de voorraad op het moment dat je koppelde." : "100% is your stock right after the last delivery, or when you connected if there was none yet.")}
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="otis-step">
          <h2>{nl ? "Hoe wil je van me horen?" : "How do you want to hear from me?"}</h2>
          <div className="otis-choices">
            <label className={`otis-choice${alertEmail ? " is-active" : ""}`}><input type="checkbox" checked={alertEmail} onChange={(event) => setAlertEmail(event.target.checked)} /><span className="otis-choice-body"><strong>{nl ? "Een mail als er iets nieuws is" : "An email when something new comes up"}</strong><small>{nl ? "Hooguit één per dag, alleen met wat je nog niet van me hoorde. Staat je verkoop twee weken stil, dan mail ik niet." : "At most one a day, only with what you haven't heard yet. If sales stand still for two weeks, I don't mail."}</small></span></label>
            <label className={`otis-choice${weeklyEmail ? " is-active" : ""}`}><input type="checkbox" checked={weeklyEmail} onChange={(event) => setWeeklyEmail(event.target.checked)} /><span className="otis-choice-body"><strong>{nl ? "Inkoopadvies op maandag" : "Buying advice on Monday"}</strong><small>{nl ? "Een overzicht van wat je die week bijbestelt en wat stil ligt." : "An overview of what to reorder that week and what sits still."}</small></span></label>
          </div>
          <p className="otis-note">{nl ? "Wat ik zie, staat altijd op deze pagina, ook zonder mail." : "Everything I notice is always on this page, also without email."}</p>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="otis-step">
          <h2>{nl ? "Iets over je winkel" : "About your shop"}</h2>
          <div className="otis-fields">
            <label className="otis-wide"><span>{nl ? "Wat verkoop je, in een paar woorden?" : "What do you sell, in a few words?"}</span><input type="text" maxLength={200} value={sells} onChange={(event) => setSells(event.target.value)} placeholder={nl ? "bijv. dameskleding en accessoires" : "e.g. women's clothing and accessories"} /></label>
          </div>
          <span className="otis-label">{nl ? "Verkoop je per seizoen?" : "Do you sell by season?"}</span>
          <div className="otis-chips" role="radiogroup">
            {([["yes", nl ? "Ja, vooral" : "Mostly"], ["some", nl ? "Sommige producten" : "Some products"], ["no", nl ? "Nee, het hele jaar" : "No, all year"]] as const).map(([value, label]) => <button key={value} type="button" role="radio" aria-checked={seasonal === value} className={seasonal === value ? "is-active" : ""} onClick={() => setSeasonal(value)}>{label}</button>)}
          </div>
          <span className="otis-label">{nl ? "Wat weegt zwaarder?" : "What matters more?"}</span>
          <div className="otis-chips" role="radiogroup">
            {([["never_out", nl ? "Nooit uitverkocht" : "Never sold out"], ["balanced", nl ? "In balans" : "Balanced"], ["little_cash", nl ? "Zo min mogelijk geld in voorraad" : "As little cash in stock as possible"]] as const).map(([value, label]) => <button key={value} type="button" role="radio" aria-checked={priority === value} className={priority === value ? "is-active" : ""} onClick={() => setPriority(value)}>{label}</button>)}
          </div>
          <p className="otis-note">{nl ? "Daarmee stel ik je veiligheidsmarge in: hoeveel extra ik adviseer om uitverkocht te voorkomen." : "This sets your safety margin: how much extra I suggest to avoid selling out."}</p>
        </div>
      ) : null}

      {step === 5 ? (
        <div className="otis-step">
          <h2>{nl ? "Dank je, ik kan aan de slag." : "Thanks, I'm ready to go."}</h2>
          <p>{nl ? "Wil je dat ik je winkel nog beter leer kennen? Vertel me in de chat over je leveranciers, je bestsellers en drukke periodes. Ik onthoud wat je zegt, en je ziet het terug onder Instellingen." : "Want me to know your shop even better? Tell me in the chat about your suppliers, best sellers and busy periods. I remember what you say, and you can see it under Settings."}</p>
          <div className="otis-actions">
            <button type="button" className="settings-btn primary" onClick={talk}><MessageCircle size={14} />{nl ? "Vertel Otis meer" : "Tell Otis more"}</button>
            <button type="button" className="otis-link" onClick={() => onDone(true)}>{nl ? "Naar mijn voorraad" : "Go to my stock"}</button>
          </div>
        </div>
      ) : null}

      {error ? <p className="otis-error" role="alert">{error}</p> : null}

      {step >= 1 && step <= 4 ? (
        <div className="otis-actions otis-nav">
          <button type="button" className="otis-link" onClick={() => setStep(step - 1)} disabled={busy}><ArrowLeft size={14} />{nl ? "Terug" : "Back"}</button>
          {step < 4
            ? <button type="button" className="settings-btn primary" disabled={!stepValid} onClick={() => setStep(step + 1)}>{nl ? "Volgende" : "Next"}<ArrowRight size={14} /></button>
            : <button type="button" className="settings-btn primary" disabled={busy} onClick={() => void save()}>{busy ? <Loader2 size={14} className="settings-spin" /> : <Check size={14} />}{nl ? "Opslaan" : "Save"}</button>}
        </div>
      ) : null}
    </section>
  );
}

/** Wat Otis over de winkel weet, onder Instellingen: met wissen per notitie en de kennismaking opnieuw. */
export function OtisMemory({ nl, profile, onChanged, onRestart }: { nl: boolean; profile: { sells?: string; notes?: Array<{ text: string; at: string }> }; onChanged: () => void; onRestart: () => void }) {
  const [busy, setBusy] = useState<number | null>(null);
  async function forget(index: number) {
    setBusy(index);
    await fetch("/api/inventory/onboarding", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ forgetNote: index }) }).catch(() => undefined);
    setBusy(null);
    onChanged();
  }
  const notes = profile.notes ?? [];
  return (
    <section className="inv-card otis-memory">
      <style>{ONBOARDING_CSS}</style>
      <h2>{nl ? "Wat Otis over je winkel weet" : "What Otis knows about your shop"}</h2>
      <p className="otis-note">{nl ? "Uit de kennismaking en uit gesprekken. Otis gebruikt dit bij zijn advies. Klopt iets niet meer, wis het dan." : "From the introduction and conversations. Otis uses this in his advice. Remove anything that is no longer true."}</p>
      {profile.sells ? <p className="otis-memory-line"><span>{nl ? "Verkoopt" : "Sells"}</span>{profile.sells}</p> : null}
      {notes.length ? (
        <ul className="otis-memory-list">
          {notes.map((note, index) => <li key={`${note.at}-${index}`}><span>{note.text}</span><button type="button" className="otis-link" disabled={busy !== null} onClick={() => void forget(index)}>{busy === index ? <Loader2 size={13} className="settings-spin" /> : (nl ? "Wissen" : "Remove")}</button></li>)}
        </ul>
      ) : <p className="otis-note">{nl ? "Nog niets uit gesprekken. Vertel Otis in de chat over je leveranciers of drukke periodes." : "Nothing from conversations yet. Tell Otis in the chat about your suppliers or busy periods."}</p>}
      <button type="button" className="settings-btn" onClick={onRestart}>{nl ? "Kennismaking opnieuw doen" : "Redo the introduction"}</button>
    </section>
  );
}

export const ONBOARDING_CSS = `
.otis-onboarding{display:grid;gap:18px;padding:26px 28px;border:1px solid rgba(199,245,111,.3);border-radius:22px;background:radial-gradient(circle at 6% 0%,rgba(199,245,111,.1),transparent 40%),var(--surface)}
.otis-onboarding-head{display:flex;align-items:center;gap:16px}
.otis-onboarding-mark{flex:none;width:64px;display:grid;place-items:center}
.otis-eyebrow{display:block;font-size:11px;font-weight:600;letter-spacing:.1em;color:var(--tone-success,#C7F56F)}
.otis-progress{display:flex;gap:6px;margin-top:8px}
.otis-progress i{width:28px;height:4px;border-radius:2px;background:var(--border)}
.otis-progress i.is-done{background:var(--tone-success,#C7F56F)}
.otis-step{display:grid;gap:12px;max-width:720px}
.otis-step h2{margin:0;color:var(--text);font-size:22px;font-weight:600;letter-spacing:-.01em}
.otis-step>p{margin:0;color:var(--muted);font-size:14px;line-height:1.65}
.otis-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.otis-fields label{display:grid;gap:6px;align-content:start}
.otis-fields label>span:first-child,.otis-label{color:var(--text);font-size:13px;font-weight:600}
.otis-fields small,.otis-choice small{color:var(--muted);font-size:12px;line-height:1.5}
.otis-wide{grid-column:1/-1}
.otis-fields input[type=text]{height:42px;padding:0 12px;border:1px solid color-mix(in srgb,var(--text) 20%,transparent);border-radius:10px;background:transparent;color:var(--text);font:inherit;font-size:14px}
.otis-inline-input{display:inline-flex;align-items:center;gap:8px;color:var(--muted);font-size:13px}
.otis-inline-input input{width:84px;height:38px;padding:0 10px;border:1px solid color-mix(in srgb,var(--text) 20%,transparent);border-radius:10px;background:transparent;color:var(--text);font:inherit;font-size:15px;font-variant-numeric:tabular-nums}
.otis-onboarding input:focus-visible{outline:2px solid var(--tone-success,#C7F56F);outline-offset:1px}
.otis-choices{display:grid;gap:10px}
.otis-choice{display:flex;gap:12px;align-items:flex-start;padding:14px 16px;border:1px solid var(--border);border-radius:14px;cursor:pointer}
.otis-choice.is-active{border-color:rgba(199,245,111,.55);background:rgba(199,245,111,.05)}
.otis-choice>input{margin-top:3px;accent-color:#C7F56F;width:16px;height:16px;flex:none}
.otis-choice-body{display:grid;gap:6px;min-width:0}
.otis-choice-body strong{color:var(--text);font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.otis-choice-body em{font-style:normal;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:rgba(199,245,111,.14);color:var(--tone-success,#C7F56F)}
.otis-chips{display:flex;flex-wrap:wrap;gap:8px}
.otis-chips button{padding:8px 14px;border:1px solid var(--border);border-radius:999px;background:transparent;color:var(--muted);font:inherit;font-size:13px;cursor:pointer}
.otis-chips button.is-active{border-color:rgba(199,245,111,.6);color:var(--text);background:rgba(199,245,111,.08)}
.otis-note{margin:0;color:var(--muted);font-size:12.5px;line-height:1.6}
.otis-actions{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.otis-nav{justify-content:space-between;max-width:720px}
.otis-link{display:inline-flex;align-items:center;gap:6px;padding:0;border:0;background:none;color:var(--muted);font:inherit;font-size:13px;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.otis-link:disabled{opacity:.5;cursor:default}
.otis-error{margin:0;color:var(--tone-danger);font-size:13px}
.otis-memory{display:grid;gap:12px}
.otis-memory h2{margin:0;font-size:16px;font-weight:600;color:var(--text)}
.otis-memory-line{margin:0;font-size:14px;color:var(--text)}
.otis-memory-line span{display:inline-block;min-width:80px;color:var(--muted);font-size:12px}
.otis-memory-list{list-style:none;margin:0;padding:0;display:grid}
.otis-memory-list li{display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-top:1px solid var(--border);font-size:14px;color:var(--text)}
.otis-memory-list li:first-child{border-top:0}
.otis-memory .settings-btn{justify-self:start}
@media(max-width:700px){.otis-onboarding{padding:20px 18px}.otis-fields{grid-template-columns:1fr}}
`;
