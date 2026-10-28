"use client";

import Link from "next/link";
import { AlertTriangle, ArrowDownToLine, CalendarRange, ChevronDown, Loader2, PackageX, RefreshCw, Search, ShoppingCart, Truck, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { Notice, SettingsStyles, Toggle } from "../settings/SettingsUi";
import type { InventoryAction, InventorySummary, SeasonRow, VariantMetrics } from "@/lib/inventory/core";
import type { DeliveryReport } from "@/lib/inventory/reportCore";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

// ── Types from the API ──────────────────────────────────────────────────────

type Settings = { leadTimeDays: number; coverWeeks: number; safetyBuffer: number; deadAfterDays: number; deadCoverWeeks: number };

export type InventoryView = {
  builtAt: string;
  today: string;
  historyFrom: string | null;
  channels: string[];
  settings: Settings;
  summary: InventorySummary;
  actions: InventoryAction[];
  variants: { total: number; offset: number; rows: VariantMetrics[] };
  deliveries: DeliveryReport[];
  stale: boolean;
  sync: { lastSyncedAt: string | null; lastSyncError: string | null; weeklyEmail: boolean };
  canManage: boolean;
};

type Season = {
  from: string;
  to: string;
  hasHistory: boolean;
  totalUnits: number;
  topProducts: Array<{ productTitle: string; units: number; revenue: number }>;
  topVariants: SeasonRow[];
  weakVariants: SeasonRow[];
};

type Tab = "overview" | "season" | "deliveries" | "settings";
type Filter = "all" | "attention" | "dead" | "low" | "out_of_stock" | "to_order" | "healthy";

const PAGE_SIZE = 50;

// ── Formatting ──────────────────────────────────────────────────────────────

function useFormat(nl: boolean) {
  return useMemo(() => {
    const locale = nl ? "nl-NL" : "en-GB";
    const number = (value: number, digits = 0) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
    const money = (value: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
    const day = (value: string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Amsterdam" }).format(new Date(`${value}T12:00:00Z`));
    const moment = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Amsterdam" }).format(new Date(value));
    const percent = (value: number | null) => value == null ? "–" : `${Math.round(value * 100)}%`;
    return { number, money, day, moment, percent };
  }, [nl]);
}

const STATUS_TONE: Record<VariantMetrics["status"], "danger" | "warning" | "success" | "neutral"> = {
  out_of_stock: "danger", low: "warning", dead: "danger", slow: "warning", healthy: "success", new: "neutral", inactive: "neutral", untracked: "neutral",
};

function statusLabel(status: VariantMetrics["status"], nl: boolean) {
  const labels: Record<VariantMetrics["status"], [string, string]> = {
    out_of_stock: ["Uitverkocht", "Sold out"],
    low: ["Bijna op", "Running low"],
    dead: ["Dode voorraad", "Dead stock"],
    slow: ["Loopt traag", "Slow"],
    healthy: ["Gezond", "Healthy"],
    new: ["Nieuw", "New"],
    inactive: ["Niet actief", "Inactive"],
    untracked: ["Voorraad onbekend", "Stock unknown"],
  };
  return labels[status][nl ? 0 : 1];
}

function channelLabel(channel: string) {
  return channel === "bol" ? "bol.com" : channel === "woocommerce" ? "WooCommerce" : channel === "shopify" ? "Shopify" : channel === "import" ? "Import" : channel;
}

function optionsText(metric: Pick<VariantMetrics, "options" | "variantTitle">) {
  const values = Object.values(metric.options ?? {});
  return values.length ? values.join(" · ") : metric.variantTitle && !/^default/i.test(metric.variantTitle) ? metric.variantTitle : null;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init, headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as { error?: string }).error || "Er ging iets mis.");
  return data as T;
}

// ── Small parts ─────────────────────────────────────────────────────────────

function Pill({ tone, children }: { tone: "danger" | "warning" | "success" | "neutral"; children: ReactNode }) {
  return <span className={`inv-pill ${tone}`}>{children}</span>;
}

function Tile({ label, value, detail, tone, active, onClick, icon }: { label: string; value: string; detail: string; tone: "danger" | "warning" | "success" | "neutral"; active: boolean; onClick: () => void; icon: ReactNode }) {
  return (
    <button type="button" className={`inv-tile ${tone}${active ? " active" : ""}`} onClick={onClick} aria-pressed={active}>
      <span className="inv-tile-label">{icon}{label}</span>
      <strong>{value}</strong>
      <span className="inv-tile-detail">{detail}</span>
    </button>
  );
}

function Bar({ value }: { value: number | null }) {
  return <span className="inv-bar" aria-hidden><span style={{ width: `${Math.round((value ?? 0) * 100)}%` }} /></span>;
}

// ── Overview ────────────────────────────────────────────────────────────────

function VariantRow({ metric, nl, settings, format }: { metric: VariantMetrics; nl: boolean; settings: Settings; format: ReturnType<typeof useFormat> }) {
  const [open, setOpen] = useState(false);
  const options = optionsText(metric);
  const advice = metric.recommendedOrder > 0
    ? <span className="inv-advice buy">{nl ? `Bestel ${metric.recommendedOrder}` : `Order ${metric.recommendedOrder}`}</span>
    : metric.status === "dead" || metric.status === "slow"
      ? <span className="inv-advice stop">{nl ? "Niet bijkopen" : "Do not reorder"}</span>
      : <span className="inv-advice">–</span>;
  const demand = settings.leadTimeDays + settings.coverWeeks * 7;
  return (
    <>
      <tr className={open ? "open" : ""}>
        <td>
          <button type="button" className="inv-variant" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
            <ChevronDown size={14} className="inv-chevron" aria-hidden />
            <span>
              <strong>{metric.productTitle}</strong>
              {options ? <span className="inv-options">{options}</span> : null}
              <span className="inv-code">{metric.sku ?? metric.ean ?? ""}</span>
            </span>
          </button>
        </td>
        <td><Pill tone={STATUS_TONE[metric.status]}>{statusLabel(metric.status, nl)}</Pill></td>
        <td className="num">{metric.stock == null ? "–" : format.number(metric.stock)}{metric.incoming ? <span className="inv-sub">+{metric.incoming}</span> : null}</td>
        <td className="num">{format.number(metric.sold30)}<span className="inv-sub">{format.number(metric.sold90)}</span></td>
        <td className="num">{format.number(metric.velocityPerWeek, 1)}</td>
        <td className="num">{metric.daysOfStock == null ? (metric.stock && metric.stock > 0 ? "∞" : "–") : format.number(metric.daysOfStock)}</td>
        <td>{advice}</td>
      </tr>
      {open ? (
        <tr className="inv-detail-row">
          <td colSpan={7}>
            <div className="inv-detail">
              <div>
                <span className="inv-eyebrow">{nl ? "Verkoop" : "Sales"}</span>
                <p>{nl ? `${metric.sold7} in 7 dagen, ${metric.sold30} in 30, ${metric.sold90} in 90, ${metric.sold365} in een jaar.` : `${metric.sold7} in 7 days, ${metric.sold30} in 30, ${metric.sold90} in 90, ${metric.sold365} in a year.`}</p>
                <p>{metric.lastSaleDay ? (nl ? `Laatst verkocht op ${format.day(metric.lastSaleDay)}.` : `Last sold on ${format.day(metric.lastSaleDay)}.`) : (nl ? "Nog nooit verkocht sinds we meten." : "Not sold since we started measuring.")}</p>
                <p>{nl ? "Kanalen" : "Channels"}: {metric.channels.map(channelLabel).join(", ") || "–"}</p>
              </div>
              <div>
                <span className="inv-eyebrow">{nl ? "Zo komt het advies tot stand" : "How the advice is calculated"}</span>
                <p>
                  {nl
                    ? `Tempo: ${format.number(metric.velocityPerWeek, 1)} per week (${metric.velocityBasis === "product_curve" ? "aandeel in de verkoop van het hele product, want deze variant verkocht weinig" : metric.velocityBasis === "long_window" ? "laatste 90 dagen, want de afgelopen weken was hij vaak op" : `laatste 8 weken, ${metric.inStockDays} dagen op voorraad`}).`
                    : `Speed: ${format.number(metric.velocityPerWeek, 1)} a week (${metric.velocityBasis === "product_curve" ? "its share of the whole product's sales, as this variant sold little" : metric.velocityBasis === "long_window" ? "last 90 days, as it was often sold out lately" : `last 8 weeks, ${metric.inStockDays} days in stock`}).`}
                </p>
                <p>
                  {nl
                    ? `Nodig voor ${settings.leadTimeDays} dagen levertijd + ${settings.coverWeeks} weken: ${format.number((metric.velocityPerWeek / 7) * demand * metric.seasonFactor, 0)} stuks${metric.seasonFactor !== 1 ? ` (seizoen ×${format.number(metric.seasonFactor, 2)})` : ""}, +${Math.round(settings.safetyBuffer * 100)}% buffer, min ${Math.max(0, metric.stock ?? 0)} op voorraad${metric.incoming ? ` en ${metric.incoming} onderweg` : ""} = ${metric.recommendedOrder}.`
                    : `Needed for ${settings.leadTimeDays} days lead time + ${settings.coverWeeks} weeks: ${format.number((metric.velocityPerWeek / 7) * demand * metric.seasonFactor, 0)} units${metric.seasonFactor !== 1 ? ` (season ×${format.number(metric.seasonFactor, 2)})` : ""}, +${Math.round(settings.safetyBuffer * 100)}% buffer, minus ${Math.max(0, metric.stock ?? 0)} in stock${metric.incoming ? ` and ${metric.incoming} incoming` : ""} = ${metric.recommendedOrder}.`}
                </p>
                {metric.stockValue != null ? <p>{nl ? "Waarde voorraad" : "Stock value"}: {format.money(metric.stockValue)} ({metric.stockValueBasis === "cost" ? (nl ? "inkoopprijs" : "cost price") : (nl ? "verkoopprijs, inkoopprijs onbekend" : "sales price, cost unknown")})</p> : null}
                {metric.returns.units ? <p>{nl ? `${metric.returns.units} retour` : `${metric.returns.units} returned`}{metric.returns.topReason ? `, ${nl ? "vooral" : "mostly"} "${metric.returns.topReason}"` : ""}.</p> : null}
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function Overview({ view, nl, filter, setFilter, search, setSearch, channel, setChannel, page, setPage, loading }: {
  view: InventoryView; nl: boolean; filter: Filter; setFilter: (filter: Filter) => void; search: string; setSearch: (value: string) => void;
  channel: string; setChannel: (value: string) => void; page: number; setPage: (page: number) => void; loading: boolean;
}) {
  const format = useFormat(nl);
  const { summary } = view;
  const filters: Array<[Filter, string]> = [
    ["attention", nl ? "Aandacht nodig" : "Needs attention"],
    ["to_order", nl ? "Bijbestellen" : "To reorder"],
    ["dead", nl ? "Dode voorraad" : "Dead stock"],
    ["low", nl ? "Bijna op" : "Running low"],
    ["out_of_stock", nl ? "Uitverkocht" : "Sold out"],
    ["healthy", nl ? "Gezond" : "Healthy"],
    ["all", nl ? "Alles" : "All"],
  ];
  const pages = Math.max(1, Math.ceil(view.variants.total / PAGE_SIZE));
  return (
    <>
      <div className="inv-tiles">
        <Tile icon={<PackageX size={14} />} tone="danger" active={filter === "dead"} onClick={() => setFilter("dead")} label={nl ? "Dode voorraad" : "Dead stock"}
          value={format.money(summary.deadStockValue)} detail={nl ? `${summary.deadVariants} varianten, ${format.number(summary.deadStockUnits)} stuks` : `${summary.deadVariants} variants, ${format.number(summary.deadStockUnits)} units`} />
        <Tile icon={<AlertTriangle size={14} />} tone="warning" active={filter === "low"} onClick={() => setFilter("low")} label={nl ? "Bijna op" : "Running low"}
          value={format.number(summary.lowVariants)} detail={nl ? `op binnen ${view.settings.leadTimeDays + 7} dagen` : `out within ${view.settings.leadTimeDays + 7} days`} />
        <Tile icon={<AlertTriangle size={14} />} tone="danger" active={filter === "out_of_stock"} onClick={() => setFilter("out_of_stock")} label={nl ? "Uitverkocht" : "Sold out"}
          value={format.number(summary.outOfStockVariants)} detail={nl ? "en wel vraag naar" : "while people buy them"} />
        <Tile icon={<ShoppingCart size={14} />} tone="success" active={filter === "to_order"} onClick={() => setFilter("to_order")} label={nl ? "Bijbestellen" : "To reorder"}
          value={format.number(summary.toOrderUnits)} detail={nl ? `stuks over ${summary.toOrderVariants} varianten` : `units across ${summary.toOrderVariants} variants`} />
      </div>

      <section className="inv-card">
        <header className="inv-card-head">
          <div><h2>{nl ? "Deze week doen" : "To do this week"}</h2><p>{nl ? "Gesorteerd op het geld dat erom draait." : "Sorted by the money at stake."}</p></div>
        </header>
        {view.actions.length ? (
          <ol className="inv-actions">
            {view.actions.map((action) => (
              <li key={`${action.kind}-${action.variantKey}`} className={action.kind}>
                <strong>{action.title}</strong>
                <p>{action.text}</p>
              </li>
            ))}
          </ol>
        ) : <p className="inv-empty-text">{nl ? "Niets dringends: je voorraad loopt in de pas met de verkoop." : "Nothing urgent: your stock is in line with sales."}</p>}
      </section>

      <section className="inv-card">
        <header className="inv-card-head">
          <div><h2>{nl ? "Alle varianten" : "All variants"}</h2><p>{nl ? `${format.number(view.summary.variants)} varianten. Klik op een regel voor de berekening.` : `${format.number(view.summary.variants)} variants. Click a row to see the calculation.`}</p></div>
        </header>
        <div className="inv-toolbar">
          <div className="inv-filters" role="tablist">
            {filters.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={filter === key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>{label}</button>)}
          </div>
          <div className="inv-search">
            <Search size={14} aria-hidden />
            <input id="inventory-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={nl ? "Zoek product, maat, kleur, SKU" : "Search product, size, colour, SKU"} aria-label={nl ? "Zoeken" : "Search"} />
          </div>
          {view.channels.length > 1 ? (
            <select id="inventory-channel" className="settings-control inv-select" value={channel} onChange={(event) => setChannel(event.target.value)} aria-label={nl ? "Kanaal" : "Channel"}>
              <option value="">{nl ? "Alle kanalen" : "All channels"}</option>
              {view.channels.map((item) => <option key={item} value={item}>{channelLabel(item)}</option>)}
            </select>
          ) : null}
        </div>
        <div className={`inv-table-wrap${loading ? " loading" : ""}`}>
          <table className="inv-table">
            <thead>
              <tr>
                <th>{nl ? "Variant" : "Variant"}</th>
                <th>Status</th>
                <th className="num">{nl ? "Voorraad" : "Stock"}</th>
                <th className="num">{nl ? "Verkocht 30 / 90 d" : "Sold 30 / 90 d"}</th>
                <th className="num">{nl ? "Per week" : "Per week"}</th>
                <th className="num">{nl ? "Dagen voorraad" : "Days of stock"}</th>
                <th>{nl ? "Advies" : "Advice"}</th>
              </tr>
            </thead>
            <tbody>
              {view.variants.rows.map((metric) => <VariantRow key={metric.variantKey} metric={metric} nl={nl} settings={view.settings} format={format} />)}
              {!view.variants.rows.length ? <tr><td colSpan={7} className="inv-empty-text">{nl ? "Geen varianten in deze selectie." : "No variants in this selection."}</td></tr> : null}
            </tbody>
          </table>
        </div>
        {pages > 1 ? (
          <div className="inv-pager">
            <button type="button" className="settings-btn" disabled={page === 0} onClick={() => setPage(page - 1)}>{nl ? "Vorige" : "Previous"}</button>
            <span>{nl ? `Pagina ${page + 1} van ${pages}` : `Page ${page + 1} of ${pages}`}</span>
            <button type="button" className="settings-btn" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>{nl ? "Volgende" : "Next"}</button>
          </div>
        ) : null}
      </section>
    </>
  );
}

// ── Season ──────────────────────────────────────────────────────────────────

function nextQuarter(today: string) {
  const [year, month] = today.split("-").map(Number);
  const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 4;
  const startYear = quarterStartMonth > 12 ? year + 1 : year;
  const startMonth = quarterStartMonth > 12 ? 1 : quarterStartMonth;
  const end = new Date(Date.UTC(startYear, startMonth + 2, 0));
  return { from: `${startYear}-${String(startMonth).padStart(2, "0")}-01`, to: end.toISOString().slice(0, 10) };
}

function SeasonTab({ view, nl, demoSeason }: { view: InventoryView; nl: boolean; demoSeason?: Season }) {
  const format = useFormat(nl);
  const initial = nextQuarter(view.today);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [season, setSeason] = useState<Season | null>(demoSeason ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (demoSeason) return;
    setBusy(true);
    setError(null);
    try {
      setSeason(await api<Season>(`/api/inventory/season?from=${from}&to=${to}`));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Er ging iets mis.");
    } finally {
      setBusy(false);
    }
  }, [from, to, demoSeason]);
  useEffect(() => { void load(); }, [load]);

  const list = (rows: Array<{ key: string; label: string; units: number; extra?: string }>, empty: string) => rows.length
    ? <ol className="inv-rank">{rows.map((row) => <li key={row.key}><span>{row.label}</span><strong>{format.number(row.units)}</strong>{row.extra ? <em>{row.extra}</em> : null}</li>)}</ol>
    : <p className="inv-empty-text">{empty}</p>;

  return (
    <section className="inv-card">
      <header className="inv-card-head">
        <div>
          <h2>{nl ? "Inkopen voor een seizoen" : "Buying for a season"}</h2>
          <p>{nl ? "Kies de periode waarvoor je inkoopt. Je ziet wat er in dezelfde periode vorig jaar verkocht is." : "Pick the period you are buying for. You see what sold in the same period last year."}</p>
        </div>
      </header>
      <div className="inv-season-form">
        <label htmlFor="season-from">{nl ? "Van" : "From"}<input id="season-from" type="date" className="settings-control" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label htmlFor="season-to">{nl ? "Tot en met" : "Until"}<input id="season-to" type="date" className="settings-control" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        {busy ? <Loader2 size={16} className="settings-spin" aria-label={nl ? "Laden" : "Loading"} /> : null}
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {season && !season.hasHistory ? (
        <Notice tone="info" title={nl ? "Nog geen verkoop van vorig jaar" : "No sales from last year yet"}>
          {nl
            ? `We hebben geen verkopen tussen ${format.day(season.from)} en ${format.day(season.to)}. Importeer je verkoopgeschiedenis onder Leveringen en import om dit te vullen.`
            : `We have no sales between ${format.day(season.from)} and ${format.day(season.to)}. Import your sales history under Deliveries and import to fill this in.`}
        </Notice>
      ) : null}
      {season?.hasHistory ? (
        <>
          <p className="inv-season-total">{nl ? `${format.day(season.from)} tot ${format.day(season.to)}: ${format.number(season.totalUnits)} stuks verkocht.` : `${format.day(season.from)} to ${format.day(season.to)}: ${format.number(season.totalUnits)} units sold.`}</p>
          <div className="inv-season-grid">
            <div><h3>{nl ? "Beste producten" : "Best products"}</h3>{list(season.topProducts.map((row) => ({ key: row.productTitle, label: row.productTitle, units: row.units, extra: row.revenue ? format.money(row.revenue) : undefined })), "–")}</div>
            <div><h3>{nl ? "Beste varianten" : "Best variants"}</h3>{list(season.topVariants.map((row) => ({ key: row.variantKey, label: row.label, units: row.units })), "–")}</div>
            <div><h3>{nl ? "Liep slecht, wel op voorraad" : "Sold poorly, still in stock"}</h3>{list(season.weakVariants.map((row) => ({ key: row.variantKey, label: row.label, units: row.units, extra: row.stock != null ? (nl ? `${row.stock} op voorraad` : `${row.stock} in stock`) : undefined })), "–")}</div>
          </div>
        </>
      ) : null}
    </section>
  );
}

// ── Deliveries and import ───────────────────────────────────────────────────

function DeliveriesTab({ view, nl, onChanged }: { view: InventoryView; nl: boolean; onChanged: () => void }) {
  const format = useFormat(nl);
  const [code, setCode] = useState("");
  const [day, setDay] = useState(view.today);
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [kind, setKind] = useState<"sales" | "deliveries">("sales");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string; details?: string[] } | null>(null);

  async function addDelivery() {
    setBusy("add");
    setMessage(null);
    try {
      await api("/api/inventory/deliveries", { method: "POST", body: JSON.stringify({ code, day, quantity: Number(quantity), note }) });
      setCode(""); setQuantity(""); setNote("");
      setMessage({ tone: "success", text: nl ? "Levering opgeslagen." : "Delivery saved." });
      onChanged();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Er ging iets mis." });
    } finally {
      setBusy(null);
    }
  }

  async function removeDelivery(id: string) {
    setBusy(id);
    try {
      await api(`/api/inventory/deliveries?id=${id}`, { method: "DELETE" });
      onChanged();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Er ging iets mis." });
    } finally {
      setBusy(null);
    }
  }

  async function upload(file: File) {
    setBusy("import");
    setMessage(null);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error(nl ? "Het bestand is groter dan 5 MB." : "The file is larger than 5 MB.");
      const result = await api<{ rows: number; variants: number; errors: string[] }>("/api/inventory/import", { method: "POST", body: JSON.stringify({ kind, csv: await file.text() }) });
      setMessage({
        tone: "success",
        text: nl ? `${result.rows} regels ingelezen voor ${result.variants} varianten.` : `${result.rows} rows read for ${result.variants} variants.`,
        details: result.errors.length ? result.errors.slice(0, 5) : undefined,
      });
      onChanged();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Er ging iets mis." });
    } finally {
      setBusy(null);
    }
  }

  const sourceLabel = (source: string) => source === "detected" ? (nl ? "Herkend" : "Detected") : source === "manual" ? (nl ? "Ingevoerd" : "Entered") : "Import";

  return (
    <>
      <section className="inv-card">
        <header className="inv-card-head">
          <div><h2>{nl ? "Leveringen" : "Deliveries"}</h2><p>{nl ? "Hoeveel van elke levering verkocht is na 30, 60 en 90 dagen. Leveringen herkennen we aan sprongen in de voorraad; je kunt ze ook zelf invoeren." : "How much of each delivery sold after 30, 60 and 90 days. We recognise deliveries from jumps in stock; you can also enter them yourself."}</p></div>
        </header>
        {view.deliveries.length ? (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>{nl ? "Variant" : "Variant"}</th><th>{nl ? "Datum" : "Date"}</th><th className="num">{nl ? "Aantal" : "Quantity"}</th><th>30 d</th><th>60 d</th><th>90 d</th><th>{nl ? "Bron" : "Source"}</th><th /></tr></thead>
              <tbody>
                {view.deliveries.map((delivery) => (
                  <tr key={delivery.id}>
                    <td><strong className="inv-cell-title">{delivery.label}</strong>{delivery.note ? <span className="inv-options">{delivery.note}</span> : null}</td>
                    <td>{format.day(delivery.day)}{delivery.upcoming ? <span className="inv-sub">{nl ? "onderweg" : "on its way"}</span> : null}</td>
                    <td className="num">{format.number(delivery.quantity)}</td>
                    {[delivery.after30, delivery.after60, delivery.after90].map((value, index) => <td key={index} className="inv-through"><Bar value={value} />{format.percent(value)}</td>)}
                    <td>{sourceLabel(delivery.source)}</td>
                    <td>{view.canManage && delivery.source !== "detected" ? <button type="button" className="settings-btn ghost" disabled={busy === delivery.id} onClick={() => void removeDelivery(delivery.id)}>{nl ? "Verwijderen" : "Remove"}</button> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="inv-empty-text">{nl ? "Nog geen leveringen. Zodra de voorraad dagelijks gemeten wordt, verschijnen ze hier vanzelf." : "No deliveries yet. Once stock is measured daily, they appear here by themselves."}</p>}
      </section>

      {view.canManage ? (
        <div className="inv-two">
          <section className="inv-card">
            <header className="inv-card-head"><div><h2>{nl ? "Levering invoeren" : "Enter a delivery"}</h2><p>{nl ? "Een datum in de toekomst telt als onderweg en gaat af van het advies." : "A future date counts as on its way and is taken off the advice."}</p></div></header>
            <div className="inv-form">
              <label htmlFor="delivery-code">SKU {nl ? "of" : "or"} EAN<input id="delivery-code" className="settings-control" value={code} onChange={(event) => setCode(event.target.value)} placeholder="C-37-GROEN" /></label>
              <label htmlFor="delivery-day">{nl ? "Datum" : "Date"}<input id="delivery-day" type="date" className="settings-control" value={day} onChange={(event) => setDay(event.target.value)} /></label>
              <label htmlFor="delivery-quantity">{nl ? "Aantal" : "Quantity"}<input id="delivery-quantity" type="number" min={1} className="settings-control" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
              <label htmlFor="delivery-note">{nl ? "Notitie (optioneel)" : "Note (optional)"}<input id="delivery-note" className="settings-control" value={note} maxLength={200} onChange={(event) => setNote(event.target.value)} placeholder={nl ? "Leverancier, ordernummer" : "Supplier, order number"} /></label>
              <button type="button" className="settings-btn primary" disabled={busy === "add" || !code.trim() || !quantity} onClick={() => void addDelivery()}><Truck size={14} />{nl ? "Opslaan" : "Save"}</button>
            </div>
          </section>
          <section className="inv-card">
            <header className="inv-card-head"><div><h2>{nl ? "Importeren" : "Import"}</h2><p>{nl ? "Haal oude verkopen binnen voor de seizoensvergelijking, of een lijst met leveringen. CSV met komma of puntkomma." : "Bring in older sales for the season comparison, or a list of deliveries. CSV with comma or semicolon."}</p></div></header>
            <div className="inv-form">
              <div className="inv-segment" role="radiogroup" aria-label={nl ? "Soort import" : "Import type"}>
                <button type="button" role="radio" aria-checked={kind === "sales"} className={kind === "sales" ? "active" : ""} onClick={() => setKind("sales")}>{nl ? "Verkoopgeschiedenis" : "Sales history"}</button>
                <button type="button" role="radio" aria-checked={kind === "deliveries"} className={kind === "deliveries" ? "active" : ""} onClick={() => setKind("deliveries")}>{nl ? "Leveringen" : "Deliveries"}</button>
              </div>
              <code className="inv-format">{kind === "sales" ? "datum;sku;aantal;omzet" : "datum;sku;aantal;inkoopprijs"}<br />{kind === "sales" ? "2025-11-03;C-37-GROEN;4;119,80" : "2026-09-15;C-37-GROEN;60;12,50"}</code>
              <p className="settings-hint">{nl ? "EAN mag in plaats van SKU. Datum als 2025-11-03 of 03-11-2025. Opnieuw importeren vervangt dezelfde dagen." : "EAN may replace SKU. Date as 2025-11-03 or 03-11-2025. Importing again replaces the same days."}</p>
              <label className={`settings-btn${busy === "import" ? " disabled" : ""}`} htmlFor="inventory-file">
                {busy === "import" ? <Loader2 size={14} className="settings-spin" /> : <Upload size={14} />}{nl ? "Kies CSV-bestand" : "Choose CSV file"}
              </label>
              <input id="inventory-file" type="file" accept=".csv,text/csv" hidden disabled={busy === "import"} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} />
            </div>
          </section>
        </div>
      ) : null}
      {message ? (
        <Notice tone={message.tone} onClose={() => setMessage(null)}>
          {message.text}{message.details ? <>{" "}{nl ? "Overgeslagen:" : "Skipped:"} {message.details.join(" ")}</> : null}
        </Notice>
      ) : null}
    </>
  );
}

// ── Settings ────────────────────────────────────────────────────────────────

function SettingsTab({ view, nl, onSaved }: { view: InventoryView; nl: boolean; onSaved: () => void }) {
  const [form, setForm] = useState({
    leadTimeDays: String(view.settings.leadTimeDays),
    coverWeeks: String(view.settings.coverWeeks),
    safetyBuffer: String(Math.round(view.settings.safetyBuffer * 100)),
    deadAfterDays: String(view.settings.deadAfterDays),
    deadCoverWeeks: String(view.settings.deadCoverWeeks),
  });
  const [weeklyEmail, setWeeklyEmail] = useState(view.sync.weeklyEmail);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function save(body: Record<string, unknown>) {
    setBusy(true);
    setMessage(null);
    try {
      await api("/api/inventory/settings", { method: "PATCH", body: JSON.stringify(body) });
      setMessage({ tone: "success", text: nl ? "Opgeslagen. Het advies is opnieuw berekend." : "Saved. The advice was recalculated." });
      onSaved();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Er ging iets mis." });
    } finally {
      setBusy(false);
    }
  }

  const fields: Array<[keyof typeof form, string, string]> = [
    ["leadTimeDays", nl ? "Levertijd (dagen)" : "Lead time (days)", nl ? "Van bestellen tot binnen in je magazijn." : "From ordering to arriving in your warehouse."],
    ["coverWeeks", nl ? "Weken voorraad per levering" : "Weeks of stock per delivery", nl ? "Hoe lang een levering moet meegaan." : "How long a delivery should last."],
    ["safetyBuffer", nl ? "Buffer (%)" : "Buffer (%)", nl ? "Extra bovenop de verwachte verkoop." : "Extra on top of expected sales."],
    ["deadAfterDays", nl ? "Dood na (dagen zonder verkoop)" : "Dead after (days without a sale)", nl ? "Geen enkele verkoop in deze periode." : "Not a single sale in this period."],
    ["deadCoverWeeks", nl ? "Of meer dan (weken voorraad)" : "Or more than (weeks of stock)", nl ? "Genoeg voorraad voor langer dan dit." : "Enough stock for longer than this."],
  ];

  return (
    <div className="inv-two">
      <section className="inv-card">
        <header className="inv-card-head"><div><h2>{nl ? "Hoe je inkoopt" : "How you buy"}</h2><p>{nl ? "Het advies rekent met deze waarden." : "The advice uses these values."}</p></div></header>
        <div className="inv-form">
          {fields.map(([key, label, hint]) => (
            <label key={key} htmlFor={`setting-${key}`}>{label}
              <input id={`setting-${key}`} type="number" className="settings-control" value={form[key]} disabled={!view.canManage} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
              <span className="settings-hint">{hint}</span>
            </label>
          ))}
          {view.canManage ? (
            <button type="button" className="settings-btn primary" disabled={busy} onClick={() => void save({
              leadTimeDays: Number(form.leadTimeDays), coverWeeks: Number(form.coverWeeks), safetyBuffer: Number(form.safetyBuffer) / 100,
              deadAfterDays: Number(form.deadAfterDays), deadCoverWeeks: Number(form.deadCoverWeeks),
            })}>{busy ? <Loader2 size={14} className="settings-spin" /> : null}{nl ? "Opslaan" : "Save"}</button>
          ) : null}
        </div>
      </section>
      <section className="inv-card">
        <header className="inv-card-head"><div><h2>{nl ? "Wekelijkse mail" : "Weekly email"}</h2><p>{nl ? "Elke maandagochtend de acties van de week in je inbox, naar alle beheerders." : "Every Monday morning the week's actions in your inbox, to all admins."}</p></div></header>
        <div className="inv-form">
          <div className="inv-toggle-row">
            <span>{weeklyEmail ? (nl ? "Aan" : "On") : (nl ? "Uit" : "Off")}</span>
            <Toggle checked={weeklyEmail} disabled={!view.canManage || busy} label={nl ? "Wekelijkse mail" : "Weekly email"} onChange={() => { const next = !weeklyEmail; setWeeklyEmail(next); void save({ weeklyEmail: next }); }} />
          </div>
        </div>
      </section>
      {message ? <Notice tone={message.tone} onClose={() => setMessage(null)}>{message.text}</Notice> : null}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function InventoryClient({ demo }: { demo?: { view: InventoryView; season: Season } } = {}) {
  const { language } = useTranslation();
  const nl = language === "nl";
  const format = useFormat(nl);
  const [tab, setTab] = useState<Tab>("overview");
  const [filter, setFilter] = useState<Filter>("attention");
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("");
  const [page, setPage] = useState(0);
  const [view, setView] = useState<InventoryView | null>(demo?.view ?? null);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [reload, setReload] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => { setPage(0); }, [filter, debouncedSearch, channel]);

  useEffect(() => {
    if (demo) return;
    let active = true;
    setLoading(true);
    const params = new URLSearchParams({ status: filter, search: debouncedSearch, offset: String(page * PAGE_SIZE), limit: String(PAGE_SIZE), lang: language });
    if (channel) params.set("channel", channel);
    api<InventoryView>(`/api/inventory?${params}`)
      .then((data) => { if (active) { setView(data); setError(null); } })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "Er ging iets mis."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [demo, filter, debouncedSearch, channel, page, language, reload]);

  async function syncNow() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await api<{ connections: Array<{ provider: string; variants: number; skipped?: string; error?: string }> }>("/api/inventory/sync", { method: "POST" });
      const problems = result.connections.filter((item) => item.error || item.skipped);
      setSyncMessage({
        tone: problems.length ? "error" : "success",
        text: problems.length
          ? problems.map((item) => `${channelLabel(item.provider)}: ${item.skipped === "no_product_access" ? (nl ? "geef in Shopify toegang tot producten en voorraad" : "grant access to products and stock in Shopify") : item.error}`).join(" · ")
          : (nl ? `Bijgewerkt: ${result.connections.reduce((sum, item) => sum + item.variants, 0)} varianten.` : `Updated: ${result.connections.reduce((sum, item) => sum + item.variants, 0)} variants.`),
      });
      setReload((value) => value + 1);
    } catch (syncError) {
      setSyncMessage({ tone: "error", text: syncError instanceof Error ? syncError.message : "Er ging iets mis." });
    } finally {
      setSyncing(false);
    }
  }

  const tabs: Array<[Tab, string, ReactNode]> = [
    ["overview", nl ? "Overzicht" : "Overview", <ShoppingCart key="o" size={14} />],
    ["season", nl ? "Seizoen" : "Season", <CalendarRange key="s" size={14} />],
    ["deliveries", nl ? "Leveringen en import" : "Deliveries and import", <ArrowDownToLine key="d" size={14} />],
    ["settings", nl ? "Instellingen" : "Settings", <RefreshCw key="i" size={14} />],
  ];
  const empty = view && view.summary.variants === 0;

  return (
    <div className="inv-page">
      <SettingsStyles />
      <style>{INVENTORY_CSS}</style>
      <header className="inv-heading">
        <div>
          <h1>{nl ? "Voorraad en inkoop" : "Stock and buying"}</h1>
          <p>{nl ? "Wat er per maat en kleur verkoopt, wat stil ligt en wat je bijbestelt. Berekend uit je verkoop en voorraad van alle kanalen." : "What sells per size and colour, what sits still and what to reorder. Calculated from sales and stock across all channels."}</p>
        </div>
        <div className="inv-heading-side">
          {view?.sync.lastSyncedAt ? <span className="inv-synced">{nl ? "Bijgewerkt" : "Updated"} {format.moment(view.sync.lastSyncedAt)}</span> : null}
          {view?.canManage ? (
            <button type="button" className="settings-btn" disabled={syncing || Boolean(demo)} onClick={() => void syncNow()}>
              {syncing ? <Loader2 size={14} className="settings-spin" /> : <RefreshCw size={14} />}{nl ? "Nu bijwerken" : "Update now"}
            </button>
          ) : null}
        </div>
      </header>

      {syncMessage ? <Notice tone={syncMessage.tone} onClose={() => setSyncMessage(null)}>{syncMessage.text}</Notice> : null}
      {view?.sync.lastSyncError && !syncMessage ? <Notice tone="warning" title={nl ? "Niet alles kon worden bijgewerkt" : "Not everything could be updated"}>{view.sync.lastSyncError}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      {!view && loading ? <div className="inv-loading"><Loader2 size={18} className="settings-spin" />{nl ? "Voorraad laden…" : "Loading stock…"}</div> : null}

      {view && empty ? (
        <section className="inv-card inv-empty">
          <h2>{nl ? "Nog geen producten" : "No products yet"}</h2>
          <p>{nl ? "Koppel je webshop of bol.com, of importeer je verkoop, en klik op Nu bijwerken. Daarna verschijnen hier je varianten met advies." : "Connect your shop or bol.com, or import your sales, and click Update now. Your variants and advice then appear here."}</p>
          <div className="settings-actions">
            <Link href="/integrations" className="settings-btn primary">{nl ? "Naar koppelingen" : "Go to connections"}</Link>
            <button type="button" className="settings-btn" onClick={() => setTab("deliveries")}>{nl ? "Verkoop importeren" : "Import sales"}</button>
          </div>
        </section>
      ) : null}

      {view ? (
        <>
          <nav className="inv-tabs" role="tablist">
            {tabs.map(([key, label, icon]) => <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{icon}{label}</button>)}
          </nav>
          {tab === "overview" && !empty ? <Overview view={view} nl={nl} filter={filter} setFilter={setFilter} search={search} setSearch={setSearch} channel={channel} setChannel={setChannel} page={page} setPage={setPage} loading={loading} /> : null}
          {tab === "season" ? <SeasonTab view={view} nl={nl} demoSeason={demo?.season} /> : null}
          {tab === "deliveries" ? <DeliveriesTab view={view} nl={nl} onChanged={() => setReload((value) => value + 1)} /> : null}
          {tab === "settings" ? <SettingsTab view={view} nl={nl} onSaved={() => setReload((value) => value + 1)} /> : null}
          {view.historyFrom ? <p className="inv-footnote">{nl ? `Verkoopgegevens vanaf ${format.day(view.historyFrom)}. Hoe langer we meten, hoe beter het seizoensadvies.` : `Sales data from ${format.day(view.historyFrom)}. The longer we measure, the better the season advice.`}</p> : null}
        </>
      ) : null}
    </div>
  );
}

const INVENTORY_CSS = `
.inv-page{width:min(100%,1180px);margin:0 auto;padding:40px 24px 64px;display:grid;gap:18px}
.inv-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap}
.inv-heading h1{margin:0;color:var(--text);font-size:30px;font-weight:500;letter-spacing:-.02em}
.inv-heading p{max-width:640px;margin:8px 0 0;color:var(--muted);font-size:14px;line-height:1.6}
.inv-heading-side{display:flex;align-items:center;gap:12px}
.inv-synced{color:var(--muted);font-size:12px}
.inv-loading{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:13px;padding:30px 0}
.inv-tabs{display:flex;gap:4px;padding:4px;border:1px solid var(--border);border-radius:14px;background:var(--surface);overflow-x:auto}
.inv-tabs button{display:inline-flex;align-items:center;gap:7px;height:38px;padding:0 14px;border:0;border-radius:10px;background:transparent;color:var(--muted);font:500 13px inherit;white-space:nowrap;cursor:pointer}
.inv-tabs button.active{background:rgba(199,245,111,.1);color:var(--tone-success);box-shadow:inset 0 0 0 1px rgba(199,245,111,.22)}
.inv-tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.inv-tile{display:grid;gap:6px;text-align:left;padding:16px;border:1px solid var(--border);border-radius:16px;background:var(--surface);color:var(--text);cursor:pointer;font:inherit;transition:border-color .15s}
.inv-tile:hover,.inv-tile.active{border-color:color-mix(in srgb,currentColor 0%,#c7f56f 60%)}
.inv-tile-label{display:inline-flex;align-items:center;gap:6px;color:var(--muted);font-size:12px;font-weight:600}
.inv-tile.danger .inv-tile-label svg{color:var(--tone-danger)}.inv-tile.warning .inv-tile-label svg{color:#e0ad3d}.inv-tile.success .inv-tile-label svg{color:var(--tone-success)}
.inv-tile strong{font-size:26px;font-weight:500;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.inv-tile-detail{color:var(--muted);font-size:12px}
.inv-card{display:grid;gap:14px;padding:18px 20px;border:1px solid var(--border);border-radius:20px;background:var(--surface);min-width:0}
.inv-card-head{display:flex;justify-content:space-between;gap:16px}
.inv-card-head h2{margin:0;color:var(--text);font-size:16px;font-weight:500}
.inv-card-head p{margin:4px 0 0;color:var(--muted);font-size:13px;line-height:1.5;max-width:720px}
.inv-actions{display:grid;gap:8px;margin:0;padding:0;list-style:none}
.inv-actions li{display:grid;gap:3px;padding:11px 14px;border:1px solid var(--border);border-left:3px solid var(--border);border-radius:10px;background:var(--bg)}
.inv-actions li.stop_buying{border-left-color:var(--tone-danger)}.inv-actions li.restock_sold_out{border-left-color:var(--tone-danger)}.inv-actions li.reorder_now{border-left-color:#e0ad3d}.inv-actions li.season_up{border-left-color:#c7f56f}
.inv-actions strong{color:var(--text);font-size:13px;font-weight:600}
.inv-actions p{margin:0;color:var(--muted);font-size:13px;line-height:1.5}
.inv-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.inv-filters{display:flex;gap:4px;flex-wrap:wrap}
.inv-filters button{height:32px;padding:0 11px;border:1px solid var(--border);border-radius:999px;background:transparent;color:var(--muted);font:500 12px inherit;cursor:pointer}
.inv-filters button.active{border-color:#c7f56f;color:var(--text);background:rgba(199,245,111,.1)}
.inv-search{display:flex;align-items:center;gap:7px;flex:1;min-width:200px;height:36px;padding:0 11px;border:1px solid var(--border);border-radius:10px;background:var(--bg);color:var(--muted)}
.inv-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--text);font:500 13px inherit}
.inv-select{width:auto;min-height:36px}
.inv-table-wrap{overflow-x:auto;border:1px solid var(--border);border-radius:12px;transition:opacity .15s}
.inv-table-wrap.loading{opacity:.55}
.inv-table{width:100%;border-collapse:collapse;font-size:13px;min-width:760px}
.inv-table th{position:sticky;top:0;padding:10px 12px;border-bottom:1px solid var(--border);background:var(--surface);color:var(--muted);font-size:11px;font-weight:600;text-align:left;letter-spacing:.03em;text-transform:uppercase;white-space:nowrap}
.inv-table td{padding:10px 12px;border-bottom:1px solid var(--border);color:var(--text);vertical-align:middle}
.inv-table tr:last-child td{border-bottom:0}
.inv-table .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.inv-sub{display:block;color:var(--muted);font-size:11px}
.inv-variant{display:flex;align-items:flex-start;gap:8px;padding:0;border:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.inv-variant strong,.inv-cell-title{display:block;font-weight:600}
.inv-chevron{margin-top:3px;color:var(--muted);transition:transform .15s;flex:none}
tr.open .inv-chevron{transform:rotate(180deg)}
.inv-options{display:block;color:var(--muted);font-size:12px}
.inv-code{display:block;color:var(--muted);font-size:11px;font-family:ui-monospace,Menlo,monospace}
.inv-pill{display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:600;white-space:nowrap;background:var(--bg);color:var(--muted)}
.inv-pill:before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
.inv-pill.danger{color:var(--tone-danger);background:rgba(248,113,113,.1)}.inv-pill.warning{color:#e0ad3d;background:rgba(245,196,88,.1)}.inv-pill.success{color:var(--tone-success);background:rgba(199,245,111,.09)}
.inv-advice{color:var(--muted);font-weight:600;white-space:nowrap}.inv-advice.buy{color:var(--tone-success)}.inv-advice.stop{color:var(--tone-danger)}
.inv-detail-row td{background:var(--bg)}
.inv-detail{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:20px;padding:4px 0 4px 22px}
.inv-detail p{margin:4px 0 0;color:var(--muted);font-size:12px;line-height:1.55}
.inv-eyebrow{display:block;color:var(--muted);font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase}
.inv-pager{display:flex;align-items:center;justify-content:flex-end;gap:10px;color:var(--muted);font-size:12px}
.inv-empty-text{margin:0;padding:12px 0;color:var(--muted);font-size:13px}
.inv-empty{justify-items:start}.inv-empty h2{margin:0;font-size:18px;font-weight:500}.inv-empty p{margin:0;color:var(--muted);font-size:13px;max-width:560px}
.inv-season-form{display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap}
.inv-season-form label,.inv-form label{display:grid;gap:6px;color:var(--muted);font-size:12px;font-weight:600}
.inv-season-total{margin:0;color:var(--text);font-size:13px}
.inv-season-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.inv-season-grid h3{margin:0 0 8px;font-size:13px;font-weight:600}
.inv-rank{display:grid;gap:6px;margin:0;padding:0;list-style:none;counter-reset:rank}
.inv-rank li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;padding:8px 10px;border-radius:8px;background:var(--bg);font-size:12px}
.inv-rank span{min-width:0;overflow-wrap:anywhere;color:var(--text)}
.inv-rank strong{font-variant-numeric:tabular-nums}
.inv-rank em{grid-column:1/-1;color:var(--muted);font-style:normal;font-size:11px}
.inv-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;align-items:start}
.inv-form{display:grid;gap:12px}
.inv-segment{display:inline-flex;gap:4px;padding:3px;border:1px solid var(--border);border-radius:10px;width:fit-content}
.inv-segment button{height:30px;padding:0 12px;border:0;border-radius:8px;background:transparent;color:var(--muted);font:500 12px inherit;cursor:pointer}
.inv-segment button.active{background:rgba(199,245,111,.12);color:var(--text)}
.inv-format{display:block;padding:10px 12px;border-radius:8px;background:var(--bg);color:var(--text);font:12px/1.6 ui-monospace,Menlo,monospace;overflow-x:auto}
.inv-toggle-row{display:flex;align-items:center;justify-content:space-between;gap:12px;color:var(--text);font-size:13px}
.inv-through{white-space:nowrap;font-variant-numeric:tabular-nums}
.inv-bar{display:inline-block;width:46px;height:5px;margin-right:6px;border-radius:999px;background:var(--border);overflow:hidden;vertical-align:middle}
.inv-bar span{display:block;height:100%;background:#9dca43}
.inv-footnote{margin:0;color:var(--muted);font-size:12px}
label.settings-btn{cursor:pointer;width:fit-content}
@media(max-width:900px){.inv-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}.inv-season-grid,.inv-two{grid-template-columns:1fr}.inv-detail{grid-template-columns:1fr;padding-left:0}}
@media(max-width:560px){.inv-page{padding:28px 16px 48px}.inv-tile strong{font-size:22px}.inv-card{padding:16px}}
`;
