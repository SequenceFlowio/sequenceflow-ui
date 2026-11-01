"use client";

import { useState } from "react";

import { estimatedMonthlyCommission, formatEuro, normalizeUsername, usernameProblem } from "@/lib/referrals/program";

const PLANS = [
  { id: "starter", name: "Starter", cents: 7_900 },
  { id: "growth", name: "Growth", cents: 22_900 },
  { id: "scale", name: "Scale", cents: 54_900 },
];

export function AffiliateCalculator() {
  const [customers, setCustomers] = useState(10);
  const [plan, setPlan] = useState(PLANS[1]);
  const monthly = estimatedMonthlyCommission(Array(customers).fill(plan.cents));
  return (
    <div className="af-calc">
      <label>
        <span>Klanten die je binnenbrengt <strong>{customers}</strong></span>
        <input type="range" min={1} max={50} value={customers} onChange={(e) => setCustomers(Number(e.target.value))} />
      </label>
      <div className="af-calc-plans" role="radiogroup" aria-label="Abonnement">
        {PLANS.map((p) => <button key={p.id} type="button" role="radio" aria-checked={plan.id === p.id} className={plan.id === p.id ? "is-selected" : ""} onClick={() => setPlan(p)}>{p.name} <small>{formatEuro(p.cents)}</small></button>)}
      </div>
      <div className="af-calc-result">
        <div><span>Per maand</span><strong>{formatEuro(monthly)}</strong></div>
        <div><span>Per jaar</span><strong>{formatEuro(monthly * 12)}</strong></div>
      </div>
    </div>
  );
}

export function AffiliateSignup() {
  const [username, setUsername] = useState("");
  const [isBusiness, setIsBusiness] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ link: string } | null>(null);
  const preview = normalizeUsername(username) || "jouwnaam";
  const usernameError = username ? usernameProblem(username) : null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/affiliate/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username, name: form.get("name"), email: form.get("email"), isBusiness,
          companyName: form.get("companyName"), kvkNumber: form.get("kvkNumber"), vatNumber: form.get("vatNumber"),
          channel: form.get("channel"), showOnLeaderboard: form.get("showOnLeaderboard") === "on",
          acceptTerms: form.get("acceptTerms") === "on", website: form.get("website"),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Aanmelden lukte niet.");
      setDone({ link: data.link });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Aanmelden lukte niet.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="af-signup" id="aanmelden">
      <div className="af-signup-copy">
        <div className="mk-eyebrow"><span />AANMELDEN</div>
        <h2>Binnen een minuut je eigen link.</h2>
        <p>Je hebt geen SequenceFlow-account nodig. Na het aanmelden krijg je je link meteen, en per mail je persoonlijke dashboard.</p>
      </div>
      <div className="af-signup-card">
        {done ? (
          <div className="af-done" role="status">
            <strong>Je bent aangemeld.</strong>
            <p>Dit is jouw link:</p>
            <code>{done.link}</code>
            <p>We hebben je een mail gestuurd met je dashboard. Zie je hem niet? Kijk dan in je spammap.</p>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <label className="af-wide">
              <span>Gebruikersnaam</span>
              <input name="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="bijv. webshopwouter" autoComplete="off" required aria-invalid={Boolean(usernameError)} />
              <small className={usernameError ? "is-error" : undefined}>{usernameError ?? `Je link: sequenceflow.io/r/${preview}`}</small>
            </label>
            <label><span>Naam</span><input name="name" autoComplete="name" required /></label>
            <label><span>E-mail</span><input name="email" type="email" autoComplete="email" required /></label>
            <label className="af-wide"><span>Waar ga je het delen? <small>(optioneel)</small></span><input name="channel" placeholder="Bijv. Instagram, nieuwsbrief, bureau met 30 webshopklanten" /></label>
            <label className="af-check af-wide"><input type="checkbox" checked={isBusiness} onChange={(e) => setIsBusiness(e.target.checked)} /><span>Ik doe mee als ondernemer (met KvK-nummer)</span></label>
            {isBusiness ? <>
              <label><span>Bedrijfsnaam</span><input name="companyName" autoComplete="organization" /></label>
              <label><span>KvK-nummer</span><input name="kvkNumber" inputMode="numeric" /></label>
              <label className="af-wide"><span>Btw-nummer <small>(als je btw-plichtig bent)</small></span><input name="vatNumber" /></label>
            </> : null}
            <label className="af-check af-wide"><input type="checkbox" name="showOnLeaderboard" defaultChecked /><span>Toon mijn gebruikersnaam op het leaderboard</span></label>
            <label className="af-check af-wide"><input type="checkbox" name="acceptTerms" required /><span>Ik ga akkoord met de <a href="#voorwaarden">spelregels</a></span></label>
            <input className="af-hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
            {error ? <p className="af-error af-wide" role="alert">{error}</p> : null}
            <button className="mk-button mk-button--primary af-wide" disabled={busy || Boolean(usernameError) || !username}>{busy ? "Bezig…" : "Maak mijn link"}</button>
          </form>
        )}
      </div>
    </section>
  );
}
