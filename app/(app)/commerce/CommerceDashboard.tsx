"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingBag,
  Truck,
} from "lucide-react";

import { useTranslation } from "@/lib/i18n/LanguageProvider";

type CommerceData = {
  connection: null | {
    status: string;
    displayName: string | null;
    externalAccountId: string | null;
    eventsStatus: string;
    lastOrderSync: string | null;
    lastReturnSync: string | null;
    lastError: string | null;
  };
  summary: { orders: number; openOrders: number; products: number; lowStock: number; activeReturns: number };
  dataQuality?: {
    shipmentsWithoutTransportEvent: number;
    productsWithoutStock: number;
    returnsWithoutRegistrationDate: number;
  };
  orders: Array<{
    id: string;
    orderNumber: string;
    createdAt: string;
    status: string | null;
    total: number | null;
    currency: string;
    itemCount: number;
    fulfilment: Array<{ method: string | null; distributionParty: string | null }>;
    latestDeliveryAt: string | null;
    lastSyncedAt: string;
  }>;
  products: Array<{
    offerId: string;
    title: string;
    ean: string | null;
    fulfilmentMethod: string | null;
    distributionParty: string | null;
    stock: number | null;
    stockKnown: boolean;
    price: number | null;
    currency: string;
    forSale: boolean | null;
    lastSyncedAt: string;
  }>;
  shipments: Array<{
    orderNumber: string | null;
    orderStatus: string | null;
    shipmentId: string;
    status: string | null;
    carrier: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
    shippedAt: string | null;
    latestEventAt: string | null;
  }>;
  returns: Array<{
    returnId: string;
    orderNumber: string | null;
    fulfilmentMethod: string | null;
    registeredAt: string | null;
    handled: boolean;
    lastSyncedAt: string;
    items: Array<{
      ean?: string | null;
      title?: string | null;
      expected_quantity?: number;
      handled_quantity?: number;
      handling_result?: string | null;
      reason?: string | null;
    }>;
  }>;
};

function formatDate(value: string | null, language: string, withTime = false) {
  if (!value) return language === "nl" ? "Nog niet" : "Not yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return language === "nl" ? "Onbekend" : "Unknown";
  return new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(parsed);
}

function formatMoney(value: number | null, currency: string, language: string) {
  if (value === null) return "–";
  return new Intl.NumberFormat(language === "nl" ? "nl-NL" : "en-GB", {
    style: "currency",
    currency: currency || "EUR",
  }).format(value);
}

function statusLabel(status: string | null, nl: boolean) {
  const labels: Record<string, string> = nl
    ? { OPEN: "Open", SHIPPED: "Verzonden", PARTIALLY_SHIPPED: "Deels verzonden", CANCELLED: "Geannuleerd" }
    : { OPEN: "Open", SHIPPED: "Shipped", PARTIALLY_SHIPPED: "Partially shipped", CANCELLED: "Cancelled" };
  return status ? labels[status] ?? status : (nl ? "Onbekend" : "Unknown");
}

function fulfilmentLabel(method: string | null, distributionParty: string | null, nl: boolean) {
  if (method === "FBB") return nl ? "Logistiek via bol" : "Fulfilled by bol";
  if (method === "FBR" && distributionParty === "BOL") return nl ? "Verzenden via bol" : "Shipping via bol";
  if (method === "FBR") return nl ? "Zelf verzenden" : "Seller fulfilled";
  if (distributionParty === "BOL") return "bol.com";
  if (distributionParty === "RETAILER") return nl ? "Door verkoper" : "By seller";
  return method || distributionParty || "–";
}

function shipmentStatusLabel(shipment: CommerceData["shipments"][number], nl: boolean) {
  if (shipment.status) return shipment.status;
  if (shipment.orderStatus === "SHIPPED" && shipment.trackingNumber) {
    return nl ? "Verzonden · track & trace beschikbaar" : "Shipped · tracking available";
  }
  if (shipment.trackingNumber) return nl ? "Track & trace beschikbaar" : "Tracking available";
  if (shipment.shippedAt) return nl ? "Verzending aangemaakt" : "Shipment created";
  return nl ? "Nog geen transportstatus van bol.com" : "No transport status from bol.com yet";
}

function datedLabel(prefixNl: string, prefixEn: string, value: string | null, language: string) {
  if (!value) return language === "nl" ? "Datum nog niet beschikbaar" : "Date not available yet";
  return `${language === "nl" ? prefixNl : prefixEn} ${formatDate(value, language)}`;
}

export default function CommerceDashboard() {
  const { language } = useTranslation();
  const nl = language === "nl";
  const [data, setData] = useState<CommerceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncCompleted, setSyncCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/commerce/overview", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(payload.error || "Commerce data unavailable"));
      setData(payload as CommerceData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Commerce data unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!syncCompleted) return;
    const timeout = window.setTimeout(() => setSyncCompleted(false), 3500);
    return () => window.clearTimeout(timeout);
  }, [syncCompleted]);

  async function sync() {
    setSyncing(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/integrations/bol/sync", { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(payload.error || "Sync failed"));
      setNotice(nl
        ? `${Number(payload.orders ?? 0)} orders en ${Number(payload.returns ?? 0)} retouren gecontroleerd op ${formatDate(new Date().toISOString(), language, true)}.`
        : `${Number(payload.orders ?? 0)} orders and ${Number(payload.returns ?? 0)} returns checked at ${formatDate(new Date().toISOString(), language, true)}.`);
      await load();
      setSyncCompleted(true);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const filteredProducts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return data?.products ?? [];
    return (data?.products ?? []).filter((product) =>
      [product.title, product.ean, product.offerId].some((value) => value?.toLowerCase().includes(needle)));
  }, [data?.products, query]);
  const connectionHealthy = data?.connection?.status === "active" && !data.connection.lastError;
  const qualityMessages = useMemo(() => {
    if (!data?.dataQuality) return [];
    const messages: string[] = [];
    if (data.dataQuality.shipmentsWithoutTransportEvent) {
      messages.push(nl
        ? `${data.dataQuality.shipmentsWithoutTransportEvent} verzending(en) hebben tracking, maar nog geen transportscan van bol.com.`
        : `${data.dataQuality.shipmentsWithoutTransportEvent} shipment(s) have tracking but no transport scan from bol.com yet.`);
    }
    if (data.dataQuality.productsWithoutStock) {
      messages.push(nl
        ? `${data.dataQuality.productsWithoutStock} artikel(en) hebben nog geen voorraadwaarde.`
        : `${data.dataQuality.productsWithoutStock} product(s) do not have a stock value yet.`);
    }
    if (data.dataQuality.returnsWithoutRegistrationDate) {
      messages.push(nl
        ? `${data.dataQuality.returnsWithoutRegistrationDate} retour(en) missen een aanmelddatum.`
        : `${data.dataQuality.returnsWithoutRegistrationDate} return(s) are missing a registration date.`);
    }
    return messages;
  }, [data?.dataQuality, nl]);

  if (loading) return <div className="commerce-page commerce-loading" role="status">{nl ? "Commerce laden…" : "Loading commerce…"}</div>;

  return (
    <main className="commerce-page">
      <style>{`
        .commerce-page{width:min(100%,1120px);margin:0 auto;padding:40px 24px 56px;display:grid;gap:18px;color:var(--text)}
        .commerce-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px}.commerce-head h1{margin:0;font-size:28px;font-weight:800;line-height:1.2;letter-spacing:0}.commerce-head p{max-width:720px;margin:7px 0 0;color:var(--muted);font-size:14px;line-height:1.6}
        .commerce-action-cluster{display:grid;justify-items:end;gap:6px}.commerce-action-meta{color:var(--muted);font-size:10px;text-align:right}
        .commerce-actions{display:flex;gap:8px;flex-wrap:wrap}.commerce-btn{min-height:38px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:0 13px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-size:12px;font-weight:750;text-decoration:none;cursor:pointer}.commerce-btn.primary{border-color:#C7F56F;background:#C7F56F;color:#172300}.commerce-btn:disabled{opacity:.55;cursor:not-allowed}
        .commerce-status,.commerce-section{border:1px solid var(--border);border-radius:8px;background:var(--surface);overflow:hidden}.commerce-status-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:15px 17px;border-bottom:1px solid var(--border)}.commerce-status-title{display:flex;align-items:center;gap:11px}.commerce-icon{width:36px;height:36px;display:grid;place-items:center;border-radius:8px;background:#f3fbdc;color:#5d8617;flex:none}.commerce-status-title strong{display:block;font-size:13px}.commerce-status-title span{display:block;margin-top:2px;color:var(--muted);font-size:11px}.commerce-fresh{color:var(--muted);font-size:10px}
        .commerce-metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr))}.commerce-metric{min-width:0;padding:14px 16px}.commerce-metric+.commerce-metric{border-left:1px solid var(--border)}.commerce-metric span{display:block;color:var(--muted);font-size:10px;font-weight:800;text-transform:uppercase}.commerce-metric strong{display:block;margin-top:5px;font-size:22px;line-height:1}.commerce-metric small{display:block;margin-top:5px;color:var(--muted);font-size:10px}
        .commerce-feedback{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border:1px solid #f0caca;border-radius:8px;background:#fff5f5;color:#b42318;font-size:11px;line-height:1.5}.commerce-feedback.success{border-color:#d4edaa;background:#f7fbea;color:#527717}.commerce-feedback.info{border-color:#cbdcf8;background:#f5f8ff;color:#315b9a}.commerce-feedback strong{display:block;color:inherit}.commerce-feedback p{margin:2px 0 0}
        .commerce-section-head{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:14px 17px;border-bottom:1px solid var(--border)}.commerce-section-title{display:flex;align-items:center;gap:11px}.commerce-section-title h2{margin:0;font-size:14px;letter-spacing:0}.commerce-section-title p{margin:3px 0 0;color:var(--muted);font-size:11px}.commerce-scope{display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border-radius:999px;background:#f5f8ff;color:#315b9a;font-size:9px;font-weight:800}
        .commerce-scope-help{position:relative}.commerce-scope-help summary{list-style:none;cursor:pointer}.commerce-scope-help summary::-webkit-details-marker{display:none}.commerce-scope-help[open] .commerce-scope{background:#eaf1ff}.commerce-scope-copy{position:absolute;z-index:4;top:calc(100% + 7px);right:0;width:min(320px,calc(100vw - 40px));padding:11px 12px;border:1px solid #cbdcf8;border-radius:8px;background:var(--surface);box-shadow:0 12px 28px rgba(31,55,92,.14);color:var(--text);font-size:10px;line-height:1.55}
        .commerce-search{position:relative;width:min(100%,280px)}.commerce-search svg{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--muted)}.commerce-search input{width:100%;height:36px;padding:0 10px 0 33px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font:inherit;font-size:11px}
        .commerce-table-wrap{overflow-x:auto}.commerce-table{width:100%;border-collapse:collapse;font-size:11px}.commerce-table th{padding:10px 14px;background:var(--surface-subtle);color:var(--muted);font-size:9px;text-align:left;text-transform:uppercase;white-space:nowrap}.commerce-table td{padding:12px 14px;border-top:1px solid var(--border);vertical-align:middle}.commerce-table tbody tr:first-child td{border-top:0}.commerce-primary{display:block;color:var(--text);font-size:11px;font-weight:800}.commerce-secondary{display:block;margin-top:3px;color:var(--muted);font-size:10px}.commerce-pill{display:inline-flex;align-items:center;gap:5px;padding:5px 7px;border-radius:999px;background:var(--surface-subtle);color:var(--muted);font-size:9px;font-weight:800}.commerce-pill.good{background:#f3fbdc;color:#527717}.commerce-pill.warn{background:#fff7e6;color:#a36100}.commerce-pill.bad{background:#fff0f0;color:#b42318}
        .commerce-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.commerce-list{display:grid}.commerce-list-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:13px 16px;border-top:1px solid var(--border)}.commerce-list-row:first-child{border-top:0}.commerce-list-row strong{font-size:11px}.commerce-list-row p{margin:4px 0 0;color:var(--muted);font-size:10px;line-height:1.45}.commerce-tracking-link{display:inline-flex;align-items:center;gap:5px;color:#315b9a;font-weight:800;text-decoration:none}.commerce-tracking-link:hover{text-decoration:underline}.commerce-list-side{display:grid;justify-items:end;align-content:start;gap:6px}.commerce-list-side small{color:var(--muted);font-size:9px;white-space:nowrap}.commerce-empty{display:grid;place-items:center;min-height:150px;padding:25px;text-align:center}.commerce-empty svg{color:var(--muted)}.commerce-empty strong{display:block;margin-top:10px;font-size:12px}.commerce-empty p{max-width:430px;margin:5px auto 0;color:var(--muted);font-size:11px;line-height:1.5}
        @media(max-width:900px){.commerce-head{align-items:flex-start;flex-direction:column}.commerce-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.commerce-metric+.commerce-metric{border-left:0}.commerce-metric:nth-child(even){border-left:1px solid var(--border)}.commerce-metric:nth-child(n+3){border-top:1px solid var(--border)}.commerce-grid{grid-template-columns:1fr}}
        @media(max-width:640px){.commerce-page{padding:28px 16px 40px}.commerce-action-cluster{width:100%;justify-items:stretch}.commerce-actions,.commerce-btn{width:100%}.commerce-action-meta{text-align:left}.commerce-status-head,.commerce-section-head{align-items:flex-start;flex-direction:column}.commerce-search{width:100%}.commerce-metrics{grid-template-columns:1fr}.commerce-metric+.commerce-metric,.commerce-metric:nth-child(even){border-left:0}.commerce-metric:nth-child(n+2){border-top:1px solid var(--border)}}
      `}</style>

      <header className="commerce-head">
        <div>
          <h1>Commerce</h1>
          <p>{nl
            ? "Controleer welke bol.com-data Support gebruikt voor klantvragen. Alles op deze pagina is read-only."
            : "Verify the bol.com data Support uses for customer questions. Everything on this page is read-only."}</p>
        </div>
        <div className="commerce-action-cluster">
          <div className="commerce-actions">
            <Link className="commerce-btn" href="/integrations">{nl ? "Koppeling beheren" : "Manage connection"}<ArrowUpRight size={14} /></Link>
            <button className="commerce-btn primary" disabled={syncing || !data?.connection} onClick={() => void sync()}>
              {syncCompleted ? <CheckCircle2 size={14} /> : <RefreshCw size={14} className={syncing ? "settings-spin" : undefined} />}
              {syncing
                ? (nl ? "Synchroniseren…" : "Syncing…")
                : syncCompleted ? (nl ? "Gesynchroniseerd" : "Synchronized")
                  : (nl ? "Nu synchroniseren" : "Sync now")}
            </button>
          </div>
          {data?.connection ? <span className="commerce-action-meta">{nl ? "Orders automatisch elke 5 min · retouren elke 15 min" : "Orders every 5 min · returns every 15 min"} · {nl ? "laatste sync" : "last sync"} {formatDate(data.connection.lastOrderSync, language, true)}</span> : null}
        </div>
      </header>

      {error ? <div className="commerce-feedback" role="alert"><AlertCircle size={17} /><div><strong>{nl ? "Commerce vraagt aandacht" : "Commerce needs attention"}</strong><p>{error}</p><button className="commerce-btn" style={{ marginTop: 8 }} onClick={() => void load()}>{nl ? "Opnieuw proberen" : "Try again"}</button></div></div> : null}
      {notice ? <div className="commerce-feedback success" role="status"><CheckCircle2 size={17} /><div><strong>{nl ? "Data is bijgewerkt" : "Data is up to date"}</strong><p>{notice}</p></div></div> : null}

      {!data?.connection ? (
        <section className="commerce-section commerce-empty">
          <div><ShoppingBag size={25} /><strong>{nl ? "Nog geen bol.com-data" : "No bol.com data yet"}</strong><p>{nl ? "Koppel eerst je bol.com-verkoopaccount. Daarna verschijnen gesynchroniseerde orders, artikelen, verzendingen en retouren hier." : "Connect your bol.com seller account first. Synced orders, products, shipments, and returns will then appear here."}</p><Link href="/integrations" className="commerce-btn primary" style={{ marginTop: 14 }}>{nl ? "bol.com koppelen" : "Connect bol.com"}<ArrowUpRight size={14} /></Link></div>
        </section>
      ) : (
        <>
          <section className="commerce-status">
            <div className="commerce-status-head">
              <div className="commerce-status-title"><span className="commerce-icon" style={!connectionHealthy ? { background: "#fff7e6", color: "#a36100" } : undefined}>{connectionHealthy ? <CheckCircle2 size={19} /> : <AlertCircle size={19} />}</span><div><strong>{connectionHealthy ? (nl ? "bol.com-data is beschikbaar" : "bol.com data is available") : (nl ? "De bol.com-koppeling vraagt aandacht" : "The bol.com connection needs attention")}</strong><span>{data.connection.displayName || "bol.com"} · {data.connection.eventsStatus === "active" ? (nl ? "events actief" : "events active") : (nl ? "polling actief" : "polling active")}</span></div></div>
              <span className="commerce-fresh">{nl ? "Orders bijgewerkt" : "Orders updated"} {formatDate(data.connection.lastOrderSync, language, true)}</span>
            </div>
            <div className="commerce-metrics">
              <div className="commerce-metric"><span>{nl ? "Orders geladen" : "Orders loaded"}</span><strong>{data.summary.orders}</strong><small>{nl ? "recente bol-orders" : "recent bol orders"}</small></div>
              <div className="commerce-metric"><span>{nl ? "Open orders" : "Open orders"}</span><strong>{data.summary.openOrders}</strong><small>{nl ? "nog niet volledig afgerond" : "not fully completed"}</small></div>
              <div className="commerce-metric"><span>{nl ? "Artikelen gecontroleerd" : "Products checked"}</span><strong>{data.summary.products}</strong><small>{nl ? "uit gesynchroniseerde orders" : "from synced orders"}</small></div>
              <div className="commerce-metric"><span>{nl ? "Lage voorraad" : "Low stock"}</span><strong>{data.summary.lowStock}</strong><small>{nl ? "bekende voorraad ≤ 5" : "known stock ≤ 5"}</small></div>
              <div className="commerce-metric"><span>{nl ? "Open retouren" : "Open returns"}</span><strong>{data.summary.activeReturns}</strong><small>{nl ? `retoursync ${formatDate(data.connection.lastReturnSync, language)}` : `return sync ${formatDate(data.connection.lastReturnSync, language)}`}</small></div>
            </div>
          </section>

          {qualityMessages.length ? (
            <section className="commerce-feedback info" role="status">
              <Clock3 size={17} />
              <div>
                <strong>{nl ? "Datadekking van bol.com" : "bol.com data coverage"}</strong>
                {qualityMessages.map((message) => <p key={message}>{message}</p>)}
              </div>
            </section>
          ) : null}

          <section className="commerce-section">
            <div className="commerce-section-head">
              <div className="commerce-section-title"><span className="commerce-icon"><Boxes size={18} /></span><div><h2>{nl ? "Producten en voorraad" : "Products and stock"}</h2><p>{nl ? "De artikelen die Support uit recente orders heeft gecontroleerd." : "Products Support verified from recent orders."}</p></div></div>
              <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                <details className="commerce-scope-help">
                  <summary><span className="commerce-scope"><AlertCircle size={11} />{nl ? "Artikelen uit recente orders" : "Products from recent orders"}</span></summary>
                  <div className="commerce-scope-copy">{nl
                    ? "Support haalt bewust niet je hele bol.com-catalogus op. Alleen artikelen uit gesynchroniseerde recente orders worden geladen; prijs, verkoopstatus en voorraad worden voor die relevante artikelen gecontroleerd."
                    : "Support deliberately does not retrieve your entire bol.com catalog. Only products from synchronized recent orders are loaded; price, sale status, and stock are checked for those relevant products."}</div>
                </details>
                <label className="commerce-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={nl ? "Zoek product, EAN of offer-ID" : "Search product, EAN, or offer ID"} /></label>
              </div>
            </div>
            {filteredProducts.length ? <div className="commerce-table-wrap"><table className="commerce-table"><thead><tr><th>{nl ? "Artikel" : "Product"}</th><th>EAN / offer-ID</th><th>{nl ? "Afhandeling" : "Fulfilment"}</th><th>{nl ? "Voorraad" : "Stock"}</th><th>{nl ? "Prijs" : "Price"}</th><th>{nl ? "Verkoopstatus" : "Sale status"}</th><th>{nl ? "Gecontroleerd" : "Checked"}</th></tr></thead><tbody>
              {filteredProducts.map((product) => <tr key={product.offerId}><td><span className="commerce-primary">{product.title}</span></td><td><span className="commerce-primary">{product.ean || "–"}</span><span className="commerce-secondary">{product.offerId}</span></td><td>{fulfilmentLabel(product.fulfilmentMethod, product.distributionParty, nl)}</td><td>{product.stockKnown ? <span className={`commerce-pill ${Number(product.stock) <= 5 ? "warn" : "good"}`}>{product.stock}</span> : <span className="commerce-pill">{nl ? "Nog niet ontvangen" : "Not received yet"}</span>}</td><td>{formatMoney(product.price, product.currency, language)}</td><td>{product.forSale === null ? <span className="commerce-pill">{nl ? "Onbekend" : "Unknown"}</span> : product.forSale ? <span className="commerce-pill good">{nl ? "Te koop" : "For sale"}</span> : <span className="commerce-pill bad">{nl ? "Niet te koop" : "Not for sale"}</span>}</td><td>{formatDate(product.lastSyncedAt, language, true)}</td></tr>)}
            </tbody></table></div> : <div className="commerce-empty"><div><Boxes size={23} /><strong>{query ? (nl ? "Geen artikelen gevonden" : "No products found") : (nl ? "Nog geen artikelen geladen" : "No products loaded yet")}</strong><p>{nl ? "Artikelen verschijnen zodra bol-orders met geldige offer-ID's zijn gesynchroniseerd." : "Products appear after bol orders with valid offer IDs have been synced."}</p></div></div>}
          </section>

          <section className="commerce-section">
            <div className="commerce-section-head"><div className="commerce-section-title"><span className="commerce-icon"><PackageCheck size={18} /></span><div><h2>{nl ? "Recente orders" : "Recent orders"}</h2><p>{nl ? "Orderstatus, aantallen, afhandeling en bezorgbelofte uit bol.com." : "Order status, quantities, fulfilment, and delivery promise from bol.com."}</p></div></div></div>
            {data.orders.length ? <div className="commerce-table-wrap"><table className="commerce-table"><thead><tr><th>{nl ? "Order" : "Order"}</th><th>{nl ? "Datum" : "Date"}</th><th>{nl ? "Status" : "Status"}</th><th>{nl ? "Artikelen" : "Items"}</th><th>{nl ? "Afhandeling" : "Fulfilment"}</th><th>{nl ? "Bezorgbelofte" : "Delivery promise"}</th><th>{nl ? "Totaal" : "Total"}</th></tr></thead><tbody>
              {data.orders.map((order) => <tr key={order.id}><td><span className="commerce-primary">{order.orderNumber}</span><span className="commerce-secondary">{nl ? "Sync" : "Sync"} {formatDate(order.lastSyncedAt, language, true)}</span></td><td>{formatDate(order.createdAt, language)}</td><td><span className={`commerce-pill ${order.status === "SHIPPED" ? "good" : order.status === "CANCELLED" ? "bad" : "warn"}`}>{statusLabel(order.status, nl)}</span></td><td>{order.itemCount}</td><td>{order.fulfilment.map((item) => fulfilmentLabel(item.method, item.distributionParty, nl)).join(" · ") || "–"}</td><td>{formatDate(order.latestDeliveryAt, language)}</td><td>{formatMoney(order.total, order.currency, language)}</td></tr>)}
            </tbody></table></div> : <div className="commerce-empty"><div><PackageCheck size={23} /><strong>{nl ? "Nog geen orders" : "No orders yet"}</strong><p>{nl ? "De bol.com API is gekoppeld, maar heeft nog geen recente orders aangeleverd." : "The bol.com API is connected but has not supplied recent orders yet."}</p></div></div>}
          </section>

          <div className="commerce-grid">
            <section className="commerce-section">
              <div className="commerce-section-head"><div className="commerce-section-title"><span className="commerce-icon"><Truck size={18} /></span><div><h2>{nl ? "Verzendingen" : "Shipments"}</h2><p>{nl ? "Laatste transportstatus en track & trace." : "Latest transport status and tracking."}</p></div></div></div>
              {data.shipments.length ? <div className="commerce-list">{data.shipments.slice(0, 12).map((shipment) => (
                <div className="commerce-list-row" key={shipment.shipmentId}>
                  <div>
                    <strong>{shipment.orderNumber ? `${nl ? "Order" : "Order"} ${shipment.orderNumber}` : `${nl ? "Zending" : "Shipment"} ${shipment.shipmentId}`}</strong>
                    <p>{shipment.carrier || (nl ? "Vervoerder niet door bol.com aangeleverd" : "Carrier not supplied by bol.com")} · {shipmentStatusLabel(shipment, nl)}</p>
                    {shipment.trackingNumber ? <p><b>{nl ? "Track & trace:" : "Tracking:"}</b>{" "}
                      {shipment.trackingUrl
                        ? <a className="commerce-tracking-link" href={`${shipment.trackingUrl}?lang=${language}`} target="_blank" rel="noreferrer">{shipment.trackingNumber}<ArrowUpRight size={11} /></a>
                        : shipment.trackingNumber}
                    </p> : null}
                  </div>
                  <div className="commerce-list-side">
                    <span className={`commerce-pill ${shipment.orderStatus === "SHIPPED" ? "good" : "warn"}`}>{statusLabel(shipment.orderStatus, nl)}</span>
                    <small>{shipment.latestEventAt
                      ? datedLabel("Laatste scan", "Last scan", shipment.latestEventAt, language)
                      : datedLabel("Verzonden", "Shipped", shipment.shippedAt, language)}</small>
                  </div>
                </div>
              ))}</div> : <div className="commerce-empty"><div><Truck size={23} /><strong>{nl ? "Nog geen verzendingen" : "No shipments yet"}</strong><p>{nl ? "Zendingen en transportevents verschijnen hier zodra bol.com ze aan een order koppelt." : "Shipments and transport events appear once bol.com links them to an order."}</p></div></div>}
            </section>
            <section className="commerce-section">
              <div className="commerce-section-head"><div className="commerce-section-title"><span className="commerce-icon"><RotateCcw size={18} /></span><div><h2>{nl ? "Retouren" : "Returns"}</h2><p>{nl ? "Aangemelde en verwerkte retouren." : "Registered and processed returns."}</p></div></div></div>
              {data.returns.length ? <div className="commerce-list">{data.returns.slice(0, 12).map((item) => {
                const expectedQuantity = item.items.reduce((sum, returnItem) => sum + Number(returnItem.expected_quantity || 0), 0);
                const handledQuantity = item.items.reduce((sum, returnItem) => sum + Number(returnItem.handled_quantity || 0), 0);
                const reason = item.items.find((returnItem) => returnItem.reason)?.reason;
                const title = item.items.find((returnItem) => returnItem.title)?.title;
                return (
                  <div className="commerce-list-row" key={item.returnId}>
                    <div>
                      <strong>{item.orderNumber ? `${nl ? "Order" : "Order"} ${item.orderNumber}` : `${nl ? "Retour" : "Return"} ${item.returnId}`}</strong>
                      <p>{title || `${expectedQuantity || item.items.length} ${nl ? "retourartikel(en)" : "return item(s)"}`} · {fulfilmentLabel(item.fulfilmentMethod, null, nl)}</p>
                      <p>{nl ? "Retour-ID" : "Return ID"}: {item.returnId}{reason ? ` · ${nl ? "Reden" : "Reason"}: ${reason}` : ""}{handledQuantity ? ` · ${nl ? "Verwerkt" : "Handled"} ${handledQuantity}/${expectedQuantity || handledQuantity}` : ""}</p>
                    </div>
                    <div className="commerce-list-side">
                      <span className={`commerce-pill ${item.handled ? "good" : "warn"}`}>{item.handled ? (nl ? "Verwerkt" : "Handled") : (nl ? "Actie nodig" : "Needs action")}</span>
                      <small>{datedLabel("Aangemeld", "Registered", item.registeredAt, language)}</small>
                    </div>
                  </div>
                );
              })}</div> : <div className="commerce-empty"><div><RotateCcw size={23} /><strong>{nl ? "Geen retouren" : "No returns"}</strong><p>{nl ? "Er zijn geen recente bol-retouren gevonden. Dat kan gewoon correct zijn." : "No recent bol returns were found. That can be perfectly correct."}</p></div></div>}
            </section>
          </div>

          <section className="commerce-feedback success">
            <CircleDollarSign size={17} />
            <div><strong>{nl ? "Read-only controle" : "Read-only verification"}</strong><p>{nl ? "Deze pagina toont alleen gesynchroniseerde context. Support wijzigt geen voorraad, orders, verzendingen of retouren in bol.com." : "This page only displays synced context. Support does not change stock, orders, shipments, or returns in bol.com."}</p></div>
          </section>
        </>
      )}
    </main>
  );
}
