"use client";

import type React from "react";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

// ── Types ──────────────────────────────────────────────────────────────────────

export type KpiTrend = { pct: number | null };

export type DashboardData = {
  metrics: {
    customerQuestions: number;
    aiDraftsGenerated: number;
    aiAcceptanceRate: number | null;
    avgResponseTimeMs: number | null;
  };
  trends: {
    customerQuestions: KpiTrend;
    aiDraftsGenerated: KpiTrend;
    aiAcceptanceRate: KpiTrend;
    avgResponseTime: KpiTrend;
  };
  workload: {
    acceptedThisMonth: number;
    savedMinutes: number;
  };
  activityByDay: Array<{ date: string; count: number }>;
  recentActivity: Array<{ ts: string; event: string }>;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatResponseTime(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${Math.round(rate * 100)}%`;
}

function acceptanceColor(rate: number | null): string {
  if (rate === null) return "var(--text)";
  const p = rate * 100;
  if (p >= 70) return "#C7F56F";
  if (p >= 40) return "#f59e0b";
  return "#ef4444";
}

// ── Trend badge ────────────────────────────────────────────────────────────────

function TrendBadge({
  trend,
  invertGood = false,
  pp = false,
}: {
  trend: KpiTrend;
  invertGood?: boolean;
  pp?: boolean;
}) {
  const { t } = useTranslation();

  if (trend.pct === null) {
    return <span style={styles.trendMuted}>{t.dashboard.noPreviousData}</span>;
  }

  const isPositive = invertGood ? trend.pct < 0 : trend.pct > 0;
  const color =
    trend.pct === 0 ? "var(--muted)" : isPositive ? "#C7F56F" : "#ef4444";
  const sign = trend.pct > 0 ? "+" : "";
  const suffix = pp ? "pp" : "%";

  return (
    <span style={{ ...styles.trend, color }}>
      {sign}{trend.pct}{suffix} {t.dashboard.vsLastWeek}
    </span>
  );
}

// ── SVG area chart ─────────────────────────────────────────────────────────────

function ActivityChart({
  data,
  emptyLabel,
}: {
  data: Array<{ date: string; count: number }>;
  emptyLabel: string;
}) {
  const hasData = data.some((d) => d.count > 0);

  if (!hasData) {
    return <div style={styles.emptyChart}>{emptyLabel}</div>;
  }

  const W = 880, H = 130;
  const padL = 28, padR = 8, padT = 10, padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = data.length;
  const maxY = Math.max(...data.map((d) => d.count), 1);

  const px = (i: number) => padL + (i / Math.max(n - 1, 1)) * plotW;
  const py = (v: number) => padT + (1 - v / maxY) * plotH;

  const lineParts = data.map(
    (d, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(d.count).toFixed(1)}`
  );
  const line = lineParts.join(" ");
  const area = `${line} L${px(n - 1).toFixed(1)},${(padT + plotH).toFixed(1)} L${padL.toFixed(1)},${(padT + plotH).toFixed(1)} Z`;

  const labelStep = Math.max(1, Math.floor(n / 5));
  const labelIndices = Array.from({ length: n }, (_, i) => i).filter(
    (i) => i % labelStep === 0 || i === n - 1
  );

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "130px", display: "block", overflow: "visible" }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sfAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C7F56F" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#C7F56F" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sfAreaGrad)" />
      <path
        d={line}
        fill="none"
        stroke="#C7F56F"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {labelIndices.map((i) => {
        const d = data[i];
        // Noon UTC avoids date-boundary timezone shifts
        const date = new Date(d.date + "T12:00:00Z");
        const label = date.toLocaleDateString("en", {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        });
        return (
          <text
            key={i}
            x={px(i).toFixed(1)}
            y={H - 5}
            textAnchor="middle"
            fontSize="9"
            style={{ fill: "var(--muted)" } as React.CSSProperties}
          >
            {label}
          </text>
        );
      })}
      <text
        x={padL - 4}
        y={padT + 7}
        textAnchor="end"
        fontSize="9"
        style={{ fill: "var(--muted)" } as React.CSSProperties}
      >
        {maxY}
      </text>
      <text
        x={padL - 4}
        y={padT + plotH}
        textAnchor="end"
        fontSize="9"
        style={{ fill: "var(--muted)" } as React.CSSProperties}
      >
        0
      </text>
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function DashboardClient({ data }: { data: DashboardData }) {
  const { t } = useTranslation();
  const { metrics, trends, workload, activityByDay, recentActivity } = data;

  const savedHours = (workload.savedMinutes / 60).toFixed(1);

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>{t.dashboard.title}</h1>
        <p style={styles.subtitle}>{t.dashboard.subtitle}</p>
      </div>

      {/* SECTION 1 — KPI Cards */}
      <div style={styles.kpiGrid}>
        {/* Customer Questions */}
        <div style={styles.card} className="card-hover">
          <div style={styles.metricValue}>
            {metrics.customerQuestions === 0 ? (
              <span style={styles.emptyValue}>{t.dashboard.noQuestionsYet}</span>
            ) : (
              metrics.customerQuestions
            )}
          </div>
          <div style={styles.metricLabel}>{t.dashboard.customerQuestions}</div>
          <TrendBadge trend={trends.customerQuestions} />
        </div>

        {/* AI Drafts Generated */}
        <div style={styles.card} className="card-hover">
          <div style={styles.metricValue}>
            {metrics.aiDraftsGenerated === 0 ? (
              <span style={styles.emptyValue}>{t.dashboard.noQuestionsYet}</span>
            ) : (
              metrics.aiDraftsGenerated
            )}
          </div>
          <div style={styles.metricLabel}>{t.dashboard.aiDraftsGenerated}</div>
          <TrendBadge trend={trends.aiDraftsGenerated} />
        </div>

        {/* AI Acceptance Rate */}
        <div style={styles.card} className="card-hover">
          <div style={{ ...styles.metricValue, color: acceptanceColor(metrics.aiAcceptanceRate) }}>
            {metrics.aiAcceptanceRate === null ? (
              <span style={styles.emptyValue}>{t.dashboard.noQuestionsYet}</span>
            ) : (
              formatRate(metrics.aiAcceptanceRate)
            )}
          </div>
          <div style={styles.metricLabel}>{t.dashboard.aiAcceptanceRate}</div>
          <TrendBadge trend={trends.aiAcceptanceRate} pp />
        </div>

        {/* Avg Response Time */}
        <div style={styles.card} className="card-hover">
          <div style={styles.metricValue}>
            {metrics.avgResponseTimeMs === null ? (
              <span style={styles.emptyValue}>{t.dashboard.noQuestionsYet}</span>
            ) : (
              formatResponseTime(metrics.avgResponseTimeMs)
            )}
          </div>
          <div style={styles.metricLabel}>{t.dashboard.avgResponseTime}</div>
          <TrendBadge trend={trends.avgResponseTime} invertGood />
        </div>
      </div>

      {/* SECTION 2 — Workload Saved */}
      <div style={styles.workloadCard} className="card-hover">
        <div style={styles.workloadInner}>
          <div>
            <div style={styles.workloadTitle}>{t.dashboard.workloadTitle}</div>
            <div style={styles.workloadSubtext}>{t.dashboard.workloadSubtext}</div>
          </div>
          <div style={styles.workloadRight}>
            {workload.savedMinutes === 0 ? (
              <span style={styles.workloadEmpty}>{t.dashboard.noActivityThisMonth}</span>
            ) : (
              <>
                <span style={styles.workloadHours}>{savedHours}h</span>
                <span style={styles.workloadSuffix}> {t.dashboard.workloadSavedThisMonth}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 3 — Questions Over Time */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>{t.dashboard.chartTitle}</h2>
        <div style={styles.chartCard}>
          <ActivityChart
            data={activityByDay}
            emptyLabel={t.dashboard.noChartActivity}
          />
        </div>
      </div>

      {/* SECTION 4 — Recent Activity */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>{t.dashboard.activityTitle}</h2>
        <div style={styles.activityCard}>
          {recentActivity.length === 0 ? (
            <div style={styles.emptyActivity}>{t.dashboard.noActivityFeed}</div>
          ) : (
            recentActivity.map((item, i) => {
              const time = new Date(item.ts).toLocaleTimeString("en", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
                timeZone: "UTC",
              });
              return (
                <div
                  key={i}
                  style={
                    i < recentActivity.length - 1
                      ? { ...styles.activityRow, ...styles.activityDivider }
                      : styles.activityRow
                  }
                >
                  <span style={styles.activityTime}>{time}</span>
                  <span style={styles.activityEvent}>{item.event}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: "52px 44px",
    maxWidth: "960px",
    margin: "0 auto",
    minHeight: "100vh",
    background: "var(--bg)",
    color: "var(--text)",
  },
  header: { marginBottom: "40px" },
  title: {
    fontSize: "26px",
    fontWeight: 600,
    marginBottom: "6px",
    color: "var(--text)",
    letterSpacing: "-0.02em",
  },
  subtitle: {
    color: "var(--muted)",
    fontSize: "14px",
    lineHeight: 1.5,
  },

  // KPI grid
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "14px",
    marginBottom: "16px",
  },
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    padding: "22px 20px 18px",
    borderRadius: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },
  metricValue: {
    fontSize: "26px",
    fontWeight: 600,
    color: "var(--text)",
    letterSpacing: "-0.02em",
    minHeight: "34px",
    display: "flex",
    alignItems: "center",
  },
  metricLabel: {
    fontSize: "11px",
    color: "var(--muted)",
    letterSpacing: "0.01em",
    marginBottom: "2px",
  },
  trend: {
    fontSize: "11px",
    fontWeight: 500,
  },
  trendMuted: {
    fontSize: "11px",
    color: "var(--muted)",
  },
  emptyValue: {
    fontSize: "13px",
    color: "var(--muted)",
    fontWeight: 400,
    letterSpacing: 0,
  },

  // Workload saved
  workloadCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "14px",
    padding: "20px 24px",
    marginBottom: "36px",
    marginTop: "4px",
  },
  workloadInner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
  },
  workloadTitle: {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--text)",
    marginBottom: "3px",
  },
  workloadSubtext: {
    fontSize: "12px",
    color: "var(--muted)",
  },
  workloadRight: {
    display: "flex",
    alignItems: "baseline",
    flexShrink: 0,
  },
  workloadHours: {
    fontSize: "28px",
    fontWeight: 700,
    color: "#C7F56F",
    letterSpacing: "-0.03em",
  },
  workloadSuffix: {
    fontSize: "13px",
    color: "var(--muted)",
    marginLeft: "6px",
  },
  workloadEmpty: {
    fontSize: "13px",
    color: "var(--muted)",
  },

  // Sections
  section: {
    marginBottom: "32px",
  },
  sectionTitle: {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--muted)",
    marginBottom: "10px",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  chartCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "14px",
    padding: "18px 20px 10px",
  },
  emptyChart: {
    padding: "40px 0",
    textAlign: "center",
    color: "var(--muted)",
    fontSize: "13px",
  },

  // Activity feed
  activityCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "14px",
    padding: "4px 0",
  },
  activityRow: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "11px 20px",
    fontSize: "13px",
  },
  activityDivider: {
    borderBottom: "1px solid var(--border)",
  },
  activityTime: {
    color: "var(--muted)",
    fontSize: "12px",
    fontVariantNumeric: "tabular-nums",
    minWidth: "38px",
    flexShrink: 0,
  },
  activityEvent: {
    color: "var(--text)",
  },
  emptyActivity: {
    padding: "24px 20px",
    color: "var(--muted)",
    fontSize: "13px",
  },
};
