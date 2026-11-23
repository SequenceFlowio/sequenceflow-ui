import { judgeUsage, RESEND_PRICING_URL, RESEND_USAGE_URL, type QuotaWindow } from "@/lib/backoffice/resendUsageCore";
import type { ResendUsageState } from "@/lib/backoffice/resendUsage";

const n = (value: number) => value.toLocaleString("nl-NL");
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" }) : null);

const VERDICT = {
  ok: { pill: "Ruim binnen", tone: "is-good", advice: "Je hoeft niet te upgraden." },
  watch: { pill: "In de gaten houden", tone: "is-warn", advice: "Nog binnen de limiet, maar het loopt op. Upgraden kan later deze maand nodig zijn." },
  upgrade: { pill: "Upgrade nodig", tone: "is-warn", advice: "Upgrade je Resend-pakket, anders weigert Resend straks mails (inlogcodes, meldingen en doorgestuurde klantmails)." },
  blocked: { pill: "Limiet bereikt", tone: "is-bad", advice: "Resend weigert nu mails. Upgrade meteen; geweigerde mails worden niet later alsnog verstuurd." },
} as const;

function Meter({ label, window, projected }: { label: string; window: QuotaWindow; projected?: number }) {
  const limit = window.limit;
  const share = limit ? Math.min(1, window.used / limit) : null;
  const tone = share === null ? "" : share >= 1 ? "is-bad" : share >= 0.8 ? "is-warn" : "is-good";
  return (
    <div className="bo-meter">
      <div className="bo-meter-head">
        <span>{label}</span>
        <strong>{n(window.used)}{limit ? <small> / {n(limit)}</small> : <small> · geen limiet</small>}</strong>
      </div>
      {limit ? <div className={`bo-meter-bar ${tone}`} role="img" aria-label={`${Math.round((share ?? 0) * 100)}% gebruikt`}><i style={{ width: `${Math.max(1, (share ?? 0) * 100)}%` }} /></div> : null}
      <p className="bo-note">
        {n(window.sent)} verstuurd · {n(window.received)} ontvangen
        {projected !== undefined && limit ? ` · verwacht deze maand zo'n ${n(projected)}` : ""}
        {window.resetsAt ? ` · teller loopt terug ${when(window.resetsAt)}` : ""}
      </p>
    </div>
  );
}

/** Resend-verbruik bovenaan het overzicht: daglimiet (alleen gratis pakket) en maandlimiet, met advies. */
export function ResendUsage({ state }: { state: ResendUsageState }) {
  if (!state.ok) {
    const text = state.reason === "no_key"
      ? "RESEND_API_KEY ontbreekt."
      : state.reason === "forbidden"
        ? "De Resend-sleutel mag het verbruik niet lezen (alleen versturen). Maak bij Resend een sleutel met volledige toegang en zet die als RESEND_USAGE_API_KEY in Vercel."
        : `Verbruik ophalen bij Resend lukte niet${state.message ? `: ${state.message}` : ""}.`;
    return (
      <section className="bo-card bo-credit">
        <h2>Resend-mails</h2>
        <p className="bo-note">{text}</p>
        <a className="bo-link" href={RESEND_USAGE_URL} target="_blank" rel="noreferrer">Verbruik bekijken bij Resend</a>
      </section>
    );
  }
  const verdict = judgeUsage(state.usage);
  const info = VERDICT[verdict.level];
  return (
    <section className={`bo-card bo-credit ${info.tone}`}>
      <div className="bo-credit-head">
        <div>
          <h2>Resend-mails</h2>
          <p className="bo-note">{info.advice}</p>
        </div>
        <span className={`bo-pill ${verdict.level === "ok" ? "is-good" : verdict.level === "blocked" ? "is-bad" : "is-warn"}`}>{info.pill}</span>
      </div>
      <div className="bo-meters">
        <Meter label="Deze maand" window={state.usage.monthly} projected={verdict.projectedMonth} />
        <Meter label={state.usage.daily.limit ? "Laatste 24 uur" : "Laatste 24 uur (geen daglimiet)"} window={state.usage.daily} />
      </div>
      {verdict.reasons.length ? <ul className="bo-reasons">{verdict.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : null}
      <p className="bo-note">Telt verzonden én ontvangen mails: ook klantmails die via het doorstuuradres binnenkomen. {state.usage.daily.limit ? "Een daglimiet heb je alleen op het gratis pakket." : ""}</p>
      <div className="bo-credit-actions">
        <a className="bo-link" href={RESEND_USAGE_URL} target="_blank" rel="noreferrer">Verbruik bij Resend</a>
        <a className="bo-link" href={RESEND_PRICING_URL} target="_blank" rel="noreferrer">Pakketten van Resend</a>
      </div>
    </section>
  );
}
