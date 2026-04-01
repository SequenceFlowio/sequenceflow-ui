"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

const INTENT_COLORS_LIST = [
  "#B4F000","#60a5fa","#a78bfa","#f87171",
  "#fb923c","#eab308","#2dd4bf","#f472b6",
];

// ─── Locked / upgrade state ───────────────────────────────────────────────────

function LockedAnalytics() {
  return (
    <div style={{ position: "relative", minHeight: "60vh" }}>
      <div style={{ filter: "blur(6px)", pointerEvents: "none", userSelect: "none", opacity: 0.4 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "32px" }}>
          {["Emails Processed", "Auto-resolve", "Avg Confidence", "Avg Latency"].map(l => (
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
            Analytics
          </p>
          <p style={{ fontSize: "13px", color: "var(--muted)", margin: "0 0 24px", lineHeight: 1.6 }}>
            Volledige analytics zijn beschikbaar vanaf het Growth plan. Upgrade om inzichten te zien over je AI-prestaties.
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
            Upgrade naar Growth →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [overview,  setOverview]  = useState<Overview | null>(null);
  const [volume,    setVolume]    = useState<VolumeRow[]>([]);
  const [intents,   setIntents]   = useState<IntentRow[]>([]);
  const [insights,  setInsights]  = useState<Insight[]>([]);
  const [locked,    setLocked]    = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

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
        setError("Kon analytics niet laden.");
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  const pageStyle: React.CSSProperties = {
    maxWidth: "1100px",
    margin: "0 auto",
    padding: "52px 44px",
  };

  if (loading) {
    return (
      <div style={pageStyle}>
        <p style={{ color: "var(--muted)", fontSize: "13px" }}>Laden…</p>
      </div>
    );
  }

  if (locked) {
    return (
      <div style={pageStyle}>
        <h1 style={{ fontSize: "26px", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 8px" }}>Analytics</h1>
        <p style={{ fontSize: "14px", color: "var(--muted)", margin: "0 0 40px" }}>
          Inzichten over de prestaties van je AI-assistent.
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

  // Compute daily auto-resolve rate from volume data (real data, no extra endpoint needed)
  const autoRateTrend = volume
    .filter(row => row.count > 0)
    .map(row => ({
      date:     row.date,
      autoRate: Math.round((row.auto / row.count) * 100),
    }));

  const hasData = overview !== null && overview.totalProcessed > 0;

  return (
    <div style={pageStyle}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .analytics-section { animation: fadeUp 0.2s ease; }
      `}</style>

      <div className="mb-8">
        <h1 style={{ fontSize: "26px", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 6px" }}>
          Analytics
        </h1>
        <p style={{ fontSize: "14px", color: "var(--muted)", margin: 0 }}>
          Inzichten over de prestaties van je AI-assistent — afgelopen 30 dagen.
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
              Nog geen data beschikbaar
            </p>
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
              Analytics worden gevuld zodra emails verwerkt zijn via de cron. Zorg dat Gmail gekoppeld is en de cron actief is.
            </p>
          </div>
        </div>
      )}

      {/* ── 1. KPI row ── */}
      <div className="analytics-section" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "32px" }}>
        <KpiCard
          label="Emails verwerkt"
          value={String(overview?.totalProcessed ?? 0)}
          sub="afgelopen 30 dagen"
        />
        <KpiCard
          label="Auto-opgelost"
          value={`${Math.round((overview?.autoResolveRate ?? 0) * 100)}%`}
          sub="zonder menselijke hulp"
        />
        <KpiCard
          label="Gem. vertrouwen"
          value={`${Math.round((overview?.avgConfidence ?? 0) * 100)}%`}
          sub="AI-zekerheid"
        />
        <KpiCard
          label="Gem. responstijd"
          value={overview?.avgLatencyMs ? `${(overview.avgLatencyMs / 1000).toFixed(1)}s` : "—"}
          sub="per verwerking"
        />
      </div>

      {/* ── 2. Volume chart ── */}
      <div className="analytics-section" style={{ ...card, marginBottom: "32px" }}>
        <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", margin: "0 0 20px" }}>
          E-mailvolume — afgelopen 30 dagen
        </p>
        {volume.length === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--muted)", textAlign: "center", padding: "40px 0" }}>
            Nog geen data beschikbaar.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={volume} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="date" tick={tickStyle} tickFormatter={(d: string) => d.slice(5)} />
              <YAxis tick={tickStyle} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: "12px" }} />
              <Area type="monotone" dataKey="auto"         name="Auto"         stackId="1" stroke="#B4F000" fill="rgba(180,240,0,0.18)" />
              <Area type="monotone" dataKey="human_review" name="Human review" stackId="1" stroke="#60a5fa" fill="rgba(96,165,250,0.18)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── 3. Auto-resolve rate trend ── */}
      <div className="analytics-section" style={{ ...card, marginBottom: "32px" }}>
        <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", margin: "0 0 4px" }}>
          Auto-oplossings trend
        </p>
        <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 20px" }}>
          % emails per dag automatisch opgelost zonder menselijke tussenkomst
        </p>
        {autoRateTrend.length === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--muted)", textAlign: "center", padding: "40px 0" }}>
            Nog geen data beschikbaar.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={autoRateTrend} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="date" tick={tickStyle} tickFormatter={(d: string) => d.slice(5)} />
              <YAxis tick={tickStyle} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v) => [`${v}%`, "Auto-opgelost"]}
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
          Top intents
        </p>
        {intents.length === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--muted)", textAlign: "center", padding: "40px 0" }}>
            Nog geen data beschikbaar.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(180, intents.length * 36)}>
            <BarChart data={intents} layout="vertical" margin={{ top: 0, right: 16, left: 80, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
              <XAxis type="number" tick={tickStyle} allowDecimals={false} />
              <YAxis type="category" dataKey="intent" tick={tickStyle} width={80} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v, name) => [v, name === "count" ? "Emails" : name]}
              />
              <Bar dataKey="count" name="Emails" radius={[0, 4, 4, 0]}>
                {intents.map((_, i) => (
                  <Cell key={i} fill={INTENT_COLORS_LIST[i % INTENT_COLORS_LIST.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── 5. AI Health Insights ── */}
      <div className="analytics-section">
        <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", margin: "0 0 14px" }}>
          AI-gezondheid
        </p>
        {insights.length === 0 ? (
          <div style={{ ...card, display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "20px" }}>✅</span>
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
              Geen problemen gevonden. Je AI presteert goed op alle intents.
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
                  Oplossen →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
