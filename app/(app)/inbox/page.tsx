"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { createClient } from "@/lib/supabaseClient";
import { useUpgradeModal } from "@/lib/upgradeModal";

type InboxTab = "draft" | "sent" | "escalated";

type Ticket = {
  id: string;
  subject: string;
  from_email: string;
  from_name: string | null;
  intent: string | null;
  confidence: number | null;
  status: string;
  created_at: string;
  escalation_department: string | null;
};

const INTENT_COLORS: Record<string, { bg: string; color: string }> = {
  order_status:     { bg: "rgba(59,130,246,0.14)",  color: "#60a5fa" },
  shipping:         { bg: "rgba(59,130,246,0.14)",  color: "#60a5fa" },
  return_request:   { bg: "rgba(139,92,246,0.14)",  color: "#a78bfa" },
  cancellation:     { bg: "rgba(139,92,246,0.14)",  color: "#a78bfa" },
  exchange:         { bg: "rgba(139,92,246,0.14)",  color: "#a78bfa" },
  damaged:          { bg: "rgba(239,68,68,0.14)",   color: "#f87171" },
  damage:           { bg: "rgba(239,68,68,0.14)",   color: "#f87171" },
  complaint:        { bg: "rgba(239,68,68,0.14)",   color: "#f87171" },
  warranty:         { bg: "rgba(249,115,22,0.14)",  color: "#fb923c" },
  missing_items:    { bg: "rgba(249,115,22,0.14)",  color: "#fb923c" },
  payment:          { bg: "rgba(234,179,8,0.14)",   color: "#eab308" },
  product_question: { bg: "rgba(20,184,166,0.14)",  color: "#2dd4bf" },
  compliment:       { bg: "#C7F56F",                   color: "#000" },
  unknown:          { bg: "rgba(107,114,128,0.14)", color: "#9ca3af" },
  fallback:         { bg: "rgba(107,114,128,0.14)", color: "#9ca3af" },
};

function intentColor(intent: string | null) {
  if (!intent) return INTENT_COLORS.fallback;
  return INTENT_COLORS[intent] ?? INTENT_COLORS.fallback;
}

function Badge({ bg, color, label }: { bg: string; color: string; label: string }) {
  return (
    <span style={{
      fontSize: "11px", fontWeight: 600, borderRadius: "6px",
      padding: "2px 8px", background: bg, color,
      letterSpacing: "0.03em", display: "inline-block", whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

function StatusIcon({
  kind,
  size = 18,
  color = "currentColor",
}: {
  kind: "warning" | "mail" | "send" | "check" | "clock";
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

  if (kind === "warning") {
    return (
      <svg {...common}>
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.3 3.9 1.8 18.3a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      </svg>
    );
  }
  if (kind === "mail") {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </svg>
    );
  }
  if (kind === "send") {
    return (
      <svg {...common}>
        <path d="M3 20 21 12 3 4v6l12 2-12 2z" />
      </svg>
    );
  }
  if (kind === "clock") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.3 2.3 4.7-5.3" />
    </svg>
  );
}

// SLA: weekdays only — warn at 8h, critical at 12h
function getSLA(createdAt: string): { label: string; color: string; bg: string; pulse: boolean } | null {
  const created = new Date(createdAt);
  const day = created.getDay(); // 0=Sun 6=Sat
  if (day === 0 || day === 6) return null; // weekend

  const hours = (Date.now() - created.getTime()) / 3_600_000;
  if (hours >= 12) return { label: `${Math.floor(hours)}u`, color: "#f87171", bg: "rgba(239,68,68,0.15)", pulse: true };
  if (hours >= 8)  return { label: `${Math.floor(hours)}u`, color: "#fbbf24", bg: "rgba(251,191,36,0.15)", pulse: false };
  return { label: `${Math.floor(hours)}u`, color: "#9ca3af", bg: "rgba(107,114,128,0.10)", pulse: false };
}

export default function InboxPage() {
  const { t } = useTranslation();
  const { open: openUpgrade } = useUpgradeModal();
  const [activeTab, setActiveTab] = useState<InboxTab>("draft");
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [forwardingActive, setForwardingActive] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [usageWarning, setUsageWarning] = useState<{ used: number; limit: number } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autosendTimes, setAutosendTimes] = useState<{ time1: string; time2: string } | null>(null);
  const [signatureMissing, setSignatureMissing] = useState(false);

  // Tick every minute to keep SLA timers fresh
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  async function load() {
    setError(null);
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        const { data: member } = await supabase
          .from("tenant_members")
          .select("tenant_id")
          .eq("user_id", user.id)
          .single();

        if (!member?.tenant_id) { setLoading(false); return; }

        const { data: rows } = await supabase
          .from("tickets")
          .select("id, subject, from_email, from_name, intent, confidence, status, created_at, escalation_department")
          .eq("tenant_id", member.tenant_id)
          .order("created_at", { ascending: false });

        const tickets = rows ?? [];
        setAllTickets(tickets);
        // Forwarding is considered active once the first email has ever been received
        setForwardingActive(tickets.length > 0);

        // Check usage limit (non-critical)
        fetch("/api/billing/usage")
          .then(r => r.ok ? r.json() : null)
          .then(usage => {
            if (usage && usage.limit > 0 && usage.used / usage.limit >= 0.8) {
              setUsageWarning({ used: usage.used, limit: usage.limit });
            }
          })
          .catch(() => {});
    } catch (err) {
      console.error("[inbox] load error:", err);
      setError(t.inbox.loadError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    fetch("/api/agent-config")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.config?.autosendEnabled) {
          setAutosendTimes({ time1: data.config.autosendTime1 ?? "08:00", time2: data.config.autosendTime2 ?? "16:00" });
        }
        if (!data?.config?.signature?.trim()) {
          setSignatureMissing(true);
        }
      })
      .catch(() => {});
  }, []);

  const draft     = allTickets.filter(t => t.status === "draft" || t.status === "pending_autosend");
  const sent      = allTickets.filter(t => t.status === "sent" || t.status === "approved");
  const escalated = [...allTickets.filter(t => t.status === "escalated")]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); // oldest first

  const tabs: { id: InboxTab; label: string; count: number }[] = [
    { id: "draft",     label: t.inbox.tabDraft,    count: draft.length     },
    { id: "sent",      label: t.inbox.tabSent,     count: sent.length      },
    { id: "escalated", label: t.inbox.tabEscalated,count: escalated.length },
  ];

  const tickets = activeTab === "draft" ? draft : activeTab === "sent" ? sent : escalated;

  // Clear selection when switching tabs
  const handleTabChange = (tab: InboxTab) => { setActiveTab(tab); setSelected(new Set()); };

  const allSelected = tickets.length > 0 && tickets.every(t => selected.has(t.id));
  const toggleAll   = () => setSelected(allSelected ? new Set() : new Set(tickets.map(t => t.id)));
  const toggleOne   = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`${selected.size} ${t.inbox.bulkDeleteConfirmSuffix}`)) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/tickets/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected] }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
      setAllTickets(prev => prev.filter(t => !selected.has(t.id)));
      setSelected(new Set());
    } catch (err) {
      console.error("[bulk-delete]", err);
      alert(t.inbox.bulkDeleteError);
    } finally {
      setDeleting(false);
    }
  }

  function nextSendLabel(t1: string, t2: string): string {
    const now  = new Date();
    const utcH = now.getUTCHours();
    const utcM = now.getUTCMinutes();
    const nowMins = utcH * 60 + utcM;
    const [h1, m1] = t1.split(":").map(Number);
    const [h2, m2] = t2.split(":").map(Number);
    if (nowMins < h1 * 60 + m1) return `${t1} UTC`;
    if (nowMins < h2 * 60 + m2) return `${t2} UTC`;
    return `${t1} UTC`; // next day
  }

  async function handleCancelAutosend(ticketId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch(`/api/tickets/${ticketId}/cancel-autosend`, { method: "POST" });
      if (res.ok) {
        setAllTickets(prev =>
          prev.map(t => t.id === ticketId ? { ...t, status: "draft" } : t)
        );
      }
    } catch {
      // silently fail
    }
  }

  const COL_DRAFT     = "28px 2fr 1.2fr 1fr 1fr 1fr";
  const COL_SENT      = "28px 2fr 1.2fr 1fr 1fr";
  const COL_ESCALATED = "28px 2fr 1.2fr 1fr 1fr 1fr";

  const colTemplate = activeTab === "sent" ? COL_SENT : activeTab === "escalated" ? COL_ESCALATED : COL_DRAFT;

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-10 sm:px-6 lg:px-10 lg:py-12">

      <style>{`
        @keyframes pulse-red {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.55; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .inbox-row { transition: background 0.12s; }
        .inbox-row:hover { background: var(--bg) !important; }
        .tab-animate { animation: fadeUp 0.18s ease; }
      `}</style>

      <div className="mb-6">
        <h1 style={{ fontSize: "26px", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text)", margin: 0 }}>
          {t.inbox.title}
        </h1>
        <p style={{ fontSize: "14px", color: "var(--muted)", marginTop: "6px" }}>
          {t.inbox.subtitle}
        </p>
      </div>

      {error && (
        <div style={{
          marginBottom: "16px", padding: "12px 16px", borderRadius: "8px",
          background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)",
          color: "#f87171", fontSize: "13px", fontWeight: 500,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
        }}>
          <span>{error}</span>
          <button
            onClick={() => { setError(null); load(); }}
            style={{ background: "none", border: "none", color: "#f87171", fontWeight: 600, textDecoration: "underline", cursor: "pointer", fontSize: "13px", padding: 0, whiteSpace: "nowrap" }}
          >
            Probeer opnieuw
          </button>
        </div>
      )}

      {usageWarning && !loading && (() => {
        const pct = Math.round((usageWarning.used / usageWarning.limit) * 100);
        const isOver = usageWarning.used >= usageWarning.limit;
        return (
          <div style={{
            marginBottom: "16px", padding: "12px 16px", borderRadius: "8px",
            background: isOver ? "rgba(239,68,68,0.10)" : "rgba(251,191,36,0.10)",
            border: `1px solid ${isOver ? "rgba(239,68,68,0.35)" : "rgba(251,191,36,0.35)"}`,
            color: isOver ? "#f87171" : "#fbbf24",
            fontSize: "13px", fontWeight: 500,
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
          }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
              {!isOver && <StatusIcon kind="warning" size={16} color="#fbbf24" />}
              {isOver
                ? `${t.inbox.limitReachedMsg} (${usageWarning.used}/${usageWarning.limit})`
                : `${pct}% ${t.inbox.limitWarningMsg} (${usageWarning.used}/${usageWarning.limit})`}
            </span>
            <button
              onClick={() => openUpgrade(isOver ? { forced: false } : undefined)}
              style={{ background: "none", border: "none", color: isOver ? "#f87171" : "#fbbf24", fontWeight: 600, textDecoration: "underline", cursor: "pointer", fontSize: "13px", padding: 0, whiteSpace: "nowrap" }}
            >
              {t.inbox.upgradeBtn}
            </button>
          </div>
        );
      })()}

      {!forwardingActive && !loading && (
        <div style={{
          marginBottom: "20px", padding: "12px 16px", borderRadius: "8px",
          background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.35)",
          color: "#fbbf24", fontSize: "13px", fontWeight: 500,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
        }}>
          <span>Set up email forwarding to start receiving emails</span>
          <Link href="/settings?tab=integrations" style={{ color: "#fbbf24", fontWeight: 600, textDecoration: "underline", whiteSpace: "nowrap" }}>
            Set up →
          </Link>
        </div>
      )}

      {signatureMissing && !loading && (
        <div style={{
          marginBottom: "20px", padding: "12px 16px", borderRadius: "8px",
          background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.28)",
          color: "#fbbf24", fontSize: "13px", fontWeight: 500,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
            <StatusIcon kind="warning" size={16} color="#fbbf24" />
            {t.inbox.noSignatureBanner}
          </span>
          <Link href="/settings?tab=policy" style={{ color: "#fbbf24", fontWeight: 600, textDecoration: "underline", whiteSpace: "nowrap" }}>
            {t.inbox.noSignatureBtn}
          </Link>
        </div>
      )}

      {/* ── Setup guide — shown only to new users with no tickets yet ── */}
      {!loading && allTickets.length === 0 && (
        <div style={{
          marginBottom: "24px", padding: "20px 24px",
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "14px",
        }}>
          <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)", margin: "0 0 4px" }}>
            Get started in 3 steps
          </p>
          <p style={{ fontSize: "13px", color: "var(--muted)", margin: "0 0 16px" }}>
            Complete this setup so the AI can start handling your customer emails.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              {
                done: forwardingActive,
                label: "Set up email forwarding",
                desc: "Required — forward your support email to SequenceFlow so the AI can process it.",
                href: "/settings?tab=integrations",
                cta: "Set up →",
              },
              {
                done: !signatureMissing,
                label: "Add your email signature",
                desc: "Required — appended to every AI reply.",
                href: "/settings?tab=policy",
                cta: "Add signature →",
              },
              {
                done: false,
                label: "Upload a knowledge document (optional)",
                desc: "Helps the AI give accurate, on-brand answers.",
                href: "/knowledge",
                cta: "Upload doc →",
              },
            ].map((step, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: "12px",
                padding: "12px 14px", borderRadius: "10px",
                background: step.done ? "rgba(199,245,111,0.06)" : "var(--bg)",
                border: `1px solid ${step.done ? "rgba(199,245,111,0.2)" : "var(--border)"}`,
              }}>
                <span style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: step.done ? "#C7F56F" : "var(--border)",
                  fontSize: "11px", fontWeight: 800,
                  color: step.done ? "#1a1a1a" : "var(--muted)",
                  marginTop: "1px",
                }}>
                  {step.done ? "✓" : i + 1}
                </span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: "0 0 2px", fontSize: "13px", fontWeight: 600, color: step.done ? "var(--muted)" : "var(--text)", textDecoration: step.done ? "line-through" : "none" }}>
                    {step.label}
                  </p>
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>{step.desc}</p>
                </div>
                {!step.done && (
                  <Link href={step.href} style={{
                    flexShrink: 0, fontSize: "12px", fontWeight: 600,
                    color: "#C7F56F", textDecoration: "none", whiteSpace: "nowrap",
                    padding: "4px 10px", borderRadius: "6px",
                    border: "1px solid rgba(199,245,111,0.3)",
                    background: "rgba(199,245,111,0.06)",
                  }}>
                    {step.cta}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="mb-0 overflow-x-auto" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex min-w-max gap-0.5">
          {tabs.map(({ id, label, count }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              style={{
                position: "relative",
                padding: "8px 18px", border: "none", background: "transparent",
                cursor: "pointer", fontSize: "13px",
                fontWeight: activeTab === id ? 600 : 400,
                color: activeTab === id ? "var(--text)" : "var(--muted)",
                borderBottom: activeTab === id ? "2px solid #C7F56F" : "2px solid transparent",
                marginBottom: "-1px", transition: "all 0.15s", whiteSpace: "nowrap",
                display: "flex", alignItems: "center", gap: "6px",
              }}
            >
              {label}
              {count > 0 && (
                <span style={{
                  fontSize: "10px", fontWeight: 700, borderRadius: "10px",
                  padding: "1px 6px", lineHeight: 1.6,
                  background: id === "escalated" && count > 0
                    ? "rgba(239,68,68,0.18)" : "#C7F56F",
                  color: id === "escalated" && count > 0 ? "#f87171" : "#000",
                }}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk-delete bar */}
      {selected.size > 0 && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 16px", marginTop: "8px", borderRadius: "10px",
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
          gap: "12px",
        }}>
          <span style={{ fontSize: "13px", color: "#f87171", fontWeight: 500 }}>
            {selected.size} {t.inbox.selectedSuffix}
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => setSelected(new Set())}
              style={{ fontSize: "12px", color: "var(--muted)", background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}
            >
              {t.inbox.deselectBtn}
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={deleting}
              style={{
                fontSize: "12px", fontWeight: 600, color: "#fff",
                background: deleting ? "rgba(239,68,68,0.4)" : "rgba(239,68,68,0.85)",
                border: "none", borderRadius: "6px", padding: "6px 14px",
                cursor: deleting ? "not-allowed" : "pointer",
              }}
            >
              {deleting ? t.inbox.deletingBtn : t.inbox.bulkDeleteBtn}
            </button>
          </div>
        </div>
      )}

      <div className="tab-animate" key={activeTab} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 14px 14px", overflow: "hidden" }}>

        {/* Header row */}
        {!loading && tickets.length > 0 && (
          <div className="hidden md:grid" style={{ gridTemplateColumns: colTemplate, padding: "11px 20px", borderBottom: "1px solid var(--border)", gap: "16px", alignItems: "center" }}>
            {/* Select-all checkbox */}
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              style={{ width: "15px", height: "15px", cursor: "pointer", accentColor: "#C7F56F" }}
            />
            {activeTab === "draft" && [t.inbox.colSubject, t.inbox.colCustomer, t.inbox.colIntent, t.inbox.colConfidence, t.inbox.colStatus].map(h => (
              <span key={h} style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</span>
            ))}
            {activeTab === "sent" && [t.inbox.colSubject, t.inbox.colCustomer, t.inbox.colIntent, t.inbox.colSent].map(h => (
              <span key={h} style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</span>
            ))}
            {activeTab === "escalated" && [t.inbox.colSubject, t.inbox.colCustomer, t.inbox.colDept, t.inbox.colSLA, t.inbox.colWait].map(h => (
              <span key={h} style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</span>
            ))}
          </div>
        )}

        {loading && (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>{t.inbox.loading}</p>
          </div>
        )}

        {!loading && tickets.length === 0 && (
          <div style={{ padding: "48px 20px", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "10px" }}>
              {activeTab === "draft" && <StatusIcon kind="mail" size={22} color="var(--sf-text-subtle)" />}
              {activeTab === "sent" && <StatusIcon kind="send" size={22} color="var(--sf-text-subtle)" />}
              {activeTab === "escalated" && <StatusIcon kind="check" size={22} color="#22c55e" />}
            </div>
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
              {activeTab === "draft" ? t.inbox.emptyDraft :
               activeTab === "sent"  ? t.inbox.emptySent :
               t.inbox.emptyEscalated}
            </p>
          </div>
        )}

        {!loading && tickets.map((ticket, i) => {
          const isLast   = i === tickets.length - 1;
          const ic       = intentColor(ticket.intent);
          const conf     = ticket.confidence ?? 0;
          const confColor = conf >= 0.8 ? "#C7F56F" : conf >= 0.6 ? "#fbbf24" : "#f87171";
          const confBg    = conf >= 0.8 ? "rgba(199,245,111,0.12)" : conf >= 0.6 ? "rgba(251,191,36,0.12)" : "rgba(239,68,68,0.12)";
          const sla      = getSLA(ticket.created_at);
          const customer = ticket.from_name || ticket.from_email;
          const date     = new Date(ticket.created_at).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });

          return (
            <Link
              key={ticket.id}
              href={`/inbox/${ticket.id}`}
              className="inbox-row block"
              style={{ borderBottom: isLast ? "none" : "1px solid var(--border)", textDecoration: "none" }}
            >
              {/* Mobile card */}
              <div className="flex flex-col gap-2 px-4 py-4 md:hidden">
                <div className="flex items-start justify-between gap-3">
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                    <input
                      type="checkbox"
                      checked={selected.has(ticket.id)}
                      onChange={e => { e.stopPropagation(); toggleOne(ticket.id); }}
                      onClick={e => e.stopPropagation()}
                      style={{ width: "15px", height: "15px", cursor: "pointer", accentColor: "#C7F56F", flexShrink: 0, marginTop: "2px" }}
                    />
                    <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text)", lineHeight: 1.4 }}>{ticket.subject}</span>
                  </div>
                  {activeTab === "escalated" && sla ? (
                    <span style={{ fontSize: "11px", fontWeight: 700, borderRadius: "6px", padding: "2px 8px", background: sla.bg, color: sla.color, animation: sla.pulse ? "pulse-red 1.8s ease-in-out infinite" : "none", whiteSpace: "nowrap" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <StatusIcon kind="clock" size={12} color={sla.color} />
                        {sla.label}
                      </span>
                    </span>
                  ) : (
                    <Badge bg="rgba(107,114,128,0.12)" color="#9ca3af" label={ticket.status} />
                  )}
                </div>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>{customer}</span>
                {activeTab !== "escalated" && (
                  <div className="flex flex-wrap gap-2 items-center">
                    <Badge bg={ic.bg} color={ic.color} label={ticket.intent ?? "—"} />
                    {ticket.confidence !== null && <Badge bg={confBg} color={confColor} label={`${Math.round(conf * 100)}%`} />}
                    {activeTab === "draft" && ticket.status === "pending_autosend" && (
                      <>
                        <span style={{
                          fontSize: "11px", fontWeight: 600, borderRadius: "6px",
                          padding: "2px 8px", background: "rgba(96,165,250,0.14)", color: "#60a5fa",
                          whiteSpace: "nowrap",
                        }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <StatusIcon kind="clock" size={12} color="#60a5fa" />
                            {autosendTimes
                              ? `${t.autosend.pendingSendAt} ${nextSendLabel(autosendTimes.time1, autosendTimes.time2)}`
                              : t.autosend.pendingSendSoon}
                          </span>
                        </span>
                        <button
                          onClick={e => handleCancelAutosend(ticket.id, e)}
                          style={{
                            fontSize: "11px", fontWeight: 600, color: "var(--muted)",
                            background: "none", border: "1px solid var(--border)",
                            borderRadius: "5px", padding: "2px 7px",
                            cursor: "pointer", whiteSpace: "nowrap",
                          }}
                        >
                          {t.autosend.cancelAutosend}
                        </button>
                      </>
                    )}
                  </div>
                )}
                {activeTab === "escalated" && ticket.escalation_department && (
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>{ticket.escalation_department}</span>
                )}
              </div>

              {/* Desktop row */}
              <div className="hidden md:grid" style={{ gridTemplateColumns: colTemplate, padding: "14px 20px", gap: "16px", alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={selected.has(ticket.id)}
                  onChange={e => { e.stopPropagation(); toggleOne(ticket.id); }}
                  onClick={e => e.stopPropagation()}
                  style={{ width: "15px", height: "15px", cursor: "pointer", accentColor: "#C7F56F" }}
                />
                <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {ticket.subject}
                </span>
                <span style={{ fontSize: "13px", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {customer}
                </span>

                {activeTab === "draft" && (
                  <>
                    <Badge bg={ic.bg} color={ic.color} label={ticket.intent ?? "—"} />
                    <Badge bg={confBg} color={confColor} label={ticket.confidence !== null ? `${Math.round(conf * 100)}%` : "—"} />
                    {ticket.status === "pending_autosend" ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{
                          fontSize: "11px", fontWeight: 600, borderRadius: "6px",
                          padding: "2px 8px", background: "rgba(96,165,250,0.14)", color: "#60a5fa",
                          whiteSpace: "nowrap",
                        }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <StatusIcon kind="clock" size={12} color="#60a5fa" />
                            {autosendTimes
                              ? `${t.autosend.pendingSendAt} ${nextSendLabel(autosendTimes.time1, autosendTimes.time2)}`
                              : t.autosend.pendingSendSoon}
                          </span>
                        </span>
                        <button
                          onClick={e => handleCancelAutosend(ticket.id, e)}
                          style={{
                            fontSize: "11px", fontWeight: 600, color: "var(--muted)",
                            background: "none", border: "1px solid var(--border)",
                            borderRadius: "5px", padding: "2px 7px",
                            cursor: "pointer", whiteSpace: "nowrap",
                          }}
                        >
                          {t.autosend.cancelAutosend}
                        </button>
                      </div>
                    ) : (
                      <Badge bg="rgba(251,191,36,0.14)" color="#fbbf24" label={t.inbox.statusDraftBadge} />
                    )}
                  </>
                )}

                {activeTab === "sent" && (
                  <>
                    <Badge bg={ic.bg} color={ic.color} label={ticket.intent ?? "—"} />
                    <span style={{ fontSize: "12px", color: "var(--muted)" }}>{date}</span>
                  </>
                )}

                {activeTab === "escalated" && (
                  <>
                    <span style={{ fontSize: "12px", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ticket.escalation_department || "—"}
                    </span>
                    {sla ? (
                      <span style={{
                        fontSize: "11px", fontWeight: 700, borderRadius: "6px", padding: "2px 8px",
                        background: sla.bg, color: sla.color, display: "inline-block",
                        animation: sla.pulse ? "pulse-red 1.8s ease-in-out infinite" : "none",
                        whiteSpace: "nowrap",
                      }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <StatusIcon kind="clock" size={12} color={sla.color} />
                          {sla.label}
                        </span>
                      </span>
                    ) : (
                      <span style={{ fontSize: "12px", color: "var(--muted)" }}>{t.inbox.weekend}</span>
                    )}
                    <span style={{ fontSize: "12px", color: "var(--muted)" }}>{date}</span>
                  </>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
