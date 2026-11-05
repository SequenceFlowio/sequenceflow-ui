"use client";

import { SequenceMark } from "@/components/marketing/SequenceMark";

import { Check, Copy, Download, Loader2, Send, Sparkles } from "lucide-react";
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { Notice } from "../settings/SettingsUi";
import { splitSuggestedReply } from "@/lib/assistants/team";
import type { AssistantProposal } from "@/lib/inventory/assistantCore";

/**
 * Chatting with Otis (fase 2) and his proposals (fase 3). The conversation
 * lives in the browser only. A proposal is a card; confirming it calls the
 * normal endpoint with this user's rights, so nothing changes without a click.
 */

type Message = { role: "user" | "assistant"; content: string; proposals?: AssistantProposal[]; grounded?: boolean; ungrounded?: string[] };
type Reply = { answer: string; proposals: AssistantProposal[]; grounded: boolean; ungrounded: string[] };

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init, headers: init?.body ? { "Content-Type": "application/json" } : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as { error?: string }).error || "Er ging iets mis.");
  return data as T;
}

// ── A safe, small Markdown: headings, bullets, steps, bold and tables ───────

function inline(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => (/^\*\*[^*]+\*\*$/.test(part) ? <strong key={index}>{part.slice(2, -2)}</strong> : <Fragment key={index}>{part}</Fragment>));
}

function cells(line: string) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

export function VeraAnswer({ content }: { content: string }) {
  const lines = splitSuggestedReply(content).content.split("\n");
  const blocks: ReactNode[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("|")) {
      const rows: string[][] = [];
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        const row = cells(lines[index]);
        if (!row.every((cell) => /^:?-{2,}:?$/.test(cell))) rows.push(row);
        index += 1;
      }
      index -= 1;
      const [head, ...body] = rows;
      const numeric = (cell: string) => /^[€$]?\s?[\d.,]+%?$/.test(cell);
      blocks.push(
        <div className="inv-table-wrap vera-table" key={blocks.length}>
          <table className="inv-table">
            {head ? <thead><tr>{head.map((cell, cellIndex) => <th key={cellIndex}>{inline(cell)}</th>)}</tr></thead> : null}
            <tbody>{body.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} className={numeric(cell) ? "num" : undefined}>{inline(cell)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    const heading = trimmed.match(/^#{1,3}\s+(.*)$/);
    if (heading) { blocks.push(<h4 key={blocks.length}>{inline(heading[1])}</h4>); continue; }
    const bullet = trimmed.match(/^[-*]\s+(.*)$/);
    if (bullet) { blocks.push(<div className="vera-bullet" key={blocks.length}><span>•</span><p>{inline(bullet[1])}</p></div>); continue; }
    const step = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (step) { blocks.push(<div className="vera-bullet" key={blocks.length}><span>{step[1]}.</span><p>{inline(step[2])}</p></div>); continue; }
    blocks.push(<p key={blocks.length}>{inline(trimmed)}</p>);
  }
  return <div className="vera-answer">{blocks}</div>;
}

// ── Proposal cards ──────────────────────────────────────────────────────────

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function CopyButton({ text, nl }: { text: string; nl: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" className="settings-btn" onClick={() => { void navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}>
      {copied ? <Check size={14} /> : <Copy size={14} />}{copied ? (nl ? "Gekopieerd" : "Copied") : (nl ? "Mailconcept kopiëren" : "Copy e-mail draft")}
    </button>
  );
}

export function PurchaseOrderCard({ proposal, nl }: { proposal: Extract<AssistantProposal, { action: "purchase_order" }>; nl: boolean }) {
  const { order } = proposal;
  const money = (value: number) => new Intl.NumberFormat(nl ? "nl-NL" : "en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value);
  return (
    <div className="vera-card">
      <strong>{nl ? "Concept-inkooporder" : "Draft purchase order"}</strong>
      <p>{proposal.summary} {nl ? "Dit is een concept: je verstuurt hem zelf." : "This is a draft: you send it yourself."}</p>
      {order.groups.map((group, index) => (
        <div key={index} className="vera-order-group">
          <h5>{group.supplier ? group.supplier.name : (nl ? "Zonder leverancier" : "No supplier")}{group.supplier?.email ? <span> · {group.supplier.email}</span> : null}{group.supplier?.leadTimeDays != null ? <span> · {nl ? "levertijd" : "lead time"} {group.supplier.leadTimeDays} {nl ? "dagen" : "days"}</span> : null}</h5>
          <div className="inv-table-wrap vera-table">
            <table className="inv-table">
              <thead><tr><th>{nl ? "Variant" : "Variant"}</th><th>SKU / EAN</th><th className="num">{nl ? "Voorraad" : "Stock"}</th><th className="num">{nl ? "Per week" : "Per week"}</th><th className="num">{nl ? "Bestellen" : "Order"}</th><th className="num">{nl ? "Inkoopprijs" : "Unit cost"}</th><th className="num">{nl ? "Marge" : "Margin"}</th><th className="num">{nl ? "Totaal" : "Total"}</th></tr></thead>
              <tbody>
                {group.lines.map((line) => (
                  <tr key={line.variantKey}>
                    <td>{line.product}{line.variant ? ` · ${line.variant}` : ""}</td>
                    <td><code className="inv-code">{line.sku ?? line.ean ?? "–"}</code></td>
                    <td className="num">{line.stock ?? "–"}{line.incoming ? ` (+${line.incoming})` : ""}</td>
                    <td className="num">{line.unitsPerWeek}</td>
                    <td className="num"><strong>{line.quantity}</strong></td>
                    <td className="num">{line.unitCost != null ? money(line.unitCost) : "–"}</td>
                    <td className="num">{line.marginPct != null ? `${line.marginPct}%` : "–"}</td>
                    <td className="num">{line.total != null ? money(line.total) : "–"}</td>
                  </tr>
                ))}
                <tr><td colSpan={4}>{nl ? "Totaal" : "Total"}</td><td className="num"><strong>{group.units}</strong></td><td /><td /><td className="num"><strong>{group.cost != null ? money(group.cost) : "–"}</strong></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <div className="vera-card-actions">
        <button type="button" className="settings-btn primary" onClick={() => download(`inkooporder-${order.today}.csv`, `﻿${proposal.csv}`, "text/csv;charset=utf-8")}><Download size={14} />{nl ? "Download CSV" : "Download CSV"}</button>
        <CopyButton text={`${proposal.mail.subject}\n\n${proposal.mail.text}`} nl={nl} />
      </div>
    </div>
  );
}

/** Mailing the people who asked when a variant would be back: who, the text (editable), and one confirm. */
export function WaitlistCard({ proposal, nl, canManage, onDone }: { proposal: Extract<AssistantProposal, { action: "waitlist" }>; nl: boolean; canManage: boolean; onDone?: () => void }) {
  const [subject, setSubject] = useState(proposal.request.body.subject);
  const [text, setText] = useState(proposal.request.body.text);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [result, setResult] = useState<{ sent: number; failed: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { waitlist } = proposal;
  async function confirm() {
    setState("busy");
    setError(null);
    try {
      const data = await call<{ sent: number; failed: string[] }>("/api/inventory/waitlist", { method: "POST", body: JSON.stringify({ variantKey: waitlist.variantKey, subject, text }) });
      setResult(data);
      setState("done");
      onDone?.();
    } catch (confirmError) {
      setState("error");
      setError(confirmError instanceof Error ? confirmError.message : "Er ging iets mis.");
    }
  }
  return (
    <div className={`vera-card${state === "done" ? " done" : ""}`}>
      <strong>{nl ? "Wachtlijst mailen" : "Mail the waitlist"}</strong>
      <p>{proposal.summary}</p>
      <ul className="vera-recipients">
        {waitlist.customers.map((customer) => <li key={customer.email}><span>{customer.name ?? customer.email}</span><small>{customer.name ? customer.email : ""}{customer.sentAt ? (nl ? " · al gemaild" : " · already mailed") : ""}</small></li>)}
      </ul>
      {state !== "done" ? (
        <div className="vera-mail-edit">
          <input className="settings-control" value={subject} maxLength={200} disabled={!canManage || state === "busy"} onChange={(event) => setSubject(event.target.value)} aria-label={nl ? "Onderwerp" : "Subject"} />
          <textarea className="settings-control" rows={8} value={text} maxLength={4000} disabled={!canManage || state === "busy"} onChange={(event) => setText(event.target.value)} aria-label={nl ? "Tekst" : "Text"} />
          <span className="settings-hint">{nl ? "{naam} wordt per klant ingevuld. De mail gaat vanuit je eigen mailbox." : "{naam} is filled in per customer. The mail goes from your own mailbox."}</span>
        </div>
      ) : null}
      <div className="vera-card-actions">
        {state === "done" ? <span className="vera-done"><Check size={14} />{nl ? `Verstuurd naar ${result?.sent ?? 0} ${result?.sent === 1 ? "klant" : "klanten"}` : `Sent to ${result?.sent ?? 0} ${result?.sent === 1 ? "customer" : "customers"}`}{result?.failed.length ? (nl ? ` · ${result.failed.length} mislukt` : ` · ${result.failed.length} failed`) : ""}</span> : canManage ? (
          <button type="button" className="settings-btn primary" disabled={state === "busy" || !subject.trim() || !text.trim() || !waitlist.toSend} onClick={() => void confirm()}>{state === "busy" ? <Loader2 size={14} className="settings-spin" /> : <Send size={14} />}{nl ? `Verstuur naar ${waitlist.toSend} ${waitlist.toSend === 1 ? "klant" : "klanten"}` : `Send to ${waitlist.toSend} ${waitlist.toSend === 1 ? "customer" : "customers"}`}</button>
        ) : <span className="settings-hint">{nl ? "Alleen een beheerder kan dit versturen." : "Only an admin can send this."}</span>}
      </div>
      {error ? <Notice tone="error" onClose={() => setError(null)}>{error}</Notice> : null}
    </div>
  );
}

export function ProposalCard({ proposal, nl, canManage, onDone }: { proposal: AssistantProposal; nl: boolean; canManage: boolean; onDone: () => void }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  if (proposal.action === "purchase_order") return <PurchaseOrderCard proposal={proposal} nl={nl} />;
  if (proposal.action === "waitlist") return <WaitlistCard proposal={proposal} nl={nl} canManage={canManage} onDone={onDone} />;
  async function confirm() {
    if (proposal.action === "purchase_order" || proposal.action === "waitlist") return;
    setState("busy");
    setError(null);
    try {
      await call(proposal.request.url, { method: proposal.request.method, body: JSON.stringify(proposal.request.body) });
      setState("done");
      onDone();
    } catch (confirmError) {
      setState("error");
      setError(confirmError instanceof Error ? confirmError.message : "Er ging iets mis.");
    }
  }
  const titles: Record<Exclude<AssistantProposal["action"], "purchase_order" | "waitlist">, [string, string]> = {
    delivery: ["Levering invoeren", "Record a delivery"],
    product_season: ["Seizoen instellen", "Set a season"],
    alert_rule: ["Regel toevoegen", "Add a rule"],
    settings: ["Inkoopinstellingen wijzigen", "Change buying settings"],
  };
  return (
    <div className={`vera-card${state === "done" ? " done" : ""}`}>
      <strong>{titles[proposal.action][nl ? 0 : 1]}</strong>
      <p>{proposal.summary}</p>
      <div className="vera-card-actions">
        {state === "done" ? <span className="vera-done"><Check size={14} />{nl ? "Gedaan" : "Done"}</span> : canManage ? (
          <button type="button" className="settings-btn primary" disabled={state === "busy"} onClick={() => void confirm()}>{state === "busy" ? <Loader2 size={14} className="settings-spin" /> : <Check size={14} />}{nl ? "Bevestig" : "Confirm"}</button>
        ) : <span className="settings-hint">{nl ? "Alleen een beheerder kan dit bevestigen." : "Only an admin can confirm this."}</span>}
      </div>
      {error ? <Notice tone="error" onClose={() => setError(null)}>{error}</Notice> : null}
    </div>
  );
}

// ── The chat ────────────────────────────────────────────────────────────────

export default function VeraChat({ nl, canManage: providedCanManage, onChanged }: { nl: boolean; canManage?: boolean; onChanged: () => void }) {
  const [accessCanManage, setAccessCanManage] = useState(false);
  const canManage = providedCanManage ?? accessCanManage;
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    call<{ suggestions: string[]; canManage: boolean }>(`/api/inventory/vera/chat?lang=${nl ? "nl" : "en"}`).then((data) => { setSuggestions(data.suggestions); setAccessCanManage(data.canManage); }).catch((error) => { setSuggestions([]); setError(error.message); });
  }, [nl]);

  useEffect(() => {
    if (messages.length) endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, busy]);

  const ask = useCallback(async (question: string) => {
    const content = question.trim();
    if (!content || busy) return;
    const history = [...messages, { role: "user" as const, content }];
    setMessages(history);
    setDraft("");
    setBusy(true);
    setError(null);
    try {
      const reply = await call<Reply>("/api/inventory/vera/chat", { method: "POST", body: JSON.stringify({ language: nl ? "nl" : "en", messages: history.slice(-12).map(({ role, content: text }) => ({ role, content: text })) }) });
      setMessages([...history, { role: "assistant", content: reply.answer, proposals: reply.proposals, grounded: reply.grounded, ungrounded: reply.ungrounded }]);
    } catch (askError) {
      setError(askError instanceof Error ? askError.message : "Er ging iets mis.");
      setMessages(messages);
      setDraft(content);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }, [busy, messages, nl]);

  return (
    <section className="inv-card vera-chat">
      <style>{`
        .vera-chat{display:grid;gap:12px}.vera-chat h2{font-size:18px}.vera-chat header p{font-size:13px;color:var(--muted);line-height:1.6}.vera-compose textarea{width:100%;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:10px;padding:10px}
        .vera-thread{display:grid;gap:12px}
        .vera-msg{display:grid;gap:8px;max-width:820px}.vera-msg.user{justify-self:end;max-width:640px}
        .vera-msg.user p{margin:0;padding:10px 14px;border-radius:14px 14px 4px 14px;background:var(--text);color:var(--surface);font-size:13px;line-height:1.5}
        .vera-answer{display:grid;gap:6px;padding:12px 14px;border:1px solid var(--border);border-radius:4px 14px 14px 14px;background:var(--bg);color:var(--text);font-size:13px;line-height:1.6}
        .vera-answer p,.vera-answer h4{margin:0}.vera-answer h4{font-size:13px;font-weight:600}
        .vera-bullet{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px}.vera-bullet span{color:var(--muted)}.vera-bullet p{margin:0}
        .vera-table .inv-table{min-width:0;font-size:12px}.vera-table .inv-table th,.vera-table .inv-table td{padding:6px 10px}
        .vera-card{display:grid;gap:8px;padding:12px 14px;border:1px solid #c7f56f;border-radius:12px;background:var(--surface);font-size:13px}.vera-card.done{border-color:var(--border)}
        .vera-card strong{font-size:13px;font-weight:600}.vera-card p{margin:0;color:var(--muted);line-height:1.5}.vera-card h5{margin:6px 0 0;font-size:12px;font-weight:600}.vera-card h5 span{color:var(--muted);font-weight:500}
        .vera-card-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.vera-done{display:inline-flex;align-items:center;gap:6px;color:var(--muted);font-size:12px}
        .vera-order-group{display:grid;gap:6px}
        .vera-recipients{display:grid;gap:4px;margin:0;padding:0;list-style:none;max-height:160px;overflow:auto}.vera-recipients li{display:flex;gap:8px;align-items:baseline;font-size:13px}.vera-recipients small{color:var(--muted);font-size:11px}
        .vera-mail-edit{display:grid;gap:8px}.vera-mail-edit textarea{font:inherit;font-size:13px;line-height:1.5;resize:vertical}
        .vera-unsure{color:var(--muted);font-size:12px}
        .vera-suggest{display:flex;flex-wrap:wrap;gap:8px}.vera-suggest button{padding:7px 12px;border:1px solid var(--border);border-radius:999px;background:var(--surface);color:var(--text);font:500 12px inherit;cursor:pointer}.vera-suggest button:hover{background:var(--bg)}
        .vera-compose{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end}.vera-compose textarea{min-height:44px;max-height:160px;resize:vertical;font:inherit;font-size:13px;line-height:1.5}
        .vera-thinking{display:inline-flex;align-items:center;gap:8px;color:var(--muted);font-size:12px}
      `}</style>
      <header className="inv-card-head"><div><h2>{nl ? "Vraag het Otis" : "Ask Otis"}</h2><p>{nl ? "Otis gebruikt je actuele voorraadgegevens. Wil je iets laten doen, dan krijg je eerst een kaart om te bevestigen." : "Otis uses your current stock data. Anything he can do for you comes as a card to confirm first."}</p></div></header>
      {messages.length ? (
        <div className="vera-thread">
          {messages.map((message, index) => (
            <div key={index} className={`vera-msg ${message.role}`}>
              {message.role === "user" ? <p>{message.content}</p> : <VeraAnswer content={message.content} />}
              {message.role === "assistant" && message.grounded === false ? <span className="vera-unsure">{nl ? `Let op: deze getallen kon ik niet in de data terugvinden: ${message.ungrounded?.join(", ")}. Controleer ze op de pagina.` : `Note: I could not find these numbers in the data: ${message.ungrounded?.join(", ")}. Check them on the page.`}</span> : null}
              {message.proposals?.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal} nl={nl} canManage={canManage} onDone={onChanged} />)}
            </div>
          ))}
          {busy ? <span className="vera-thinking"><SequenceMark size={32} gear="analyst" state="investigating" title="" />{nl ? "Otis kijkt in je voorraad…" : "Otis is looking at your stock…"}</span> : null}
          <div ref={endRef} />
        </div>
      ) : null}
      {!messages.length && suggestions.length ? (
        <div className="vera-suggest">{suggestions.map((suggestion) => <button key={suggestion} type="button" disabled={busy} onClick={() => void ask(suggestion)}><Sparkles size={12} /> {suggestion}</button>)}</div>
      ) : null}
      {error ? <Notice tone="error" onClose={() => setError(null)}>{error}</Notice> : null}
      <form className="vera-compose" onSubmit={(event) => { event.preventDefault(); void ask(draft); }}>
        <textarea ref={inputRef} className="settings-control" placeholder={nl ? "Bijvoorbeeld: welke maten van de hoodie moet ik bijbestellen voor de feestdagen?" : "For example: which hoodie sizes should I reorder for the holidays?"} value={draft} maxLength={4000} rows={2} disabled={busy}
          onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void ask(draft); } }} />
        <button type="submit" className="settings-btn primary" disabled={busy || !draft.trim()} aria-label={nl ? "Versturen" : "Send"}>{busy ? <Loader2 size={14} className="settings-spin" /> : <Send size={14} />}</button>
      </form>
    </section>
  );
}
