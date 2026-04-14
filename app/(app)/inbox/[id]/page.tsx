"use client";

import { use, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { createClient } from "@/lib/supabaseClient";

type Department = { name: string; email: string };

type TicketDetail = {
  id: string;
  subject: string;
  from_email: string;
  from_name: string | null;
  intent: string | null;
  confidence: number | null;
  body_text: string | null;
  ai_draft: { subject?: string; body?: string; from?: string } | string | null;
  status: string;
  tenant_id: string;
  escalation_reason: string | null;
  escalation_department: string | null;
};

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--muted)", lineHeight: 1, fontSize: "14px" }}
        aria-label="Info"
      >
        ⓘ
      </button>
      {show && (
        <span style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)",
          background: "#1a2435", border: "1px solid var(--border)", borderRadius: "8px",
          padding: "8px 12px", fontSize: "12px", color: "var(--text)", lineHeight: 1.5,
          whiteSpace: "nowrap", zIndex: 50, boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          pointerEvents: "none",
        }}>
          {text}
        </span>
      )}
    </span>
  );
}

// ─── Escalation modal ─────────────────────────────────────────────────────────

function EscalationModal({
  departments,
  onClose,
  onConfirm,
  loading,
}: {
  departments: Department[];
  onClose: () => void;
  onConfirm: (deptEmail: string, deptName: string, reason: string) => void;
  loading: boolean;
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [reason, setReason]           = useState("");
  const [error, setError]             = useState("");
  const modalRef                      = useRef<HTMLDivElement>(null);

  // Close on backdrop click
  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSubmit() {
    setError("");
    if (departments.length === 0) return;
    if (!reason.trim()) { setError("Geef een reden voor escalatie op."); return; }
    const dept = departments[selectedIdx];
    onConfirm(dept.email, dept.name, reason.trim());
  }

  const noDepts = departments.length === 0;

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
        animation: "modalFadeIn 0.18s ease",
      }}
    >
      <div
        ref={modalRef}
        style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "440px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          animation: "modalSlideUp 0.2s ease",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text)", margin: 0 }}>
              Ticket escaleren
            </h2>
            <p style={{ fontSize: "12px", color: "var(--muted)", margin: "3px 0 0" }}>
              Het originele bericht wordt doorgestuurd naar de gekozen afdeling.
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "20px", lineHeight: 1, padding: "4px" }}>×</button>
        </div>

        {noDepts ? (
          <div style={{ padding: "24px 0", textAlign: "center" }}>
            <p style={{ fontSize: "32px", margin: "0 0 10px" }}>📂</p>
            <p style={{ fontSize: "13px", color: "var(--text)", fontWeight: 500, margin: "0 0 6px" }}>
              Geen afdelingen ingesteld
            </p>
            <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 18px" }}>
              Voeg een escalatie-afdeling toe in de instellingen om te kunnen escaleren.
            </p>
            <Link
              href="/settings?tab=escalation"
              style={{
                display: "inline-block", padding: "9px 20px", borderRadius: "8px",
                background: "#C7F56F", color: "#1a1a1a", fontSize: "13px", fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Ga naar Instellingen →
            </Link>
          </div>
        ) : (
          <>
            {/* Department dropdown */}
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                <label style={{ fontSize: "13px", fontWeight: 500, color: "var(--muted)" }}>
                  Afdeling
                </label>
                <InfoTooltip text="Voeg afdelingen toe via Instellingen → Escalatie" />
              </div>
              <select
                value={selectedIdx}
                onChange={(e) => setSelectedIdx(Number(e.target.value))}
                style={{
                  width: "100%", padding: "9px 12px", borderRadius: "8px",
                  border: "1px solid var(--border)", background: "var(--bg)",
                  color: "var(--text)", fontSize: "13px", outline: "none",
                  fontFamily: "inherit", cursor: "pointer",
                }}
              >
                {departments.map((d, i) => (
                  <option key={i} value={i}>{d.name} — {d.email}</option>
                ))}
              </select>
            </div>

            {/* Reason */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "13px", fontWeight: 500, color: "var(--muted)", display: "block", marginBottom: "6px" }}>
                Reden voor escalatie
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Bijv: Klant eist compensatie van €150, buiten mijn bevoegdheid..."
                rows={4}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: "8px",
                  border: `1px solid ${error ? "rgba(239,68,68,0.5)" : "var(--border)"}`,
                  background: "var(--bg)", color: "var(--text)", fontSize: "13px",
                  lineHeight: 1.55, fontFamily: "inherit", outline: "none",
                  resize: "vertical", boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                autoFocus
              />
              {error && <p style={{ fontSize: "12px", color: "#f87171", margin: "4px 0 0" }}>{error}</p>}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  flex: 1, padding: "10px", borderRadius: "8px", border: "none",
                  background: loading ? "rgba(239,68,68,0.3)" : "rgba(239,68,68,0.85)",
                  color: "#fff", fontSize: "13px", fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                  transition: "background 0.15s, transform 0.1s",
                }}
              >
                {loading ? "Versturen…" : "Escaleren & versturen"}
              </button>
              <button
                onClick={onClose}
                disabled={loading}
                style={{
                  padding: "10px 18px", borderRadius: "8px",
                  border: "1px solid var(--border)", background: "transparent",
                  color: "var(--muted)", fontSize: "13px", fontWeight: 500,
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                Annuleren
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t }  = useTranslation();

  const [ticket, setTicket]         = useState<TicketDetail | null>(null);
  const [draft, setDraft]           = useState("");
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [departments, setDepts]     = useState<Department[]>([]);
  const [showModal, setShowModal]   = useState(false);

  // Button states
  const [sendState, setSendState]       = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [escalateState, setEscalState]  = useState<"idle" | "sending" | "done" | "error">("idle");

  // Translation
  const [translateLang, setTranslateLang]           = useState("original");
  const [translating, setTranslating]               = useState(false);
  const [translateError, setTranslateError]         = useState(false);
  const [translatedCustomer, setTranslatedCustomer] = useState<string | null>(null);
  const [translatedDraft, setTranslatedDraft]       = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setError("Not authenticated."); setLoading(false); return; }

        const { data: member } = await supabase
          .from("tenant_members")
          .select("tenant_id")
          .eq("user_id", user.id)
          .single();

        if (!member?.tenant_id) { setError("No tenant found."); setLoading(false); return; }

        const [ticketRes, configRes] = await Promise.all([
          supabase
            .from("tickets")
            .select("id, subject, from_email, from_name, intent, confidence, body_text, ai_draft, status, tenant_id, escalation_reason, escalation_department")
            .eq("id", id)
            .eq("tenant_id", member.tenant_id)
            .single(),
          fetch("/api/agent-config").then(r => r.ok ? r.json() : null),
        ]);

        if (ticketRes.error || !ticketRes.data) {
          setError("Ticket niet gevonden.");
          setLoading(false);
          return;
        }

        const row = ticketRes.data;
        setTicket(row);

        const aiDraft = row.ai_draft as { body?: string } | string | null;
        const storedBody = typeof aiDraft === "string" ? aiDraft : (aiDraft?.body ?? "");

        // Inject signature at display time if it's configured but not yet in the draft
        const configuredSignature: string = configRes?.config?.signature?.trim() ?? "";
        const bodyWithSignature =
          configuredSignature && !storedBody.includes(configuredSignature)
            ? storedBody.trim() + "\n\n--\n" + configuredSignature
            : storedBody;
        setDraft(bodyWithSignature);

        if (configRes?.config?.escalationDepartments) {
          setDepts(configRes.config.escalationDepartments);
        }
      } catch (err) {
        console.error("[ticket-detail] load error:", err);
        setError("Er is een fout opgetreden.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleSend() {
    if (!ticket) return;
    setSendState("sending");
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftBody: draft }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Send failed");
      }
      setTicket(t => t ? { ...t, status: "sent" } : t);
      setSendState("sent");
    } catch (err: any) {
      console.error("[send]", err);
      setSendState("error");
      setTimeout(() => setSendState("idle"), 3000);
    }
  }

  async function handleEscalate(deptEmail: string, deptName: string, reason: string) {
    if (!ticket) return;
    setEscalState("sending");
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/escalate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departmentEmail: deptEmail, departmentName: deptName, reason }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Escalate failed");
      }
      setTicket(t => t ? { ...t, status: "escalated", escalation_department: deptName || deptEmail, escalation_reason: reason } : t);
      setEscalState("done");
      setShowModal(false);
    } catch (err: any) {
      console.error("[escalate]", err);
      setEscalState("error");
      setTimeout(() => setEscalState("idle"), 3000);
    }
  }

  async function handleTranslate(lang: string) {
    setTranslateLang(lang);
    setTranslateError(false);
    if (lang === "original") {
      setTranslatedCustomer(null);
      setTranslatedDraft(null);
      return;
    }
    setTranslating(true);
    try {
      const res = await fetch(`/api/tickets/${ticket!.id}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: lang }),
      });
      if (res.ok) {
        const data = await res.json();
        setTranslatedCustomer(data.customer ?? null);
        setTranslatedDraft(data.draft ?? null);
      } else {
        console.error("[translate] API error:", res.status, await res.text());
        setTranslateError(true);
        setTranslateLang("original");
      }
    } catch (err) {
      console.error("[translate] fetch error:", err);
      setTranslateError(true);
      setTranslateLang("original");
    } finally {
      setTranslating(false);
    }
  }

  const TRANSLATE_OPTIONS = [
    { code: "original", label: "Original" },
    { code: "en", label: "English" },
    { code: "nl", label: "Nederlands" },
    { code: "de", label: "Deutsch" },
    { code: "fr", label: "Français" },
    { code: "es", label: "Español" },
    { code: "it", label: "Italiano" },
    { code: "pt", label: "Português" },
  ];

  const confColor = ticket?.confidence != null
    ? (ticket.confidence >= 0.8 ? "#C7F56F" : ticket.confidence >= 0.6 ? "#fbbf24" : "#f87171")
    : "var(--muted)";

  const isFinal = ticket?.status === "sent" || ticket?.status === "escalated";

  if (loading) return (
    <div className="flex flex-col gap-6" style={{ width: "100%", minWidth: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {[220, 340, 140].map(w => (
          <div key={w} style={{ height: "16px", borderRadius: "8px", background: "var(--border)", width: w, animation: "shimmer 1.4s ease-in-out infinite" }} />
        ))}
      </div>
    </div>
  );

  if (error || !ticket) return (
    <div className="flex flex-col gap-6" style={{ width: "100%", minWidth: 0 }}>
      <Link href="/inbox" style={{ fontSize: "13px", color: "var(--muted)", textDecoration: "none" }}>
        {t.ticketDetail.backToInbox}
      </Link>
      <p style={{ fontSize: "13px", color: "#f87171" }}>{error ?? "Ticket niet gevonden."}</p>
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes modalFadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalSlideUp { from { opacity: 0; transform: translateY(20px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes shimmer { 0%,100% { opacity: 0.4; } 50% { opacity: 0.9; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .ticket-panel { animation: fadeIn 0.2s ease; }
        @media (max-width: 640px) {
          .ticket-grid { grid-template-columns: 1fr !important; }
          .ticket-actions { flex-direction: column; }
          .ticket-actions button, .ticket-actions span, .ticket-actions a { width: 100%; text-align: center; justify-content: center; }
        }
      `}</style>

      {showModal && (
        <EscalationModal
          departments={departments}
          onClose={() => setShowModal(false)}
          onConfirm={handleEscalate}
          loading={escalateState === "sending"}
        />
      )}

      <div className="flex flex-col gap-6 ticket-panel" style={{ width: "100%", minWidth: 0 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
          <div style={{ minWidth: 0 }}>
            <Link href="/inbox" style={{ fontSize: "13px", color: "var(--muted)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}>
              {t.ticketDetail.backToInbox}
            </Link>
            <h1 style={{ fontSize: "22px", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text)", margin: "10px 0 4px" }}>
              {ticket.subject}
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
                {ticket.from_name ? `${ticket.from_name} <${ticket.from_email}>` : ticket.from_email}
              </p>
              {ticket.status === "sent" && (
                <span style={{ fontSize: "11px", fontWeight: 700, background: "#C7F56F", color: "#000", borderRadius: "99px", padding: "1px 8px" }}>VERZONDEN</span>
              )}
              {ticket.status === "escalated" && (
                <span style={{ fontSize: "11px", fontWeight: 700, background: "rgba(239,68,68,0.14)", color: "#f87171", borderRadius: "4px", padding: "1px 7px" }}>GEËSCALEERD</span>
              )}
              {ticket.status === "draft" && (
                <span style={{ fontSize: "11px", fontWeight: 700, background: "rgba(251,191,36,0.14)", color: "#fbbf24", borderRadius: "4px", padding: "1px 7px" }}>CONCEPT</span>
              )}
            </div>
          </div>

          {/* Translate — top right */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, paddingTop: "2px" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: translateError ? "#f87171" : "var(--muted)", opacity: translating ? 0.4 : 1, transition: "opacity 0.2s, color 0.2s" }}>
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            <select
              value={translateLang}
              onChange={(e) => handleTranslate(e.target.value)}
              disabled={translating}
              style={{
                fontSize: "12px", padding: "4px 8px", borderRadius: "7px",
                border: `1px solid ${translateError ? "rgba(248,113,113,0.4)" : "var(--border)"}`,
                background: "var(--surface)",
                color: translateError ? "#f87171" : "var(--text)",
                cursor: translating ? "not-allowed" : "pointer",
                outline: "none", fontFamily: "inherit", opacity: translating ? 0.5 : 1,
                transition: "opacity 0.2s",
              }}
            >
              {TRANSLATE_OPTIONS.map(o => (
                <option key={o.code} value={o.code}>{o.label}</option>
              ))}
            </select>
            {translating && <span style={{ fontSize: "11px", color: "var(--muted)" }}>…</span>}
            {translateError && <span style={{ fontSize: "11px", color: "#f87171" }}>Failed</span>}
          </div>
        </div>

        {/* Escalation info bar */}
        {ticket.status === "escalated" && (ticket.escalation_department || ticket.escalation_reason) && (
          <div style={{
            padding: "14px 18px", borderRadius: "10px",
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
            display: "flex", flexDirection: "column", gap: "4px",
          }}>
            {ticket.escalation_department && (
              <p style={{ fontSize: "13px", color: "#f87171", margin: 0, fontWeight: 500 }}>
                Doorgestuurd naar: {ticket.escalation_department}
              </p>
            )}
            {ticket.escalation_reason && (
              <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0 }}>
                Reden: {ticket.escalation_reason}
              </p>
            )}
          </div>
        )}

        {/* Three panels */}
        <div className="ticket-grid" style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) minmax(0,1.5fr) minmax(0,0.75fr)",
          gap: 16,
          alignItems: "start",
          width: "100%",
        }}>

          {/* Customer message */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px", display: "flex", flexDirection: "column" }}>
            <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase", margin: "0 0 14px" }}>
              {t.ticketDetail.customerMessage}
            </p>
            <div style={{ overflowY: "auto", maxHeight: "420px" }}>
              <p style={{ fontSize: "13px", color: "var(--text)", lineHeight: 1.65, whiteSpace: "pre-wrap", margin: 0 }}>
                {translatedCustomer ?? ticket.body_text ?? "—"}
              </p>
            </div>
          </div>

          {/* AI draft */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase", margin: 0 }}>
                {t.ticketDetail.aiDraft}
              </p>
              {isFinal && (
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>Alleen lezen</span>
              )}
            </div>
            <textarea
              value={translatedDraft ?? draft}
              onChange={(e) => { if (!translatedDraft) setDraft(e.target.value); }}
              disabled={isFinal || !!translatedDraft}
              rows={14}
              style={{
                width: "100%", resize: "vertical", padding: "12px",
                borderRadius: "8px", border: "1px solid var(--border)",
                background: isFinal || translatedDraft ? "transparent" : "var(--bg)",
                color: "var(--text)", fontSize: "13px", lineHeight: 1.65,
                fontFamily: "inherit", outline: "none", boxSizing: "border-box",
                opacity: isFinal ? 0.7 : 1, transition: "opacity 0.2s",
                cursor: isFinal || translatedDraft ? "default" : "text",
              }}
            />
            {translatedDraft && (
              <p style={{ fontSize: "11px", color: "var(--muted)", margin: 0 }}>
                Translation only — switch back to Original to edit and send.
              </p>
            )}
          </div>

          {/* Decision panel */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase", margin: 0 }}>
              {t.ticketDetail.decisionPanel}
            </p>

            <div>
              <p style={{ fontSize: "11px", color: "var(--muted)", margin: "0 0 3px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>{t.ticketDetail.intent}</p>
              <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--text)", margin: 0 }}>{ticket.intent ?? "—"}</p>
            </div>

            <div>
              <p style={{ fontSize: "11px", color: "var(--muted)", margin: "0 0 3px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>{t.ticketDetail.confidence}</p>
              <p style={{ fontSize: "13px", fontWeight: 500, color: confColor, margin: 0 }}>
                {ticket.confidence != null ? `${Math.round(ticket.confidence * 100)}%` : "—"}
              </p>
            </div>

            <div>
              <p style={{ fontSize: "11px", color: "var(--muted)", margin: "0 0 3px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>Status</p>
              <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--text)", margin: 0 }}>{ticket.status}</p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        {!isFinal && (
          <div className="ticket-actions flex flex-wrap gap-3">
            {/* Approve & send */}
            {sendState === "sent" ? (
              <span style={{ padding: "10px 28px", borderRadius: "8px", background: "#C7F56F", color: "#000", fontSize: "13px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                ✓ Verzonden
              </span>
            ) : (
              <button
                onClick={handleSend}
                disabled={sendState === "sending"}
                style={{
                  padding: "10px 28px", borderRadius: "8px", border: "none",
                  background: sendState === "error" ? "rgba(239,68,68,0.15)" : "#C7F56F",
                  color: sendState === "error" ? "#f87171" : "#1a1a1a",
                  fontSize: "13px", fontWeight: 600,
                  cursor: sendState === "sending" ? "not-allowed" : "pointer",
                  opacity: sendState === "sending" ? 0.7 : 1,
                  transition: "background 0.2s, transform 0.1s",
                }}
              >
                {sendState === "sending" ? "Versturen…" : sendState === "error" ? "Versturen mislukt — opnieuw?" : t.ticketDetail.approveAndSend}
              </button>
            )}

            {/* Escalate */}
            {escalateState === "done" ? (
              <span style={{ padding: "10px 28px", borderRadius: "8px", background: "rgba(239,68,68,0.08)", color: "#f87171", fontSize: "13px", fontWeight: 600, border: "1px solid rgba(248,113,113,0.4)" }}>
                Geëscaleerd ✓
              </span>
            ) : (
              <button
                onClick={() => setShowModal(true)}
                disabled={escalateState === "sending"}
                style={{
                  padding: "10px 28px", borderRadius: "8px",
                  border: "1px solid rgba(248,113,113,0.4)", background: "rgba(239,68,68,0.08)",
                  color: "#f87171", fontSize: "13px", fontWeight: 600,
                  cursor: escalateState === "sending" ? "not-allowed" : "pointer",
                  transition: "background 0.15s, border-color 0.15s",
                }}
              >
                {escalateState === "error" ? "Mislukt — opnieuw?" : t.ticketDetail.escalate}
              </button>
            )}
          </div>
        )}

        {isFinal && (
          <div style={{ padding: "14px 18px", borderRadius: "10px", background: "var(--surface)", border: "1px solid var(--border)", display: "inline-flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "13px", color: "var(--muted)" }}>
              Dit ticket is afgehandeld. Ga terug naar de
            </span>
            <Link href="/inbox" style={{ fontSize: "13px", color: "#3d6200", fontWeight: 600, textDecoration: "none" }}>inbox →</Link>
          </div>
        )}
      </div>
    </>
  );
}
