"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type Overview = {
  totalProcessed:  number;
  autoResolveRate: number;
  avgConfidence:   number;
  avgLatencyMs:    number;
  escalationRate:  number;
};

type VolumeRow = {
  date:         string;
  count:        number;
  auto:         number;
  human_review: number;
};

type IntentRow = {
  intent:        string;
  count:         number;
  avgConfidence: number;
};

type Insight = {
  type:          string;
  intent:        string;
  count:         number;
  avgConfidence: number;
  message:       string;
};

type PainPoint = {
  category:    string;
  count:       number;
  percentage:  number;
  description: string;
  example:     string;
};

type PainPointData = {
  id:           string;
  generated_at: string;
  ticket_count: number;
  week_count:   number;
  intro:        string;
  pain_points:  PainPoint[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background:   "var(--surface)",
  border:       "1px solid var(--border)",
  borderRadius: "14px",
  padding:      "20px 24px",
};

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={card}>
      <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>
        {label}
      </p>
      <p style={{ fontSize: "28px", fontWeight: 700, color: "var(--text)", margin: "0 0 2px", letterSpacing: "-0.02em" }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0 }}>{sub}</p>}
    </div>
  );
}

type TimeAgoStrings = {
  timeAgoJustNow: string;
  timeAgoMinutes: string;
  timeAgoHours:   string;
  timeAgoDays:    string;
};

function timeAgo(iso: string, s: TimeAgoStrings): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2)  return s.timeAgoJustNow;
  if (mins < 60) return `${mins} ${s.timeAgoMinutes}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs} ${s.timeAgoHours}`;
  return `${Math.floor(hrs / 24)} ${s.timeAgoDays}`;
}

const INTENT_COLORS_LIST = [
  "#B4F000","#60a5fa","#a78bfa","#f87171",
  "#fb923c","#eab308","#2dd4bf","#f472b6",
];

// ─── Locked / upgrade state ───────────────────────────────────────────────────

function LockedAnalytics() {
  const { t } = useTranslation();
  const ta = t.analytics;
  return (
    <div style={{ position: "relative", minHeight: "60vh" }}>
      <div style={{ filter: "blur(6px)", pointerEvents: "none", userSelect: "none", opacity: 0.4 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "32px" }}>
          {[ta.kpiEmailsProcessed, ta.kpiAutoResolved, ta.kpiAvgConfidence, ta.kpiAvgLatency].map(l => (
            <div key={l} style={card}>
              <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 8px", textTransform: "uppercase" }}>{l}</p>
              <p style={{ fontSize: "28px", fontWeight: 700, color: "var(--text)", margin: 0 }}>—</p>
            </div>
          ))}
        </div>
        <div style={{ ...card, marginBottom: "32px", height: "200px" }} />
        <div style={{ ...card, height: "180px" }} />
      </div>

      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "16px", padding: "40px 48px", textAlign: "center",
          maxWidth: "400px", boxShadow: "0 8px 40px rgba(0,0,0,0.25)",
        }}>
          <p style={{ fontSize: "32px", margin: "0 0 12px" }}>📊</p>
          <p style={{ fontSize: "18px", fontWeight: 700, color: "var(--text)", margin: "0 0 8px", letterSpacing: "-0.01em" }}>
            {ta.title}
          </p>
          <p style={{ fontSize: "13px", color: "var(--muted)", margin: "0 0 24px", lineHeight: 1.6 }}>
            {ta.lockedText}
          </p>
          <Link
            href="/settings?tab=billing"
            style={{
              display: "inline-block",
              padding: "10px 28px", borderRadius: "8px",
              background: "#B4F000", color: "#0B1220",
              fontSize: "13px", fontWeight: 700,
              textDecoration: "none",
            }}
          >
            {ta.upgradeCta}
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Pain point row ───────────────────────────────────────────────────────────

function PainPointRow({ point }: { point: PainPoint }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      style={{
        ...card,
        cursor: "pointer",
        padding: "16px 20px",
        transition: "border-color 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)", margin: "0 0 3px" }}>
            {point.category}
          </p>
          <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0, lineHeight: 1.4 }}>
            {point.description}
          </p>
        </div>
        <div style={{ flexShrink: 0, textAlign: "right" }}>
          <span style={{ fontSize: "20px", fontWeight: 700, color: "#B4F000" }}>
            {point.percentage}%
          </span>
          <p style={{ fontSize: "11px", color: "var(--muted)", margin: "2px 0 0" }}>
            {point.count} {t.analytics.ticketsLabel}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: "4px", borderRadius: "2px", background: "var(--border)", marginTop: "12px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${point.percentage}%`, borderRadius: "2px", background: "#B4F000", transition: "width 0.4s ease" }} />
      </div>

      {/* Expandable example */}
      {expanded && (
        <p style={{
          fontSize: "13px", color: "var(--muted)", fontStyle: "italic",
          margin: "12px 0 0", lineHeight: 1.6,
          borderLeft: "3px solid var(--border)", paddingLeft: "12px",
        }}>
          "{point.example}"
        </p>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { t } = useTranslation();
  const ta = t.analytics;

  const [overview,  setOverview]  = useState<Overview | null>(null);
  const [volume,    setVolume]    = useState<VolumeRow[]>([]);
  const [intents,   setIntents]   = useState<IntentRow[]>([]);
  const [insights,  setInsights]  = useState<Insight[]>([]);
  const [locked,    setLocked]    = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const [painPoints,           setPainPoints]           = useState<PainPointData | null>(null);
  const [painPointsLocked,     setPainPointsLocked]     = useState(false);
  const [painPointsInsufficient, setPainPointsInsufficient] = useState(false);
  const [painPointsLoading,    setPainPointsLoading]    = useState(true);
  const [painPointsRefreshing, setPainPointsRefreshing] = useState(false);

  async function loadPainPoints(force = false) {
    if (force) {
      setPainPointsRefreshing(true);
    } else {
      setPainPointsLoading(true);
    }
    try {
      const res = await fetch("/api/analytics/pain-points", { method: force ? "POST" : "GET" });
      if (res.status === 403) {
        const body = await res.json();
        if (body.upgrade) setPainPointsLocked(true);
        return;
      }
      const data = await res.json();
      if (data.insufficient) {
        setPainPointsInsufficient(true);
        return;
      }
      if (data.pain_points) {
        setPainPoints(data as PainPointData);
        setPainPointsInsufficient(false);
      }
    } catch {
      // silently fail — pain points are non-critical
    } finally {
      setPainPointsLoading(false);
      setPainPointsRefreshing(false);
    }
  }

  useEffect(() => {
    async function loadAll() {
      try {
        const [ovRes, volRes, intRes, insRes] = await Promise.all([
          fetch("/api/analytics/overview"),
          fetch("/api/analytics/volume"),
          fetch("/api/analytics/intents"),
          fetch("/api/analytics/insights"),
        ]);

        if (ovRes.status === 403) {
          const body = await ovRes.json();
          if (body.upgrade) { setLocked(true); setLoading(false); return; }
        }

        if (!ovRes.ok) throw new Error("Failed to load overview");

        const [ov, vol, int_, ins] = await Promise.all([
          ovRes.json(), volRes.json(), intRes.json(), insRes.json(),
        ]);

        setOverview(ov);
        setVolume(Array.isArray(vol) ? vol : []);
        setIntents(Array.isArray(int_) ? int_ : []);
        setInsights(Array.isArray(ins) ? ins : []);
      } catch (e) {
        console.error("[analytics]", e);
        setError(ta.loadError);
      } finally {
        setLoading(false);
      }
    }
    loadAll();
    loadPainPoints();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pageStyle: React.CSSProperties = {
    maxWidth: "1100px",
    margin: "0 auto",
    padding: "52px 44px",
  };

  if (loading) {
    return (
      <div style={pageStyle}>
        <p style={{ color: "var(--muted)", fontSize: "13px" }}>{t.common.loading}</p>
      </div>
    );
  }

  if (locked) {
    return (
      <div style={pageStyle}>
        <h1 style={{ fontSize: "26px", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 8px" }}>{ta.title}</h1>
        <p style={{ fontSize: "14px", color: "var(--muted)", margin: "0 0 40px" }}>
          {ta.subtitleLocked}
        </p>
        <LockedAnalytics />
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <p style={{ color: "#f87171", fontSize: "13px" }}>{error}</p>
      </div>
    );
  }

  const tickStyle = { fill: "var(--muted)", fontSize: 11 };
  const gridColor = "rgba(229,231,235,0.08)";
  const tooltipStyle = {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "8px", fontSize: "12px", color: "var(--text)",
  };

  const autoRateTrend = volume
    .filter(row => row.count > 0)
    .map(row => ({
      date:     row.date,
      autoRate: Math.round((row.auto / row.count) * 100),
    }));

  const hasData = overview !== null && overview.totalProcessed > 0;

  const sortedPainPoints = painPoints
    ? [...painPoints.pain_points].sort((a, b) => b.count - a.count)
    : [];

  return (
    <div style={pageStyle}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .analytics-section { animation: fadeUp 0.2s ease; }
        @keyframes shimmer {
          0%   { opacity: 0.4; }
          50%  { opacity: 0.7; }
          100% { opacity: 0.4; }
        }
        .pp-skeleton { animation: shimmer 1.4s ease-in-out infinite; }
      `}</style>

      <div className="mb-8">
        <h1 style={{ fontSize: "26px", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 6px" }}>
          {ta.title}
        </h1>
        <p style={{ fontSize: "14px", color: "var(--muted)", margin: 0 }}>
          {ta.subtitle}
        </p>
      </div>

      {/* ── No data yet ── */}
      {!hasData && (
        <div style={{
          ...card, marginBottom: "32px",
          display: "flex", alignItems: "center", gap: "14px",
          padding: "20px 24px",
        }}>
          <span style={{ fontSize: "22px" }}>📭</span>
          <div>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", margin: "0 0 4px" }}>
              {ta.noDataTitle}
            </p>
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
              {ta.noDataDesc}
            </p>
          </div>
        </div>
      )}

      {/* ── 1. KPI row ── */}
      <div className="analytics-section" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "32px" }}>
        <KpiCard
          label={ta.kpiEmailsProcessed}
          value={String(overview?.totalProcessed ?? 0)}
          sub={ta.kpiEmailsSub}
        />
        <KpiCard
          label={ta.kpiAutoResolved}
          value={`${Math.round((overview?.autoResolveRate ?? 0) * 100)}%`}
          sub={ta.kpiAutoResolvedSub}
        />
        <KpiCard
          label={ta.kpiAvgConfidence}
          value={`${Math.round((overview?.avgConfidence ?? 0) * 100)}%`}
          sub={ta.kpiAvgConfidenceSub}
        />
        <KpiCard
          label={ta.kpiAvgLatency}
          value={overview?.avgLatencyMs ? `${(overview.avgLatencyMs / 1000).toFixed(1)}s` : "—"}
          sub={ta.kpiAvgLatencySub}
        />
      </div>

      {/* ── 2. Volume chart ── */}
      <div className="analytics-section" style={{ ...card, marginBottom: "32px" }}>
        <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", margin: "0 0 20px" }}>
          {ta.volumeTitle}
        </p>
        {volume.length === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--muted)", textAlign: "center", padding: "40px 0" }}>
            {ta.volumeNoData}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={volume} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="date" tick={tickStyle} tickFormatter={(d: string) => d.slice(5)} />
              <YAxis tick={tickStyle} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: "12px" }} />
              <Area type="monotone" dataKey="auto"         name={ta.areaAuto}        stackId="1" stroke="#B4F000" fill="rgba(180,240,0,0.18)" />
              <Area type="monotone" dataKey="human_review" name={ta.areaHumanReview} stackId="1" stroke="#60a5fa" fill="rgba(96,165,250,0.18)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── 3. Auto-resolve rate trend ── */}
      <div className="analytics-section" style={{ ...card, marginBottom: "32px" }}>
        <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", margin: "0 0 4px" }}>
          {ta.autoResolveTrendTitle}
        </p>
        <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 20px" }}>
          {ta.autoResolveTrendSub}
        </p>
        {autoRateTrend.length === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--muted)", textAlign: "center", padding: "40px 0" }}>
            {ta.autoResolveTrendNoData}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={autoRateTrend} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="date" tick={tickStyle} tickFormatter={(d: string) => d.slice(5)} />
              <YAxis tick={tickStyle} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v) => [`${v}%`, ta.autoResolvedLabel]}
              />
              <Line
                type="monotone" dataKey="autoRate"
                stroke="#B4F000" strokeWidth={2}
                dot={{ fill: "#B4F000", r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── 4. Intent breakdown ── */}
      <div className="analytics-section" style={{ ...card, marginBottom: "32px" }}>
        <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", margin: "0 0 20px" }}>
          {ta.topIntentsTitle}
        </p>
        {intents.length === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--muted)", textAlign: "center", padding: "40px 0" }}>
            {ta.topIntentsNoData}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(180, intents.length * 36)}>
            <BarChart data={intents} layout="vertical" margin={{ top: 0, right: 16, left: 80, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
              <XAxis type="number" tick={tickStyle} allowDecimals={false} />
              <YAxis type="category" dataKey="intent" tick={tickStyle} width={80} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v, name) => [v, name === "count" ? ta.emailsLabel : name]}
              />
              <Bar dataKey="count" name={ta.emailsLabel} radius={[0, 4, 4, 0]}>
                {intents.map((_, i) => (
                  <Cell key={i} fill={INTENT_COLORS_LIST[i % INTENT_COLORS_LIST.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── 5. AI Health Insights ── */}
      <div className="analytics-section" style={{ marginBottom: "40px" }}>
        <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", margin: "0 0 14px" }}>
          {ta.aiHealthTitle}
        </p>
        {insights.length === 0 ? (
          <div style={{ ...card, display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "20px" }}>✅</span>
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
              {ta.aiHealthAllGood}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {insights.map((ins, i) => (
              <div key={i} style={{
                ...card,
                display: "flex", alignItems: "flex-start", gap: "14px",
                borderLeft: `3px solid ${ins.type === "low_confidence" ? "#fbbf24" : "#f87171"}`,
              }}>
                <span style={{ fontSize: "18px", flexShrink: 0, marginTop: "1px" }}>
                  {ins.type === "low_confidence" ? "⚠️" : "🔺"}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "13px", color: "var(--text)", margin: "0 0 4px", lineHeight: 1.5 }}>
                    {ins.message}
                  </p>
                </div>
                <Link
                  href="/knowledge"
                  style={{
                    flexShrink: 0, fontSize: "12px", fontWeight: 600,
                    color: "#B4F000", textDecoration: "none", whiteSpace: "nowrap",
                  }}
                >
                  {ta.aiHealthFix}
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 6. Klantpijnpunten ── */}
      <div className="analytics-section">
        {/* Section header */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
          <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", margin: 0 }}>
            {ta.painPointsTitle}
          </p>
          <span style={{
            fontSize: "11px", fontWeight: 700, color: "#B4F000",
            background: "rgba(180,240,0,0.15)", borderRadius: "4px",
            padding: "2px 7px", letterSpacing: "0.04em",
          }}>
            PRO
          </span>

          {/* Right-aligned: timestamp + refresh button */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "12px" }}>
            {painPoints && (
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                {ta.painPointsAnalyzedAt} {timeAgo(painPoints.generated_at, ta)}
              </span>
            )}
            {!painPointsLocked && !painPointsInsufficient && (
              <button
                className="btn-secondary"
                onClick={() => loadPainPoints(true)}
                disabled={painPointsRefreshing}
                style={{
                  fontSize: "12px", fontWeight: 500,
                  padding: "5px 12px", borderRadius: "7px",
                  opacity: painPointsRefreshing ? 0.6 : 1,
                  cursor: painPointsRefreshing ? "not-allowed" : "pointer",
                }}
              >
                {painPointsRefreshing ? ta.painPointsRefreshing : ta.painPointsReanalyze}
              </button>
            )}
          </div>
        </div>

        {/* Locked state */}
        {painPointsLocked && (
          <div style={{ position: "relative" }}>
            <div style={{ filter: "blur(5px)", pointerEvents: "none", userSelect: "none", opacity: 0.35 }}>
              {[85, 60, 45, 30, 20].map((w, i) => (
                <div key={i} style={{ ...card, marginBottom: "10px", height: "72px" }}>
                  <div style={{ height: "14px", width: `${w}%`, background: "var(--border)", borderRadius: "4px", marginBottom: "8px" }} />
                  <div style={{ height: "4px", width: `${w}%`, background: "var(--border)", borderRadius: "2px" }} />
                </div>
              ))}
            </div>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: "14px", padding: "28px 36px", textAlign: "center",
                maxWidth: "340px", boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
              }}>
                <p style={{ fontSize: "24px", margin: "0 0 10px" }}>🔍</p>
                <p style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)", margin: "0 0 6px" }}>
                  {ta.painPointsLockedTitle}
                </p>
                <p style={{ fontSize: "13px", color: "var(--muted)", margin: "0 0 20px", lineHeight: 1.6 }}>
                  {ta.painPointsLockedText}
                </p>
                <Link
                  href="/settings?tab=billing"
                  style={{
                    display: "inline-block", padding: "9px 24px", borderRadius: "8px",
                    background: "#B4F000", color: "#0B1220",
                    fontSize: "13px", fontWeight: 700, textDecoration: "none",
                  }}
                >
                  {ta.upgradeCta}
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Insufficient data */}
        {!painPointsLocked && painPointsInsufficient && (
          <div style={{ ...card, display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "20px" }}>📭</span>
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
              {ta.painPointsInsufficientData}
            </p>
          </div>
        )}

        {/* Loading skeleton */}
        {!painPointsLocked && !painPointsInsufficient && painPointsLoading && (
          <div className="pp-skeleton" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[75, 55, 40].map((w, i) => (
              <div key={i} style={{ ...card, padding: "16px 20px" }}>
                <div style={{ height: "14px", width: `${w}%`, background: "var(--border)", borderRadius: "4px", marginBottom: "8px" }} />
                <div style={{ height: "12px", width: `${w * 0.8}%`, background: "var(--border)", borderRadius: "4px", marginBottom: "12px" }} />
                <div style={{ height: "4px", width: "100%", background: "var(--border)", borderRadius: "2px" }} />
              </div>
            ))}
          </div>
        )}

        {/* Data */}
        {!painPointsLocked && !painPointsInsufficient && !painPointsLoading && painPoints && (
          <div>
            {/* AI briefing intro card */}
            <div style={{
              ...card,
              borderLeft: "3px solid #B4F000",
              marginBottom: "16px",
              padding: "18px 20px",
            }}>
              <p style={{
                fontSize: "11px", fontWeight: 700, color: "#B4F000",
                textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px",
              }}>
                {ta.aiBriefingLabel}
              </p>
              <p style={{ fontSize: "14px", color: "var(--text)", margin: 0, lineHeight: 1.7 }}>
                {painPoints.intro}
              </p>
            </div>

            {/* Pain point rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {sortedPainPoints.map((point, i) => (
                <PainPointRow key={i} point={point} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
