"use client";

import { Loader2, Plus, Trash2, Truck } from "lucide-react";
import { useEffect, useState } from "react";

import { Notice } from "../settings/SettingsUi";
import type { Supplier } from "@/lib/inventory/assistantCore";
import type { ProductSeasonRow } from "@/lib/inventory/reportCore";

/**
 * Suppliers (fase 3 of Vera): who delivers what, their lead time and minimum
 * order quantity. A product with a supplier uses that supplier's lead time in
 * the advice; the draft purchase order is grouped by supplier.
 */

type State = { suppliers: Supplier[]; productSuppliers: Record<string, string> };
type Form = { name: string; email: string; leadTimeDays: string; minOrderQty: string };

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init, headers: init?.body ? { "Content-Type": "application/json" } : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error((data as { error?: string }).error || "Er ging iets mis."), { notReady: Boolean((data as { notReady?: boolean }).notReady) });
  return data as T;
}

const empty: Form = { name: "", email: "", leadTimeDays: "", minOrderQty: "" };

export default function SuppliersCard({ nl, canManage, products, onSaved }: { nl: boolean; canManage: boolean; products: ProductSeasonRow[]; onSaved: () => void }) {
  const [state, setState] = useState<State | null>(null);
  const [notReady, setNotReady] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Form>(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let active = true;
    call<State>("/api/inventory/suppliers")
      .then((data) => { if (active) setState(data); })
      .catch((loadError: Error & { notReady?: boolean }) => { if (!active) return; if (loadError.notReady) setNotReady(true); else setError(loadError.message); });
    return () => { active = false; };
  }, []);

  async function run(request: () => Promise<State>, rebuilt = false) {
    setBusy(true);
    setError(null);
    try {
      setState(await request());
      setAdding(false);
      setForm(empty);
      if (rebuilt) onSaved();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Er ging iets mis.");
    } finally {
      setBusy(false);
    }
  }

  async function link(productKey: string, supplierId: string | null) {
    setBusy(true);
    setError(null);
    try {
      await call("/api/inventory/settings", { method: "PATCH", body: JSON.stringify({ productSupplier: { productKey, supplierId } }) });
      setState((current) => {
        if (!current) return current;
        const productSuppliers = { ...current.productSuppliers };
        if (supplierId) productSuppliers[productKey] = supplierId;
        else delete productSuppliers[productKey];
        return { ...current, productSuppliers };
      });
      onSaved();
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : "Er ging iets mis.");
    } finally {
      setBusy(false);
    }
  }

  const filtered = products.filter((product) => product.productTitle.toLowerCase().includes(search.trim().toLowerCase()));
  const shown = showAll || search ? filtered : filtered.slice(0, 10);

  return (
    <section className="inv-card inv-wide">
      <style>{`
        .inv-suppliers{display:grid;margin:0;padding:0;list-style:none;border:1px solid var(--border);border-radius:12px}
        .inv-suppliers li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:10px 14px;border-bottom:1px solid var(--border)}.inv-suppliers li:last-child{border-bottom:0}
        .inv-suppliers strong{display:block;color:var(--text);font-size:13px;font-weight:600}.inv-suppliers span{display:block;margin-top:2px;color:var(--muted);font-size:12px}
        .inv-supplier-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:14px;border:1px solid var(--border);border-radius:12px;background:var(--bg)}.inv-supplier-form label{display:grid;gap:6px;color:var(--muted);font-size:12px;font-weight:600}.inv-supplier-form>div{grid-column:1/-1;display:flex;gap:8px}
        .inv-supplier-products{display:grid;margin:0;padding:0;list-style:none;gap:0;border:1px solid var(--border);border-radius:12px}.inv-supplier-products li{display:grid;grid-template-columns:minmax(0,1fr) 220px;gap:12px;align-items:center;padding:8px 14px;border-bottom:1px solid var(--border);font-size:13px}.inv-supplier-products li:last-child{border-bottom:0}
        @media(max-width:700px){.inv-supplier-form{grid-template-columns:1fr}.inv-supplier-products li{grid-template-columns:1fr}}
      `}</style>
      <header className="inv-card-head"><div>
        <h2>{nl ? "Leveranciers" : "Suppliers"}</h2>
        <p>{nl
          ? "Wie levert wat. Heeft een leverancier een eigen levertijd, dan rekent het advies daarmee voor zijn producten. Vera maakt de concept-inkooporder per leverancier."
          : "Who delivers what. A supplier with its own lead time drives the advice for its products. Vera drafts the purchase order per supplier."}</p>
      </div></header>
      {notReady ? <Notice tone="warning" title={nl ? "Nog niet beschikbaar" : "Not available yet"}>{nl ? "Leveranciers staan nog niet aan voor deze omgeving (migratie 062)." : "Suppliers are not switched on for this environment yet (migration 062)."}</Notice> : null}
      {error ? <Notice tone="error" onClose={() => setError(null)}>{error}</Notice> : null}
      {state ? (
        <>
          {state.suppliers.length ? (
            <ul className="inv-suppliers">
              {state.suppliers.map((supplier) => (
                <li key={supplier.id}>
                  <div>
                    <strong>{supplier.name}</strong>
                    <span>
                      {supplier.email ?? (nl ? "geen e-mail" : "no e-mail")}
                      {" · "}{supplier.leadTimeDays != null ? `${nl ? "levertijd" : "lead time"} ${supplier.leadTimeDays} ${nl ? "dagen" : "days"}` : (nl ? "levertijd van de winkel" : "shop lead time")}
                      {supplier.minOrderQty ? ` · ${nl ? "minimaal" : "minimum"} ${supplier.minOrderQty} ${nl ? "stuks per regel" : "units per line"}` : ""}
                      {" · "}{Object.values(state.productSuppliers).filter((id) => id === supplier.id).length} {nl ? "producten" : "products"}
                    </span>
                  </div>
                  {canManage ? <button type="button" className="settings-btn ghost icon" disabled={busy} aria-label={nl ? "Leverancier verwijderen" : "Remove supplier"} onClick={() => void run(() => call<State>(`/api/inventory/suppliers?id=${encodeURIComponent(supplier.id)}`, { method: "DELETE" }), true)}><Trash2 size={14} /></button> : null}
                </li>
              ))}
            </ul>
          ) : <p className="inv-empty-text">{nl ? "Nog geen leveranciers." : "No suppliers yet."}</p>}
          {canManage ? (adding ? (
            <div className="inv-supplier-form">
              <label>{nl ? "Naam" : "Name"}<input className="settings-control" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
              <label>{nl ? "E-mail (voor de inkooporder)" : "E-mail (for the purchase order)"}<input className="settings-control" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
              <label>{nl ? "Levertijd (dagen, leeg = die van de winkel)" : "Lead time (days, empty = the shop's)"}<input className="settings-control" type="number" min={0} max={365} value={form.leadTimeDays} onChange={(event) => setForm({ ...form, leadTimeDays: event.target.value })} /></label>
              <label>{nl ? "Minimale bestelhoeveelheid per regel" : "Minimum order quantity per line"}<input className="settings-control" type="number" min={0} value={form.minOrderQty} onChange={(event) => setForm({ ...form, minOrderQty: event.target.value })} /></label>
              <div>
                <button type="button" className="settings-btn primary" disabled={busy || !form.name.trim()} onClick={() => void run(() => call<State>("/api/inventory/suppliers", { method: "POST", body: JSON.stringify({ name: form.name, email: form.email, leadTimeDays: form.leadTimeDays === "" ? null : Number(form.leadTimeDays), minOrderQty: form.minOrderQty === "" ? 0 : Number(form.minOrderQty) }) }))}>{busy ? <Loader2 size={14} className="settings-spin" /> : <Plus size={14} />}{nl ? "Toevoegen" : "Add"}</button>
                <button type="button" className="settings-btn ghost" disabled={busy} onClick={() => { setAdding(false); setForm(empty); }}>{nl ? "Annuleren" : "Cancel"}</button>
              </div>
            </div>
          ) : <div><button type="button" className="settings-btn" onClick={() => setAdding(true)}><Truck size={14} />{nl ? "Leverancier toevoegen" : "Add supplier"}</button></div>) : null}
          {state.suppliers.length && products.length ? (
            <>
              <p className="settings-hint">{nl ? "Welke leverancier levert welk product?" : "Which supplier delivers which product?"}</p>
              {products.length > 10 ? <input className="settings-control" placeholder={nl ? "Zoek een product" : "Find a product"} value={search} onChange={(event) => setSearch(event.target.value)} /> : null}
              <ul className="inv-supplier-products">
                {shown.map((product) => (
                  <li key={product.productKey}>
                    <span>{product.productTitle}</span>
                    <select className="settings-control" value={state.productSuppliers[product.productKey] ?? ""} disabled={!canManage || busy} onChange={(event) => void link(product.productKey, event.target.value || null)}>
                      <option value="">{nl ? "Geen leverancier" : "No supplier"}</option>
                      {state.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                    </select>
                  </li>
                ))}
              </ul>
              {!search && !showAll && filtered.length > 10 ? <button type="button" className="settings-btn ghost" onClick={() => setShowAll(true)}>{nl ? `Toon alle ${filtered.length} producten` : `Show all ${filtered.length} products`}</button> : null}
            </>
          ) : null}
        </>
      ) : !notReady && !error ? <Loader2 size={16} className="settings-spin" /> : null}
    </section>
  );
}
