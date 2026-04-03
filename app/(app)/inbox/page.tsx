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
  compliment:       { bg: "rgba(180,240,0,0.14)",   color: "#B4F000" },
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
  const [gmailConnected, setGmailConnected] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [usageWarning, setUsageWarning] = useState<{ used: number; limit: number } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autosendTimes, setAutosendTimes] = useState<{ time1: string; time2: string } | null>(null);

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

        const { data: integration } = await supabase
          .from("tenant_integrations")
          .select("status")
          .eq("tenant_id", member.tenant_id)
          .eq("provider", "gmail")
          .single();

        setGmailConnected(integration?.status === "connected" || integration?.status === "active");

        const { data: rows } = await supabase
          .from("tickets")
          .select("id, subject, from_email, from_name, intent, confidence, status, created_at, escalation_department")
          .eq("tenant_id", member.tenant_id)
          .order("created_at", { ascending: false });

        setAllTickets(rows ?? []);

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
            <span>
              {isOver
                ? `${t.inbox.limitReachedMsg} (${usageWarning.used}/${usageWarning.limit})`
                : `⚠️ ${pct}% ${t.inbox.limitWarningMsg} (${usageWarning.used}/${usageWarning.limit})`}
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

      {!gmailConnected && !loading && (
        <div style={{
          marginBottom: "20px", padding: "12px 16px", borderRadius: "8px",
          background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.35)",
          color: "#fbbf24", fontSize: "13px", fontWeight: 500,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
        }}>
          <span>{t.inbox.connectGmailBanner}</span>
          <Link href="/settings?tab=integrations" style={{ color: "#fbbf24", fontWeight: 600, textDecoration: "underline", whiteSpace: "nowrap" }}>
            {t.inbox.connectBtn}
          </Link>
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
                borderBottom: activeTab === id ? "2px solid #B4F000" : "2px solid transparent",
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
                    ? "rgba(239,68,68,0.18)" : "rgba(180,240,0,0.15)",
                  color: id === "escalated" && count > 0 ? "#f87171" : "#B4F000",
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
              style={{ width: "15px", height: "15px", cursor: "pointer", accentColor: "#B4F000" }}
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
            <p style={{ fontSize: "22px", margin: "0 0 8px" }}>
              {activeTab === "draft" ? "📭" : activeTab === "sent" ? "✉️" : "✅"}
            </p>
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
          const confColor = conf >= 0.8 ? "#B4F000" : conf >= 0.6 ? "#fbbf24" : "#f87171";
          const confBg    = conf >= 0.8 ? "rgba(180,240,0,0.12)" : conf >= 0.6 ? "rgba(251,191,36,0.12)" : "rgba(239,68,68,0.12)";
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
                      style={{ width: "15px", height: "15px", cursor: "pointer", accentColor: "#B4F000", flexShrink: 0, marginTop: "2px" }}
                    />
                    <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text)", lineHeight: 1.4 }}>{ticket.subject}</span>
                  </div>
                  {activeTab === "escalated" && sla ? (
                    <span style={{ fontSize: "11px", fontWeight: 700, borderRadius: "6px", padding: "2px 8px", background: sla.bg, color: sla.color, animation: sla.pulse ? "pulse-red 1.8s ease-in-out infinite" : "none", whiteSpace: "nowrap" }}>
                      ⏱ {sla.label}
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
                          ⏱ {autosendTimes
                            ? `${t.autosend.pendingSendAt} ${nextSendLabel(autosendTimes.time1, autosendTimes.time2)}`
                            : t.autosend.pendingSendSoon}
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
                  style={{ width: "15px", height: "15px", cursor: "pointer", accentColor: "#B4F000" }}
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
                          ⏱ {autosendTimes
                            ? `${t.autosend.pendingSendAt} ${nextSendLabel(autosendTimes.time1, autosendTimes.time2)}`
                            : t.autosend.pendingSendSoon}
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
                        ⏱ {sla.label}
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
