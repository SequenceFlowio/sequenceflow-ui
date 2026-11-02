"use client";

import { Bell, ClipboardList, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Notice, Toggle } from "../settings/SettingsUi";
import VeraChat, { PurchaseOrderCard } from "./VeraChat";
import { ALERT_KINDS, ALERT_KIND_INFO, alertKindLabel, type AlertKind, type AlertRule, type AlertScope } from "@/lib/inventory/alertsCore";
import type { AssistantProposal, PurchaseOrder } from "@/lib/inventory/assistantCore";
import type { ProductSeasonRow } from "@/lib/inventory/reportCore";

/**
 * Vera, the stock assistant: what she noticed, when she speaks up (rules), and
 * whether she mails. The numbers come from the same report as the rest of the page.
 */

type Alert = { id: string; rule_id: string | null; kind: AlertKind; title: string; body: string; impact: number; opened_at: string; emailed_at?: string | null; resolved_at?: string | null };
type State = { rules: AlertRule[]; open: Alert[]; resolved: Alert[] };
type VariantOption = { variantKey: string; label: string };

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init, headers: init?.body ? { "Content-Type": "application/json" } : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error((data as { error?: string }).error || "Er ging iets mis."), { notReady: Boolean((data as { notReady?: boolean }).notReady) });
  return data as T;
}

function targetText(rule: AlertRule, nl: boolean) {
  if (rule.scope === "all") return nl ? "Alle producten" : "All products";
  return rule.targetLabel ?? rule.targetKey ?? "";
}

function RuleRow({ rule, nl, canManage, busy, onChange, onDelete }: { rule: AlertRule; nl: boolean; canManage: boolean; busy: boolean; onChange: (patch: { enabled?: boolean; threshold?: number }) => void; onDelete: () => void }) {
  const info = ALERT_KIND_INFO[rule.kind];
  const [threshold, setThreshold] = useState(rule.threshold == null ? "" : String(rule.threshold));
  const commit = () => {
    const value = Number(threshold);
    if (threshold !== "" && Number.isFinite(value) && value !== rule.threshold) onChange({ threshold: value });
  };
  return (
    <li className={`vera-rule${rule.enabled ? "" : " off"}`}>
      <div className="vera-rule-copy">
        <strong>{alertKindLabel(rule.kind, nl ? "nl" : "en")}</strong>
        <span>{targetText(rule, nl)}</span>
      </div>
      {info.threshold ? (
        <label className="vera-threshold">
          <input type="number" className="settings-control" value={threshold} disabled={!canManage || busy} min={info.min} max={info.max} step="any"
            onChange={(event) => setThreshold(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") commit(); }} aria-label={info.threshold[nl ? 0 : 1]} />
          <span>{info.threshold[nl ? 0 : 1]}</span>
        </label>
      ) : <span className="vera-threshold-none" />}
      <Toggle checked={rule.enabled} disabled={!canManage || busy} label={nl ? "Aan of uit" : "On or off"} onChange={() => onChange({ enabled: !rule.enabled })} />
      {canManage ? <button type="button" className="settings-btn ghost icon" disabled={busy} onClick={onDelete} aria-label={nl ? "Regel verwijderen" : "Remove rule"}><Trash2 size={14} /></button> : null}
    </li>
  );
}

function NewRule({ nl, products, busy, onCreate }: { nl: boolean; products: ProductSeasonRow[]; busy: boolean; onCreate: (rule: { kind: AlertKind; scope: AlertScope; targetKey: string | null; targetLabel: string | null; threshold: number | null }) => void }) {
  const [kind, setKind] = useState<AlertKind>("stock_below");
  const [scope, setScope] = useState<AlertScope>("variant");
  const [product, setProduct] = useState("");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ query: string; options: VariantOption[] }>({ query: "", options: [] });
  const [variant, setVariant] = useState<VariantOption | null>(null);
  const info = ALERT_KIND_INFO[kind];
  const [threshold, setThreshold] = useState(String(info.defaultThreshold ?? ""));
  const query = search.trim();
  // Only the answer to what is typed now counts; an older, slower answer is dropped.
  const variants = scope === "variant" && query.length >= 2 && results.query === query ? results.options : [];

  function chooseKind(next: AlertKind) {
    const nextInfo = ALERT_KIND_INFO[next];
    setKind(next);
    if (!nextInfo.scopes.includes(scope)) setScope(nextInfo.scopes[0]);
    setThreshold(String(nextInfo.defaultThreshold ?? ""));
  }

  useEffect(() => {
    if (scope !== "variant" || query.length < 2) return;
    const timer = setTimeout(() => {
      call<{ variants: { rows: Array<{ variantKey: string; productTitle: string; variantTitle: string | null }> } }>(`/api/inventory?search=${encodeURIComponent(query)}&limit=20`)
        .then((data) => setResults({ query, options: data.variants.rows.map((row) => ({ variantKey: row.variantKey, label: row.variantTitle ? `${row.productTitle} · ${row.variantTitle}` : row.productTitle })) }))
        .catch(() => setResults({ query, options: [] }));
    }, 250);
    return () => clearTimeout(timer);
  }, [scope, query]);

  const chosenProduct = products.find((row) => row.productKey === product);
  const ready = scope === "all" || (scope === "product" ? Boolean(chosenProduct) : Boolean(variant));

  return (
    <div className="vera-new">
      <label>{nl ? "Wanneer" : "When"}
        <select className="settings-control" value={kind} onChange={(event) => chooseKind(event.target.value as AlertKind)}>
          {ALERT_KINDS.map((value) => <option key={value} value={value}>{alertKindLabel(value, nl ? "nl" : "en")}</option>)}
        </select>
      </label>
      <label>{nl ? "Voor" : "For"}
        <select className="settings-control" value={scope} onChange={(event) => setScope(event.target.value as AlertScope)}>
          {info.scopes.map((value) => <option key={value} value={value}>{value === "all" ? (nl ? "Alle producten" : "All products") : value === "product" ? (nl ? "Eén product" : "One product") : (nl ? "Eén variant" : "One variant")}</option>)}
        </select>
      </label>
      {scope === "product" ? (
        <label>{nl ? "Product" : "Product"}
          <select className="settings-control" value={product} onChange={(event) => setProduct(event.target.value)}>
            <option value="">{nl ? "Kies een product" : "Choose a product"}</option>
            {products.map((row) => <option key={row.productKey} value={row.productKey}>{row.productTitle}</option>)}
          </select>
        </label>
      ) : null}
      {scope === "variant" ? (
        <label>{nl ? "Variant" : "Variant"}
          {variant ? (
            <span className="vera-chosen">{variant.label}<button type="button" className="settings-btn ghost" onClick={() => { setVariant(null); setSearch(""); }}>{nl ? "Andere" : "Change"}</button></span>
          ) : (
            <>
              <input className="settings-control" placeholder={nl ? "Zoek op naam, maat, kleur of SKU" : "Search by name, size, colour or SKU"} value={search} onChange={(event) => setSearch(event.target.value)} />
              {variants.length ? <ul className="vera-options">{variants.map((option) => <li key={option.variantKey}><button type="button" onClick={() => setVariant(option)}>{option.label}</button></li>)}</ul> : null}
            </>
          )}
        </label>
      ) : null}
      {info.threshold ? (
        <label>{nl ? "Grens" : "Limit"}
          <span className="vera-threshold"><input type="number" className="settings-control" value={threshold} min={info.min} max={info.max} step="any" onChange={(event) => setThreshold(event.target.value)} /><span>{info.threshold[nl ? 0 : 1]}</span></span>
        </label>
      ) : null}
      <div>
        <button type="button" className="settings-btn primary" disabled={busy || !ready} onClick={() => onCreate({
          kind,
          scope,
          targetKey: scope === "all" ? null : scope === "product" ? product : variant!.variantKey,
          targetLabel: scope === "all" ? null : scope === "product" ? chosenProduct!.productTitle : variant!.label,
          threshold: info.threshold ? Number(threshold) : null,
        })}>{busy ? <Loader2 size={14} className="settings-spin" /> : <Plus size={14} />}{nl ? "Regel toevoegen" : "Add rule"}</button>
      </div>
    </div>
  );
}

/** The draft purchase order from the current advice, outside the chat. */
function PurchaseOrderSection({ nl }: { nl: boolean }) {
  const [proposal, setProposal] = useState<Extract<AssistantProposal, { action: "purchase_order" }> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [none, setNone] = useState(false);

  async function load() {
    setBusy(true);
    setError(null);
    setNone(false);
    try {
      const data = await call<{ order: PurchaseOrder; csv: string; mail: { subject: string; text: string } }>(`/api/inventory/purchase-order?lang=${nl ? "nl" : "en"}`);
      if (!data.order.lines) { setProposal(null); setNone(true); return; }
      const nlText = `${data.order.lines} ${data.order.lines === 1 ? "regel" : "regels"}, ${data.order.units} stuks, voor ${data.order.groups.length} ${data.order.groups.length === 1 ? "leverancier" : "leveranciers"}.`;
      const enText = `${data.order.lines} ${data.order.lines === 1 ? "line" : "lines"}, ${data.order.units} units, for ${data.order.groups.length} ${data.order.groups.length === 1 ? "supplier" : "suppliers"}.`;
      setProposal({ id: "page", action: "purchase_order", order: data.order, csv: data.csv, mail: data.mail, summary: nl ? nlText : enText });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Er ging iets mis.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="inv-card">
      <header className="inv-card-head"><div><h2>{nl ? "Concept-inkooporder" : "Draft purchase order"}</h2><p>{nl ? "Alles wat het advies wil bijbestellen, per leverancier, met SKU, aantal en inkoopprijs. Als CSV of als mailconcept; versturen doe je zelf. Leveranciers stel je in onder Instellingen." : "Everything the advice wants to reorder, per supplier, with SKU, quantity and unit cost. As CSV or as an e-mail draft; you send it yourself. Suppliers are set under Settings."}</p></div></header>
      {proposal ? <PurchaseOrderCard proposal={proposal} nl={nl} /> : null}
      {none ? <p className="inv-empty-text">{nl ? "Niets om te bestellen: geen enkele variant heeft nu een bijbestel-advies." : "Nothing to order: no variant has a reorder advice right now."}</p> : null}
      {error ? <Notice tone="error" onClose={() => setError(null)}>{error}</Notice> : null}
      <div><button type="button" className="settings-btn" disabled={busy} onClick={() => void load()}>{busy ? <Loader2 size={14} className="settings-spin" /> : <ClipboardList size={14} />}{proposal ? (nl ? "Opnieuw maken" : "Make again") : (nl ? "Concept maken" : "Make a draft")}</button></div>
    </section>
  );
}

export default function VeraTab({ nl, canManage, alertEmail, products, demo, onSettingsSaved }: { nl: boolean; canManage: boolean; alertEmail: boolean | null; products: ProductSeasonRow[]; demo?: boolean; onSettingsSaved: () => void }) {
  const [state, setState] = useState<State | null>(null);
  const [notReady, setNotReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mail, setMail] = useState(alertEmail ?? true);
  const [adding, setAdding] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const format = useCallback((value: string) => new Intl.DateTimeFormat(nl ? "nl-NL" : "en-GB", { day: "numeric", month: "short", timeZone: "Europe/Amsterdam" }).format(new Date(value)), [nl]);

  const reloadAlerts = useCallback(() => call<State>("/api/inventory/alerts").then(setState).catch(() => undefined), []);

  useEffect(() => {
    if (demo) return;
    let active = true;
    call<State>("/api/inventory/alerts")
      .then((data) => { if (active) setState(data); })
      .catch((loadError: Error & { notReady?: boolean }) => { if (!active) return; if (loadError.notReady) setNotReady(true); else setError(loadError.message); });
    return () => { active = false; };
  }, [demo]);

  async function run(request: () => Promise<State>) {
    setBusy(true);
    setError(null);
    try {
      setState(await request());
      setAdding(false);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Er ging iets mis.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleMail() {
    const next = !mail;
    setMail(next);
    try {
      await call("/api/inventory/settings", { method: "PATCH", body: JSON.stringify({ alertEmail: next }) });
      onSettingsSaved();
    } catch (saveError) {
      setMail(!next);
      setError(saveError instanceof Error ? saveError.message : "Er ging iets mis.");
    }
  }

  const intro = (
    <section className="inv-card vera-intro">
      <div className="vera-avatar" aria-hidden><Bell size={18} /></div>
      <div>
        <h2>{nl ? "Vera, je voorraadassistent" : "Vera, your stock assistant"}</h2>
        <p>{nl
          ? "Vera kijkt elke nacht na de controle van je voorraad of er iets is waar je iets mee moet: een maat die uitverkocht raakt, een piek in de verkoop, een seizoen dat eraan komt, een levering die te laat is. Wat nieuw is, mailt ze je, hoogstens één keer per dag. Op maandag stuurt ze het weekoverzicht. Je kunt haar ook vragen stellen over je voorraad, en dingen laten doen die jij eerst bevestigt."
          : "Every night after checking your stock, Vera looks for things you need to act on: a size running out, a sales spike, a season coming up, a late delivery. What is new she mails you, at most once a day. On Mondays she sends the weekly overview. You can also ask her about your stock, and let her do things you confirm first."}</p>
      </div>
    </section>
  );

  if (demo) return <>{intro}<Notice tone="info">{nl ? "Vera hoort bij het Scale-pakket." : "Vera is part of the Scale plan."}</Notice></>;
  if (notReady) return <>{intro}<VeraChat nl={nl} canManage={canManage} onChanged={onSettingsSaved} /><Notice tone="warning" title={nl ? "Meldingen nog niet beschikbaar" : "Alerts not available yet"}>{nl ? "Vera's meldingen staan nog niet aan voor deze omgeving (migratie 061)." : "Vera's alerts are not switched on for this environment yet (migration 061)."}</Notice><PurchaseOrderSection nl={nl} /></>;

  return (
    <>
      <style>{`
        .vera-intro{grid-template-columns:auto minmax(0,1fr);align-items:start}.vera-intro h2{margin:0;font-size:16px;font-weight:500}.vera-intro p{margin:4px 0 0;color:var(--muted);font-size:13px;line-height:1.6;max-width:760px}
        .vera-avatar{width:40px;height:40px;display:grid;place-items:center;border-radius:12px;background:#c7f56f;color:#142000}
        .vera-alerts{display:grid;margin:0;padding:0;list-style:none;border:1px solid var(--border);border-radius:12px}
        .vera-alerts li{display:grid;gap:3px;padding:12px 14px;border-bottom:1px solid var(--border)}.vera-alerts li:last-child{border-bottom:0}
        .vera-alerts strong{color:var(--text);font-size:13px;font-weight:600}.vera-alerts p{margin:0;color:var(--muted);font-size:13px;line-height:1.55}.vera-alerts small{color:var(--muted);font-size:11px}
        .vera-rules{display:grid;margin:0;padding:0;list-style:none;border:1px solid var(--border);border-radius:12px}
        .vera-rule{display:grid;grid-template-columns:minmax(0,1fr) 190px auto auto;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid var(--border)}.vera-rule:last-child{border-bottom:0}.vera-rule.off .vera-rule-copy{opacity:.55}
        .vera-rule-copy strong{display:block;color:var(--text);font-size:13px;font-weight:600}.vera-rule-copy span{display:block;margin-top:2px;color:var(--muted);font-size:12px}
        .vera-threshold{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:12px;white-space:nowrap}.vera-threshold input{width:90px;min-height:36px}
        .vera-new{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:14px;border:1px solid var(--border);border-radius:12px;background:var(--bg)}.vera-new label{display:grid;gap:6px;color:var(--muted);font-size:12px;font-weight:600}
        .vera-options{display:grid;max-height:200px;overflow:auto;margin:0;padding:4px;list-style:none;border:1px solid var(--border);border-radius:10px;background:var(--surface)}.vera-options button{width:100%;padding:8px 10px;border:0;border-radius:8px;background:transparent;color:var(--text);font:500 13px inherit;text-align:left;cursor:pointer}.vera-options button:hover{background:var(--bg)}
        .vera-chosen{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:42px;padding:0 4px 0 12px;border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:13px;font-weight:500}
        @media(max-width:700px){.vera-rule{grid-template-columns:minmax(0,1fr) auto;}.vera-threshold{grid-column:1/-1}.vera-new{grid-template-columns:1fr}}
      `}</style>
      {intro}
      <VeraChat nl={nl} canManage={canManage} onChanged={() => { onSettingsSaved(); void reloadAlerts(); }} />
      {error ? <Notice tone="error" onClose={() => setError(null)}>{error}</Notice> : null}
      <section className="inv-card">
        <header className="inv-card-head"><div><h2>{nl ? "Wat Vera nu ziet" : "What Vera sees now"}</h2><p>{nl ? "Een melding blijft staan zolang het speelt en verdwijnt vanzelf als het is opgelost." : "An alert stays while it applies and goes away by itself once it is solved."}</p></div></header>
        {!state ? <Loader2 size={16} className="settings-spin" /> : state.open.length ? (
          <ul className="vera-alerts">
            {state.open.map((alert) => <li key={alert.id}><strong>{alert.title}</strong><p>{alert.body}</p><small>{nl ? "Sinds" : "Since"} {format(alert.opened_at)}{alert.emailed_at ? (nl ? " · gemaild" : " · emailed") : ""}</small></li>)}
          </ul>
        ) : <p className="inv-empty-text">{nl ? "Niets om te melden. Vera kijkt vannacht weer." : "Nothing to report. Vera checks again tonight."}</p>}
        {state?.resolved.length ? (
          <div>
            <button type="button" className="settings-btn ghost" onClick={() => setShowResolved((value) => !value)}>{showResolved ? (nl ? "Opgeloste verbergen" : "Hide solved") : (nl ? `Opgelost in de laatste 30 dagen (${state.resolved.length})` : `Solved in the last 30 days (${state.resolved.length})`)}</button>
            {showResolved ? <ul className="vera-alerts">{state.resolved.map((alert) => <li key={alert.id}><strong>{alert.title}</strong><small>{nl ? "Opgelost op" : "Solved on"} {format(alert.resolved_at!)}</small></li>)}</ul> : null}
          </div>
        ) : null}
      </section>

      <section className="inv-card">
        <header className="inv-card-head"><div><h2>{nl ? "Wanneer Vera iets meldt" : "When Vera speaks up"}</h2><p>{nl ? "Zet regels aan of uit, pas de grens aan, of voeg een eigen regel toe voor één product of maat." : "Turn rules on or off, change the limit, or add your own for one product or size."}</p></div></header>
        <div className="inv-toggle-row">
          <span>{nl ? "Mail me wat nieuw is (hoogstens één keer per dag)" : "Email me what is new (at most once a day)"}</span>
          <Toggle checked={mail} disabled={!canManage || alertEmail === null} label={nl ? "Mail van Vera" : "Email from Vera"} onChange={() => void toggleMail()} />
        </div>
        {state ? (
          <ul className="vera-rules">
            {state.rules.map((rule) => (
              <RuleRow key={`${rule.id}:${rule.threshold}`} rule={rule} nl={nl} canManage={canManage} busy={busy}
                onChange={(patch) => void run(() => call<State>("/api/inventory/alerts", { method: "PATCH", body: JSON.stringify({ id: rule.id, ...patch }) }))}
                onDelete={() => void run(() => call<State>(`/api/inventory/alerts?id=${encodeURIComponent(rule.id)}`, { method: "DELETE" }))} />
            ))}
          </ul>
        ) : null}
        {canManage && state ? (adding
          ? <NewRule nl={nl} products={products} busy={busy} onCreate={(rule) => void run(() => call<State>("/api/inventory/alerts", { method: "POST", body: JSON.stringify(rule) }))} />
          : <div><button type="button" className="settings-btn" onClick={() => setAdding(true)}><Plus size={14} />{nl ? "Eigen regel toevoegen" : "Add your own rule"}</button></div>) : null}
      </section>
      <PurchaseOrderSection nl={nl} />
    </>
  );
}
