"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type Overview = {
  totalProcessed:  number;
  autoResolveRate: number;
  escalationRate:  number;
  pendingCount:    number;
  avgConfidence:   number;
  avgLatencyMs:    number;
};

type VolumeRow = {
  date:         string;
  count:        number;
  auto:         number;
  human_review: number;
};

type IntentRow = {
  intent:        string;
  label:         string;
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

type Period = "daily" | "weekly" | "monthly";

type PainPointData = {
  id:               string;
  generated_at:     string;
  period:           Period;
  date_range_label: string;
  ticket_count:     number;
  intro:            string;
  pain_points:      PainPoint[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pageTitleStyle: React.CSSProperties = {
  fontSize: "28px",
  fontWeight: 800,
  letterSpacing: "-0.03em",
  color: "var(--text)",
  margin: 0,
};

const pageSubtitleStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "var(--muted)",
  marginTop: "8px",
  lineHeight: 1.7,
  maxWidth: 720,
};

const eyebrowStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "11px",
  fontWeight: 700,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const card: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "16px",
  padding: "20px 24px",
  boxShadow: "0 18px 36px rgba(15,23,42,0.035)",
};

const sectionCard: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "16px",
  overflow: "hidden",
  boxShadow: "0 18px 36px rgba(15,23,42,0.035)",
};

const sectionHeader: React.CSSProperties = {
  padding: "14px 18px",
  borderBottom: "1px solid var(--border)",
  display: "grid",
  gap: 6,
  background: "rgba(255,255,255,0.65)",
};

const sectionBody: React.CSSProperties = {
  padding: "18px",
};

const segmentedWrapStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: 4,
  borderRadius: 16,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
  width: "fit-content",
  flexWrap: "wrap",
};

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ ...card, padding: "22px 24px", background: "rgba(255,255,255,0.82)" }}>
      <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>
        {label}
      </p>
      <p style={{ fontSize: "36px", fontWeight: 900, color: "var(--text)", margin: "0 0 4px", letterSpacing: "-0.04em", lineHeight: 1 }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0, lineHeight: 1.65 }}>{sub}</p>}
    </div>
  );
}

const INTENT_COLORS_LIST = [
  "#C7F56F","#60a5fa","#a78bfa","#f87171",
  "#fb923c","#eab308","#2dd4bf","#f472b6",
];

function AnalyticsStatusIcon({
  kind,
  size = 20,
  color = "currentColor",
}: {
  kind: "mail" | "check" | "warning" | "triangle" | "chart" | "search";
  size?: number;
  color?: string;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    style: { flexShrink: 0, display: "block" },
    "aria-hidden": true,
  };

  if (kind === "mail") {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </svg>
    );
  }
  if (kind === "check") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12.5 2.3 2.3 4.7-5.3" />
      </svg>
    );
  }
  if (kind === "warning") {
    return (
      <svg {...common}>
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.3 3.9 1.8 18.3a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      </svg>
    );
  }
  if (kind === "triangle") {
    return (
      <svg {...common}>
        <path d="m12 3 9 16H3L12 3Z" />
      </svg>
    );
  }
  if (kind === "search") {
    return (
      <svg {...common}>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.2-3.2" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <line x1="4" y1="20" x2="20" y2="20" />
      <rect x="6" y="11" width="3" height="6" rx="1" />
      <rect x="11" y="8" width="3" height="9" rx="1" />
      <rect x="16" y="5" width="3" height="12" rx="1" />
    </svg>
  );
}

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
          background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(244,248,232,0.92))", border: "1px solid rgba(199,245,111,0.24)",
          borderRadius: "16px", padding: "40px 48px", textAlign: "center",
          maxWidth: "400px", boxShadow: "0 8px 40px rgba(0,0,0,0.25)",
        }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
            <AnalyticsStatusIcon kind="chart" size={30} color="var(--sf-text-subtle)" />
          </div>
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
              background: "#C7F56F", color: "#1a1a1a",
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
        transition: "border-color 0.15s, transform 0.15s",
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
          <span style={{ fontSize: "20px", fontWeight: 700, color: "#C7F56F" }}>
            {point.percentage}%
          </span>
          <p style={{ fontSize: "11px", color: "var(--muted)", margin: "2px 0 0" }}>
            {point.count} {t.analytics.ticketsLabel}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: "4px", borderRadius: "2px", background: "var(--border)", marginTop: "12px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${point.percentage}%`, borderRadius: "2px", background: "#C7F56F", transition: "width 0.4s ease" }} />
      </div>

      {/* Expandable example */}
      {expanded && (
        <p style={{
          fontSize: "13px", color: "var(--muted)", fontStyle: "italic",
          margin: "12px 0 0", lineHeight: 1.6,
          borderLeft: "3px solid var(--border)", paddingLeft: "12px",
        }}>
          &ldquo;{point.example}&rdquo;
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

  const [activePeriod, setActivePeriod] = useState<Period>("weekly");
  const [painPointsLocked, setPainPointsLocked] = useState(false);

  // Per-period state
  const [ppData,        setPpData]        = useState<Partial<Record<Period, PainPointData>>>({});
  const [ppLoading,     setPpLoading]     = useState<Partial<Record<Period, boolean>>>({});
  const [ppRefreshing,  setPpRefreshing]  = useState<Partial<Record<Period, boolean>>>({});
  const [ppInsufficient,setPpInsufficient]= useState<Partial<Record<Period, boolean>>>({});

  async function loadPainPoints(period: Period, force = false) {
    if (force) {
      setPpRefreshing(p => ({ ...p, [period]: true }));
    } else {
      if (ppData[period] || ppLoading[period]) return; // already loaded or loading
      setPpLoading(p => ({ ...p, [period]: true }));
    }
    try {
      const res = await fetch(
        `/api/analytics/pain-points?period=${period}`,
        { method: force ? "POST" : "GET" }
      );
      if (res.status === 403) {
        const body = await res.json();
        if (body.upgrade) setPainPointsLocked(true);
        return;
      }
      const data = await res.json();
      if (data.insufficient) {
        setPpInsufficient(p => ({ ...p, [period]: true }));
        return;
      }
      if (data.pain_points) {
        setPpData(p => ({ ...p, [period]: data as PainPointData }));
        setPpInsufficient(p => ({ ...p, [period]: false }));
      }
    } catch {
      // silently fail — pain points are non-critical
    } finally {
      setPpLoading(p      => ({ ...p, [period]: false }));
      setPpRefreshing(p   => ({ ...p, [period]: false }));
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
    loadPainPoints("weekly");
    loadPainPoints("monthly");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pageStyle: React.CSSProperties = {
    maxWidth: "1120px",
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

  const totalResolved  = overview ? Math.round((overview.autoResolveRate  ?? 0) * (overview.totalProcessed ?? 0)) : 0;
  const totalEscalated = overview ? Math.round((overview.escalationRate   ?? 0) * (overview.totalProcessed ?? 0)) : 0;
  const totalPending   = overview?.pendingCount ?? 0;
  const breakdownData = [
    { label: ta.breakdownAuto,      value: totalResolved,   color: "#C7F56F",  pct: overview?.totalProcessed ? Math.round((totalResolved  / overview.totalProcessed) * 100) : 0 },
    { label: ta.breakdownEscalated, value: totalEscalated,  color: "#f87171",  pct: overview?.totalProcessed ? Math.round((totalEscalated / overview.totalProcessed) * 100) : 0 },
    { label: ta.breakdownPending,   value: totalPending,    color: "#fbbf24",  pct: overview?.totalProcessed ? Math.round((totalPending   / overview.totalProcessed) * 100) : 0 },
  ].filter(d => d.value > 0);

  const hasData = overview !== null && overview.totalProcessed > 0;

  const PERIOD_TABS: { id: Period; label: string }[] = [
    { id: "weekly",  label: ta.periodWeekly  },
    { id: "monthly", label: ta.periodMonthly },
    { id: "daily",   label: ta.periodDaily   },
  ];

  const activePpData        = ppData[activePeriod] ?? null;
  const activePpLoading     = ppLoading[activePeriod] ?? false;
  const activePpRefreshing  = ppRefreshing[activePeriod] ?? false;
  const activePpInsufficient= ppInsufficient[activePeriod] ?? false;
  const sortedPainPoints    = activePpData
    ? [...activePpData.pain_points].sort((a, b) => b.count - a.count)
    : [];

  return (
    <div style={pageStyle} className="analytics-page">
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
        @media (max-width: 768px) {
          .analytics-page { padding: 20px 16px !important; }
          .analytics-kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      <div className="mb-8" style={{ display: "grid", gap: 10 }}>
        <div>
          <h1 style={pageTitleStyle}>
          {ta.title}
          </h1>
          <p style={pageSubtitleStyle}>
          {ta.subtitle}
          </p>
        </div>
      </div>

      {/* ── No data yet ── */}
      {!hasData && (
        <div style={{
          ...card, marginBottom: "32px",
          display: "flex", alignItems: "center", gap: "14px",
          padding: "20px 24px",
        }}>
          <AnalyticsStatusIcon kind="mail" size={22} color="var(--sf-text-subtle)" />
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
      <div className="analytics-section analytics-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "32px" }}>
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
          label={ta.kpiPending}
          value={String(overview?.pendingCount ?? 0)}
          sub={ta.kpiPendingSub}
        />
      </div>

      {/* ── 2. Volume chart ── */}
      <div className="analytics-section" style={{ ...sectionCard, marginBottom: "32px" }}>
        <div style={sectionHeader}>
          <p style={eyebrowStyle}>{ta.title}</p>
          <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>{ta.volumeTitle}</p>
        </div>
        <div style={sectionBody}>
        {volume.length === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--muted)", textAlign: "center", padding: "28px 0", margin: 0 }}>
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
              <Area type="monotone" dataKey="count"        name={ta.areaTotal}       stackId="2" stroke="#9ca3af" fill="rgba(156,163,175,0.10)" strokeDasharray="4 2" />
              <Area type="monotone" dataKey="auto"         name={ta.areaAuto}        stackId="1" stroke="#C7F56F" fill="rgba(199,245,111,0.18)" />
              <Area type="monotone" dataKey="human_review" name={ta.areaHumanReview} stackId="1" stroke="#60a5fa" fill="rgba(96,165,250,0.18)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
        </div>
      </div>

      {/* ── 3. Response breakdown ── */}
      <div className="analytics-section" style={{ ...sectionCard, marginBottom: "32px" }}>
        <div style={sectionHeader}>
          <p style={eyebrowStyle}>{ta.kpiEmailsProcessed}</p>
          <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>{ta.breakdownTitle}</p>
        </div>
        <div style={sectionBody}>
        {breakdownData.length === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--muted)", textAlign: "center", padding: "20px 0", margin: 0 }}>
            {ta.volumeNoData}
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {breakdownData.map(({ label, value, color, pct }) => (
              <div key={label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                  <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 500 }}>{label}</span>
                  <span style={{ fontSize: "12px", color: "var(--text)", fontWeight: 600 }}>
                    {value} <span style={{ color: "var(--muted)", fontWeight: 400 }}>({pct}%)</span>
                  </span>
                </div>
                <div style={{ height: "6px", borderRadius: "3px", background: "var(--border)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "3px", transition: "width 0.5s ease" }} />
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>

      {/* ── 4. Intent breakdown ── */}
      <div className="analytics-section" style={{ ...sectionCard, marginBottom: "32px" }}>
        <div style={sectionHeader}>
          <p style={eyebrowStyle}>{ta.emailsLabel}</p>
          <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>{ta.topIntentsTitle}</p>
        </div>
        <div style={sectionBody}>
        {intents.length === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--muted)", textAlign: "center", padding: "28px 0", margin: 0 }}>
            {ta.topIntentsNoData}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(180, intents.length * 40)}>
            <BarChart data={intents} layout="vertical" margin={{ top: 0, right: 8, left: 80, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
              <XAxis type="number" tick={tickStyle} allowDecimals={false} />
              <YAxis type="category" dataKey="label" tick={{ ...tickStyle, fontSize: 10 }} width={80} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v, name) => [v, name === "count" ? ta.emailsLabel : name]}
              />
              <Bar dataKey="count" name={ta.emailsLabel} radius={[0, 4, 4, 0]}>
                {intents.map((row, i) => (
                  <Cell
                    key={i}
                    fill={row.intent === "fallback" || row.intent === "unknown"
                      ? "rgba(107,114,128,0.5)"
                      : INTENT_COLORS_LIST[i % INTENT_COLORS_LIST.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        </div>
      </div>

      {/* ── 5. AI Health Insights ── */}
      <div className="analytics-section" style={{ marginBottom: "40px" }}>
        <div style={{ marginBottom: "14px", display: "grid", gap: 6 }}>
          <p style={eyebrowStyle}>{ta.title}</p>
          <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)", margin: 0 }}>{ta.aiHealthTitle}</p>
        </div>
        {insights.length === 0 ? (
          <div style={{ ...card, display: "flex", alignItems: "center", gap: "12px" }}>
            <AnalyticsStatusIcon kind="check" size={20} color="#22c55e" />
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
                <AnalyticsStatusIcon
                  kind={ins.type === "low_confidence" ? "warning" : "triangle"}
                  size={18}
                  color={ins.type === "low_confidence" ? "#fbbf24" : "#f87171"}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "13px", color: "var(--text)", margin: "0 0 4px", lineHeight: 1.5 }}>
                    {ins.message}
                  </p>
                </div>
                <Link
                  href="/knowledge"
                  style={{
                    flexShrink: 0, fontSize: "12px", fontWeight: 600,
                    color: "#C7F56F", textDecoration: "none", whiteSpace: "nowrap",
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
          <div style={{ display: "grid", gap: 6 }}>
            <p style={eyebrowStyle}>{ta.title}</p>
            <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)", margin: 0 }}>
            {ta.painPointsTitle}
            </p>
          </div>
          <span style={{
            fontSize: "11px", fontWeight: 700, color: "#000",
            background: "#C7F56F", borderRadius: 6,
            padding: "2px 9px", letterSpacing: "0.04em",
          }}>
            PRO
          </span>

          {/* Right-aligned: refresh button */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "12px" }}>
            {!painPointsLocked && !activePpInsufficient && activePeriod !== "daily" && (
              <button
                className="btn-secondary"
                onClick={() => loadPainPoints(activePeriod, true)}
                disabled={activePpRefreshing}
                style={{
                  fontSize: "12px", fontWeight: 500,
                  padding: "5px 12px", borderRadius: "7px",
                  opacity: activePpRefreshing ? 0.6 : 1,
                  cursor: activePpRefreshing ? "not-allowed" : "pointer",
                }}
              >
                {activePpRefreshing ? ta.painPointsRefreshing : ta.painPointsReanalyze}
              </button>
            )}
          </div>
        </div>

        {/* Period tabs */}
        {!painPointsLocked && (
          <div style={{ marginBottom: "20px" }}>
            <div style={segmentedWrapStyle}>
              {PERIOD_TABS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => {
                    setActivePeriod(id);
                    if (id !== "daily") loadPainPoints(id);
                  }}
                  style={{
                    minHeight: 40,
                    padding: "0 16px", border: "none", background: activePeriod === id ? "var(--surface-2)" : "transparent",
                    cursor: "pointer", fontSize: "13px",
                    fontWeight: activePeriod === id ? 700 : 600,
                    color: activePeriod === id ? "var(--text)" : "var(--muted)",
                    boxShadow: activePeriod === id ? "0 6px 18px rgba(15,23,42,0.08)" : "none",
                    borderRadius: 12,
                    transition: "all 0.15s", whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Date range label */}
            <p style={{ fontSize: "12px", color: "var(--muted)", margin: "8px 0 0" }}>
              {activePeriod === "daily"   && `${ta.dateRangeToday} — ${activePpData?.date_range_label ?? new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}`}
              {activePeriod === "weekly"  && (activePpData?.date_range_label ?? ta.dateRangeWeekFallback)}
              {activePeriod === "monthly" && (activePpData?.date_range_label ?? ta.dateRangeMonthFallback)}
            </p>
          </div>
        )}

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
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "10px" }}>
                  <AnalyticsStatusIcon kind="search" size={24} color="var(--sf-text-subtle)" />
                </div>
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
                    background: "#C7F56F", color: "#1a1a1a",
                    fontSize: "13px", fontWeight: 700, textDecoration: "none",
                  }}
                >
                  {ta.upgradeCta}
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Daily — manual trigger */}
        {!painPointsLocked && activePeriod === "daily" && !activePpData && !activePpLoading && !activePpInsufficient && (
          <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
              {ta.dailyTriggerDesc}
            </p>
            <button
              className="btn-secondary"
              onClick={() => loadPainPoints("daily")}
              style={{ fontSize: "12px", fontWeight: 600, padding: "7px 16px", borderRadius: "7px", whiteSpace: "nowrap", cursor: "pointer" }}
            >
              {ta.dailyTriggerButton}
            </button>
          </div>
        )}

        {/* Insufficient data */}
        {!painPointsLocked && activePpInsufficient && (
          <div style={{ ...card, display: "flex", alignItems: "center", gap: "12px" }}>
            <AnalyticsStatusIcon kind="mail" size={20} color="var(--sf-text-subtle)" />
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
              {activePeriod === "daily" ? ta.insufficientDataDaily : ta.painPointsInsufficientData}
            </p>
          </div>
        )}

        {/* Loading skeleton */}
        {!painPointsLocked && !activePpInsufficient && activePpLoading && (
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
        {!painPointsLocked && !activePpInsufficient && !activePpLoading && activePpData && (
          <div className="tab-animate">
            {/* AI briefing intro */}
            <div style={{ ...card, borderLeft: "3px solid #C7F56F", marginBottom: "16px", padding: "18px 20px" }}>
              <p style={{
                fontSize: "11px", fontWeight: 700, color: "#C7F56F",
                textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px",
              }}>
                {ta.aiBriefingLabel}
              </p>
              <p style={{ fontSize: "14px", color: "var(--text)", margin: 0, lineHeight: 1.7 }}>
                {activePpData.intro}
              </p>
            </div>

            {/* Daily: re-analyze button */}
            {activePeriod === "daily" && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
                <button
                  className="btn-secondary"
                  onClick={() => loadPainPoints("daily", true)}
                  disabled={activePpRefreshing}
                  style={{
                    fontSize: "12px", fontWeight: 500,
                    padding: "5px 12px", borderRadius: "7px",
                    opacity: activePpRefreshing ? 0.6 : 1,
                    cursor: activePpRefreshing ? "not-allowed" : "pointer",
                  }}
                >
                  {activePpRefreshing ? ta.painPointsRefreshing : ta.painPointsReanalyze}
                </button>
              </div>
            )}

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
