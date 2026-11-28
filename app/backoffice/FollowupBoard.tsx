"use client";

import { useState } from "react";

export type FollowupView = {
  id: string; tenantName: string; email: string | null; step: number; variant: string; dueAt: string;
  status: "concept" | "verstuurd" | "overgeslagen"; subject: string; body: string; sentAt: string | null; sentBy: string | null;
};

export type TrialView = {
  tenantId: string; name: string; email: string | null; createdAt: string; trialEndsAt: string | null; plan: string;
  connected: boolean; drafted: boolean; sent: boolean; paying: boolean; day: number; nextAction: string | null; nextActionAt: string | null;
};

const TZ = "Europe/Amsterdam";
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", timeZone: TZ }) : "—");
const yes = (value: boolean) => (value ? "✓" : "—");

async function post(body: Record<string, unknown>) {
  const response = await fetch("/api/backoffice/followups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({ ok: false, error: "Geen antwoord." })) as { ok: boolean; error?: string };
  if (!data.ok) throw new Error(data.error ?? "Mislukt.");
}

export function FollowupBoard({ followups, trials, demoLink }: { followups: FollowupView[]; trials: TrialView[]; demoLink: boolean }) {
  const [message, setMessage] = useState<string | null>(null);
  const open = followups.filter((row) => row.status === "concept");
  const done = followups.filter((row) => row.status === "verstuurd").slice(0, 15);
  const today = new Date(); today.setHours(23, 59, 59, 999);
  const calls = trials.filter((trial) => trial.nextActionAt && Date.parse(trial.nextActionAt) <= today.getTime() && !trial.paying);

  return (
    <>
      <div className="bo-kpis">
        <div className="bo-kpi"><span>Mails klaar om te versturen</span><strong>{open.length}</strong><small>dag 2, 7 en 12 van de proef</small></div>
        <div className="bo-kpi"><span>Bellen vandaag</span><strong>{calls.length}</strong><small>belmoment uit de CRM</small></div>
        <div className="bo-kpi"><span>Proefaccounts (30 dagen)</span><strong>{trials.filter((t) => !t.paying).length}</strong><small>{trials.filter((t) => t.connected).length} met mailbox</small></div>
        <div className="bo-kpi"><span>Betalend geworden</span><strong>{trials.filter((t) => t.paying).length}</strong></div>
      </div>
      {!demoLink ? <p className="bo-banner">Er is nog geen demo-boekingslink (DEMO_BOOKING_URL). Tot die tijd vragen de mails om te antwoorden met een moment.</p> : null}
      {message ? <p className="bo-banner">{message}</p> : null}

      <section className="bo-card bo-card--wide">
        <h2>Opvolgmails om te versturen</h2>
        <p className="bo-note">Elke mail gaat pas weg als je op Versturen klikt, vanaf Navaron van SequenceFlow. Antwoorden komen binnen op hallo@sequenceflow.io. Je kunt de tekst eerst aanpassen.</p>
        {!open.length ? <p className="bo-empty">Niets te versturen. Nieuwe concepten verschijnen hier op dag 2, 7 en 12 van een proef.</p> : (
          <ol className="bo-leads">{open.map((row) => <FollowupItem key={row.id} row={row} onDone={setMessage} />)}</ol>
        )}
      </section>

      <section className="bo-card bo-card--wide">
        <h2>Proefaccounts</h2>
        <p className="bo-note">Aanmeldingen van de laatste 30 dagen. Elke aanmelding staat ook in de tab Leads, met een belmoment op de tweede werkdag.</p>
        {!trials.length ? <p className="bo-empty">Geen aanmeldingen in de laatste 30 dagen.</p> : (
          <div className="bo-table-wrap">
            <table className="bo-table">
              <thead><tr><th>Werkruimte</th><th>Aangemeld</th><th className="is-num">Dag</th><th>Mailbox</th><th>Concept</th><th>Verstuurd</th><th>Betaalt</th><th>Volgende actie</th></tr></thead>
              <tbody>{trials.map((trial) => (
                <tr key={trial.tenantId}>
                  <td><b>{trial.name}</b><small className="bo-sub">{trial.email ?? "geen adres"}</small></td>
                  <td>{day(trial.createdAt)}</td>
                  <td className="is-num">{trial.day}</td>
                  <td>{yes(trial.connected)}</td><td>{yes(trial.drafted)}</td><td>{yes(trial.sent)}</td><td>{yes(trial.paying)}</td>
                  <td>{trial.nextActionAt ? `${trial.nextAction ?? "Actie"} · ${day(trial.nextActionAt)}` : "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      {done.length ? (
        <section className="bo-card bo-card--wide">
          <h2>Laatst verstuurd</h2>
          <ul className="bo-list">{done.map((row) => <li key={row.id}>{day(row.sentAt)} · dag {row.step} · <b>{row.tenantName}</b> · {row.subject} <span className="bo-sub-inline">({row.sentBy})</span></li>)}</ul>
        </section>
      ) : null}
    </>
  );
}

function FollowupItem({ row, onDone }: { row: FollowupView; onDone: (message: string) => void }) {
  const [subject, setSubject] = useState(row.subject);
  const [body, setBody] = useState(row.body);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function act(action: "send" | "skip") {
    if (action === "send" && !window.confirm(`Deze mail nu versturen naar ${row.email}?`)) return;
    setBusy(true);
    try {
      await post({ action, id: row.id, subject, body });
      onDone(action === "send" ? `Verstuurd naar ${row.email}.` : "Overgeslagen.");
      window.location.reload();
    } catch (error) {
      onDone(error instanceof Error ? error.message : "Mislukt.");
      setBusy(false);
    }
  }

  return (
    <li className={open ? "is-open" : undefined}>
      <button className="bo-lead-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <b className="bo-lead-score">d{row.step}</b>
        <span><strong>{row.tenantName}</strong><small>{row.email ?? "geen adres"} · {row.variant}</small></span>
        <span className="bo-pill is-info">{row.subject}</span>
        <small>{day(row.dueAt)}</small>
      </button>
      {open ? (
        <div className="bo-lead-body">
          <label className="bo-field">Onderwerp<input className="bo-input" value={subject} onChange={(event) => setSubject(event.target.value)} /></label>
          <label className="bo-field">Tekst<textarea className="bo-input bo-textarea" rows={10} value={body} onChange={(event) => setBody(event.target.value)} /></label>
          <div className="bo-row">
            <button className="bo-button" disabled={busy || !row.email} onClick={() => act("send")}>{busy ? "Bezig…" : "Versturen"}</button>
            <button className="bo-button bo-button--ghost" disabled={busy} onClick={() => act("skip")}>Overslaan</button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
