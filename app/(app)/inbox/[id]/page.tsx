"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { createClient } from "@/lib/supabaseClient";

type TicketDetail = {
  id: string;
  subject: string;
  from_email: string;
  from_name: string | null;
  intent: string | null;
  confidence: number | null;
  body_text: string | null;
  ai_draft: string | null;
  status: string;
  tenant_id: string;
};

function Field({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div>
      <p style={{ fontSize: "11px", color: "var(--muted)", margin: "0 0 3px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
        {label}
      </p>
      <p style={{ fontSize: "13px", fontWeight: 500, color: highlight ?? "var(--text)", margin: 0, lineHeight: 1.5 }}>
        {value}
      </p>
    </div>
  );
}

export default function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useTranslation();

  const [ticket, setTicket]   = useState<TicketDetail | null>(null);
  const [draft, setDraft]     = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [actionState, setActionState] = useState<"idle" | "approving" | "approved" | "escalating" | "escalated">("idle");

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setError("Not authenticated."); setLoading(false); return; }

        // Get tenant_id for isolation
        const { data: member } = await supabase
          .from("tenant_members")
          .select("tenant_id")
          .eq("user_id", user.id)
          .single();

        if (!member?.tenant_id) { setError("No tenant found."); setLoading(false); return; }

        const { data: row, error: fetchError } = await supabase
          .from("tickets")
          .select("id, subject, from_email, from_name, intent, confidence, body_text, ai_draft, status, tenant_id")
          .eq("id", id)
          .eq("tenant_id", member.tenant_id)
          .single();

        if (fetchError || !row) {
          setError("Ticket niet gevonden.");
          setLoading(false);
          return;
        }

        setTicket(row);
        const aiDraft = row.ai_draft as { body?: string } | string | null;
        setDraft(typeof aiDraft === "string" ? aiDraft : (aiDraft?.body ?? ""));
      } catch (err) {
        console.error("[ticket-detail] load error:", err);
        setError("Er is een fout opgetreden.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleApprove() {
    if (!ticket) return;
    setActionState("approving");
    try {
      const supabase = createClient();
      await supabase
        .from("tickets")
        .update({ status: "approved", ai_draft: draft, updated_at: new Date().toISOString() })
        .eq("id", ticket.id);
      setTicket({ ...ticket, status: "approved" });
      setActionState("approved");
    } catch {
      setActionState("idle");
    }
  }

  async function handleEscalate() {
    if (!ticket) return;
    setActionState("escalating");
    try {
      const supabase = createClient();
      await supabase
        .from("tickets")
        .update({ status: "escalated", updated_at: new Date().toISOString() })
        .eq("id", ticket.id);
      setTicket({ ...ticket, status: "escalated" });
      setActionState("escalated");
    } catch {
      setActionState("idle");
    }
  }

  const confColor = ticket?.confidence != null
    ? (ticket.confidence >= 0.8 ? "#B4F000" : ticket.confidence >= 0.6 ? "#fbbf24" : "#f87171")
    : "var(--muted)";

  if (loading) {
    return (
      <div className="mx-auto flex max-w-screen-xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <p style={{ fontSize: "13px", color: "var(--muted)" }}>Laden…</p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="mx-auto flex max-w-screen-xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <Link href="/inbox" style={{ fontSize: "13px", color: "var(--muted)", textDecoration: "none" }}>
          {t.ticketDetail.backToInbox}
        </Link>
        <p style={{ fontSize: "13px", color: "#f87171" }}>{error ?? "Ticket niet gevonden."}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-screen-xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">

      {/* Breadcrumb + title */}
      <div>
        <Link href="/inbox" style={{ fontSize: "13px", color: "var(--muted)", textDecoration: "none" }}>
          {t.ticketDetail.backToInbox}
        </Link>
        <h1 style={{ fontSize: "22px", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text)", margin: "8px 0 4px" }}>
          {ticket.subject}
        </h1>
        <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
          {ticket.from_name ? `${ticket.from_name} <${ticket.from_email}>` : ticket.from_email}
        </p>
      </div>

      {/* Columns: stacked on mobile, 3-col on desktop */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.5fr_0.75fr] lg:items-start">

        {/* Customer message */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px" }}>
          <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase", margin: "0 0 14px" }}>
            {t.ticketDetail.customerMessage}
          </p>
          <p style={{ fontSize: "13px", color: "var(--text)", lineHeight: 1.65, whiteSpace: "pre-wrap", margin: 0 }}>
            {ticket.body_text || "—"}
          </p>
        </div>

        {/* AI draft */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase", margin: 0 }}>
            {t.ticketDetail.aiDraft}
          </p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={14}
            style={{
              width: "100%", resize: "vertical", padding: "12px",
              borderRadius: "8px", border: "1px solid var(--border)",
              background: "var(--bg)", color: "var(--text)",
              fontSize: "13px", lineHeight: 1.65,
              fontFamily: "inherit", outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {/* Decision panel */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px", display: "flex", flexDirection: "column", gap: "18px" }}>
          <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase", margin: 0 }}>
            {t.ticketDetail.decisionPanel}
          </p>
          <Field label={t.ticketDetail.intent}     value={ticket.intent ?? "—"} />
          <Field
            label={t.ticketDetail.confidence}
            value={ticket.confidence != null ? `${Math.round(ticket.confidence * 100)}%` : "—"}
            highlight={confColor}
          />
          <Field
            label="Status"
            value={ticket.status}
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        {actionState === "approved" ? (
          <span style={{ padding: "10px 28px", borderRadius: "8px", background: "rgba(180,240,0,0.12)", color: "#B4F000", fontSize: "13px", fontWeight: 600, border: "1px solid rgba(180,240,0,0.3)" }}>
            Goedgekeurd ✓
          </span>
        ) : (
          <button
            onClick={handleApprove}
            disabled={actionState !== "idle"}
            style={{
              padding: "10px 28px", borderRadius: "8px", border: "none",
              background: "#B4F000", color: "#0B1220", fontSize: "13px", fontWeight: 600,
              cursor: actionState !== "idle" ? "not-allowed" : "pointer",
              opacity: actionState !== "idle" ? 0.7 : 1,
            }}
          >
            {actionState === "approving" ? "Bezig…" : t.ticketDetail.approveAndSend}
          </button>
        )}

        {actionState === "escalated" ? (
          <span style={{ padding: "10px 28px", borderRadius: "8px", background: "rgba(239,68,68,0.08)", color: "#f87171", fontSize: "13px", fontWeight: 600, border: "1px solid rgba(248,113,113,0.4)" }}>
            Geëscaleerd ✓
          </span>
        ) : (
          <button
            onClick={handleEscalate}
            disabled={actionState !== "idle"}
            style={{
              padding: "10px 28px", borderRadius: "8px",
              border: "1px solid rgba(248,113,113,0.4)", background: "rgba(239,68,68,0.08)",
              color: "#f87171", fontSize: "13px", fontWeight: 600,
              cursor: actionState !== "idle" ? "not-allowed" : "pointer",
              opacity: actionState !== "idle" ? 0.7 : 1,
            }}
          >
            {actionState === "escalating" ? "Bezig…" : t.ticketDetail.escalate}
          </button>
        )}
      </div>
    </div>
  );
}
