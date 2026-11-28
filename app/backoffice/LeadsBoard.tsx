"use client";

import { useMemo, useState } from "react";

import { LEAD_STATUSES, STATUS_LABEL, type LeadStatus } from "@/lib/sales/leadsCore";

export type LeadView = {
  id: string; domain: string; name: string | null; website: string; bolUrl: string | null; platform: string | null; category: string | null;
  contactEmail: string | null; linkedinUrl: string | null; score: number; scoreReasons: string[]; status: LeadStatus;
  linkedinDraft: string | null; emailSubject: string | null; emailDraft: string | null;
  nextAction: string | null; nextActionAt: string | null; contactedAt: string | null; notes: string | null; createdAt: string;
  helpdesk: string[]; productCount: number | null;
};

const TZ = "Europe/Amsterdam";
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", timeZone: TZ }) : "—");
const OPEN: LeadStatus[] = ["nieuw", "goedgekeurd", "benaderd", "gereageerd", "demo", "trial"];
const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); };

async function call(body: Record<string, unknown>) {
  const response = await fetch("/api/backoffice/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({ ok: false, error: "Geen antwoord." })) as { ok: boolean; error?: string; results?: Array<{ domain: string; outcome: string; detail: string }> };
  if (!data.ok) throw new Error(data.error ?? "Mislukt.");
  return data;
}

export function LeadsBoard({ leads, mailDomainReady }: { leads: LeadView[]; mailDomainReady: boolean }) {
  const [filter, setFilter] = useState<"vandaag" | "open" | LeadStatus | "alle">("open");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [importText, setImportText] = useState("");

  const today = endOfToday();
  const due = leads.filter((lead) => lead.nextActionAt && Date.parse(lead.nextActionAt) <= today && OPEN.includes(lead.status));
  const shown = useMemo(() => {
    if (filter === "vandaag") return due;
    if (filter === "open") return leads.filter((lead) => OPEN.includes(lead.status));
    if (filter === "alle") return leads;
    return leads.filter((lead) => lead.status === filter);
  }, [filter, leads, due]);

  const counts = Object.fromEntries(LEAD_STATUSES.map((status) => [status, leads.filter((lead) => lead.status === status).length])) as Record<LeadStatus, number>;

  async function run(key: string, body: Record<string, unknown>, done: string) {
    setBusy(key);
    setMessage(null);
    try {
      const data = await call(body);
      if (data.results) {
        const added = data.results.filter((r) => r.outcome === "added").length;
        setMessage(`${added} toegevoegd. ${data.results.filter((r) => r.outcome !== "added").map((r) => `${r.domain}: ${r.detail}`).join(" · ")}`);
      } else setMessage(done);
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Mislukt.");
    } finally {
      setBusy(null);
    }
  }

  async function copy(text: string | null, label: string) {
    if (!text) return;
    try { await navigator.clipboard.writeText(text); setMessage(`${label} gekopieerd.`); } catch { setMessage("Kopiëren lukte niet; selecteer de tekst zelf."); }
  }

  return (
    <>
      <div className="bo-kpis">
        <div className="bo-kpi"><span>Vandaag opvolgen</span><strong>{due.length}</strong><small>volgende actie vandaag of eerder</small></div>
        <div className="bo-kpi"><span>Klaar om te benaderen</span><strong>{counts.goedgekeurd + counts.nieuw}</strong><small>{counts.nieuw} nog te beoordelen</small></div>
        <div className="bo-kpi"><span>Benaderd</span><strong>{counts.benaderd}</strong><small>{counts.gereageerd} gereageerd</small></div>
        <div className="bo-kpi"><span>Demo of proef</span><strong>{counts.demo + counts.trial}</strong></div>
        <div className="bo-kpi"><span>Klant</span><strong>{counts.klant}</strong></div>
      </div>

      {!mailDomainReady ? <p className="bo-banner">Koude mail staat uit: er is nog geen apart, opgewarmd maildomein. De mailconcepten staan klaar, maar verstuur ze niet vanaf sequenceflow.io. LinkedIn verstuur je zelf.</p> : null}
      {message ? <p className="bo-banner">{message}</p> : null}

      <section className="bo-card bo-card--wide">
        <h2>Leads toevoegen</h2>
        <p className="bo-note">Eén webshop per regel (domein of url). De eigen site wordt opgehaald, gescoord en er komt een concept bij. Maximaal 20 per keer. bol.com, LinkedIn en social-sites worden overgeslagen.</p>
        <textarea className="bo-input bo-textarea" rows={3} value={importText} onChange={(event) => setImportText(event.target.value)} placeholder={"voorbeeldshop.nl\nhttps://www.anderewinkel.nl"} />
        <button className="bo-button" disabled={busy !== null || !importText.trim()} onClick={() => run("import", { action: "import", items: importText.split(/\s+/).filter(Boolean).slice(0, 20) }, "Toegevoegd.")}>
          {busy === "import" ? "Bezig met ophalen…" : "Toevoegen en scoren"}
        </button>
      </section>

      <nav className="bo-filters" aria-label="Filter">
        {([["vandaag", `Vandaag (${due.length})`], ["open", "Open"], ...LEAD_STATUSES.map((s) => [s, `${STATUS_LABEL[s]} (${counts[s]})`]), ["alle", "Alle"]] as Array<[typeof filter, string]>).map(([key, label]) => (
          <button key={key} className={filter === key ? "is-active" : undefined} onClick={() => setFilter(key)}>{label}</button>
        ))}
      </nav>

      <section className="bo-card bo-card--wide">
        {!shown.length ? <p className="bo-empty">Geen leads in deze lijst.</p> : (
          <ol className="bo-leads">
            {shown.map((lead) => (
              <li key={lead.id} className={openId === lead.id ? "is-open" : undefined}>
                <button className="bo-lead-head" onClick={() => setOpenId(openId === lead.id ? null : lead.id)} aria-expanded={openId === lead.id}>
                  <b className="bo-lead-score">{lead.score}</b>
                  <span><strong>{lead.name || lead.domain}</strong><small>{lead.domain} · {lead.platform ?? "?"}{lead.bolUrl ? " · bol" : ""}{lead.productCount ? ` · ${lead.productCount} producten` : ""}</small></span>
                  <span className={`bo-pill is-${lead.status === "klant" ? "good" : lead.status === "afgewezen" || lead.status === "afgemeld" ? "muted" : "info"}`}>{STATUS_LABEL[lead.status]}</span>
                  <small>{lead.nextActionAt ? `${lead.nextAction ?? "Actie"}: ${day(lead.nextActionAt)}` : ""}</small>
                </button>
                {openId === lead.id ? <LeadDetail lead={lead} busy={busy} run={run} copy={copy} mailDomainReady={mailDomainReady} /> : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

function LeadDetail({ lead, busy, run, copy, mailDomainReady }: {
  lead: LeadView; busy: string | null; mailDomainReady: boolean;
  run: (key: string, body: Record<string, unknown>, done: string) => Promise<void>;
  copy: (text: string | null, label: string) => Promise<void>;
}) {
  const [linkedin, setLinkedin] = useState(lead.linkedinDraft ?? "");
  const [subject, setSubject] = useState(lead.emailSubject ?? "");
  const [email, setEmail] = useState(lead.emailDraft ?? "");
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [nextAction, setNextAction] = useState(lead.nextAction ?? "");
  const [nextAt, setNextAt] = useState(lead.nextActionAt ? lead.nextActionAt.slice(0, 10) : "");
  const searchName = encodeURIComponent(lead.name || lead.domain);
  const update = (patch: Record<string, unknown>, done: string) => run(`${lead.id}:${Object.keys(patch).join()}`, { action: "update", id: lead.id, patch }, done);

  return (
    <div className="bo-lead-body">
      <div className="bo-lead-links">
        <a href={lead.website} target="_blank" rel="noreferrer">Website</a>
        {lead.bolUrl ? <a href={lead.bolUrl} target="_blank" rel="noreferrer">bol-winkel</a> : <a href={`https://www.bol.com/nl/nl/s/?searchtext=${searchName}`} target="_blank" rel="noreferrer">Zoek op bol</a>}
        <a href={lead.linkedinUrl ?? `https://www.linkedin.com/search/results/companies/?keywords=${searchName}`} target="_blank" rel="noreferrer">{lead.linkedinUrl ? "LinkedIn-bedrijfspagina" : "Zoek op LinkedIn"}</a>
        <a href={`https://www.linkedin.com/search/results/people/?keywords=${searchName}%20eigenaar`} target="_blank" rel="noreferrer">Eigenaar zoeken</a>
        {lead.contactEmail ? <span>Algemeen adres: {lead.contactEmail}</span> : null}
      </div>
      <p className="bo-note">Score: {lead.scoreReasons.join(" · ")}</p>

      <label className="bo-field">LinkedIn-bericht ({linkedin.length}/300)
        <textarea className="bo-input bo-textarea" rows={4} maxLength={300} value={linkedin} onChange={(event) => setLinkedin(event.target.value)} />
      </label>
      <div className="bo-row">
        <button className="bo-button bo-button--ghost" onClick={() => copy(linkedin, "LinkedIn-bericht")}>Kopieer</button>
        <button className="bo-button" disabled={busy !== null} onClick={() => update({ linkedinDraft: linkedin, contacted: "linkedin" }, "Gemarkeerd als benaderd via LinkedIn; opvolgen over 4 werkdagen.")}>Ik heb het via LinkedIn verstuurd</button>
      </div>

      <label className="bo-field">Mail: onderwerp
        <input className="bo-input" value={subject} onChange={(event) => setSubject(event.target.value)} />
      </label>
      <label className="bo-field">Mail: tekst
        <textarea className="bo-input bo-textarea" rows={7} value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <div className="bo-row">
        <button className="bo-button bo-button--ghost" onClick={() => copy(`${subject}\n\n${email}`, "Mail")}>Kopieer</button>
        <button className="bo-button" disabled={busy !== null || !mailDomainReady} title={mailDomainReady ? undefined : "Eerst een apart, opgewarmd maildomein"} onClick={() => update({ emailSubject: subject, emailDraft: email, contacted: "mail" }, "Gemarkeerd als benaderd via mail.")}>Ik heb het gemaild</button>
        <button className="bo-button bo-button--ghost" disabled={busy !== null} onClick={() => update({ linkedinDraft: linkedin, emailSubject: subject, emailDraft: email }, "Concepten opgeslagen.")}>Concepten opslaan</button>
        <button className="bo-button bo-button--ghost" disabled={busy !== null} onClick={() => run(`${lead.id}:draft`, { action: "draft", id: lead.id }, "Nieuw concept gemaakt.")}>{busy === `${lead.id}:draft` ? "Schrijven…" : "Nieuw concept"}</button>
      </div>

      <div className="bo-row">
        <label className="bo-field">Status
          <select className="bo-input" value={lead.status} onChange={(event) => update({ status: event.target.value }, "Status bijgewerkt.")}>
            {LEAD_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}
          </select>
        </label>
        <label className="bo-field">Volgende actie
          <input className="bo-input" value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="Bellen, demo, opvolgen…" />
        </label>
        <label className="bo-field">Wanneer
          <input className="bo-input" type="date" value={nextAt} onChange={(event) => setNextAt(event.target.value)} />
        </label>
      </div>
      <label className="bo-field">Notities
        <textarea className="bo-input bo-textarea" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <div className="bo-row">
        <button className="bo-button" disabled={busy !== null} onClick={() => update({ notes, nextAction: nextAction || null, nextActionAt: nextAt ? new Date(`${nextAt}T08:00:00`).toISOString() : null }, "Opgeslagen.")}>Opslaan</button>
        <button className="bo-button bo-button--ghost" disabled={busy !== null} onClick={() => update({ status: "afgemeld" }, "Afgemeld: deze shop wordt nooit meer benaderd.")}>Wil geen contact (afmelden)</button>
      </div>
    </div>
  );
}
