"use client";

import { useState } from "react";

/**
 * Legt vast dat een affiliate is uitbetaald. Het overmaken zelf doe je bij de
 * bank; deze knop zet de commissie op betaald, maakt de factuur en mailt de affiliate.
 */
export function PayoutButton({ affiliateId, username, total, disabled }: { affiliateId: string; username: string; total: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/backoffice/payouts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ affiliateId, reference }) });
      const data = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "Vastleggen is mislukt.");
      window.location.assign("?tab=partners&vers=1");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Vastleggen is mislukt.");
      setBusy(false);
    }
  }

  if (!open) {
    return <button type="button" className="bo-action" disabled={disabled} title={disabled ? "Eerst moet de affiliate een rekening invullen" : undefined} onClick={() => setOpen(true)}>Uitbetaald</button>;
  }
  return (
    <div className="bo-confirm">
      <p>Heb je {total} overgemaakt aan <b>{username}</b>? Dit zet de commissie op betaald en mailt de affiliate. Het is niet terug te draaien.</p>
      <input className="bo-input bo-input--small" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Betalingskenmerk (optioneel)" maxLength={140} aria-label="Betalingskenmerk" />
      {error ? <p className="bo-login-error" role="alert">{error}</p> : null}
      <div>
        <button type="button" className="bo-action" disabled={busy} onClick={confirm}>{busy ? "Bezig…" : "Ja, vastleggen"}</button>
        <button type="button" className="bo-link" disabled={busy} onClick={() => { setOpen(false); setError(null); }}>Annuleren</button>
      </div>
    </div>
  );
}
