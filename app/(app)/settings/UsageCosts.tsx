"use client";

import { useEffect, useState } from "react";
import { Receipt } from "lucide-react";

import { Notice, Section } from "./SettingsUi";
import { formatCents, HANDLED_RATES, PLAN_CATALOG_V2 } from "@/lib/planCatalog";

type Summary = {
  periodStart: string;
  assisted: number;
  autonomous: number;
  pending: number;
  usageCents: number;
  billedCents: number;
  overBudget: number;
  budgetCents: number | null;
  budget: "none" | "near" | "reached";
};

/**
 * Wat je deze periode betaalt: het vaste bedrag, de afgehandelde gesprekken
 * en wat nog in de 72 uur controle zit. Plus het maandbudget dat je zelf
 * instelt; daarboven betaal je niets.
 */
export function UsageCosts({ plan, canManage, nl }: { plan: string; canManage: boolean; nl: boolean }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function load() {
    const response = await fetch("/api/billing/handled", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as Summary;
    setSummary(data);
    setBudgetInput(data.budgetCents === null ? "" : String(Math.round(data.budgetCents / 100)));
  }
  useEffect(() => { void load(); }, []);

  async function saveBudget(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = budgetInput.trim();
    const euros = trimmed === "" ? null : Number(trimmed.replace(",", "."));
    if (euros !== null && (!Number.isFinite(euros) || euros < 0)) {
      setMessage({ tone: "error", text: nl ? "Vul een bedrag in euro's in, of laat het leeg." : "Enter an amount in euros, or leave it empty." });
      return;
    }
    setSaving(true); setMessage(null);
    const response = await fetch("/api/billing/budget", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ budgetCents: euros === null ? null : Math.round(euros * 100) }) });
    setSaving(false);
    if (!response.ok) { setMessage({ tone: "error", text: nl ? "Het budget kon niet worden opgeslagen." : "The budget could not be saved." }); return; }
    setMessage({ tone: "success", text: euros === null ? (nl ? "Geen budget meer ingesteld." : "Budget removed.") : (nl ? `Budget opgeslagen: ${formatCents(Math.round(euros * 100))} per maand.` : `Budget saved: ${formatCents(Math.round(euros * 100))} per month.`) });
    void load();
  }

  if (!summary) return null;
  const base = PLAN_CATALOG_V2.find((item) => item.id === plan)?.baseCents ?? 0;
  const start = new Date(summary.periodStart).toLocaleDateString(nl ? "nl-NL" : "en-GB", { day: "numeric", month: "long" });
  const pct = summary.budgetCents ? Math.min(100, Math.round((summary.billedCents / summary.budgetCents) * 100)) : 0;

  return (
    <Section icon={<Receipt size={18} />} title={nl ? "Kosten deze periode" : "Costs this period"} description={nl ? `Sinds ${start}. Bedragen exclusief btw.` : `Since ${start}. Amounts exclude VAT.`}>
      {summary.budget === "near" ? <Notice tone="warning">{nl ? `Je zit op ${pct}% van je maandbudget.` : `You're at ${pct}% of your monthly budget.`}</Notice> : null}
      {summary.budget === "reached" ? <Notice tone="warning">{nl ? "Je maandbudget is bereikt. Support One werkt gewoon door; afgehandelde gesprekken boven je budget betaal je niet." : "Your monthly budget is reached. Support One keeps working; handled conversations above your budget are free."}</Notice> : null}
      <div className="usage-costs">
        {base ? <div><span>{nl ? "Abonnement" : "Plan"}</span><strong>{formatCents(base)}</strong></div> : null}
        <div><span>{nl ? `${summary.assisted} × gecontroleerd à ${formatCents(HANDLED_RATES.assisted)}` : `${summary.assisted} × checked at ${formatCents(HANDLED_RATES.assisted)}`}</span><strong>{formatCents(summary.assisted * HANDLED_RATES.assisted)}</strong></div>
        <div><span>{nl ? `${summary.autonomous} × zelfstandig à ${formatCents(HANDLED_RATES.autonomous)}` : `${summary.autonomous} × autonomous at ${formatCents(HANDLED_RATES.autonomous)}`}</span><strong>{formatCents(summary.autonomous * HANDLED_RATES.autonomous)}</strong></div>
        <div className="is-total"><span>{nl ? "Tot nu toe" : "So far"}</span><strong>{formatCents(base + summary.usageCents)}</strong></div>
        <p>{nl ? `${summary.pending} ${summary.pending === 1 ? "gesprek zit" : "gesprekken zitten"} nog in de controle van 72 uur. Die tellen pas als de klant niet terugkomt.` : `${summary.pending} ${summary.pending === 1 ? "conversation is" : "conversations are"} still in the 72-hour check. They only count if the customer doesn't come back.`}</p>
      </div>
      <form className="usage-budget" onSubmit={saveBudget}>
        <label htmlFor="usage-budget">{nl ? "Maandbudget voor afgehandelde gesprekken" : "Monthly budget for handled conversations"}</label>
        <div>
          <span>€</span>
          <input id="usage-budget" inputMode="decimal" placeholder={nl ? "Geen maximum" : "No maximum"} value={budgetInput} disabled={!canManage || saving} onChange={(event) => setBudgetInput(event.target.value)} />
          <button className="settings-btn" type="submit" disabled={!canManage || saving}>{nl ? "Opslaan" : "Save"}</button>
        </div>
        <small>{nl ? "Bij 80% krijg je een seintje. Boven het budget betaal je niets, en Support One blijft gewoon werken." : "You get a heads-up at 80%. Above the budget you pay nothing, and Support One keeps working."}</small>
        {message ? <Notice tone={message.tone} onClose={() => setMessage(null)}>{message.text}</Notice> : null}
      </form>
      <style>{`
        .usage-costs{display:grid;border:1px solid var(--border);border-radius:8px;overflow:hidden}
        .usage-costs>div{display:flex;justify-content:space-between;gap:16px;padding:11px 14px;border-bottom:1px solid var(--border);font-size:13px}
        .usage-costs>div span{color:var(--muted)}
        .usage-costs>div.is-total{background:var(--surface-2)}
        .usage-costs>div.is-total span,.usage-costs>div.is-total strong{color:var(--text);font-weight:650}
        .usage-costs>p{margin:0;padding:11px 14px;font-size:12px;color:var(--muted)}
        .usage-budget{display:grid;gap:8px;margin-top:18px}
        .usage-budget label{font-size:13px;font-weight:600}
        .usage-budget>div{display:flex;align-items:center;gap:8px}
        .usage-budget input{width:140px;padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font:inherit}
        .usage-budget small{color:var(--muted);font-size:12px}
      `}</style>
    </Section>
  );
}
