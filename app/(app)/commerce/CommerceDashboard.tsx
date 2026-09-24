"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  PackageCheck,
  RefreshCw,
  Search,
  ShoppingBag,
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
        ? `${Number(payload.orders ?? 0)} bestellingen en ${Number(payload.returns ?? 0)} retouren bijgewerkt.`
        : `${Number(payload.orders ?? 0)} orders and ${Number(payload.returns ?? 0)} returns updated.`);
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
  // Eén lijst: per bestelling ook de verzending en een eventuele retour.
  const shipmentByOrder = useMemo(() => new Map((data?.shipments ?? []).filter((shipment) => shipment.orderNumber).map((shipment) => [shipment.orderNumber as string, shipment])), [data?.shipments]);
  const returnByOrder = useMemo(() => new Map((data?.returns ?? []).filter((item) => item.orderNumber).map((item) => [item.orderNumber as string, item])), [data?.returns]);
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

  if (loading) return <div className="commerce-page commerce-loading" role="status">{nl ? "Bestelgegevens laden…" : "Loading order data…"}</div>;

  return (
    <main className="commerce-page">
      <style>{`
        .commerce-page{width:min(100%,1080px);margin:0 auto;padding:40px 24px 56px;display:grid;gap:18px;color:var(--text)}
        .commerce-loading{color:var(--muted);font-size:13px}
        .commerce-back{display:inline-flex;align-items:center;gap:6px;width:fit-content;color:var(--muted);font-size:13px;text-decoration:none}.commerce-back:hover{color:var(--text)}
        .commerce-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px}.commerce-head h1{margin:0;font-size:30px;font-weight:500;line-height:1.15;letter-spacing:-.02em}.commerce-head p{max-width:680px;margin:7px 0 0;color:var(--muted);font-size:14px;line-height:1.6}
        .commerce-action-cluster{display:grid;justify-items:end;gap:6px}.commerce-action-meta{color:var(--muted);font-size:12px;text-align:right}
        .commerce-btn{min-height:38px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:0 14px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text);font-size:13px;font-weight:600;text-decoration:none;cursor:pointer}.commerce-btn.primary{border-color:var(--sf-green);background:var(--sf-green);color:#10180a}.commerce-btn:disabled{opacity:.55;cursor:not-allowed}
        .commerce-section{border:1px solid var(--border);border-radius:20px;background:var(--surface);overflow:hidden}
        .commerce-feedback{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border:1px solid rgba(248,113,113,.3);border-radius:14px;background:rgba(248,113,113,.08);color:var(--tone-danger);font-size:13px;line-height:1.5}.commerce-feedback.success{border-color:rgba(199,245,111,.28);background:rgba(199,245,111,.08);color:var(--sf-green)}.commerce-feedback strong{display:block;color:var(--text);font-weight:600}.commerce-feedback p{margin:2px 0 0;color:var(--muted)}
        .commerce-section-head{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:18px 20px 12px}.commerce-section-head h2{margin:0;font-size:16px;font-weight:500;letter-spacing:-.01em}.commerce-section-head p{margin:4px 0 0;color:var(--muted);font-size:13px}
        .commerce-orders{display:grid}.commerce-order{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1.4fr) auto;align-items:center;gap:16px;padding:14px 20px;border-top:1px solid var(--border)}
        .commerce-primary{display:block;color:var(--text);font-size:13px;font-weight:600}.commerce-secondary{display:block;margin-top:3px;color:var(--muted);font-size:12px;line-height:1.45}
        .commerce-order-side{display:flex;align-items:center;justify-content:flex-end;gap:6px;flex-wrap:wrap}
        .commerce-pill{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;background:var(--surface-2);color:var(--muted);font-size:11px;font-weight:600;white-space:nowrap}.commerce-pill.good{background:rgba(199,245,111,.1);color:var(--sf-green)}.commerce-pill.warn{background:rgba(245,196,88,.1);color:var(--tone-warning)}.commerce-pill.bad{background:rgba(248,113,113,.1);color:var(--tone-danger)}
        .commerce-tracking-link{display:inline-flex;align-items:center;gap:4px;color:var(--sf-green);font-weight:600;text-decoration:none}.commerce-tracking-link:hover{text-decoration:underline}
        .commerce-details{border:1px solid var(--border);border-radius:20px;background:var(--surface);overflow:hidden}.commerce-details>summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;list-style:none;cursor:pointer;color:var(--text);font-size:14px;font-weight:500}.commerce-details>summary::-webkit-details-marker{display:none}.commerce-details>summary span{color:var(--muted);font-size:12px;font-weight:400}.commerce-details>summary svg{flex:none;color:var(--muted);transition:transform .2s}.commerce-details[open]>summary svg{transform:rotate(180deg)}
        .commerce-detail-block{border-top:1px solid var(--border);padding:16px 20px;display:grid;gap:12px}.commerce-detail-block h3{margin:0;font-size:13px;font-weight:600}.commerce-detail-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.commerce-scope{color:var(--muted);font-size:12px}
        .commerce-search{position:relative;width:min(100%,280px)}.commerce-search svg{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--muted)}.commerce-search input{width:100%;height:36px;padding:0 10px 0 33px;border:1px solid var(--border);border-radius:10px;background:var(--bg);color:var(--text);font:inherit;font-size:13px}
        .commerce-table-wrap{overflow-x:auto;border:1px solid var(--border);border-radius:14px}.commerce-table{width:100%;border-collapse:collapse;font-size:12px}.commerce-table th{padding:10px 14px;color:var(--muted);font-size:11px;font-weight:600;letter-spacing:.06em;text-align:left;text-transform:uppercase;white-space:nowrap}.commerce-table td{padding:12px 14px;border-top:1px solid var(--border);vertical-align:middle}
        .commerce-list{display:grid;border:1px solid var(--border);border-radius:14px;overflow:hidden}.commerce-list-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:12px 14px;border-top:1px solid var(--border)}.commerce-list-row:first-child{border-top:0}.commerce-list-side{display:grid;justify-items:end;align-content:start;gap:6px}.commerce-list-side small{color:var(--muted);font-size:11px;white-space:nowrap}
        .commerce-notes{margin:0;padding-left:18px;color:var(--muted);font-size:12px;line-height:1.6}
        .commerce-empty{display:grid;place-items:center;gap:8px;min-height:150px;padding:25px;text-align:center}.commerce-empty svg{color:var(--muted)}.commerce-empty strong{display:block;font-size:14px;font-weight:500}.commerce-empty p{max-width:430px;margin:0 auto;color:var(--muted);font-size:13px;line-height:1.5}
        @media(max-width:760px){.commerce-head{align-items:flex-start;flex-direction:column}.commerce-action-cluster{justify-items:start}.commerce-action-meta{text-align:left}.commerce-order{grid-template-columns:1fr;gap:8px}.commerce-order-side{justify-content:flex-start}}
        @media(max-width:640px){.commerce-page{padding:28px 16px 40px}.commerce-search{width:100%}}
      `}</style>

      <Link className="commerce-back" href="/integrations"><ArrowLeft size={14} />{nl ? "Koppelingen" : "Connections"}</Link>
      <header className="commerce-head">
        <div>
          <h1>{nl ? "Bestelgegevens" : "Order data"}</h1>
          <p>{nl
            ? "Wat Support One van bol.com gebruikt bij klantvragen. Support One wijzigt geen voorraad, orders, verzendingen of retouren."
            : "What Support One uses from bol.com for customer questions. Support One does not change stock, orders, shipments, or returns."}</p>
        </div>
        {data?.connection ? (
          <div className="commerce-action-cluster">
            <button className="commerce-btn primary" disabled={syncing} onClick={() => void sync()}>
              {syncCompleted ? <CheckCircle2 size={14} /> : <RefreshCw size={14} className={syncing ? "settings-spin" : undefined} />}
              {syncing ? (nl ? "Bijwerken…" : "Updating…") : syncCompleted ? (nl ? "Bijgewerkt" : "Updated") : (nl ? "Nu bijwerken" : "Update now")}
            </button>
            <span className="commerce-action-meta">{nl ? "Bijgewerkt" : "Updated"} {formatDate(data.connection.lastOrderSync, language, true)}</span>
          </div>
        ) : null}
      </header>

      {error ? <div className="commerce-feedback" role="alert"><AlertCircle size={17} /><div><strong>{nl ? "Bestelgegevens konden niet laden" : "Order data could not load"}</strong><p>{error}</p><button className="commerce-btn" style={{ marginTop: 8 }} onClick={() => void load()}>{nl ? "Opnieuw proberen" : "Try again"}</button></div></div> : null}
      {notice ? <div className="commerce-feedback success" role="status"><CheckCircle2 size={17} /><div><strong>{nl ? "Bijgewerkt" : "Updated"}</strong><p>{notice}</p></div></div> : null}
      {data?.connection && !connectionHealthy ? <div className="commerce-feedback" role="status"><AlertCircle size={17} /><div><strong>{nl ? "De bol.com-koppeling vraagt aandacht" : "The bol.com connection needs attention"}</strong><p>{data.connection.lastError || (nl ? "Controleer de koppeling bij Koppelingen." : "Check the connection under Connections.")}</p></div></div> : null}

      {!data?.connection ? (
        <section className="commerce-section commerce-empty">
          <div><ShoppingBag size={25} /><strong>{nl ? "Nog geen bestelgegevens" : "No order data yet"}</strong><p>{nl ? "Koppel eerst je bol.com-verkoopaccount. Daarna zie je hier welke bestellingen Support One kent." : "Connect your bol.com seller account first. You will then see which orders Support One knows about."}</p><Link href="/integrations" className="commerce-btn primary" style={{ marginTop: 14 }}>{nl ? "bol.com koppelen" : "Connect bol.com"}<ArrowUpRight size={14} /></Link></div>
        </section>
      ) : (
        <>
          <section className="commerce-section">
            <div className="commerce-section-head"><div><h2>{nl ? "Recente bestellingen" : "Recent orders"}</h2><p>{nl ? "Met verzending en retour, zoals Support One ze ziet." : "With shipment and return, as Support One sees them."}</p></div></div>
            {data.orders.length ? <div className="commerce-orders">{data.orders.map((order) => {
              const shipment = shipmentByOrder.get(order.orderNumber);
              const orderReturn = returnByOrder.get(order.orderNumber);
              return (
                <div className="commerce-order" key={order.id}>
                  <div>
                    <span className="commerce-primary">{order.orderNumber}</span>
                    <span className="commerce-secondary">{formatDate(order.createdAt, language)} · {order.itemCount} {nl ? (order.itemCount === 1 ? "artikel" : "artikelen") : (order.itemCount === 1 ? "item" : "items")} · {formatMoney(order.total, order.currency, language)}</span>
                  </div>
                  <div>
                    {shipment ? <>
                      <span className="commerce-secondary" style={{ marginTop: 0 }}>{shipment.carrier ? `${shipment.carrier} · ` : ""}{shipmentStatusLabel(shipment, nl)}</span>
                      {shipment.trackingNumber ? <span className="commerce-secondary">{shipment.trackingUrl
                        ? <a className="commerce-tracking-link" href={`${shipment.trackingUrl}?lang=${language}`} target="_blank" rel="noreferrer">{shipment.trackingNumber}<ArrowUpRight size={11} /></a>
                        : shipment.trackingNumber}</span> : null}
                    </> : <span className="commerce-secondary" style={{ marginTop: 0 }}>{order.latestDeliveryAt ? `${nl ? "Bezorgbelofte" : "Delivery promise"} ${formatDate(order.latestDeliveryAt, language)}` : fulfilmentLabel(order.fulfilment[0]?.method ?? null, order.fulfilment[0]?.distributionParty ?? null, nl)}</span>}
                  </div>
                  <div className="commerce-order-side">
                    {orderReturn ? <span className={`commerce-pill ${orderReturn.handled ? "" : "warn"}`}>{orderReturn.handled ? (nl ? "Retour verwerkt" : "Return handled") : (nl ? "Retour aangemeld" : "Return registered")}</span> : null}
                    <span className={`commerce-pill ${order.status === "SHIPPED" ? "good" : order.status === "CANCELLED" ? "bad" : "warn"}`}>{statusLabel(order.status, nl)}</span>
                  </div>
                </div>
              );
            })}</div> : <div className="commerce-empty"><div><PackageCheck size={23} /><strong>{nl ? "Nog geen bestellingen" : "No orders yet"}</strong><p>{nl ? "bol.com is gekoppeld, maar heeft nog geen recente bestellingen doorgegeven." : "bol.com is connected but has not shared recent orders yet."}</p></div></div>}
          </section>

          <details className="commerce-details">
            <summary><div>{nl ? "Details" : "Details"} <span>· {nl ? "producten, retouren en datadekking" : "products, returns and data coverage"}</span></div><ChevronDown size={16} /></summary>

            <div className="commerce-detail-block">
              <div className="commerce-detail-head">
                <div><h3>{nl ? "Producten en voorraad" : "Products and stock"}</h3><span className="commerce-scope">{nl ? "Artikelen uit recente orders, niet je hele catalogus." : "Products from recent orders, not your whole catalog."}</span></div>
                <label className="commerce-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={nl ? "Zoek product of EAN" : "Search product or EAN"} /></label>
              </div>
              {filteredProducts.length ? <div className="commerce-table-wrap"><table className="commerce-table"><thead><tr><th>{nl ? "Artikel" : "Product"}</th><th>EAN</th><th>{nl ? "Afhandeling" : "Fulfilment"}</th><th>{nl ? "Voorraad" : "Stock"}</th><th>{nl ? "Prijs" : "Price"}</th><th>{nl ? "Te koop" : "For sale"}</th></tr></thead><tbody>
                {filteredProducts.map((product) => <tr key={product.offerId}><td><span className="commerce-primary">{product.title}</span></td><td>{product.ean || "–"}</td><td>{fulfilmentLabel(product.fulfilmentMethod, product.distributionParty, nl)}</td><td>{product.stockKnown ? <span className={`commerce-pill ${Number(product.stock) <= 5 ? "warn" : "good"}`}>{product.stock}</span> : <span className="commerce-pill">{nl ? "Onbekend" : "Unknown"}</span>}</td><td>{formatMoney(product.price, product.currency, language)}</td><td>{product.forSale === null ? <span className="commerce-pill">{nl ? "Onbekend" : "Unknown"}</span> : product.forSale ? <span className="commerce-pill good">{nl ? "Ja" : "Yes"}</span> : <span className="commerce-pill bad">{nl ? "Nee" : "No"}</span>}</td></tr>)}
              </tbody></table></div> : <p className="commerce-scope">{query ? (nl ? "Geen artikelen gevonden." : "No products found.") : (nl ? "Nog geen artikelen: die verschijnen zodra er bestellingen binnen zijn." : "No products yet: they appear once orders come in.")}</p>}
            </div>

            <div className="commerce-detail-block">
              <h3>{nl ? "Retouren" : "Returns"}</h3>
              {data.returns.length ? <div className="commerce-list">{data.returns.slice(0, 12).map((item) => {
                const expectedQuantity = item.items.reduce((sum, returnItem) => sum + Number(returnItem.expected_quantity || 0), 0);
                const reason = item.items.find((returnItem) => returnItem.reason)?.reason;
                const title = item.items.find((returnItem) => returnItem.title)?.title;
                return (
                  <div className="commerce-list-row" key={item.returnId}>
                    <div>
                      <span className="commerce-primary">{item.orderNumber ? `${nl ? "Bestelling" : "Order"} ${item.orderNumber}` : `${nl ? "Retour" : "Return"} ${item.returnId}`}</span>
                      <span className="commerce-secondary">{title || `${expectedQuantity || item.items.length} ${nl ? "artikel(en)" : "item(s)"}`} · {fulfilmentLabel(item.fulfilmentMethod, null, nl)}{reason ? ` · ${reason}` : ""}</span>
                    </div>
                    <div className="commerce-list-side">
                      <span className={`commerce-pill ${item.handled ? "good" : "warn"}`}>{item.handled ? (nl ? "Verwerkt" : "Handled") : (nl ? "Open" : "Open")}</span>
                      <small>{datedLabel("Aangemeld", "Registered", item.registeredAt, language)}</small>
                    </div>
                  </div>
                );
              })}</div> : <p className="commerce-scope">{nl ? "Geen recente retouren." : "No recent returns."}</p>}
            </div>

            {qualityMessages.length ? (
              <div className="commerce-detail-block">
                <h3>{nl ? "Datadekking van bol.com" : "bol.com data coverage"}</h3>
                <ul className="commerce-notes">{qualityMessages.map((message) => <li key={message}>{message}</li>)}</ul>
              </div>
            ) : null}
          </details>
        </>
      )}
    </main>
  );
}
