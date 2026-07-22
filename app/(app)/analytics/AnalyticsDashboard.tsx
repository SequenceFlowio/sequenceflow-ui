"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity, AlertCircle, AlertTriangle, ArrowUpRight, BarChart3, Bot,
  CheckCircle2, CircleGauge, Lightbulb, Link2, Lock, Mail, RefreshCw,
  Search, ShieldCheck, Sparkles, UserRoundCheck,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import type { AnalyticsDays } from "@/lib/analytics/core";
import type { PainPoint, PainPointPeriod } from "@/lib/analytics/painPoints";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

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
type Operations = {
  contextMatchRate: number | null;
  correctionRate: number | null;
  medianEditDistance: number | null;
  actionApprovalRate: number | null;
  actionSuccessRate: number | null;
  repeatContact7dRate: number | null;
  repeatContact30dRate: number | null;
  commerceConnected: boolean;
  samples: { contextAttempts: number; learningEdits: number; actionProposals: number; approvedActions: number; replies: number };
  signals: Array<{ label: string; current: number; baseline: number }>;
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
type SectionKey = "overview" | "volume" | "intents" | "insights" | "operations";

const DAYS: AnalyticsDays[] = [7, 30, 90];

function painPointPeriodForDays(days: AnalyticsDays): PainPointPeriod {
  if (days === 7) return "weekly";
  if (days === 90) return "quarterly";
  return "monthly";
}

function AnalyticsStyles() {
  return <style>{`
    .analytics-page{width:min(100%,1120px);margin:0 auto;padding:40px 24px 72px;color:var(--sf-text)}
    .analytics-head{display:flex;align-items:flex-end;justify-content:space-between;gap:22px;margin-bottom:22px}.analytics-head h1{margin:0;font-size:28px;font-weight:800;letter-spacing:0}.analytics-head p{max-width:670px;margin:7px 0 0;color:var(--sf-text-muted);font-size:14px;line-height:1.6}
    .analytics-period{display:flex;flex:none;gap:3px;padding:4px;border:1px solid var(--sf-border);border-radius:8px;background:var(--sf-surface)}.analytics-period button{height:34px;padding:0 13px;border:0;border-radius:6px;background:transparent;color:var(--sf-text-muted);font:750 12px inherit;cursor:pointer}.analytics-period button.active{background:var(--sf-surface-2);color:var(--sf-text);box-shadow:0 2px 8px rgba(15,23,42,.07)}
    .analytics-status{margin-bottom:16px;border:1px solid var(--sf-border);border-radius:8px;background:var(--sf-surface);overflow:hidden}.analytics-status-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 16px;border-bottom:1px solid var(--sf-border);background:var(--sf-surface-2)}.analytics-status-title{display:flex;align-items:center;gap:10px;min-width:0}.analytics-status-icon{width:32px;height:32px;display:grid;place-items:center;flex:none;border-radius:7px;background:#eff8df;color:#60891c}.analytics-status-icon.warning{background:#fff3d5;color:#9a6700}.analytics-status-title strong{display:block;font-size:13px}.analytics-status-title span{display:block;margin-top:2px;color:var(--sf-text-muted);font-size:11px}.analytics-status-time{color:var(--sf-text-subtle);font-size:10px;white-space:nowrap}.analytics-status-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))}.analytics-status-item{min-width:0;padding:13px 15px;border-right:1px solid var(--sf-border)}.analytics-status-item:last-child{border-right:0}.analytics-status-item>span{display:flex;align-items:center;gap:6px;color:var(--sf-text-muted);font-size:10px;font-weight:800;text-transform:uppercase}.analytics-status-item strong{display:block;margin-top:5px;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.analytics-status-item p{margin:3px 0 0;color:var(--sf-text-muted);font-size:10px;line-height:1.4}
    .analytics-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:16px;border:1px solid var(--sf-border);border-radius:8px;background:var(--sf-surface);overflow:hidden}.analytics-metric{display:grid;grid-template-columns:34px minmax(0,1fr);gap:10px;padding:15px}.analytics-metric+.analytics-metric{border-left:1px solid var(--sf-border)}.analytics-metric-icon{width:34px;height:34px;display:grid;place-items:center;border-radius:7px;background:var(--sf-surface-2);color:var(--sf-text-muted)}.analytics-metric span,.analytics-metric strong,.analytics-metric small{display:block}.analytics-metric span{color:var(--sf-text-muted);font-size:10px;font-weight:800;text-transform:uppercase}.analytics-metric strong{margin-top:3px;font-size:23px;line-height:1}.analytics-metric small{margin-top:5px;color:var(--sf-text-subtle);font-size:10px;line-height:1.35}
    .analytics-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(280px,.85fr);gap:16px}.analytics-section{min-width:0;border:1px solid var(--sf-border);border-radius:8px;background:var(--sf-surface);overflow:hidden}.analytics-span-2{grid-column:1/-1}.analytics-section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:14px 16px;border-bottom:1px solid var(--sf-border);background:var(--sf-surface-2)}.analytics-section-title{display:flex;gap:10px;min-width:0}.analytics-section-title>span{width:31px;height:31px;display:grid;place-items:center;flex:none;border-radius:7px;background:#eff8df;color:#60891c}.analytics-section-title h2{margin:0;font-size:13px;font-weight:800}.analytics-section-title p{margin:3px 0 0;color:var(--sf-text-muted);font-size:11px;line-height:1.45}.analytics-section-body{padding:16px}.analytics-badge{display:inline-flex;align-items:center;gap:6px;min-height:26px;padding:0 8px;border:1px solid var(--sf-border);border-radius:999px;color:var(--sf-text-muted);font-size:10px;font-weight:800;white-space:nowrap}.analytics-badge.success{border-color:#d4edaa;background:#f5faea;color:#527717}.analytics-badge.warning{border-color:#f2dda5;background:#fff8e6;color:#8a5d00}.analytics-icon-btn{width:34px;height:34px;display:grid;place-items:center;border:1px solid var(--sf-border);border-radius:7px;background:var(--sf-surface);color:var(--sf-text-muted);cursor:pointer}.analytics-icon-btn:disabled{opacity:.5;cursor:not-allowed}.analytics-spin{animation:analyticsSpin .8s linear infinite}@keyframes analyticsSpin{to{transform:rotate(360deg)}}
    .analytics-notice{display:flex;align-items:flex-start;gap:10px;padding:12px 13px;border:1px solid var(--sf-border);border-radius:8px;background:var(--sf-surface-2);color:var(--sf-text-muted);font-size:12px;line-height:1.5}.analytics-notice.success{border-color:#d4edaa;background:#f5faea;color:#527717}.analytics-notice.warning{border-color:#f2dda5;background:#fff8e6;color:#8a5d00}.analytics-notice.error{border-color:#ffd2cc;background:#fff2f0;color:#b42318}.analytics-notice>div{flex:1}.analytics-notice strong{display:block}.analytics-notice p{margin:2px 0 0}.analytics-notice button,.analytics-notice a{display:inline-flex;align-items:center;gap:4px;margin-top:7px;border:0;background:transparent;color:inherit;font:800 11px inherit;text-decoration:none;cursor:pointer}
    .analytics-breakdown{display:grid;gap:13px}.analytics-breakdown-row>div:first-child{display:flex;justify-content:space-between;gap:12px;margin-bottom:6px;font-size:11px}.analytics-breakdown-row span{color:var(--sf-text-muted)}.analytics-progress{height:6px;border-radius:999px;background:var(--sf-border);overflow:hidden}.analytics-progress i{display:block;height:100%;border-radius:inherit}
    .analytics-intents{display:grid}.analytics-intent{display:grid;grid-template-columns:26px minmax(0,1fr) auto;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--sf-border)}.analytics-intent:last-child{border-bottom:0}.analytics-rank{width:24px;height:24px;display:grid;place-items:center;border-radius:6px;background:var(--sf-surface-2);color:var(--sf-text-muted);font-size:10px;font-weight:800}.analytics-intent strong{display:block;font-size:12px;text-transform:capitalize}.analytics-intent span{display:block;margin-top:2px;color:var(--sf-text-muted);font-size:10px}.analytics-intent-count{text-align:right;font-size:13px;font-weight:800}
    .analytics-insights{display:grid}.analytics-insight{display:flex;align-items:flex-start;gap:10px;padding:12px 0;border-bottom:1px solid var(--sf-border)}.analytics-insight:last-child{border-bottom:0}.analytics-insight>span{width:28px;height:28px;display:grid;place-items:center;flex:none;border-radius:7px;background:#fff3d5;color:#9a6700}.analytics-insight strong{display:block;font-size:12px}.analytics-insight p{margin:3px 0 0;color:var(--sf-text-muted);font-size:11px;line-height:1.5}.analytics-insight a{display:inline-flex;align-items:center;gap:4px;margin-top:6px;color:#527717;font-size:10px;font-weight:800;text-decoration:none}
    .analytics-ops{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid var(--sf-border);border-radius:8px;overflow:hidden}.analytics-op{padding:11px 12px}.analytics-op:nth-child(3n+2),.analytics-op:nth-child(3n+3){border-left:1px solid var(--sf-border)}.analytics-op:nth-child(n+4){border-top:1px solid var(--sf-border)}.analytics-op span,.analytics-op strong,.analytics-op small{display:block}.analytics-op span{color:var(--sf-text-muted);font-size:9px;font-weight:800;text-transform:uppercase}.analytics-op strong{margin-top:4px;font-size:18px}.analytics-op small{margin-top:3px;color:var(--sf-text-subtle);font-size:9px}.analytics-signals{margin-top:14px;padding-top:14px;border-top:1px solid var(--sf-border)}.analytics-signal{display:flex;justify-content:space-between;gap:14px;padding:8px 0;border-top:1px solid var(--sf-border);font-size:11px}.analytics-signal:first-of-type{border-top:0}.analytics-signal span:last-child{color:var(--sf-text-muted);text-align:right}
    .analytics-briefing{display:flex;gap:10px;padding:13px 14px;border-bottom:1px solid #d4edaa;background:#f7fbea;color:#456412}.analytics-briefing svg{flex:none;margin-top:1px}.analytics-briefing strong{display:block;font-size:10px;text-transform:uppercase}.analytics-briefing p{margin:3px 0 0;font-size:12px;line-height:1.55}.analytics-pain-meta{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 16px;border-bottom:1px solid var(--sf-border);color:var(--sf-text-muted);font-size:10px}.analytics-pains{display:grid}.analytics-pain{display:grid;grid-template-columns:30px minmax(0,1fr) minmax(180px,.65fr) 76px;gap:13px;padding:14px 16px;border-bottom:1px solid var(--sf-border)}.analytics-pain:last-child{border-bottom:0}.analytics-pain h3{margin:0;font-size:12px}.analytics-pain p{margin:4px 0 0;color:var(--sf-text-muted);font-size:11px;line-height:1.45}.analytics-pain-action{padding-left:12px;border-left:1px solid var(--sf-border)}.analytics-pain-action span{display:block;color:var(--sf-text-subtle);font-size:9px;font-weight:800;text-transform:uppercase}.analytics-pain-value{text-align:right}.analytics-pain-value strong{display:block;font-size:18px;color:#60891c}.analytics-pain-value span{font-size:9px;color:var(--sf-text-muted)}
    .analytics-empty{display:grid;place-items:center;gap:8px;min-height:150px;padding:24px;text-align:center}.analytics-empty>span{width:38px;height:38px;display:grid;place-items:center;border-radius:8px;background:var(--sf-surface-2);color:var(--sf-text-muted)}.analytics-empty strong{font-size:12px}.analytics-empty p{max-width:430px;margin:0;color:var(--sf-text-muted);font-size:11px;line-height:1.5}.analytics-skeleton{height:180px;border-radius:8px;background:linear-gradient(90deg,var(--sf-surface-2) 20%,var(--sf-bg) 50%,var(--sf-surface-2) 80%);background-size:220% 100%;animation:analyticsSkeleton 1.2s infinite}@keyframes analyticsSkeleton{to{background-position:-20% 0}}
    @media(max-width:900px){.analytics-status-grid,.analytics-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.analytics-status-item:nth-child(2){border-right:0}.analytics-status-item:nth-child(-n+2){border-bottom:1px solid var(--sf-border)}.analytics-metric:nth-child(3){border-left:0;border-top:1px solid var(--sf-border)}.analytics-metric:nth-child(4){border-top:1px solid var(--sf-border)}.analytics-grid{grid-template-columns:1fr}.analytics-span-2{grid-column:auto}.analytics-pain{grid-template-columns:30px minmax(0,1fr) 70px}.analytics-pain-action{grid-column:2/4;padding:10px 0 0;border-left:0;border-top:1px solid var(--sf-border)}}
    @media(max-width:640px){.analytics-page{padding:28px 16px 56px}.analytics-head{align-items:flex-start;flex-direction:column}.analytics-period{width:100%}.analytics-period button{flex:1}.analytics-status-head{align-items:flex-start}.analytics-status-time{display:none}.analytics-status-grid,.analytics-metrics{grid-template-columns:1fr}.analytics-status-item{border-right:0!important;border-bottom:1px solid var(--sf-border)!important}.analytics-status-item:last-child{border-bottom:0!important}.analytics-metric+.analytics-metric{border-left:0;border-top:1px solid var(--sf-border)}.analytics-ops{grid-template-columns:repeat(2,minmax(0,1fr))}.analytics-op:nth-child(n){border-left:0;border-top:0}.analytics-op:nth-child(2n){border-left:1px solid var(--sf-border)}.analytics-op:nth-child(n+3){border-top:1px solid var(--sf-border)}.analytics-pain{grid-template-columns:26px minmax(0,1fr) 58px;padding:13px 12px}.analytics-pain-action{grid-column:2/4}}
  `}</style>;
}

async function fetchJson(url: string, signal: AbortSignal, method = "GET") {
  const response = await fetch(url, { method, cache: "no-store", signal });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error || "Request failed"), { status: response.status, body });
  return body;
}

function formatPercent(value: number | null) {
  return value === null ? "-" : `${Math.round(value * 100)}%`;
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
  if (["fallback", "unknown"].includes(intent)) return language === "nl" ? "Overig" : "Other";
  const label = intent.replace(/_/g, " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
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
  const [operations, setOperations] = useState<Operations | null>(null);
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
    subtitle: "Live inzicht in volume, afhandeling, AI-kwaliteit en waar klanten vastlopen.",
    period: (value: number) => `${value} dagen`,
    healthy: "Analytics is actueel",
    attention: "Een deel van Analytics vraagt aandacht",
    healthyDetail: "Alle databronnen zijn zonder fouten bijgewerkt.",
    attentionDetail: "Werkende secties blijven zichtbaar; mislukte data wordt nooit als nul gepresenteerd.",
    lastUpdated: "Bijgewerkt",
    dataFlow: "Datastroom", quality: "AI-kwaliteit", pains: "Klantpijnpunten", commerce: "Commerce",
    active: "Actief", noData: "Nog geen data", analyzed: "Analyse gereed", analyzing: "Wordt geanalyseerd", unavailable: "Niet beschikbaar",
    conversations: "gesprekken in periode", confidenceSamples: "beslissingen gemeten", noQualitySamples: "Nog te weinig beslissingen", commerceReady: "Contextmeting actief", commerceNoCases: "Gekoppeld, nog geen cases", commerceOff: "Geen shop gekoppeld",
    processed: "Verwerkt", autoResolved: "Auto-opgelost", confidence: "Gem. vertrouwen", needsReview: "Te beoordelen",
    inPeriod: "in geselecteerde periode", actualAutosends: "echte autosends", basedOn: "gebaseerd op", openCases: "openstaande cases",
    volume: "Volume en afhandeling", volumeDesc: "Dagelijks ontvangen cases, uitgesplitst naar huidige afhandeling.", resolved: "Afgehandeld", review: "Beoordeling nodig", escalated: "Geëscaleerd", ignored: "Genegeerd",
    handling: "Afhandeling", handlingDesc: "Waar alle cases uit deze periode nu staan.",
    intents: "Belangrijkste onderwerpen", intentsDesc: "Waar klanten het vaakst over mailen.", emails: "e-mails", avg: "gem. zekerheid",
    aiAttention: "Wat vraagt aandacht?", aiAttentionDesc: "Signalen met voldoende volume om iets mee te doen.", allGood: "Geen duidelijke AI-risico’s gevonden", allGoodDesc: "Er zijn geen onderwerpen met minimaal drie cases én lage zekerheid of veel escalaties.", needMore: "Minimaal drie cases per onderwerp zijn nodig voor een betrouwbaar signaal.",
    lowConfidence: (intent: string, count: number, pct: number) => `${count} mails over ${intent} hebben gemiddeld ${pct}% zekerheid.`,
    highEscalation: (intent: string, pct: number) => `${pct}% van de mails over ${intent} wordt geëscaleerd.`,
    improve: "Verbeter kennis",
    operations: "Operationele kwaliteit", operationsDesc: "Commerce, correcties en vervolgcontact met hun echte samplegrootte.", connectCommerce: "Koppel een webshop om ordermatching en acties hier te meten.", manageIntegrations: "Naar Integraties", insufficientSample: "Geen sample",
    painDesc: "Geclusterde klantproblemen, zonder letterlijke quotes of persoonsgegevens.", refresh: "Opnieuw analyseren", sampled: "representatieve cases geanalyseerd", fromTotal: "van", action: "Aanbevolen actie", cases: "cases", proOnly: "Beschikbaar vanaf Pro", upgrade: "Bekijk plannen", painInsufficient: "Nog onvoldoende klantvragen voor een betrouwbare analyse.",
    emptyTitle: "Nog geen analyticsdata", emptyText: "Zodra klantmails worden verwerkt, vult dit dashboard zichzelf automatisch.", errorDetail: "Deze sectie toont geen oude of verzonnen waarden.", retry: "Opnieuw proberen",
  } : {
    subtitle: "Live insight into volume, handling, AI quality, and where customers get stuck.",
    period: (value: number) => `${value} days`,
    healthy: "Analytics is up to date", attention: "Part of Analytics needs attention", healthyDetail: "All data sources updated without errors.", attentionDetail: "Working sections stay visible; failed data is never presented as zero.", lastUpdated: "Updated",
    dataFlow: "Data flow", quality: "AI quality", pains: "Customer pain points", commerce: "Commerce", active: "Active", noData: "No data yet", analyzed: "Analysis ready", analyzing: "Analyzing", unavailable: "Unavailable",
    conversations: "conversations in range", confidenceSamples: "decisions measured", noQualitySamples: "Not enough decisions yet", commerceReady: "Context measurement active", commerceNoCases: "Connected, no cases yet", commerceOff: "No store connected",
    processed: "Processed", autoResolved: "Auto-resolved", confidence: "Avg. confidence", needsReview: "Needs review", inPeriod: "in selected range", actualAutosends: "verified autosends", basedOn: "based on", openCases: "open cases",
    volume: "Volume and handling", volumeDesc: "Daily received cases, split by current handling state.", resolved: "Resolved", review: "Needs review", escalated: "Escalated", ignored: "Ignored", handling: "Handling", handlingDesc: "Where all cases in this range currently stand.",
    intents: "Top topics", intentsDesc: "What customers email about most often.", emails: "emails", avg: "avg. confidence", aiAttention: "What needs attention?", aiAttentionDesc: "Signals with enough volume to act on.", allGood: "No clear AI risks found", allGoodDesc: "No topic has at least three cases plus low confidence or heavy escalation.", needMore: "At least three cases per topic are needed for a reliable signal.",
    lowConfidence: (intent: string, count: number, pct: number) => `${count} emails about ${intent} average ${pct}% confidence.`, highEscalation: (intent: string, pct: number) => `${pct}% of emails about ${intent} are escalated.`, improve: "Improve knowledge",
    operations: "Operational quality", operationsDesc: "Commerce, corrections, and repeat contact with their actual sample sizes.", connectCommerce: "Connect a store to measure order matching and actions here.", manageIntegrations: "Open Integrations", insufficientSample: "No sample",
    painDesc: "Clustered customer problems without literal quotes or personal data.", refresh: "Analyze again", sampled: "representative cases analyzed", fromTotal: "of", action: "Recommended action", cases: "cases", proOnly: "Available from Pro", upgrade: "View plans", painInsufficient: "Not enough customer questions for a reliable analysis yet.",
    emptyTitle: "No analytics data yet", emptyText: "This dashboard fills automatically as customer email is processed.", errorDetail: "This section never substitutes stale or invented values.", retry: "Try again",
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
      ["operations", `/api/analytics/operations?days=${days}`],
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
        if (key === "operations") setOperations(result.value as Operations);
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

  const errorCount = Object.keys(errors).length + Number(Boolean(painError));
  const hasData = (overview?.totalProcessed ?? 0) > 0;
  const generatedAt = overview?.meta.generatedAt;
  const painPoints = pain?.pain_points ?? [];
  const maxIntentCount = Math.max(1, ...intents.map((intent) => intent.count));
  const handlingRows = overview ? [
    { label: copy.resolved, value: overview.resolvedCount, color: "#8fbd37" },
    { label: copy.review, value: overview.reviewCount, color: "#e0a21a" },
    { label: copy.escalated, value: overview.escalationCount, color: "#e76e62" },
    { label: copy.ignored, value: overview.ignoredCount, color: "#98a2b3" },
  ].filter((row) => row.value > 0) : [];
  const chartLabels = useMemo(() => ({ resolved: copy.resolved, review: copy.review, escalated: copy.escalated, ignored: copy.ignored }), [copy.resolved, copy.review, copy.escalated, copy.ignored]);
  const tooltipStyle = { background: "var(--sf-surface)", border: "1px solid var(--sf-border)", borderRadius: 8, color: "var(--sf-text)", fontSize: 11 };

  if (locked) {
    return <main className="analytics-page"><AnalyticsStyles /><header className="analytics-head"><div><h1>{ta.title}</h1><p>{copy.subtitle}</p></div></header><div className="analytics-notice warning"><Lock size={18} /><div><strong>{ta.lockedText}</strong><Link href="/settings?tab=billing">{copy.upgrade} <ArrowUpRight size={12} /></Link></div></div></main>;
  }

  return (
    <main className="analytics-page">
      <AnalyticsStyles />
      <header className="analytics-head">
        <div><h1>{ta.title}</h1><p>{copy.subtitle}</p></div>
        <div className="analytics-period" aria-label={nl ? "Analyseperiode" : "Analytics period"}>{DAYS.map((value) => <button type="button" key={value} className={days === value ? "active" : ""} aria-pressed={days === value} onClick={() => setDays(value)}>{copy.period(value)}</button>)}</div>
      </header>

      <section className="analytics-status" aria-live="polite">
        <div className="analytics-status-head">
          <div className="analytics-status-title"><span className={`analytics-status-icon${errorCount ? " warning" : ""}`}>{errorCount ? <AlertTriangle size={17} /> : <ShieldCheck size={17} />}</span><div><strong>{errorCount ? copy.attention : copy.healthy}</strong><span>{errorCount ? copy.attentionDetail : copy.healthyDetail}</span></div></div>
          {generatedAt ? <span className="analytics-status-time">{copy.lastUpdated} {formatRelativeTime(generatedAt, language)}</span> : null}
        </div>
        <div className="analytics-status-grid">
          <StatusItem icon={<Activity size={13} />} label={copy.dataFlow} value={loading ? ta.painPointsRefreshing : hasData ? copy.active : copy.noData} detail={`${overview?.meta.sampleSize ?? 0} ${copy.conversations}`} />
          <StatusItem icon={<CircleGauge size={13} />} label={copy.quality} value={errors.overview ? copy.unavailable : overview?.confidenceSampleSize ? formatPercent(overview.avgConfidence) : copy.noData} detail={overview?.confidenceSampleSize ? `${overview.confidenceSampleSize} ${copy.confidenceSamples}` : copy.noQualitySamples} />
          <StatusItem icon={<Search size={13} />} label={copy.pains} value={painError ? copy.unavailable : painLoading ? copy.analyzing : pain?.insufficient ? copy.noData : painLocked ? copy.proOnly : pain ? copy.analyzed : copy.noData} detail={pain?.generated_at ? formatRelativeTime(pain.generated_at, language) : copy.painDesc} />
          <StatusItem icon={<Link2 size={13} />} label={copy.commerce} value={errors.operations ? copy.unavailable : operations?.commerceConnected ? copy.active : copy.noData} detail={operations?.commerceConnected ? operations.samples.contextAttempts ? copy.commerceReady : copy.commerceNoCases : copy.commerceOff} />
        </div>
      </section>

      <section className="analytics-metrics" aria-label={nl ? "Kerncijfers" : "Key metrics"}>
        <Metric icon={<Mail size={17} />} label={copy.processed} value={loading && !overview ? "-" : String(overview?.totalProcessed ?? 0)} detail={copy.inPeriod} />
        <Metric icon={<Sparkles size={17} />} label={copy.autoResolved} value={formatPercent(overview?.autoResolveRate ?? null)} detail={`${overview?.autoSentCount ?? 0} ${copy.actualAutosends}`} />
        <Metric icon={<CircleGauge size={17} />} label={copy.confidence} value={formatPercent(overview?.avgConfidence ?? null)} detail={`${copy.basedOn} ${overview?.confidenceSampleSize ?? 0}`} />
        <Metric icon={<UserRoundCheck size={17} />} label={copy.needsReview} value={String(overview?.pendingCount ?? 0)} detail={copy.openCases} />
      </section>

      {!loading && !hasData && !errors.overview ? <div className="analytics-notice"><Mail size={17} /><div><strong>{copy.emptyTitle}</strong><p>{copy.emptyText}</p></div></div> : null}

      <div className="analytics-grid" style={{ marginTop: 16 }}>
        <Panel className="analytics-span-2" icon={<BarChart3 size={16} />} title={copy.volume} description={copy.volumeDesc}>
          {errors.volume ? <SectionError text={errors.volume} detail={copy.errorDetail} retryLabel={copy.retry} retry={() => setReloadKey((value) => value + 1)} /> : loading && !volume.length ? <div className="analytics-skeleton" /> : volume.every((row) => row.count === 0) ? <Empty icon={<BarChart3 size={18} />} title={copy.noData} text={copy.emptyText} /> : <ResponsiveContainer width="100%" height={250}><AreaChart data={volume} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}><CartesianGrid stroke="var(--sf-border)" vertical={false} /><XAxis dataKey="date" tick={{ fill: "var(--sf-text-muted)", fontSize: 10 }} tickFormatter={(value: string) => new Intl.DateTimeFormat(language, { day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00Z`))} /><YAxis allowDecimals={false} tick={{ fill: "var(--sf-text-muted)", fontSize: 10 }} /><Tooltip contentStyle={tooltipStyle} /><Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} /><Area type="monotone" dataKey="resolved" name={chartLabels.resolved} stackId="handling" stroke="#8fbd37" fill="rgba(143,189,55,.24)" /><Area type="monotone" dataKey="review" name={chartLabels.review} stackId="handling" stroke="#e0a21a" fill="rgba(224,162,26,.20)" /><Area type="monotone" dataKey="escalated" name={chartLabels.escalated} stackId="handling" stroke="#e76e62" fill="rgba(231,110,98,.18)" /><Area type="monotone" dataKey="ignored" name={chartLabels.ignored} stackId="handling" stroke="#98a2b3" fill="rgba(152,162,179,.14)" /></AreaChart></ResponsiveContainer>}
        </Panel>

        <Panel icon={<Activity size={16} />} title={copy.handling} description={copy.handlingDesc}>
          {errors.overview ? <SectionError text={errors.overview} detail={copy.errorDetail} retryLabel={copy.retry} retry={() => setReloadKey((value) => value + 1)} /> : !handlingRows.length ? <Empty icon={<Activity size={18} />} title={copy.noData} text={copy.emptyText} /> : <div className="analytics-breakdown">{handlingRows.map((row) => { const percentage = overview?.totalProcessed ? Math.round(row.value / overview.totalProcessed * 100) : 0; return <div className="analytics-breakdown-row" key={row.label}><div><span>{row.label}</span><strong>{row.value} ({percentage}%)</strong></div><div className="analytics-progress"><i style={{ width: `${percentage}%`, background: row.color }} /></div></div>; })}</div>}
        </Panel>

        <Panel icon={<Mail size={16} />} title={copy.intents} description={copy.intentsDesc}>
          {errors.intents ? <SectionError text={errors.intents} detail={copy.errorDetail} retryLabel={copy.retry} retry={() => setReloadKey((value) => value + 1)} /> : !intents.length ? <Empty icon={<Mail size={18} />} title={copy.noData} text={copy.emptyText} /> : <div className="analytics-intents">{intents.map((intent, index) => <div className="analytics-intent" key={intent.intent}><span className="analytics-rank">{index + 1}</span><div><strong>{humanizeIntent(intent.intent, language)}</strong><span>{intent.avgConfidence === null ? copy.insufficientSample : `${Math.round(intent.avgConfidence * 100)}% ${copy.avg}`}</span><div className="analytics-progress" style={{ marginTop: 6 }}><i style={{ width: `${intent.count / maxIntentCount * 100}%`, background: index === 0 ? "#8fbd37" : "#b8c5a0" }} /></div></div><span className="analytics-intent-count">{intent.count}<small style={{ display: "block", color: "var(--sf-text-muted)", fontSize: 9 }}>{copy.emails}</small></span></div>)}</div>}
        </Panel>

        <Panel icon={<Lightbulb size={16} />} title={copy.aiAttention} description={copy.aiAttentionDesc}>
          {errors.insights ? <SectionError text={errors.insights} detail={copy.errorDetail} retryLabel={copy.retry} retry={() => setReloadKey((value) => value + 1)} /> : overview && overview.totalProcessed < 3 ? <Empty icon={<Lightbulb size={18} />} title={copy.noData} text={copy.needMore} /> : insights.length === 0 ? <div className="analytics-notice success"><CheckCircle2 size={17} /><div><strong>{copy.allGood}</strong><p>{copy.allGoodDesc}</p></div></div> : <div className="analytics-insights">{insights.map((insight) => { const intent = humanizeIntent(insight.intent, language); const message = insight.type === "low_confidence" ? copy.lowConfidence(intent, insight.count, Math.round((insight.avgConfidence ?? 0) * 100)) : copy.highEscalation(intent, Math.round(insight.escalationRate * 100)); return <div className="analytics-insight" key={`${insight.type}-${insight.intent}`}><span><AlertTriangle size={15} /></span><div><strong>{intent}</strong><p>{message}</p><Link href="/knowledge">{copy.improve} <ArrowUpRight size={11} /></Link></div></div>; })}</div>}
        </Panel>

        <Panel className="analytics-span-2" icon={<Bot size={16} />} title={copy.operations} description={copy.operationsDesc}>
          {errors.operations ? <SectionError text={errors.operations} detail={copy.errorDetail} retryLabel={copy.retry} retry={() => setReloadKey((value) => value + 1)} /> : !operations?.commerceConnected ? <div className="analytics-notice"><Link2 size={17} /><div><strong>{copy.commerceOff}</strong><p>{copy.connectCommerce}</p>{overview?.meta.canManage ? <Link href="/integrations">{copy.manageIntegrations} <ArrowUpRight size={11} /></Link> : null}</div></div> : <><div className="analytics-ops"><Operation label={ta.contextMatchRate} value={operations.contextMatchRate} sample={operations.samples.contextAttempts} /><Operation label={ta.correctionRate} value={operations.correctionRate} sample={operations.samples.learningEdits} /><Operation label={ta.medianEditDistance} value={operations.medianEditDistance} sample={operations.samples.learningEdits} /><Operation label={ta.actionApprovalRate} value={operations.actionApprovalRate} sample={operations.samples.actionProposals} /><Operation label={ta.actionSuccessRate} value={operations.actionSuccessRate} sample={operations.samples.approvedActions} /><Operation label={ta.repeatContact7dRate} value={operations.repeatContact7dRate} sample={operations.samples.replies} /></div>{operations.signals.length ? <div className="analytics-signals"><strong style={{ fontSize: 11 }}>{ta.skuSignalsTitle}</strong>{operations.signals.map((signal) => <div className="analytics-signal" key={signal.label}><span>{signal.label}</span><span>{signal.current} {ta.casesThisWeek} · {signal.baseline.toFixed(1)} {ta.baselineCases}</span></div>)}</div> : null}</>}
        </Panel>

        <section className="analytics-section analytics-span-2">
          <header className="analytics-section-head"><div className="analytics-section-title"><span><Search size={16} /></span><div><h2>{ta.painPointsTitle}</h2><p>{copy.painDesc}</p></div></div>{pain?.canRefresh && !pain?.insufficient ? <button type="button" className="analytics-icon-btn" aria-label={copy.refresh} title={copy.refresh} disabled={painRefreshing} onClick={refreshPainPoints}><RefreshCw size={15} className={painRefreshing ? "analytics-spin" : ""} /></button> : painLocked ? <span className="analytics-badge warning"><Lock size={11} /> Pro</span> : null}</header>
          {painError ? <div className="analytics-section-body"><SectionError text={painError} detail={copy.errorDetail} retryLabel={copy.retry} retry={() => setReloadKey((value) => value + 1)} /></div> : painLocked ? <div className="analytics-empty"><span><Lock size={18} /></span><strong>{copy.proOnly}</strong><Link href="/settings?tab=billing" style={{ color: "#527717", fontSize: 11, fontWeight: 800 }}>{copy.upgrade}</Link></div> : painLoading ? <div className="analytics-section-body"><div className="analytics-skeleton" /></div> : pain?.insufficient ? <Empty icon={<Mail size={18} />} title={copy.noData} text={`${copy.painInsufficient} ${pain.ticketCount ?? 0}/${pain.minimum ?? 5}`} /> : pain && painPoints.length ? <><div className="analytics-briefing"><Sparkles size={16} /><div><strong>{ta.aiBriefingLabel.replace("✦ ", "")}</strong><p>{pain.intro}</p></div></div><div className="analytics-pain-meta"><span>{pain.sampled_ticket_count ?? pain.ticket_count ?? 0} {copy.sampled} {pain.ticket_count && pain.sampled_ticket_count !== pain.ticket_count ? `${copy.fromTotal} ${pain.ticket_count}` : ""}</span><span>{pain.generated_at ? formatRelativeTime(pain.generated_at, language) : ""}</span></div><div className="analytics-pains">{[...painPoints].sort((a, b) => b.count - a.count).map((point, index) => <div className="analytics-pain" key={point.category}><span className="analytics-rank">{index + 1}</span><div><h3>{point.category}</h3><p>{point.description}</p><div className="analytics-progress" style={{ marginTop: 8 }}><i style={{ width: `${point.percentage}%`, background: "#8fbd37" }} /></div></div><div className="analytics-pain-action"><span>{copy.action}</span><p>{point.recommended_action}</p></div><div className="analytics-pain-value"><strong>{point.percentage}%</strong><span>{point.count} {copy.cases}</span></div></div>)}</div></> : <Empty icon={<Search size={18} />} title={copy.noData} text={copy.painInsufficient} />}
        </section>
      </div>
    </main>
  );
}

function StatusItem({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <div className="analytics-status-item"><span>{icon}{label}</span><strong>{value}</strong><p>{detail}</p></div>;
}
function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <div className="analytics-metric"><span className="analytics-metric-icon">{icon}</span><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></div>;
}
function Panel({ icon, title, description, className = "", children }: { icon: React.ReactNode; title: string; description: string; className?: string; children: React.ReactNode }) {
  return <section className={`analytics-section ${className}`.trim()}><header className="analytics-section-head"><div className="analytics-section-title"><span>{icon}</span><div><h2>{title}</h2><p>{description}</p></div></div></header><div className="analytics-section-body">{children}</div></section>;
}
function Empty({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="analytics-empty"><span>{icon}</span><strong>{title}</strong><p>{text}</p></div>;
}
function Operation({ label, value, sample }: { label: string; value: number | null; sample: number }) {
  return <div className="analytics-op"><span>{label}</span><strong>{formatPercent(value)}</strong><small>n={sample}</small></div>;
}
