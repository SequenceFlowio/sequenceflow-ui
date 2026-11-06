"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, Lock, RefreshCw, Sparkles, Target } from "lucide-react";

import type { AnalyticsDays } from "@/lib/analytics/core";

/**
 * Pijnpunten: waar klanten tegenaan lopen. De AI bundelt de klantvragen van
 * de gekozen periode tot thema's, met aantal, aandeel, uitleg en advies.
 * Growth en hoger; andere pakketten zien wat het is en hoe ze het krijgen.
 */

type PainPoint = { category: string; count: number; percentage: number; description: string; recommended_action: string };
type Analysis = {
  intro: string;
  pain_points: PainPoint[];
  generated_at: string;
  ticket_count: number;
  sampled_ticket_count: number;
  date_range_label: string | null;
  canRefresh: boolean;
};
type State =
  | { kind: "loading" }
  | { kind: "locked" }
  | { kind: "insufficient"; count: number; minimum: number }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: Analysis };

const PERIOD: Record<AnalyticsDays, "weekly" | "monthly" | "quarterly"> = { 7: "weekly", 30: "monthly", 90: "quarterly" };

export function PainPointsPanel({ days, nl }: { days: AnalyticsDays; nl: boolean }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: "loading" });
    load("GET", controller.signal).then((next) => { if (next) setState(next); });
    return () => controller.abort();
  }, [days, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load(method: "GET" | "POST", signal?: AbortSignal): Promise<State | null> {
    try {
      const response = await fetch(`/api/analytics/pain-points?period=${PERIOD[days]}`, { method, cache: "no-store", signal });
      const body = await response.json().catch(() => ({}));
      if (response.status === 403 && body.upgrade) return { kind: "locked" };
      if (!response.ok) return { kind: "error", message: body.error || (nl ? "Pijnpunten konden niet laden." : "Pain points could not load.") };
      if (body.insufficient) return { kind: "insufficient", count: body.ticketCount ?? 0, minimum: body.minimum ?? 5 };
      return { kind: "ready", data: body as Analysis };
    } catch (error) {
      if ((error as Error).name === "AbortError") return null;
      return { kind: "error", message: nl ? "Pijnpunten konden niet laden." : "Pain points could not load." };
    }
  }

  async function refresh() {
    setRefreshing(true);
    const next = await load("POST");
    if (next) setState(next);
    setRefreshing(false);
  }

  const canRefresh = state.kind === "ready" && state.data.canRefresh;
  const title = nl ? "Pijnpunten: waar klanten tegenaan lopen" : "Pain points: where customers get stuck";
  const description = nl
    ? "De AI bundelt je klantvragen tot thema's en geeft advies over wat je bij de bron kunt verbeteren."
    : "AI groups your customer questions into themes and advises what to fix at the source.";

  return (
    <section className="analytics-section analytics-span-2 pp-app">
      <header className="analytics-section-head">
        <div className="analytics-section-title"><span><Target size={16} /></span><div><h2>{title}</h2><p>{description}</p></div></div>
        {canRefresh ? (
          <button type="button" className="analytics-icon-btn" onClick={refresh} disabled={refreshing} title={nl ? "Opnieuw analyseren" : "Analyse again"} aria-label={nl ? "Opnieuw analyseren" : "Analyse again"}>
            <RefreshCw size={15} className={refreshing ? "analytics-spin" : ""} />
          </button>
        ) : null}
      </header>
      <div className="analytics-section-body">
        {state.kind === "loading" ? (
          <div className="pp-app-loading"><div className="analytics-skeleton" style={{ height: 120 }} /><p>{nl ? "Klantvragen worden geanalyseerd…" : "Analysing customer questions…"}</p></div>
        ) : state.kind === "locked" ? (
          <div className="analytics-notice warning"><Lock size={18} /><div><strong>{nl ? "Pijnpunten zit in Growth en Scale." : "Pain points are included in Growth and Scale."}</strong><p>{nl ? "Zie welk probleem het vaakst terugkomt, met AI-advies om het bij de bron op te lossen." : "See which problem comes back most, with AI advice to fix it at the source."}</p><Link href="/settings?tab=billing">{nl ? "Bekijk plannen" : "View plans"} <ArrowUpRight size={12} /></Link></div></div>
        ) : state.kind === "insufficient" ? (
          <div className="analytics-empty"><span><Target size={18} /></span><strong>{nl ? "Nog te weinig klantvragen" : "Not enough customer questions yet"}</strong><p>{nl ? `Voor een betrouwbaar beeld zijn er minstens ${state.minimum} nodig in deze periode; nu ${state.count}.` : `A reliable picture needs at least ${state.minimum} in this period; there are ${state.count}.`}</p></div>
        ) : state.kind === "error" ? (
          <div className="analytics-notice error"><AlertCircle size={17} /><div><strong>{state.message}</strong><button type="button" onClick={() => setReloadKey((value) => value + 1)}>{nl ? "Opnieuw proberen" : "Try again"}</button></div></div>
        ) : (
          <Result data={state.data} nl={nl} />
        )}
      </div>
    </section>
  );
}

function Result({ data, nl }: { data: Analysis; nl: boolean }) {
  const points = [...data.pain_points].sort((a, b) => b.count - a.count);
  const max = Math.max(1, ...points.map((point) => point.count));
  const when = new Date(data.generated_at).toLocaleString(nl ? "nl-NL" : "en-GB", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  return (
    <>
      <div className="pp-app-intro">
        <p className="pp-app-label"><Sparkles size={13} /> {nl ? "Samenvatting" : "Summary"}</p>
        <p>{data.intro}</p>
      </div>
      <ol className="pp-app-list">
        {points.map((point, index) => (
          <li key={point.category}>
            <span className="analytics-rank">{index + 1}</span>
            <div>
              <div className="pp-app-head"><strong>{point.category}</strong><span><b>{point.count}</b> {nl ? (point.count === 1 ? "vraag" : "vragen") : (point.count === 1 ? "question" : "questions")} · {point.percentage}%</span></div>
              <div className="analytics-progress"><i style={{ width: `${(point.count / max) * 100}%`, background: "var(--sf-green)", opacity: index === 0 ? 1 : Math.max(0.45, 1 - index * 0.15) }} /></div>
              <p>{point.description}</p>
              <div className="pp-app-advice"><b>✦ {nl ? "Advies" : "Advice"}</b> {point.recommended_action}</div>
            </div>
          </li>
        ))}
      </ol>
      <p className="pp-app-meta">{nl ? `Gebaseerd op ${data.sampled_ticket_count} van ${data.ticket_count} klantvragen · geanalyseerd ${when}` : `Based on ${data.sampled_ticket_count} of ${data.ticket_count} customer questions · analysed ${when}`}</p>
      <style>{`
        .pp-app-loading p{margin:10px 0 0;color:var(--sf-text-muted);font-size:11px}
        .pp-app-intro{padding:14px 16px;border:1px solid rgba(199,245,111,.25);border-radius:12px;background:rgba(199,245,111,.06)}
        .pp-app-intro p{margin:0;font-size:13px;line-height:1.6;color:var(--sf-text-secondary)}
        .pp-app-intro .pp-app-label{display:flex;align-items:center;gap:6px;margin-bottom:6px;color:var(--tone-success);font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
        .pp-app-list{list-style:none;margin:14px 0 0;padding:0;display:grid}
        .pp-app-list>li{display:grid;grid-template-columns:24px 1fr;gap:12px;padding:14px 0;border-bottom:1px solid var(--sf-border)}
        .pp-app-list>li:last-child{border-bottom:0}
        .pp-app-head{display:flex;justify-content:space-between;gap:12px;margin-bottom:8px;font-size:13px}
        .pp-app-head strong{font-weight:700}
        .pp-app-head span{flex:none;color:var(--sf-text-muted);font-size:12px}
        .pp-app-head b{color:var(--sf-text);font-variant-numeric:tabular-nums}
        .pp-app-list p{margin:8px 0 0;color:var(--sf-text-muted);font-size:12px;line-height:1.55}
        .pp-app-advice{margin-top:8px;padding:9px 11px;border-radius:8px;background:var(--sf-surface-2);font-size:12px;line-height:1.55;color:var(--sf-text-secondary)}
        .pp-app-advice b{color:var(--tone-success);margin-right:4px}
        .pp-app-meta{margin:12px 0 0;color:var(--sf-text-muted);font-size:11px}
        @media(max-width:640px){.pp-app-head{flex-direction:column;gap:3px}}
      `}</style>
    </>
  );
}
