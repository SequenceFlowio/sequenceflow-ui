"use client";

import { use, useEffect, useMemo, useState, type CSSProperties } from "react";
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

function statusTone(status: string) {
  if (status === "sent") {
    return { dot: "#5c8200", bg: "rgba(199,245,111,0.18)", border: "rgba(199,245,111,0.28)" };
  }

  if (status === "escalated") {
    return { dot: "#60a5fa", bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.22)" };
  }

  if (status === "open" || status === "review") {
    return { dot: "#fbbf24", bg: "rgba(251,191,36,0.14)", border: "rgba(251,191,36,0.22)" };
  }

  return { dot: "#9ca3af", bg: "rgba(107,114,128,0.12)", border: "rgba(107,114,128,0.18)" };
}

function humanizeLabel(value: string | null | undefined) {
  if (!value) return "";
  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getInitials(name: string | null, email: string) {
  const source = (name?.trim() || email.split("@")[0] || "SF").replace(/[._-]+/g, " ");
  const parts = source.split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "SF";
}

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  padding: "12px 14px",
  fontSize: 14,
  lineHeight: 1.5,
  fontFamily: "inherit",
  outline: "none",
};

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
  const [sendErrorMessage, setSendErrorMessage] = useState<string | null>(null);
  const [escalateState, setEscalateState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [regenerateState, setRegenerateState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [escalateModalOpen, setEscalateModalOpen] = useState(false);
  const [escalateDepartment, setEscalateDepartment] = useState("");
  const [escalateReason, setEscalateReason] = useState("");
  const [escalateFormError, setEscalateFormError] = useState<string | null>(null);

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
        const hasEnglish = data.messages?.some((message) => Boolean(message.english?.body || message.english?.subject));
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

  const headerSubject = useMemo(() => {
    if (!ticket) return "";
    return viewMode === "english" ? ticket.subjectEnglish ?? ticket.subject : ticket.subject;
  }, [ticket, viewMode]);

  async function reloadTicket() {
    const res = await fetch(`/api/tickets/${id}`);
    const data = (await res.json()) as TicketDetailApiResponse;
    if (!res.ok) throw new Error(data.error ?? t.ticketDetail.reloadError);
    setTicket(data);
    setDraftBody(data.draft?.original.body ?? "");
  }

  async function handleApproveSend() {
    if (!ticket || draftBody.trim().length === 0) return;
    setSendErrorMessage(null);
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
      setSendErrorMessage(err instanceof Error ? err.message : t.ticketDetail.sendError);
      setSendState("error");
    }
  }

  function closeEscalationModal(force = false) {
    if (!force && escalateState === "sending") return;
    setEscalateModalOpen(false);
    setEscalateDepartment("");
    setEscalateReason("");
    setEscalateFormError(null);
  }

  async function handleEscalateSubmit() {
    if (!ticket) return;

    const department = escalateDepartment.trim();
    const reason = escalateReason.trim();
    const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(department);

    if (!department || !emailIsValid) {
      setEscalateFormError(t.ticketDetail.escalateDepartmentRequired);
      return;
    }

    if (!reason) {
      setEscalateFormError(t.ticketDetail.escalateReasonRequired);
      return;
    }

    if (reason.length < 10) {
      setEscalateFormError(t.ticketDetail.escalateReasonTooShort);
      return;
    }

    setEscalateFormError(null);
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
      closeEscalationModal(true);
    } catch (err) {
      console.error("[ticket-detail/escalate]", err);
      setEscalateState("error");
      setEscalateFormError(t.ticketDetail.escalateError);
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

  const animationStyles = (
    <style jsx global>{`
      @keyframes ticket-detail-shimmer {
        0% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }

      @keyframes ticket-detail-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `}</style>
  );

  if (loading) {
    const shimmerBlock: CSSProperties = {
      borderRadius: 14,
      background: "linear-gradient(90deg, var(--surface) 20%, rgba(107,114,128,0.08) 50%, var(--surface) 80%)",
      backgroundSize: "400% 100%",
      animation: "ticket-detail-shimmer 1.5s ease-in-out infinite",
    };

    return (
      <>
        {animationStyles}
        <div className="mx-auto max-w-screen-xl px-4 py-10 sm:px-6 lg:px-10 lg:py-12">
          <div style={{ display: "grid", gap: 18 }}>
            <div style={{ display: "grid", gap: 10, maxWidth: 520 }}>
              <div style={{ ...shimmerBlock, width: 76, height: 12 }} />
              <div style={{ ...shimmerBlock, width: "100%", height: 32, borderRadius: 18 }} />
              <div style={{ ...shimmerBlock, width: 220, height: 16 }} />
            </div>

            <div style={{ ...shimmerBlock, width: 320, height: 44, borderRadius: 12 }} />

            <div style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.08fr) minmax(280px, 0.9fr)",
              gap: 16,
            }}>
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  style={{
                    borderRadius: 20,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    padding: 18,
                    minHeight: index === 2 ? 460 : 620,
                    display: "grid",
                    gap: 14,
                  }}
                >
                  <div style={{ ...shimmerBlock, width: 120, height: 12 }} />
                  <div style={{ ...shimmerBlock, width: index === 2 ? "56%" : "72%", height: 18 }} />
                  <div style={{ ...shimmerBlock, width: "100%", height: index === 2 ? 220 : 420, borderRadius: 16 }} />
                  {index === 2 && (
                    <>
                      <div style={{ ...shimmerBlock, width: "100%", height: 48, borderRadius: 14 }} />
                      <div style={{ ...shimmerBlock, width: "100%", height: 44, borderRadius: 14 }} />
                      <div style={{ ...shimmerBlock, width: "100%", height: 40, borderRadius: 12 }} />
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error || !ticket) {
    return (
      <>
        {animationStyles}
        <div className="flex flex-col gap-4">
          <Link href="/inbox" style={{ textDecoration: "none", color: "var(--muted)", fontSize: 13 }}>
            {t.ticketDetail.backToInbox}
          </Link>
          <p style={{ margin: 0, color: "#f87171", fontSize: 14 }}>{error ?? t.ticketDetail.ticketNotFound}</p>
        </div>
      </>
    );
  }

  const confidence = confidenceTone(ticket.confidence);
  const statusMeta = statusTone(ticket.status);
  const isFinal = ticket.status === "sent" || ticket.status === "escalated";
  const confidencePercent = ticket.confidence != null ? Math.round(ticket.confidence * 100) : null;
  const customerName = ticket.customer.name?.trim() || ticket.customer.email;
  const customerInitials = getInitials(ticket.customer.name, ticket.customer.email);
  const decisionLabel = humanizeLabel(ticket.decision);
  const intentLabel = humanizeLabel(ticket.intent) || t.ticketDetail.none;
  const statusLabel = humanizeLabel(ticket.status) || t.ticketDetail.none;
  const draftSubject = ticket.draft
    ? viewMode === "english"
      ? ticket.draft.english.subject ?? ticket.draft.original.subject
      : ticket.draft.original.subject
    : "";
  const readOnlyMode = viewMode === "english";
  const canSend = !isFinal && sendState !== "sending" && draftBody.trim().length > 0;
  const actionError =
    sendState === "error"
      ? sendErrorMessage ?? t.ticketDetail.sendError
      : escalateState === "error"
        ? t.ticketDetail.escalateError
        : regenerateState === "error"
          ? t.ticketDetail.regenerateError
          : null;
  const finalBannerText = ticket.status === "escalated"
    ? t.ticketDetail.escalatedBanner.replace("{department}", ticket.escalation?.department ?? t.ticketDetail.none)
    : t.ticketDetail.sentBanner;
  const finalWatermark = ticket.status === "escalated"
    ? t.ticketDetail.escalatedWatermark
    : t.ticketDetail.sentWatermark;

  return (
    <>
      {animationStyles}
      <div className="mx-auto max-w-screen-xl px-4 py-10 sm:px-6 lg:px-10 lg:py-12">
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0, display: "grid", gap: 10 }}>
              <Link
                href="/inbox"
                style={{
                  textDecoration: "none",
                  color: "var(--muted)",
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  width: "fit-content",
                }}
              >
                {t.ticketDetail.backToInbox}
              </Link>

              <h1
                style={{
                  margin: 0,
                  fontSize: 26,
                  fontWeight: 800,
                  lineHeight: 1.05,
                  letterSpacing: "-0.03em",
                  color: "var(--text)",
                  maxWidth: 720,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {headerSubject}
              </h1>

              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--muted)" }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    border: "1px solid var(--border)",
                    background: "var(--sf-surface-2)",
                    color: "var(--text)",
                    fontSize: 12,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {customerInitials}
                </div>
                <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{customerName}</span>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>{ticket.customer.email}</span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {decisionLabel && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 6,
                    padding: "6px 10px",
                    background: "rgba(59,130,246,0.10)",
                    color: "#60a5fa",
                    border: "1px solid rgba(59,130,246,0.14)",
                  }}
                >
                  {decisionLabel}
                </span>
              )}

              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 6,
                  padding: "6px 10px",
                  background: confidence.bg,
                  color: confidence.color,
                  border: `1px solid ${confidence.bg}`,
                }}
              >
                {confidencePercent != null ? `${confidencePercent}% ${t.inbox.confidenceSuffix}` : statusLabel}
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <div
              style={{
                display: "inline-flex",
                width: "fit-content",
                alignItems: "center",
                gap: 4,
                padding: 3,
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--surface)",
              }}
            >
              {(["english", "original"] as const).map((mode) => {
                const active = viewMode === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    style={{
                      border: "none",
                      background: active ? "var(--surface)" : "transparent",
                      color: active ? "var(--text)" : "var(--muted)",
                      borderRadius: 9,
                      padding: "10px 16px",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    }}
                  >
                    {mode === "english" ? t.ticketDetail.englishTab : t.ticketDetail.originalTab}
                  </button>
                );
              })}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "fit-content",
                maxWidth: 560,
                padding: "10px 12px",
                borderRadius: 12,
                background: "rgba(199,245,111,0.08)",
                border: "1px solid rgba(199,245,111,0.2)",
                color: "var(--muted)",
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#C7F56F",
                  boxShadow: "0 0 0 4px rgba(199,245,111,0.14)",
                  flexShrink: 0,
                }}
              />
              <span>{t.ticketDetail.sendLanguageHint}</span>
            </div>

            {readOnlyMode && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  width: "fit-content",
                  maxWidth: 640,
                  padding: "12px 14px",
                  borderRadius: 14,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ display: "grid", gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                    {t.ticketDetail.readOnlyTitle}
                  </span>
                  <span style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.55 }}>
                    {t.ticketDetail.readOnlyExplanation}
                  </span>
                </div>
                <button
                  onClick={() => setViewMode("original")}
                  style={{
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    color: "var(--text)",
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  {t.ticketDetail.switchToOriginal}
                </button>
              </div>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 0.95fr) minmax(0, 1.1fr) minmax(280px, 0.9fr)",
              gap: 16,
              alignItems: "start",
            }}
          >
            <section
              style={{
                border: "1px solid var(--border)",
                background: "var(--surface)",
                borderRadius: 18,
                overflow: "hidden",
                minHeight: 620,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  padding: "14px 18px",
                  borderBottom: "1px solid var(--border)",
                  display: "grid",
                  gap: 8,
                }}
              >
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {t.ticketDetail.customerMessage}
                </p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                  {customerSubject}
                </p>
              </div>

              <div style={{ flex: 1, minHeight: 0, padding: 18 }}>
                <div
                  style={{
                    height: "100%",
                    maxHeight: 520,
                    overflowY: "auto",
                    paddingRight: 6,
                    WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 90%, transparent 100%)",
                    maskImage: "linear-gradient(to bottom, black 0%, black 90%, transparent 100%)",
                  }}
                >
                  <p style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 14, color: "var(--text)", lineHeight: 1.72 }}>
                    {customerBody || t.ticketDetail.noMessageContent}
                  </p>
                </div>
              </div>
            </section>

            <section
              style={{
                border: "1px solid var(--border)",
                background: "var(--surface)",
                borderRadius: 18,
                overflow: "hidden",
                minHeight: 620,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  padding: "14px 18px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ display: "grid", gap: 6 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    {t.ticketDetail.aiDraft}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
                    {t.ticketDetail.bilingualHint}
                  </p>
                </div>
                {readOnlyMode && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 999,
                      padding: "5px 10px",
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      color: "var(--muted)",
                      flexShrink: 0,
                    }}
                  >
                    {t.ticketDetail.readOnlyBadge}
                  </span>
                )}
              </div>

              <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
                {ticket.draft && (
                  <div
                    style={{
                      width: "fit-content",
                      maxWidth: "100%",
                      borderRadius: 999,
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      padding: "7px 12px",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--text)",
                    }}
                  >
                    {draftSubject}
                  </div>
                )}

                <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
                  {viewMode === "original" ? (
                    <textarea
                      value={draftBody}
                      onChange={(event) => setDraftBody(event.target.value)}
                      disabled={isFinal}
                      rows={18}
                      style={{
                        width: "100%",
                        minHeight: 500,
                        resize: "none",
                        boxSizing: "border-box",
                        borderRadius: 14,
                        border: "1px solid var(--border)",
                        background: "var(--bg)",
                        color: "var(--text)",
                        padding: 16,
                        fontSize: 14,
                        lineHeight: 1.75,
                        fontFamily: "inherit",
                        outline: "none",
                        opacity: isFinal ? 0.84 : 1,
                        boxShadow: isFinal ? "none" : "0 0 0 0 rgba(199,245,111,0)",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        minHeight: 500,
                        borderRadius: 14,
                        border: "1px solid var(--border)",
                        background: "var(--bg)",
                        padding: 16,
                        opacity: 0.9,
                      }}
                    >
                      <p style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 14, color: "var(--text)", lineHeight: 1.75 }}>
                        {translatedDraft || t.ticketDetail.noMessageContent}
                      </p>
                    </div>
                  )}

                  {isFinal && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: "none",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          letterSpacing: "0.02em",
                          color: "var(--muted)",
                          background: "rgba(255,255,255,0.72)",
                          padding: "10px 14px",
                          borderRadius: 999,
                          border: "1px solid var(--border)",
                          opacity: 0.9,
                          backdropFilter: "blur(6px)",
                        }}
                      >
                        {finalWatermark}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <aside style={{ display: "grid", gap: 12, alignSelf: "start", position: "sticky", top: 24 }}>
              <div
                style={{
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  borderRadius: 18,
                  padding: 18,
                  display: "grid",
                  gap: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      aria-hidden
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: statusMeta.dot,
                        boxShadow: `0 0 0 5px ${statusMeta.bg}`,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ display: "grid", gap: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase" }}>
                        {t.ticketDetail.status}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{statusLabel}</span>
                    </div>
                  </div>
                </div>

                <div style={{ height: 1, background: "var(--border)" }} />

                <div style={{ display: "grid", gap: 14 }}>
                  <div style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase" }}>
                      {t.ticketDetail.intent}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{intentLabel}</span>
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase" }}>
                        {t.ticketDetail.confidence}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: confidence.color }}>
                        {confidencePercent != null ? `${confidencePercent}%` : "—"}
                      </span>
                    </div>
                    <div style={{ height: 4, borderRadius: 999, background: "var(--bg)", overflow: "hidden" }}>
                      <div
                        style={{
                          width: confidencePercent != null ? `${Math.max(confidencePercent, 8)}%` : "0%",
                          height: "100%",
                          borderRadius: 999,
                          background: confidence.color,
                        }}
                      />
                    </div>
                  </div>

                  {ticket.reasons.length > 0 && (
                    <div style={{ display: "grid", gap: 8 }}>
                      {ticket.reasons.map((reason, index) => (
                        <div key={`${reason}-${index}`} style={{ display: "grid", gridTemplateColumns: "3px minmax(0, 1fr)", gap: 10, alignItems: "start" }}>
                          <span
                            aria-hidden
                            style={{
                              width: 3,
                              height: "100%",
                              minHeight: 26,
                              borderRadius: 2,
                              background: "var(--border)",
                            }}
                          />
                          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
                            {reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {!isFinal && (
                  <button
                    onClick={handleApproveSend}
                    disabled={!canSend}
                    style={{
                      border: "none",
                      background: "#C7F56F",
                      color: "#0f1a00",
                      borderRadius: 14,
                      minHeight: 48,
                      padding: "12px 16px",
                      fontSize: 15,
                      fontWeight: 800,
                      cursor: canSend ? "pointer" : "not-allowed",
                      opacity: canSend ? 1 : 0.65,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      boxShadow: canSend ? "0 4px 16px rgba(199,245,111,0.32)" : "none",
                    }}
                    title={readOnlyMode ? t.ticketDetail.sendLanguageHint : undefined}
                  >
                    {sendState === "sending" && (
                      <span
                        aria-hidden
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          border: "2px solid rgba(15,26,0,0.2)",
                          borderTopColor: "#0f1a00",
                          animation: "ticket-detail-spin 0.8s linear infinite",
                        }}
                      />
                    )}
                    {sendState === "sending" ? t.ticketDetail.sending : t.ticketDetail.approveAndSend}
                  </button>
                )}

                {!isFinal && (
                  <button
                    onClick={() => {
                      setEscalateFormError(null);
                      setEscalateModalOpen(true);
                    }}
                    disabled={escalateState === "sending"}
                    style={{
                      border: "1px solid rgba(239,68,68,0.25)",
                      background: "rgba(239,68,68,0.07)",
                      color: "#f87171",
                      borderRadius: 14,
                      minHeight: 44,
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
                      color: regenerateState === "running" ? "var(--text)" : "var(--muted)",
                      borderRadius: 12,
                      minHeight: 40,
                      padding: "10px 14px",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: regenerateState === "running" ? "not-allowed" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        display: "inline-block",
                        animation: regenerateState === "running" ? "ticket-detail-spin 0.9s linear infinite" : "none",
                      }}
                    >
                      ↺
                    </span>
                    {regenerateState === "running" ? t.ticketDetail.regenerating : t.ticketDetail.regenerate}
                  </button>
                )}

                {actionError && (
                  <p style={{ margin: "2px 2px 0", fontSize: 12, color: "#f87171", lineHeight: 1.5 }}>
                    {actionError}
                  </p>
                )}
              </div>
            </aside>
          </div>

          {isFinal && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                borderRadius: 16,
                border: `1px solid ${statusMeta.border}`,
                background: statusMeta.bg,
                padding: "14px 16px",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(255,255,255,0.65)",
                  color: statusMeta.dot,
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                {ticket.status === "escalated" ? "↗" : "✓"}
              </span>
              <div style={{ display: "grid", gap: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{finalBannerText}</span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{t.ticketDetail.sendLanguageHint}</span>
              </div>
            </div>
          )}
        </div>

        {escalateModalOpen && (
          <div
            className="sf-modal-overlay"
            style={{ zIndex: 70 }}
            onClick={(event) => {
              if (event.target === event.currentTarget) closeEscalationModal();
            }}
          >
            <div className="sf-modal" style={{ maxWidth: 520, border: "1px solid var(--border)" }}>
              <div className="sf-modal__header">
                <div className="sf-modal__header-left">
                  <div
                    className="sf-modal__icon"
                    style={{
                      background: "rgba(239,68,68,0.12)",
                      color: "#f87171",
                      fontSize: 18,
                      fontWeight: 800,
                    }}
                  >
                    !
                  </div>
                  <div style={{ display: "grid", gap: 2 }}>
                    <p className="sf-modal__title">{t.ticketDetail.escalateModalTitle}</p>
                    <p className="sf-modal__subtitle">{t.ticketDetail.escalateModalSubtitle}</p>
                  </div>
                </div>
                <button className="sf-modal__close" onClick={() => closeEscalationModal()} aria-label={t.ticketDetail.escalateCancel}>
                  ×
                </button>
              </div>

              <div className="sf-modal__body" style={{ display: "grid", gap: 14 }}>
                <label style={{ display: "grid", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                    {t.ticketDetail.escalateDepartmentLabel}
                  </span>
                  <input
                    type="email"
                    value={escalateDepartment}
                    onChange={(event) => setEscalateDepartment(event.target.value)}
                    placeholder={t.ticketDetail.escalateDepartmentPlaceholder}
                    style={inputStyle}
                  />
                </label>

                <label style={{ display: "grid", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                    {t.ticketDetail.escalateReasonLabel}
                  </span>
                  <textarea
                    value={escalateReason}
                    onChange={(event) => setEscalateReason(event.target.value)}
                    placeholder={t.ticketDetail.escalateReasonPlaceholder}
                    rows={5}
                    style={{
                      ...inputStyle,
                      resize: "vertical",
                      minHeight: 120,
                    }}
                  />
                </label>

                {escalateFormError && (
                  <p style={{ margin: 0, fontSize: 12, color: "#f87171", lineHeight: 1.5 }}>
                    {escalateFormError}
                  </p>
                )}
              </div>

              <div className="sf-modal__footer" style={{ gap: 10 }}>
                <button
                  onClick={() => closeEscalationModal()}
                  disabled={escalateState === "sending"}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: escalateState === "sending" ? "not-allowed" : "pointer",
                  }}
                >
                  {t.ticketDetail.escalateCancel}
                </button>
                <button
                  onClick={handleEscalateSubmit}
                  disabled={escalateState === "sending"}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(239,68,68,0.25)",
                    background: "rgba(239,68,68,0.10)",
                    color: "#f87171",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: escalateState === "sending" ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {escalateState === "sending" && (
                    <span
                      aria-hidden
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        border: "2px solid rgba(248,113,113,0.25)",
                        borderTopColor: "#f87171",
                        animation: "ticket-detail-spin 0.8s linear infinite",
                      }}
                    />
                  )}
                  {escalateState === "sending" ? t.ticketDetail.escalateSending : t.ticketDetail.escalateConfirm}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
