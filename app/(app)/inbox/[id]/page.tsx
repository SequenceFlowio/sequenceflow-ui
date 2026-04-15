"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { useTranslation } from "@/lib/i18n/LanguageProvider";
import type { TicketDetailResponse } from "@/types/aiInbox";

type ViewMode = "english" | "original";

function confidenceTone(confidence: number | null) {
  if (confidence == null) return { bg: "rgba(107,114,128,0.12)", color: "#9ca3af" };
  if (confidence >= 0.85) return { bg: "rgba(199,245,111,0.22)", color: "#5c8200" };
  if (confidence >= 0.65) return { bg: "rgba(251,191,36,0.16)", color: "#fbbf24" };
  return { bg: "rgba(239,68,68,0.14)", color: "#f87171" };
}

type TicketDetailApiResponse = TicketDetailResponse & {
  messages?: TicketDetailResponse["messages"];
  error?: string;
};

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, language } = useTranslation();
  const [ticket, setTicket] = useState<TicketDetailResponse | null>(null);
  const [draftBody, setDraftBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(language === "en" ? "english" : "original");
  const [sendState, setSendState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [escalateState, setEscalateState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [regenerateState, setRegenerateState] = useState<"idle" | "running" | "done" | "error">("idle");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/tickets/${id}`);
        const data = (await res.json()) as TicketDetailApiResponse;
        if (!res.ok) throw new Error(data.error ?? t.ticketDetail.loadError);
        setTicket(data);
        setDraftBody(data.draft?.original.body ?? "");
        const hasEnglish = data.messages?.some((message) => Boolean(message.english?.body));
        setViewMode(hasEnglish && language === "en" ? "english" : "original");
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : t.ticketDetail.loadError);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, language, t.ticketDetail.loadError]);

  const latestMessage = ticket?.messages?.[ticket.messages.length - 1];
  const customerBody = useMemo(() => {
    if (!latestMessage) return "";
    if (viewMode === "english") {
      return latestMessage.english.body ?? latestMessage.original.body;
    }
    return latestMessage.original.body;
  }, [latestMessage, viewMode]);

  const customerSubject = useMemo(() => {
    if (!latestMessage) return ticket?.subject ?? "";
    if (viewMode === "english") {
      return latestMessage.english.subject ?? latestMessage.original.subject;
    }
    return latestMessage.original.subject;
  }, [latestMessage, ticket?.subject, viewMode]);

  const translatedDraft = useMemo(() => {
    if (!ticket?.draft) return "";
    return viewMode === "english"
      ? ticket.draft.english.body ?? ticket.draft.original.body
      : ticket.draft.original.body;
  }, [ticket, viewMode]);

  async function reloadTicket() {
    const res = await fetch(`/api/tickets/${id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? t.ticketDetail.reloadError);
    setTicket(data);
    setDraftBody(data.draft?.original.body ?? "");
  }

  async function handleApproveSend() {
    if (!ticket) return;
    setSendState("sending");
    try {
      const endpoint = ticket.source === "conversation"
        ? `/api/tickets/${ticket.id}/approve-send`
        : `/api/tickets/${ticket.id}/send`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftBody }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? t.ticketDetail.sendError);
      await reloadTicket();
      setSendState("sent");
    } catch (err) {
      console.error("[ticket-detail/send]", err);
      setSendState("error");
    }
  }

  async function handleEscalate() {
    if (!ticket) return;
    const department = window.prompt(t.ticketDetail.escalatePromptDepartment);
    if (!department) return;
    const reason = window.prompt(t.ticketDetail.escalatePromptReason);
    if (!reason) return;

    setEscalateState("sending");
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/escalate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentEmail: department,
          departmentName: "",
          reason,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? t.ticketDetail.escalateError);
      await reloadTicket();
      setEscalateState("done");
    } catch (err) {
      console.error("[ticket-detail/escalate]", err);
      setEscalateState("error");
    }
  }

  async function handleRegenerate() {
    if (!ticket || ticket.source !== "conversation") return;
    setRegenerateState("running");
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/regenerate`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? t.ticketDetail.regenerateError);
      await reloadTicket();
      setRegenerateState("done");
    } catch (err) {
      console.error("[ticket-detail/regenerate]", err);
      setRegenerateState("error");
    }
  }

  if (loading) {
    return <div style={{ minHeight: 420, borderRadius: 18, background: "var(--surface)", border: "1px solid var(--border)" }} />;
  }

  if (error || !ticket) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/inbox" style={{ textDecoration: "none", color: "var(--muted)", fontSize: 13 }}>
          {t.ticketDetail.backToInbox}
        </Link>
        <p style={{ margin: 0, color: "#f87171", fontSize: 14 }}>{error ?? t.ticketDetail.ticketNotFound}</p>
      </div>
    );
  }

  const confidence = confidenceTone(ticket.confidence);
  const isFinal = ticket.status === "sent" || ticket.status === "escalated";

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-10 sm:px-6 lg:px-10 lg:py-12">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <Link href="/inbox" style={{ textDecoration: "none", color: "var(--muted)", fontSize: 13 }}>
            {t.ticketDetail.backToInbox}
          </Link>
          <h1 style={{ margin: "10px 0 6px", fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text)" }}>
            {viewMode === "english" ? ticket.subjectEnglish ?? ticket.subject : ticket.subject}
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
            {ticket.customer.name ? `${ticket.customer.name} <${ticket.customer.email}>` : ticket.customer.email}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ticket.decision && (
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 999,
              padding: "5px 10px",
              background: "rgba(59,130,246,0.12)",
              color: "#60a5fa",
            }}>
              {ticket.decision.replace(/_/g, " ")}
            </span>
          )}
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            borderRadius: 999,
            padding: "5px 10px",
            background: confidence.bg,
            color: confidence.color,
          }}>
            {ticket.confidence != null ? `${Math.round(ticket.confidence * 100)}% confidence` : ticket.status}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
            {(["english", "original"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            style={{
              border: viewMode === mode ? "1px solid rgba(199,245,111,0.45)" : "1px solid var(--border)",
              background: viewMode === mode ? "rgba(199,245,111,0.10)" : "var(--surface)",
              color: viewMode === mode ? "var(--text)" : "var(--muted)",
              borderRadius: 999,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {mode === "english" ? t.ticketDetail.englishTab : t.ticketDetail.originalTab}
          </button>
        ))}
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.1fr) 300px",
        gap: 16,
        alignItems: "start",
      }}>
        <section style={{ border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 18, padding: 18 }}>
          <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {t.ticketDetail.customerMessage}
          </p>
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
            {customerSubject}
          </p>
          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            <p style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 14, color: "var(--text)", lineHeight: 1.65 }}>
              {customerBody || t.ticketDetail.noMessageContent}
            </p>
          </div>
        </section>

        <section style={{ border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 18, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {t.ticketDetail.aiDraft}
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)" }}>
                {t.ticketDetail.bilingualHint}
              </p>
            </div>
          </div>

          {ticket.draft && (
            <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 12, background: "var(--bg)", border: "1px solid var(--border)" }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                {viewMode === "english" ? ticket.draft.english.subject ?? ticket.draft.original.subject : ticket.draft.original.subject}
              </p>
            </div>
          )}

          {viewMode === "original" ? (
            <textarea
              value={draftBody}
              onChange={(event) => setDraftBody(event.target.value)}
              disabled={isFinal}
              rows={18}
              style={{
                width: "100%",
                resize: "vertical",
                boxSizing: "border-box",
                borderRadius: 14,
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: "var(--text)",
                padding: 14,
                fontSize: 14,
                lineHeight: 1.7,
                fontFamily: "inherit",
                outline: "none",
                opacity: isFinal ? 0.7 : 1,
              }}
            />
          ) : (
            <div style={{
              minHeight: 420,
              borderRadius: 14,
              border: "1px solid var(--border)",
              background: "var(--bg)",
              padding: 14,
            }}>
              <p style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 14, color: "var(--text)", lineHeight: 1.7 }}>
                {translatedDraft}
              </p>
            </div>
          )}
        </section>

        <aside style={{ border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 18, padding: 18, display: "grid", gap: 16 }}>
          <div>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {t.ticketDetail.status}
            </p>
            <p style={{ margin: 0, fontSize: 14, color: "var(--text)", fontWeight: 700 }}>{ticket.status}</p>
          </div>

          <div>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {t.ticketDetail.intent}
            </p>
            <p style={{ margin: 0, fontSize: 14, color: "var(--text)" }}>{ticket.intent ?? "fallback"}</p>
          </div>

          {ticket.reasons.length > 0 && (
            <div>
              <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {t.ticketDetail.reasons}
              </p>
              <div style={{ display: "grid", gap: 8 }}>
                {ticket.reasons.map((reason, index) => (
                  <p key={index} style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.55 }}>
                    {reason}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gap: 10 }}>
            {!isFinal && (
              <button
                onClick={handleApproveSend}
                disabled={sendState === "sending" || viewMode !== "original"}
                style={{
                  border: "none",
                  background: "#C7F56F",
                  color: "#111",
                  borderRadius: 12,
                  padding: "12px 14px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: sendState === "sending" || viewMode !== "original" ? "not-allowed" : "pointer",
                  opacity: sendState === "sending" || viewMode !== "original" ? 0.65 : 1,
                }}
              >
                {sendState === "sending" ? t.ticketDetail.sending : t.ticketDetail.approveAndSend}
              </button>
            )}

            {!isFinal && (
              <button
                onClick={handleEscalate}
                disabled={escalateState === "sending"}
                style={{
                  border: "1px solid rgba(239,68,68,0.3)",
                  background: "rgba(239,68,68,0.08)",
                  color: "#f87171",
                  borderRadius: 12,
                  padding: "12px 14px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: escalateState === "sending" ? "not-allowed" : "pointer",
                }}
              >
                {escalateState === "sending" ? t.ticketDetail.escalateSending : t.ticketDetail.escalate}
              </button>
            )}

            {ticket.source === "conversation" && !isFinal && (
              <button
                onClick={handleRegenerate}
                disabled={regenerateState === "running"}
                style={{
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text)",
                  borderRadius: 12,
                  padding: "12px 14px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: regenerateState === "running" ? "not-allowed" : "pointer",
                }}
              >
                {regenerateState === "running" ? t.ticketDetail.regenerating : t.ticketDetail.regenerate}
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
