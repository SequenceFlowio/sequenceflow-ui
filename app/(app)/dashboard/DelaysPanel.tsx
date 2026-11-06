"use client";

import { useEffect, useState } from "react";
import { Copy, Truck } from "lucide-react";

import { appFetch } from "@/lib/shopify/client";

type Delay = { orderId: string; order: string | null; provider: string; reason: "past_promise" | "tracking_stalled" | "not_shipped"; days: number; trackingUrl: string | null; message: string };

/** Bestellingen die vertraging oplopen, met een bericht om de klant vóór te zijn. Niets gaat vanzelf naar de klant. */
export function DelaysPanel({ nl }: { nl: boolean }) {
  const [delays, setDelays] = useState<Delay[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    appFetch("/api/commerce/delays", { cache: "no-store", signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data && !controller.signal.aborted) setDelays(Array.isArray(data.delays) ? data.delays : []); })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  if (!delays?.length) return null;
  const reason = (delay: Delay) => {
    if (delay.reason === "past_promise") return nl ? `${delay.days} ${delay.days === 1 ? "dag" : "dagen"} over de beloofde leverdatum` : `${delay.days} ${delay.days === 1 ? "day" : "days"} past the promised date`;
    if (delay.reason === "tracking_stalled") return nl ? `al ${delay.days} dagen geen trackingupdate` : `no tracking update for ${delay.days} days`;
    return nl ? `${delay.days} dagen besteld, nog niet verzonden` : `ordered ${delay.days} days ago, not shipped yet`;
  };
  async function copy(delay: Delay) {
    try { await navigator.clipboard.writeText(delay.message); setCopied(delay.orderId); window.setTimeout(() => setCopied(null), 2000); } catch { /* geen klembord: tekst blijft zichtbaar */ }
  }

  return (
    <section className="dl-panel" aria-labelledby="delays-title">
      <style>{`
        .dl-panel{margin-top:16px;padding:18px 20px;border:1px solid rgba(245,196,88,.3);border-radius:14px;background:rgba(245,196,88,.06)}
        .dl-head{display:flex;align-items:center;gap:10px}.dl-head svg{color:var(--tone-warning)}
        .dl-head h2{margin:0;font-size:16px;font-weight:600}.dl-panel>p{margin:6px 0 0;color:var(--sf-text-muted);font-size:13px}
        .dl-list{list-style:none;margin:12px 0 0;padding:0;display:grid;gap:10px}
        .dl-list li{padding:12px 14px;border:1px solid var(--sf-border);border-radius:10px;background:var(--sf-surface)}
        .dl-row{display:flex;justify-content:space-between;gap:12px;font-size:13px}.dl-row span{color:var(--sf-text-muted)}
        .dl-msg{margin:8px 0 0;font-size:12.5px;line-height:1.55;color:var(--sf-text-secondary)}
        .dl-copy{display:inline-flex;align-items:center;gap:6px;margin-top:8px;padding:5px 10px;border:1px solid var(--sf-border);border-radius:8px;background:transparent;color:var(--sf-text);font:600 12px inherit;cursor:pointer}
      `}</style>
      <div className="dl-head"><Truck size={18} aria-hidden /><h2 id="delays-title">{nl ? `${delays.length} ${delays.length === 1 ? "bestelling loopt" : "bestellingen lopen"} vertraging op` : `${delays.length} ${delays.length === 1 ? "order is" : "orders are"} running late`}</h2></div>
      <p>{nl ? "Laat het je klant weten voordat die mailt. Kopieer het bericht en stuur het via je eigen mailbox of het bol-berichtensysteem." : "Let your customer know before they email. Copy the message and send it from your own mailbox or bol's messaging."}</p>
      <ul className="dl-list">
        {delays.slice(0, 5).map((delay) => (
          <li key={delay.orderId}>
            <div className="dl-row"><strong>{delay.order ?? (nl ? "Bestelling" : "Order")}</strong><span>{reason(delay)}</span></div>
            <p className="dl-msg">{delay.message}</p>
            <button type="button" className="dl-copy" onClick={() => copy(delay)}><Copy size={13} aria-hidden /> {copied === delay.orderId ? (nl ? "Gekopieerd" : "Copied") : (nl ? "Kopieer bericht" : "Copy message")}</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
