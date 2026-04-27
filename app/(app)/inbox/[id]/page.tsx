"use client";

import { use, useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useTranslation } from "@/lib/i18n/LanguageProvider";
import type { TicketDetailResponse } from "@/types/aiInbox";
import { computeNextAutoSend, formatAutoSendWhen, formatAutoSendCountdown } from "@/lib/autosend/nextSendTime";

type ViewMode = "english" | "original";

/**
 * Shared shape for the non-primary action buttons in the ticket sidebar
 * (Escalate, Regenerate, Delete). Only color role differs per button —
 * everything else (radius, height, font size, weight, padding, gap) is
 * unified so the stack reads as a coherent group next to the Approve CTA.
 */
const secondaryButtonStyle: CSSProperties = {
  borderRadius: 12,
  minHeight: 42,
  padding: "10px 14px",
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: "0.01em",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
};

function confidenceTone(confidence: number | null) {
  if (confidence == null) return { bg: "rgba(107,114,128,0.12)", color: "#9ca3af" };
  if (confidence >= 0.85) return { bg: "rgba(199,245,111,0.22)", color: "var(--tone-success-strong)" };
  if (confidence >= 0.65) return { bg: "rgba(251,191,36,0.16)", color: "#fbbf24" };
  return { bg: "rgba(239,68,68,0.14)", color: "#f87171" };
}

function statusTone(status: string) {
  if (status === "sent") {
    return { dot: "var(--tone-success-strong)", bg: "rgba(199,245,111,0.18)", border: "rgba(199,245,111,0.28)" };
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
  const router = useRouter();
  const [ticket, setTicket] = useState<TicketDetailResponse | null>(null);
  const [draftBody, setDraftBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("original");
  const [sendState, setSendState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [sendErrorMessage, setSendErrorMessage] = useState<string | null>(null);
  const [escalateState, setEscalateState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [regenerateState, setRegenerateState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteState, setDeleteState] = useState<"idle" | "deleting" | "error">("idle");
  const [escalateModalOpen, setEscalateModalOpen] = useState(false);
  const [escalateDepartment, setEscalateDepartment] = useState("");
  const [escalateReason, setEscalateReason] = useState("");
  const [escalateFormError, setEscalateFormError] = useState<string | null>(null);
  const [autosendTimes, setAutosendTimes] = useState<{ time1: string | null; time2: string | null; enabled: boolean }>({ time1: null, time2: null, enabled: false });
  const [badgeNow, setBadgeNow] = useState<number>(() => Date.now());
  const [cancelAutosendState, setCancelAutosendState] = useState<"idle" | "cancelling" | "error">("idle");
  // True while the AI pipeline is still likely producing a draft for this
  // conversation — gives the UI a clean signal to show a loading skeleton
  // instead of the misleading "AI couldn't generate a draft" warning that
  // appears purely because there's no decision row yet.
  const [draftPipelineTimedOut, setDraftPipelineTimedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/autosend-config");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setAutosendTimes({
          time1: data.autosendTime1 ?? null,
          time2: data.autosendTime2 ?? null,
          enabled: Boolean(data.autosendEnabled),
        });
      } catch {
        // silent — the card simply won't render
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setBadgeNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);

  const nextAutoSend = useMemo(
    () => computeNextAutoSend(autosendTimes, new Date(badgeNow)),
    [autosendTimes, badgeNow],
  );

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

  // ── Draft-still-generating detection ──────────────────────────────────────
  // The conversation row is created by the inbound webhook a few seconds
  // before the AI pipeline finishes. During that gap the API correctly
  // returns `draft: null` — but rendering the existing "AI couldn't
  // generate a draft" warning during that gap is misleading. We treat any
  // conversation younger than DRAFT_PIPELINE_TIMEOUT_MS as still drafting,
  // and silently poll the API until either the draft arrives or we time out.
  const DRAFT_PIPELINE_TIMEOUT_MS = 90_000;
  const conversationAgeMs = useMemo(() => {
    if (!ticket?.createdAt) return null;
    const created = new Date(ticket.createdAt).getTime();
    if (Number.isNaN(created)) return null;
    return Math.max(0, badgeNow - created);
  }, [ticket?.createdAt, badgeNow]);
  const awaitingDraft =
    ticket?.source === "conversation"
    && !ticket.draft
    && !draftPipelineTimedOut
    && conversationAgeMs != null
    && conversationAgeMs < DRAFT_PIPELINE_TIMEOUT_MS;

  // Tighten the badgeNow tick while we're awaiting the draft so the
  // age check (and the auto-poll's stop condition) react within ~1s
  // instead of waiting on the default 30s heartbeat.
  useEffect(() => {
    if (!awaitingDraft) return;
    const iv = setInterval(() => setBadgeNow(Date.now()), 1_000);
    return () => clearInterval(iv);
  }, [awaitingDraft]);

  // Poll the detail endpoint every 2.5s while we believe the draft is
  // in flight. As soon as the decision row lands, `ticket.draft` becomes
  // non-null and the effect tears itself down on the next render. If we
  // hit the timeout the warning panel takes over (manual Regenerate).
  useEffect(() => {
    if (!awaitingDraft) return;
    let cancelled = false;
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`/api/tickets/${id}`);
        if (!res.ok) return;
        const data = (await res.json()) as TicketDetailApiResponse;
        if (cancelled || "error" in data) return;
        setTicket(data);
        if (data.draft?.original.body) {
          setDraftBody(data.draft.original.body);
        }
      } catch {
        // transient — keep polling
      }
    }, 2_500);
    return () => { cancelled = true; clearInterval(iv); };
  }, [awaitingDraft, id]);

  // Flip to the "actually failed" warning once we've waited long enough.
  useEffect(() => {
    if (ticket?.source !== "conversation" || ticket.draft) {
      setDraftPipelineTimedOut(false);
      return;
    }
    if (conversationAgeMs == null) return;
    if (conversationAgeMs >= DRAFT_PIPELINE_TIMEOUT_MS) {
      setDraftPipelineTimedOut(true);
    }
  }, [ticket?.source, ticket?.draft, conversationAgeMs]);

  const translatedDraft = useMemo(() => {
    if (!ticket?.draft) return "";
    return viewMode === "english"
      ? (ticket.draft.english.body || ticket.draft.original.body)
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
      // Success — leave the detail page and return to the inbox. The ticket
      // is finalised, there's nothing more to do on this screen.
      setSendState("sent");
      router.push("/inbox");
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
      setViewMode("original");
      setRegenerateState("done");
    } catch (err) {
      console.error("[ticket-detail/regenerate]", err);
      setRegenerateState("error");
    }
  }

  async function handleDelete() {
    if (!ticket) return;
    setDeleteState("deleting");
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      router.push("/inbox");
    } catch {
      setDeleteState("error");
      setDeleteConfirm(false);
    }
  }

  async function handleCancelAutosend() {
    if (!ticket || ticket.status !== "pending_autosend") return;
    setCancelAutosendState("cancelling");
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/cancel-autosend`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Cancel failed");
      }
      // Reload so the banner disappears and the status flips back to the
      // review/draft surface with its normal action buttons.
      await reloadTicket();
      setCancelAutosendState("idle");
    } catch (err) {
      console.error("[ticket-detail/cancel-autosend]", err);
      setCancelAutosendState("error");
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

      @media (max-width: 900px) {
        .ticket-detail-grid {
          grid-template-columns: 1fr !important;
        }
        .ticket-detail-aside {
          position: static !important;
        }
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
  // Header display for the sender block.
  // - Legacy/bugged rows can have customer.email pointing at our own inbound
  //   routing domain (the forwarding envelope). Show a friendly label there
  //   instead of leaking the internal `t-...@inbox.emailreply...` address.
  // - When no real name is present we only render one row (the email) so the
  //   same string isn't repeated twice below the avatar.
  const rawCustomerEmail = ticket.customer.email ?? "";
  const isForwardingArtifact = rawCustomerEmail
    .toLowerCase()
    .endsWith("@inbox.emailreply.sequenceflow.io");
  const trimmedCustomerName = ticket.customer.name?.trim() || null;
  const customerDisplayName = isForwardingArtifact
    ? (language === "nl" ? "Onbekende afzender" : "Unknown sender")
    : trimmedCustomerName;
  const customerDisplayEmail = isForwardingArtifact
    ? (language === "nl"
        ? "Oorspronkelijke afzender niet beschikbaar"
        : "Original sender unavailable")
    : rawCustomerEmail;
  const customerInitials = getInitials(
    isForwardingArtifact ? null : ticket.customer.name,
    isForwardingArtifact ? "?" : rawCustomerEmail,
  );
  const decisionLabel = humanizeLabel(ticket.decision);
  const intentLabel = humanizeLabel(ticket.intent) || t.ticketDetail.none;
  const statusLabel = humanizeLabel(ticket.status) || t.ticketDetail.none;
  const draftSubject = ticket.draft
    ? viewMode === "english"
      ? (ticket.draft.english.subject || ticket.draft.original.subject)
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
                  {customerDisplayName ? (
                    <>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "var(--text)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {customerDisplayName}
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          color: "var(--muted)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          fontStyle: isForwardingArtifact ? "italic" : "normal",
                        }}
                        title={isForwardingArtifact ? undefined : customerDisplayEmail}
                      >
                        {customerDisplayEmail}
                      </span>
                    </>
                  ) : (
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "var(--text)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={customerDisplayEmail}
                    >
                      {customerDisplayEmail}
                    </span>
                  )}
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

            {ticket.status === "pending_autosend" && nextAutoSend && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  maxWidth: 640,
                  padding: "12px 16px",
                  borderRadius: 14,
                  background: "rgba(251,191,36,0.08)",
                  border: "1px solid rgba(251,191,36,0.28)",
                  color: "#a16207",
                }}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
                <div style={{ display: "grid", gap: 2, minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>
                    {`${t.inbox.autosendScheduledTitle} · ${formatAutoSendWhen(nextAutoSend, language, new Date(badgeNow))} · ${formatAutoSendCountdown(nextAutoSend, language, new Date(badgeNow))}`}
                  </span>
                  <span style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.9 }}>
                    {cancelAutosendState === "error" ? t.ticketDetail.cancelAutosendError : t.inbox.autosendScheduledDesc}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCancelAutosend}
                  disabled={cancelAutosendState === "cancelling"}
                  style={{
                    flexShrink: 0,
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: "1px solid rgba(161,98,7,0.45)",
                    background: "rgba(251,191,36,0.18)",
                    color: "#a16207",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: cancelAutosendState === "cancelling" ? "not-allowed" : "pointer",
                    opacity: cancelAutosendState === "cancelling" ? 0.6 : 1,
                  }}
                >
                  {t.autosend.cancelAutosend}
                </button>
              </div>
            )}

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
            className="ticket-detail-grid"
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
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {t.ticketDetail.customerMessage}
                </p>
                {ticket.messages.filter((m) => m.direction !== "outbound").length > 1 && (
                  <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 6, padding: "2px 7px", background: "var(--bg)", border: "1px solid var(--border)", color: "var(--muted)" }}>
                    {ticket.messages.filter((m) => m.direction !== "outbound").length} berichten
                  </span>
                )}
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                {ticket.messages.filter((m) => m.direction !== "outbound").length === 0 && (
                  <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>{t.ticketDetail.noMessageContent}</p>
                )}
                {ticket.messages.filter((m) => m.direction !== "outbound").map((msg, i, arr) => {
                  const body = viewMode === "english"
                    ? (msg.english.body || msg.original.body)
                    : msg.original.body;
                  const isLast = i === arr.length - 1;
                  const timeStr = msg.receivedAt
                    ? new Date(msg.receivedAt).toLocaleString(language === "nl" ? "nl-NL" : "en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                    : null;

                  return (
                    <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, maxWidth: "88%" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>
                          {(() => {
                            const addr = msg.fromEmail ?? "";
                            if (addr && addr.toLowerCase().endsWith("@inbox.emailreply.sequenceflow.io")) {
                              return customerDisplayName ?? customerDisplayEmail;
                            }
                            return addr || customerDisplayName || customerDisplayEmail;
                          })()}
                        </span>
                        {timeStr && (
                          <span style={{ fontSize: 10, color: "var(--muted)" }}>{timeStr}</span>
                        )}
                        {isLast && (
                          <span style={{ fontSize: 10, fontWeight: 600, borderRadius: 4, padding: "1px 5px", background: "rgba(199,245,111,0.14)", color: "var(--tone-success-strong)" }}>
                            {language === "nl" ? "nieuwste" : "latest"}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          maxWidth: "88%",
                          borderRadius: "4px 14px 14px 14px",
                          padding: "10px 14px",
                          background: "var(--bg)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <p style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 13, color: "var(--text)", lineHeight: 1.72 }}>
                          {body || t.ticketDetail.noMessageContent}
                        </p>
                      </div>
                    </div>
                  );
                })}
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
                  {!isFinal && ticket.source === "conversation" && !draftBody && awaitingDraft && (
                    <div
                      style={{
                        borderRadius: 14,
                        background: "var(--surface-subtle)",
                        border: "1px solid var(--border)",
                        padding: "20px 22px",
                        marginBottom: 12,
                        display: "flex",
                        flexDirection: "column",
                        gap: 14,
                      }}
                      aria-live="polite"
                      aria-busy="true"
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span className="draft-spinner" aria-hidden="true" />
                        <div style={{ display: "grid", gap: 3, flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em" }}>
                            {t.ticketDetail.draftGeneratingTitle}
                          </p>
                          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
                            {t.ticketDetail.draftGeneratingHint}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: "grid", gap: 8 }}>
                        <span className="draft-skeleton-line" style={{ width: "92%" }} />
                        <span className="draft-skeleton-line" style={{ width: "78%" }} />
                        <span className="draft-skeleton-line" style={{ width: "85%" }} />
                        <span className="draft-skeleton-line" style={{ width: "60%" }} />
                      </div>
                    </div>
                  )}
                  {!isFinal && ticket.source === "conversation" && !draftBody && !awaitingDraft && (
                    <div
                      style={{
                        borderRadius: 14,
                        background: "rgba(251,191,36,0.10)",
                        border: "1px solid rgba(251,191,36,0.35)",
                        padding: "18px 20px",
                        marginBottom: 12,
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                      }}
                    >
                      <span style={{ fontSize: 18, lineHeight: 1 }}>⚠</span>
                      <div style={{ display: "grid", gap: 4 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#a16207" }}>
                          {language === "nl" ? "AI kon geen concept genereren" : "AI couldn't generate a draft"}
                        </p>
                        <p style={{ margin: 0, fontSize: 12, color: "#a16207", lineHeight: 1.5 }}>
                          {language === "nl"
                            ? "Klik op Opnieuw genereren om het opnieuw te proberen."
                            : "Click Regenerate below to try again."}
                        </p>
                      </div>
                    </div>
                  )}
                  {awaitingDraft ? null : viewMode === "original" ? (
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
                          background: "var(--surface-subtle-strong)",
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

            <aside className="ticket-detail-aside" style={{ display: "grid", gap: 12, alignSelf: "start", position: "sticky", top: 24 }}>
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
                      ...secondaryButtonStyle,
                      border: "1px solid rgba(239,68,68,0.25)",
                      background: "rgba(239,68,68,0.07)",
                      color: "#f87171",
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
                      ...secondaryButtonStyle,
                      border: !draftBody ? "1px solid rgba(251,191,36,0.35)" : "1px solid var(--border)",
                      background: !draftBody ? "rgba(251,191,36,0.10)" : "transparent",
                      color: regenerateState === "running"
                        ? "var(--text)"
                        : !draftBody
                          ? "#d4a017"
                          : "var(--muted)",
                      cursor: regenerateState === "running" ? "not-allowed" : "pointer",
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
                    {regenerateState === "running"
                      ? t.ticketDetail.regenerating
                      : regenerateState === "error"
                        ? (language === "nl" ? "Mislukt — opnieuw proberen" : "Failed — try again")
                        : t.ticketDetail.regenerate}
                  </button>
                )}

                {!deleteConfirm ? (
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    style={{
                      ...secondaryButtonStyle,
                      border: "1px solid rgba(248,113,113,0.3)",
                      background: "transparent",
                      color: "#f87171",
                    }}
                  >
                    {language === "nl" ? "Verwijderen" : "Delete"}
                  </button>
                ) : (
                  <div style={{ display: "grid", gap: 6 }}>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", textAlign: "center" }}>
                      {language === "nl" ? "Weet je het zeker?" : "Are you sure?"}
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      <button
                        onClick={() => setDeleteConfirm(false)}
                        style={{ border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", borderRadius: 10, padding: "8px 0", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                      >
                        {language === "nl" ? "Annuleren" : "Cancel"}
                      </button>
                      <button
                        onClick={handleDelete}
                        disabled={deleteState === "deleting"}
                        style={{ border: "none", background: "#ef4444", color: "#fff", borderRadius: 10, padding: "8px 0", fontSize: 12, fontWeight: 700, cursor: deleteState === "deleting" ? "not-allowed" : "pointer", opacity: deleteState === "deleting" ? 0.7 : 1 }}
                      >
                        {deleteState === "deleting" ? "…" : (language === "nl" ? "Ja, verwijder" : "Yes, delete")}
                      </button>
                    </div>
                  </div>
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
                  background: "var(--surface-subtle)",
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
