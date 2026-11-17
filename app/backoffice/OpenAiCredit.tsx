"use client";

import { useState } from "react";

import { OPENAI_BILLING_URL, usd, type CreditEstimate } from "@/lib/backoffice/openaiCreditCore";

type Props = { ready: boolean; estimate: CreditEstimate | null; adminKey: boolean; error?: string };

const day = (iso: string) => new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" });

/**
 * OpenAI-tegoed bovenaan het overzicht. OpenAI geeft het resterende tegoed niet via een API:
 * je neemt de stand over van de billingpagina, en het dashboard telt de kosten sindsdien af.
 */
export function OpenAiCredit({ ready, estimate, adminKey, error }: Props) {
  const [open, setOpen] = useState(!estimate);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setSaveError(null);
    try {
      const response = await fetch("/api/backoffice/openai-credit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ balanceUsd: value }) });
      const data = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "Opslaan lukte niet.");
      window.location.assign("?tab=overzicht&vers=1");
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : String(cause));
      setBusy(false);
    }
  }

  if (!ready) {
    return <section className="bo-card bo-credit"><h2>OpenAI-tegoed</h2><p className="bo-banner">Voer eerst migratie <code>076_backoffice_notifications.sql</code> uit in Supabase.</p></section>;
  }

  const tone = estimate?.level === "empty" ? "is-bad" : estimate?.level === "low" ? "is-warn" : "is-good";
  return (
    <section className={`bo-card bo-credit ${estimate ? tone : ""}`}>
      <div className="bo-credit-head">
        <div>
          <h2>OpenAI-tegoed</h2>
          {estimate ? (
            <>
              <strong className="bo-credit-value">{usd(Math.max(0, estimate.remainingUsd))}</strong>
              <p className="bo-note">
                Geschat over: {usd(estimate.balanceUsd)} op {day(estimate.notedAt)}, min {usd(estimate.spentSinceUsd)} verbruikt sindsdien
                {estimate.perDayUsd ? ` · ongeveer ${usd(estimate.perDayUsd)} per dag` : ""}
                {estimate.daysLeft !== null ? ` · nog zo'n ${estimate.daysLeft} ${estimate.daysLeft === 1 ? "dag" : "dagen"}` : ""}.
              </p>
              <p className="bo-note">
                {estimate.basis === "costs_api"
                  ? "Verbruik volgens OpenAI's eigen kostenoverzicht."
                  : adminKey
                    ? "OpenAI's kostenoverzicht gaf geen antwoord; verbruik volgens onze eigen telling van Support One."
                    : "Verbruik volgens onze eigen telling van Support One. Andere apps op dezelfde OpenAI-organisatie tellen niet mee; zet OPENAI_ADMIN_KEY in Vercel voor OpenAI's eigen cijfers."}
              </p>
            </>
          ) : <p className="bo-note">{error ? `Verbruik ophalen lukte niet: ${error}` : "Nog geen stand ingevuld. Kijk op de billingpagina van OpenAI hoeveel tegoed er staat en vul het hieronder in."}</p>}
        </div>
        {estimate?.level === "low" || estimate?.level === "empty" ? <span className="bo-pill is-warn">{estimate.level === "empty" ? "Op" : "Bijna op"}</span> : null}
      </div>
      {open ? (
        <form className="bo-credit-form" onSubmit={save}>
          <label>
            <span>Tegoed volgens OpenAI (in dollars)</span>
            <input className="bo-input bo-input--small" inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} placeholder="bijv. 42,50" required />
          </label>
          <button className="bo-action" disabled={busy || !value.trim()}>{busy ? "Bezig…" : "Opslaan"}</button>
          <a className="bo-link" href={OPENAI_BILLING_URL} target="_blank" rel="noreferrer">Billingpagina van OpenAI</a>
          {saveError ? <p className="bo-login-error" role="alert">{saveError}</p> : null}
        </form>
      ) : (
        <div className="bo-credit-actions">
          <button type="button" className="bo-link" onClick={() => setOpen(true)}>Nieuwe stand invullen (na opwaarderen)</button>
          <a className="bo-link" href={OPENAI_BILLING_URL} target="_blank" rel="noreferrer">Billingpagina van OpenAI</a>
        </div>
      )}
    </section>
  );
}
