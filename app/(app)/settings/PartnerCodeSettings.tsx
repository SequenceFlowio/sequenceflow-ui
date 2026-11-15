"use client";

import { useEffect, useState } from "react";
import { Gift } from "lucide-react";

import { Notice, Section } from "./SettingsUi";

type Status = { linked: string | null; canClaim: boolean; discountRate: number; discountUsed: boolean };

/**
 * Partnercode in het abonnementsscherm. Tijdens de proef kan een klant hier alsnog de
 * code van een affiliate of doorverwijzer invullen; de korting op de eerste maand staat
 * dan klaar bij het afsluiten. Toont niets als er niets te melden of in te vullen is.
 */
export function PartnerCodeSettings({ nl, canManage }: { nl: boolean; canManage: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/referrals/code", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: Status | null) => setStatus(data))
      .catch(() => setStatus(null));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/referrals/code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || (nl ? "Code invullen lukte niet." : "Could not apply the code."));
      setStatus(data as Status);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  if (!status || (!status.linked && !status.canClaim)) return null;
  const pct = Math.round(status.discountRate * 100);

  if (status.linked) {
    const who = status.linked === "doorverwijzing" ? (nl ? "een doorverwijzing" : "a referral") : status.linked;
    return (
      <Notice tone="success" title={nl ? "Partnercode gekoppeld" : "Partner code linked"}>
        {status.discountUsed
          ? (nl ? `Je kwam binnen via ${who}. Je welkomstkorting is verrekend met je eerste factuur.` : `You joined via ${who}. Your welcome discount was applied to your first invoice.`)
          : (nl ? `Je kwam binnen via ${who}: ${pct}% korting op je eerste betaalde maand staat klaar. Die wordt verrekend zodra je een pakket kiest.` : `You joined via ${who}: ${pct}% off your first paid month is ready. It is applied when you choose a plan.`)}
      </Notice>
    );
  }

  if (!canManage) return null;
  return (
    <Section icon={<Gift size={18} />} title={nl ? "Partnercode" : "Partner code"} description={nl ? "Kreeg je een code van een partner of een andere webshop? Vul hem in vóór je eerste betaling: je krijgt 10% korting op je eerste betaalde maand." : "Got a code from a partner or another store? Enter it before your first payment to get 10% off your first paid month."}>
      <form className="settings-referral-link" onSubmit={submit}>
        <input value={code} onChange={(event) => { setCode(event.target.value); setError(null); }} placeholder={nl ? "bijv. ecomjuju" : "e.g. ecomjuju"} aria-label={nl ? "Partnercode" : "Partner code"} autoComplete="off" autoCapitalize="none" spellCheck={false} />
        <button className="settings-btn primary" disabled={busy || !code.trim()}>{busy ? (nl ? "Bezig…" : "Working…") : (nl ? "Toepassen" : "Apply")}</button>
      </form>
      {error ? <p className="settings-error" role="alert">{error}</p> : null}
    </Section>
  );
}
