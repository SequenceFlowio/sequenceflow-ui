"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle, AlertTriangle, ArrowUpRight, BarChart3,
  CheckCircle2, Lightbulb, Lock, Mail, RefreshCw,
  Search, Sparkles,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import type { AnalyticsDays } from "@/lib/analytics/core";
import type { PainPoint, PainPointPeriod } from "@/lib/analytics/painPoints";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { supportLabel } from "@/lib/support/labels";

type Overview = {
  totalProcessed: number;
  resolvedCount: number;
  reviewCount: number;
  escalationCount: number;
  ignoredCount: number;
  autoResolveRate: number | null;
  autoSentCount: number;
  manualSentCount: number;
  escalationRate: number | null;
  pendingCount: number;
  avgConfidence: number | null;
  confidenceSampleSize: number;
  meta: { rangeDays: AnalyticsDays; generatedAt: string; sampleSize: number; canManage: boolean };
};

type VolumeRow = {
  date: string;
  count: number;
  resolved: number;
  review: number;
  escalated: number;
  ignored: number;
};

type IntentRow = { intent: string; count: number; avgConfidence: number | null };
type Insight = {
  type: "low_confidence" | "high_escalation";
  intent: string;
  count: number;
  avgConfidence: number | null;
  escalationRate: number;
};
type PainPointData = {
  id?: string;
  generated_at?: string;
  period: PainPointPeriod;
  date_range_label?: string;
  ticket_count?: number;
  sampled_ticket_count?: number;
  intro?: string;
  pain_points?: PainPoint[];
  insufficient?: boolean;
  minimum?: number;
  ticketCount?: number;
  canRefresh?: boolean;
};
type SectionKey = "overview" | "volume" | "intents" | "insights";

const DAYS: AnalyticsDays[] = [7, 30, 90];

function painPointPeriodForDays(days: AnalyticsDays): PainPointPeriod {
  if (days === 7) return "weekly";
  if (days === 90) return "quarterly";
  return "monthly";
}

function AnalyticsStyles() {
  return <style>{`
    .analytics-page{width:min(100%,1120px);margin:0 auto;padding:40px 24px 72px;color:var(--sf-text)}
    .analytics-head{display:flex;align-items:flex-end;justify-content:space-between;gap:22px;margin-bottom:22px}.analytics-head h1{margin:0;font-size:30px;font-weight:500;line-height:1.15;letter-spacing:-.02em}.analytics-head p{max-width:670px;margin:7px 0 0;color:var(--sf-text-muted);font-size:14px;line-height:1.6}.analytics-ask{display:inline-flex;align-items:center;gap:5px;margin-top:10px;color:var(--sf-text);font-size:13px;font-weight:600;text-decoration:none;border-bottom:1px solid var(--sf-border);padding-bottom:2px}.analytics-ask:hover{color:var(--sf-green);border-color:var(--sf-green)}
    .analytics-period{display:flex;flex:none;gap:3px;padding:4px;border:1px solid var(--sf-border);border-radius:8px;background:var(--sf-surface)}.analytics-period button{height:34px;padding:0 13px;border:0;border-radius:6px;background:transparent;color:var(--sf-text-muted);font:750 12px inherit;cursor:pointer}.analytics-period button.active{background:var(--sf-surface-2);color:var(--sf-text);box-shadow:0 2px 8px rgba(15,23,42,.07)}

    .analytics-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.analytics-section{min-width:0;border:1px solid var(--sf-border);border-radius:18px;background:var(--sf-surface);overflow:hidden}.analytics-span-2{grid-column:1/-1}.analytics-section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;min-height:60px;padding:14px 16px;border-bottom:1px solid var(--sf-border);background:var(--sf-surface-2)}.analytics-section-title{display:flex;gap:10px;min-width:0}.analytics-section-title>span{width:31px;height:31px;display:grid;place-items:center;flex:none;border-radius:7px;background:rgba(199,245,111,.1);color:var(--tone-success)}.analytics-section-title h2{margin:0;font-size:13px;font-weight:800}.analytics-section-title p{margin:3px 0 0;color:var(--sf-text-muted);font-size:11px;line-height:1.45}.analytics-section-body{padding:16px}.analytics-badge{display:inline-flex;align-items:center;gap:6px;min-height:26px;padding:0 8px;border:1px solid var(--sf-border);border-radius:999px;color:var(--sf-text-muted);font-size:10px;font-weight:800;white-space:nowrap}.analytics-badge.success{border-color:rgba(199,245,111,.3);background:rgba(199,245,111,.1);color:var(--tone-success)}.analytics-badge.warning{border-color:rgba(245,196,88,.32);background:rgba(245,196,88,.1);color:var(--tone-warning)}.analytics-icon-btn{width:34px;height:34px;display:grid;place-items:center;border:1px solid var(--sf-border);border-radius:7px;background:var(--sf-surface);color:var(--sf-text-muted);cursor:pointer}.analytics-icon-btn:disabled{opacity:.5;cursor:not-allowed}.analytics-spin{animation:analyticsSpin .8s linear infinite}@keyframes analyticsSpin{to{transform:rotate(360deg)}}
    .analytics-notice{display:flex;align-items:flex-start;gap:10px;padding:12px 13px;border:1px solid var(--sf-border);border-radius:8px;background:var(--sf-surface-2);color:var(--sf-text-muted);font-size:12px;line-height:1.5}.analytics-notice.success{border-color:rgba(199,245,111,.3);background:rgba(199,245,111,.1);color:var(--tone-success)}.analytics-notice.warning{border-color:rgba(245,196,88,.32);background:rgba(245,196,88,.1);color:var(--tone-warning)}.analytics-notice.error{border-color:rgba(248,113,113,.32);background:rgba(248,113,113,.1);color:var(--tone-danger)}.analytics-notice>div{flex:1}.analytics-notice strong{display:block}.analytics-notice p{margin:2px 0 0}.analytics-notice button,.analytics-notice a{display:inline-flex;align-items:center;gap:4px;margin-top:7px;border:0;background:transparent;color:inherit;font:800 11px inherit;text-decoration:none;cursor:pointer}
    .analytics-progress{height:6px;border-radius:999px;background:var(--sf-border);overflow:hidden}.analytics-progress i{display:block;height:100%;border-radius:inherit}
    .analytics-rank{width:24px;height:24px;display:grid;place-items:center;border-radius:6px;background:var(--sf-surface-2);color:var(--sf-text-muted);font-size:10px;font-weight:800}
    .analytics-insights{display:grid}.analytics-insight{display:flex;align-items:flex-start;gap:10px;padding:12px 0;border-bottom:1px solid var(--sf-border)}.analytics-insight:last-child{border-bottom:0}.analytics-insight>span{width:28px;height:28px;display:grid;place-items:center;flex:none;border-radius:7px;background:rgba(245,196,88,.12);color:var(--tone-warning)}.analytics-insight strong{display:block;font-size:12px}.analytics-insight p{margin:3px 0 0;color:var(--sf-text-muted);font-size:11px;line-height:1.5}.analytics-insight a{display:inline-flex;align-items:center;gap:4px;margin-top:6px;color:var(--tone-success);font-size:10px;font-weight:800;text-decoration:none}
    .analytics-signals{margin-top:14px;padding-top:14px;border-top:1px solid var(--sf-border)}.analytics-signal{display:flex;justify-content:space-between;gap:14px;padding:8px 0;border-top:1px solid var(--sf-border);font-size:11px}.analytics-signal:first-of-type{border-top:0}.analytics-signal span:last-child{color:var(--sf-text-muted);text-align:right}
    .analytics-briefing{display:flex;gap:10px;padding:13px 14px;border-bottom:1px solid rgba(199,245,111,.3);background:rgba(199,245,111,.1);color:var(--tone-success)}.analytics-briefing svg{flex:none;margin-top:1px}.analytics-briefing strong{display:block;font-size:10px;text-transform:uppercase}.analytics-briefing p{margin:3px 0 0;font-size:12px;line-height:1.55}.analytics-pain-meta{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 16px;border-bottom:1px solid var(--sf-border);color:var(--sf-text-muted);font-size:10px}.analytics-pains{display:grid}.analytics-pain{display:grid;grid-template-columns:30px minmax(0,1fr) minmax(180px,.65fr) 76px;gap:13px;padding:14px 16px;border-bottom:1px solid var(--sf-border)}.analytics-pain:last-child{border-bottom:0}.analytics-pain h3{margin:0;font-size:12px}.analytics-pain p{margin:4px 0 0;color:var(--sf-text-muted);font-size:11px;line-height:1.45}.analytics-pain-action{padding-left:12px;border-left:1px solid var(--sf-border)}.analytics-pain-action span{display:block;color:var(--sf-text-subtle);font-size:9px;font-weight:800;text-transform:uppercase}.analytics-pain-value{text-align:right}.analytics-pain-value strong{display:block;font-size:18px;color:var(--tone-success)}.analytics-pain-value span{font-size:9px;color:var(--sf-text-muted)}
    
    .analytics-empty{display:grid;place-items:center;align-content:center;gap:7px;min-height:112px;padding:18px 24px;text-align:center}.analytics-empty>span{width:34px;height:34px;display:grid;place-items:center;border-radius:8px;background:var(--sf-surface-2);color:var(--sf-text-muted)}.analytics-empty strong{font-size:12px}.analytics-empty p{max-width:430px;margin:0;color:var(--sf-text-muted);font-size:11px;line-height:1.5}.analytics-skeleton{height:180px;border-radius:8px;background:linear-gradient(90deg,var(--sf-surface-2) 20%,var(--sf-bg) 50%,var(--sf-surface-2) 80%);background-size:220% 100%;animation:analyticsSkeleton 1.2s infinite}@keyframes analyticsSkeleton{to{background-position:-20% 0}}
    .analytics-page .analytics-section-title>span,.analytics-page .analytics-icon-btn,.analytics-page .analytics-rank,.analytics-page .analytics-insight>span,.analytics-page .analytics-empty>span{display:grid;place-items:center;margin:0}.analytics-page .analytics-section-title>span>svg,.analytics-page .analytics-icon-btn>svg,.analytics-page .analytics-insight>span>svg,.analytics-page .analytics-empty>span>svg{display:block}
    @media(max-width:900px){.analytics-grid{grid-template-columns:1fr}.analytics-span-2{grid-column:auto}.analytics-pain{grid-template-columns:30px minmax(0,1fr) 70px}.analytics-pain-action{grid-column:2/4;padding:10px 0 0;border-left:0;border-top:1px solid var(--sf-border)}}
    @media(max-width:640px){.analytics-page{padding:28px 16px 56px}.analytics-head{align-items:flex-start;flex-direction:column}.analytics-period{width:100%}.analytics-period button{flex:1}.analytics-pain{grid-template-columns:26px minmax(0,1fr) 58px;padding:13px 12px}.analytics-pain-action{grid-column:2/4}}
  .analytics-topics{display:grid;gap:18px;padding:4px 2px}.analytics-topic-head{display:flex;justify-content:space-between;gap:12px;font-size:13px;color:var(--sf-text-secondary)}.analytics-topic-head strong{color:var(--sf-text);font-weight:600;font-variant-numeric:tabular-nums}.analytics-topic-bar{height:10px;margin-top:9px;border-radius:4px;background:rgba(255,255,255,.06);overflow:hidden}.analytics-topic-bar i{display:block;height:100%;border-radius:4px;background:var(--sf-green)}`}</style>;
}

async function fetchJson(url: string, signal: AbortSignal, method = "GET") {
  const response = await fetch(url, { method, cache: "no-store", signal });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error || "Request failed"), { status: response.status, body });
  return body;
}

function formatRelativeTime(value: string | undefined, language: string) {
  if (!value) return "";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return language === "nl" ? "zojuist" : "just now";
  if (minutes < 60) return language === "nl" ? `${minutes} min geleden` : `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return language === "nl" ? `${hours} uur geleden` : `${hours}h ago`;
}

function humanizeIntent(intent: string, language: string) {
  return supportLabel("intent", intent, language === "en" ? "en" : "nl");
}

function SectionError({ text, detail, retryLabel, retry }: { text: string; detail: string; retryLabel: string; retry: () => void }) {
  return <div className="analytics-notice error" role="alert"><AlertCircle size={17} /><div><strong>{text}</strong><p>{detail}</p><button type="button" onClick={retry}><RefreshCw size={12} /> {retryLabel}</button></div></div>;
}

export default function AnalyticsDashboard() {
  const { t, language } = useTranslation();
  const nl = language === "nl";
  const ta = t.analytics;
  const [days, setDays] = useState<AnalyticsDays>(30);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [volume, setVolume] = useState<VolumeRow[]>([]);
  const [intents, setIntents] = useState<IntentRow[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [errors, setErrors] = useState<Partial<Record<SectionKey, string>>>({});
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [pain, setPain] = useState<PainPointData | null>(null);
  const [painLoading, setPainLoading] = useState(true);
  const [painRefreshing, setPainRefreshing] = useState(false);
  const [painLocked, setPainLocked] = useState(false);
  const [painError, setPainError] = useState<string | null>(null);

  const copy = nl ? {
    subtitle: "Waar je klantvragen over gaan en wat er aandacht vraagt.",
    period: (value: number) => `${value} dagen`,
    noData: "Nog geen data",
    volume: "Klantvragen per dag",
    volumeDesc: "Hoeveel vragen er binnenkwamen en hoe ze nu afgehandeld zijn.",
    resolved: "Afgehandeld",
    review: "Beoordeling nodig",
    escalated: "Doorgestuurd",
    ignored: "Genegeerd",
    intents: "Waar gaan de vragen over?",
    intentsDesc: "De onderwerpen waar klanten het vaakst over mailen.",
    aiAttention: "Wat vraagt aandacht?",
    aiAttentionDesc: "Signalen met voldoende volume om iets mee te doen.",
    allGood: "Niets dat nu aandacht vraagt",
    allGoodDesc: "Geen onderwerp heeft minstens drie klantvragen die vaak controle nodig hebben of vaak worden doorgestuurd.",
    needMore: "Per onderwerp zijn minstens drie klantvragen nodig voor een betrouwbaar signaal.",
    lowConfidence: (intent: string, count: number) => `${count} klantvragen over ${intent} hebben vaak jouw controle nodig. Meer kennis hierover helpt.`,
    highEscalation: (intent: string, pct: number) => `${pct}% van de klantvragen over ${intent} wordt doorgestuurd.`,
    improve: "Verbeter kennis",
    painDesc: "Geclusterde klantproblemen, zonder letterlijke quotes of persoonsgegevens.",
    refresh: "Opnieuw analyseren",
    sampled: "klantvragen bekeken",
    fromTotal: "van",
    action: "Aanbevolen actie",
    cases: "klantvragen",
    proOnly: "Beschikbaar vanaf Pro",
    upgrade: "Bekijk plannen",
    painInsufficient: "Nog onvoldoende klantvragen voor een betrouwbare analyse.",
    emptyTitle: "Nog geen gegevens",
    emptyText: "Zodra er klantvragen binnenkomen, vult deze pagina zich vanzelf.",
    errorDetail: "Er worden geen oude of verzonnen cijfers getoond.",
    retry: "Opnieuw proberen",
  } : {
    subtitle: "What your customer questions are about and what needs attention.",
    period: (value: number) => `${value} days`,
    noData: "No data yet",
    volume: "Customer questions per day",
    volumeDesc: "How many questions came in and how they are handled now.",
    resolved: "Resolved",
    review: "Needs review",
    escalated: "Forwarded",
    ignored: "Ignored",
    intents: "What are the questions about?",
    intentsDesc: "The topics customers email about most often.",
    aiAttention: "What needs attention?",
    aiAttentionDesc: "Signals with enough volume to act on.",
    allGood: "Nothing needs attention right now",
    allGoodDesc: "No topic has at least three questions that often need review or get forwarded.",
    needMore: "Each topic needs at least three questions for a reliable signal.",
    lowConfidence: (intent: string, count: number) => `${count} questions about ${intent} often need your review. More knowledge on this helps.`,
    highEscalation: (intent: string, pct: number) => `${pct}% of questions about ${intent} get forwarded.`,
    improve: "Improve knowledge",
    painDesc: "Clustered customer problems without literal quotes or personal data.",
    refresh: "Analyze again",
    sampled: "questions reviewed",
    fromTotal: "of",
    action: "Recommended action",
    cases: "cases",
    proOnly: "Available from Pro",
    upgrade: "View plans",
    painInsufficient: "Not enough customer questions for a reliable analysis yet.",
    emptyTitle: "No analytics data yet",
    emptyText: "This dashboard fills automatically as customer email is processed.",
    errorDetail: "This section never substitutes stale or invented values.",
    retry: "Try again",
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setErrors({});
    const endpoints: Array<[SectionKey, string]> = [
      ["overview", `/api/analytics/overview?days=${days}`],
      ["volume", `/api/analytics/volume?days=${days}`],
      ["intents", `/api/analytics/intents?days=${days}`],
      ["insights", `/api/analytics/insights?days=${days}`],
    ];
    Promise.allSettled(endpoints.map(([, url]) => fetchJson(url, controller.signal))).then((results) => {
      if (controller.signal.aborted) return;
      const nextErrors: Partial<Record<SectionKey, string>> = {};
      results.forEach((result, index) => {
        const key = endpoints[index][0];
        if (result.status === "rejected") {
          const reason = result.reason as { status?: number; body?: { upgrade?: boolean }; message?: string };
          if (key === "overview" && reason.status === 403 && reason.body?.upgrade) setLocked(true);
          else nextErrors[key] = reason.message || ta.loadError;
          return;
        }
        if (key === "overview") { setOverview(result.value as Overview); setLocked(false); }
        if (key === "volume") setVolume(Array.isArray(result.value) ? result.value as VolumeRow[] : []);
        if (key === "intents") setIntents(Array.isArray(result.value) ? result.value as IntentRow[] : []);
        if (key === "insights") setInsights(Array.isArray(result.value) ? result.value as Insight[] : []);
      });
      setErrors(nextErrors);
      setLoading(false);
    });
    return () => controller.abort();
  }, [days, reloadKey, ta.loadError]);

  useEffect(() => {
    const controller = new AbortController();
    const period = painPointPeriodForDays(days);
    setPainLoading(true); setPainError(null); setPain(null); setPainLocked(false);
    fetchJson(`/api/analytics/pain-points?period=${period}`, controller.signal).then((data) => {
      setPain(data as PainPointData);
    }).catch((error: { status?: number; body?: { upgrade?: boolean }; message?: string }) => {
      if (controller.signal.aborted) return;
      if (error.status === 403 && error.body?.upgrade) setPainLocked(true);
      else setPainError(error.message || ta.loadError);
    }).finally(() => { if (!controller.signal.aborted) setPainLoading(false); });
    return () => controller.abort();
  }, [days, reloadKey, ta.loadError]);

  async function refreshPainPoints() {
    const controller = new AbortController();
    setPainRefreshing(true); setPainError(null);
    try {
      const data = await fetchJson(`/api/analytics/pain-points?period=${painPointPeriodForDays(days)}`, controller.signal, "POST");
      setPain(data as PainPointData);
    } catch (error) {
      setPainError(error instanceof Error ? error.message : ta.loadError);
    } finally {
      setPainRefreshing(false);
    }
  }

  const hasData = (overview?.totalProcessed ?? 0) > 0;
  const painPoints = pain?.pain_points ?? [];
  const maxIntentCount = Math.max(1, ...intents.map((intent) => intent.count));
  const chartLabels = useMemo(() => ({ resolved: copy.resolved, review: copy.review, escalated: copy.escalated, ignored: copy.ignored }), [copy.resolved, copy.review, copy.escalated, copy.ignored]);
  const tooltipStyle = { background: "var(--sf-surface)", border: "1px solid var(--sf-border)", borderRadius: 8, color: "var(--sf-text)", fontSize: 11 };

  if (locked) {
    return <main className="analytics-page"><AnalyticsStyles /><header className="analytics-head"><div><h1>{ta.title}</h1><p>{copy.subtitle}</p></div></header><div className="analytics-notice warning"><Lock size={18} /><div><strong>{ta.lockedText}</strong><Link href="/settings?tab=billing">{copy.upgrade} <ArrowUpRight size={12} /></Link></div></div></main>;
  }

  return (
    <main className="analytics-page">
      <AnalyticsStyles />
      <header className="analytics-head">
        <div><h1>{ta.title}</h1><p>{copy.subtitle}</p><Link href="/sefi" className="analytics-ask">{nl ? "Vraag Sefi" : "Ask Sefi"} <ArrowUpRight size={13} /></Link></div>
        <div className="analytics-period" aria-label={nl ? "Analyseperiode" : "Analytics period"}>{DAYS.map((value) => <button type="button" key={value} className={days === value ? "active" : ""} aria-pressed={days === value} onClick={() => setDays(value)}>{copy.period(value)}</button>)}</div>
      </header>

      {!loading && !hasData && !errors.overview ? <div className="analytics-notice"><Mail size={17} /><div><strong>{copy.emptyTitle}</strong><p>{copy.emptyText}</p></div></div> : null}

      <div className="analytics-grid" style={{ marginTop: 16 }}>
        <Panel className="analytics-span-2" icon={<BarChart3 size={16} />} title={copy.volume} description={copy.volumeDesc}>
          {errors.volume ? <SectionError text={errors.volume} detail={copy.errorDetail} retryLabel={copy.retry} retry={() => setReloadKey((value) => value + 1)} /> : loading && !volume.length ? <div className="analytics-skeleton" /> : volume.every((row) => row.count === 0) ? <Empty icon={<BarChart3 size={18} />} title={copy.noData} text={copy.emptyText} /> : <ResponsiveContainer width="100%" height={250}><AreaChart data={volume} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}><CartesianGrid stroke="var(--sf-border)" vertical={false} /><XAxis dataKey="date" tick={{ fill: "var(--sf-text-muted)", fontSize: 10 }} tickFormatter={(value: string) => new Intl.DateTimeFormat(language, { day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00Z`))} /><YAxis allowDecimals={false} tick={{ fill: "var(--sf-text-muted)", fontSize: 10 }} /><Tooltip contentStyle={tooltipStyle} /><Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} /><Area type="monotone" dataKey="resolved" name={chartLabels.resolved} stackId="handling" stroke="#8fbd37" fill="rgba(143,189,55,.24)" /><Area type="monotone" dataKey="review" name={chartLabels.review} stackId="handling" stroke="#e0a21a" fill="rgba(224,162,26,.20)" /><Area type="monotone" dataKey="escalated" name={chartLabels.escalated} stackId="handling" stroke="#e76e62" fill="rgba(231,110,98,.18)" /><Area type="monotone" dataKey="ignored" name={chartLabels.ignored} stackId="handling" stroke="#98a2b3" fill="rgba(152,162,179,.14)" /></AreaChart></ResponsiveContainer>}
        </Panel>

        <Panel className="analytics-span-2" icon={<Mail size={16} />} title={copy.intents} description={copy.intentsDesc}>
          {errors.intents ? <SectionError text={errors.intents} detail={copy.errorDetail} retryLabel={copy.retry} retry={() => setReloadKey((value) => value + 1)} /> : !intents.length ? <Empty icon={<Mail size={18} />} title={copy.noData} text={copy.emptyText} /> : <div className="analytics-topics">{intents.map((intent, index) => <div className="analytics-topic" key={intent.intent}><div className="analytics-topic-head"><span>{humanizeIntent(intent.intent, language)}</span><strong>{intent.count}</strong></div><div className="analytics-topic-bar"><i style={{ width: `${intent.count / maxIntentCount * 100}%`, opacity: index === 0 ? 1 : Math.max(0.4, 1 - index * 0.15) }} /></div></div>)}</div>}
        </Panel>

        <Panel className="analytics-span-2" icon={<Lightbulb size={16} />} title={copy.aiAttention} description={copy.aiAttentionDesc}>
          {errors.insights ? <SectionError text={errors.insights} detail={copy.errorDetail} retryLabel={copy.retry} retry={() => setReloadKey((value) => value + 1)} /> : overview && overview.totalProcessed < 3 ? <Empty icon={<Lightbulb size={18} />} title={copy.noData} text={copy.needMore} /> : insights.length === 0 ? <div className="analytics-notice success"><CheckCircle2 size={17} /><div><strong>{copy.allGood}</strong><p>{copy.allGoodDesc}</p></div></div> : <div className="analytics-insights">{insights.map((insight) => { const intent = humanizeIntent(insight.intent, language); const message = insight.type === "low_confidence" ? copy.lowConfidence(intent, insight.count) : copy.highEscalation(intent, Math.round(insight.escalationRate * 100)); return <div className="analytics-insight" key={`${insight.type}-${insight.intent}`}><span><AlertTriangle size={15} /></span><div><strong>{intent}</strong><p>{message}</p><Link href="/knowledge">{copy.improve} <ArrowUpRight size={11} /></Link></div></div>; })}</div>}
        </Panel>

        <section className="analytics-section analytics-span-2">
          <header className="analytics-section-head"><div className="analytics-section-title"><span><Search size={16} /></span><div><h2>{ta.painPointsTitle}</h2><p>{copy.painDesc}</p></div></div>{pain?.canRefresh && !pain?.insufficient ? <button type="button" className="analytics-icon-btn" aria-label={copy.refresh} title={copy.refresh} disabled={painRefreshing} onClick={refreshPainPoints}><RefreshCw size={15} className={painRefreshing ? "analytics-spin" : ""} /></button> : painLocked ? <span className="analytics-badge warning"><Lock size={11} /> Pro</span> : null}</header>
          {painError ? <div className="analytics-section-body"><SectionError text={painError} detail={copy.errorDetail} retryLabel={copy.retry} retry={() => setReloadKey((value) => value + 1)} /></div> : painLocked ? <div className="analytics-empty"><span><Lock size={18} /></span><strong>{copy.proOnly}</strong><Link href="/settings?tab=billing" style={{ color: "var(--tone-success)", fontSize: 11, fontWeight: 800 }}>{copy.upgrade}</Link></div> : painLoading ? <div className="analytics-section-body"><div className="analytics-skeleton" /></div> : pain?.insufficient ? <Empty icon={<Mail size={18} />} title={copy.noData} text={`${copy.painInsufficient} ${pain.ticketCount ?? 0}/${pain.minimum ?? 5}`} /> : pain && painPoints.length ? <><div className="analytics-briefing"><Sparkles size={16} /><div><strong>{ta.aiBriefingLabel.replace("✦ ", "")}</strong><p>{pain.intro}</p></div></div><div className="analytics-pain-meta"><span>{pain.sampled_ticket_count ?? pain.ticket_count ?? 0} {copy.sampled} {pain.ticket_count && pain.sampled_ticket_count !== pain.ticket_count ? `${copy.fromTotal} ${pain.ticket_count}` : ""}</span><span>{pain.generated_at ? formatRelativeTime(pain.generated_at, language) : ""}</span></div><div className="analytics-pains">{[...painPoints].sort((a, b) => b.count - a.count).map((point, index) => <div className="analytics-pain" key={point.category}><span className="analytics-rank">{index + 1}</span><div><h3>{point.category}</h3><p>{point.description}</p><div className="analytics-progress" style={{ marginTop: 8 }}><i style={{ width: `${point.percentage}%`, background: "#8fbd37" }} /></div></div><div className="analytics-pain-action"><span>{copy.action}</span><p>{point.recommended_action}</p></div><div className="analytics-pain-value"><strong>{point.percentage}%</strong><span>{point.count} {copy.cases}</span></div></div>)}</div></> : <Empty icon={<Search size={18} />} title={copy.noData} text={copy.painInsufficient} />}
        </section>
      </div>
    </main>
  );
}

function Panel({ icon, title, description, className = "", children }: { icon: React.ReactNode; title: string; description: string; className?: string; children: React.ReactNode }) {
  return <section className={`analytics-section ${className}`.trim()}><header className="analytics-section-head"><div className="analytics-section-title"><span>{icon}</span><div><h2>{title}</h2><p>{description}</p></div></div></header><div className="analytics-section-body">{children}</div></section>;
}
function Empty({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="analytics-empty"><span>{icon}</span><strong>{title}</strong><p>{text}</p></div>;
}
