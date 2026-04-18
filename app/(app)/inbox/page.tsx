"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useTranslation } from "@/lib/i18n/LanguageProvider";
import type { TicketListItem } from "@/types/aiInbox";

type Tab = "review" | "sent" | "escalated";

type OnboardingState = {
  inboundEmail: string;
  isForwardingActive: boolean;
  hasSignature: boolean;
  knowledgeDocCount: number;
};

function IconInbox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <path d="M2 13h5l2 3h6l2-3h5" />
    </svg>
  );
}

function IconPaperPlane() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function IconArrowTurn() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
      <path d="M17 8l4 4-4 4" />
      <path d="M3 12h18" />
    </svg>
  );
}

function IconSetup() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
      <path d="M12 2v4" />
      <path d="M12 18v4" />
      <path d="M4.93 4.93l2.83 2.83" />
      <path d="M16.24 16.24l2.83 2.83" />
      <path d="M2 12h4" />
      <path d="M18 12h4" />
      <path d="M4.93 19.07l2.83-2.83" />
      <path d="M16.24 7.76l2.83-2.83" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function confidenceMeta(confidence: number | null) {
  if (confidence == null) {
    return {
      fill: "rgba(148,163,184,0.3)",
      badgeBg: "rgba(148,163,184,0.12)",
      badgeColor: "var(--sf-text-muted)",
    };
  }

  if (confidence >= 0.85) {
    return {
      fill: "#C7F56F",
      badgeBg: "rgba(199,245,111,0.22)",
      badgeColor: "#5a7d00",
    };
  }

  if (confidence >= 0.65) {
    return {
      fill: "#fbbf24",
      badgeBg: "rgba(251,191,36,0.16)",
      badgeColor: "#a16207",
    };
  }

  return {
    fill: "#f87171",
    badgeBg: "rgba(248,113,113,0.14)",
    badgeColor: "#b42318",
  };
}

function intentMeta(intent: string | null) {
  switch (intent) {
    case "order_status":
    case "order_tracking":  return { bg: "rgba(59,130,246,0.12)",  color: "#2563eb" };
    case "return_request":  return { bg: "rgba(251,191,36,0.14)",  color: "#a16207" };
    case "complaint":       return { bg: "rgba(239,68,68,0.10)",   color: "#dc2626" };
    default:                return { bg: "var(--sf-surface-2)",    color: "var(--sf-text-muted)" };
  }
}

function statusTab(status: string): Tab {
  if (status === "sent") return "sent";
  if (status === "escalated") return "escalated";
  return "review";
}

function statusDot(status: string) {
  if (status === "sent") return "#60a5fa";
  if (status === "escalated") return "#f87171";
  return "#C7F56F";
}

function formatRelativeTime(dateString: string, language: "en" | "nl") {
  const value = new Date(dateString).getTime();
  if (Number.isNaN(value)) return "";

  const diffMs = value - Date.now();
  const abs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat(language === "nl" ? "nl-NL" : "en-US", { numeric: "auto" });

  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (abs < hour) return rtf.format(Math.round(diffMs / minute), "minute");
  if (abs < day) return rtf.format(Math.round(diffMs / hour), "hour");
  return rtf.format(Math.round(diffMs / day), "day");
}

export default function InboxPage() {
  const { t, language } = useTranslation();
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("review");
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [copiedForwarding, setCopiedForwarding] = useState(false);

  useEffect(() => {
    async function load() {
      setError(null);
      try {
        const [ticketsRes, onboardingRes] = await Promise.all([
          fetch("/api/tickets"),
          fetch("/api/integrations/email/setup"),
        ]);

        const ticketsData = await ticketsRes.json();
        if (!ticketsRes.ok) throw new Error(ticketsData.error ?? "Failed to load tickets.");
        setTickets(ticketsData.tickets ?? []);

        if (onboardingRes.ok) {
          const onboardingData = await onboardingRes.json();
          setOnboarding({
            inboundEmail: onboardingData.inboundEmail ?? "",
            isForwardingActive: Boolean(onboardingData.isForwardingActive),
            hasSignature: Boolean(onboardingData.hasSignature),
            knowledgeDocCount: Number(onboardingData.knowledgeDocCount ?? 0),
          });
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load tickets.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const visibleTickets = useMemo(
    () => tickets.filter((ticket) => statusTab(ticket.status) === tab),
    [tickets, tab]
  );

  const counts = useMemo(
    () => ({
      review: tickets.filter((ticket) => statusTab(ticket.status) === "review").length,
      sent: tickets.filter((ticket) => statusTab(ticket.status) === "sent").length,
      escalated: tickets.filter((ticket) => statusTab(ticket.status) === "escalated").length,
    }),
    [tickets]
  );

  const metrics = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const reviewQueue = tickets.filter((t) => statusTab(t.status) === "review");
    const confSum = reviewQueue.reduce((s, t) => s + (t.confidence ?? 0), 0);
    const avgConf = reviewQueue.length > 0 ? confSum / reviewQueue.length : null;
    return {
      needsHuman: tickets.filter((t) => t.requiresHuman).length,
      autoSentToday: tickets.filter((t) => statusTab(t.status) === "sent" && (t.updatedAt ?? "").slice(0, 10) === todayStr).length,
      avgConfidence: avgConf,
    };
  }, [tickets]);

  const showSetupChecklist =
    !loading &&
    (!onboarding?.isForwardingActive ||
      !onboarding?.hasSignature ||
      (onboarding?.knowledgeDocCount ?? 0) === 0);

  const setupSteps = onboarding
    ? [
        {
          key: "forwarding",
          done: onboarding.isForwardingActive,
          optional: false,
          label: t.inbox.setupForwardingTitle,
          description: t.inbox.setupForwardingDesc,
          cta: t.inbox.setupForwardingCta,
          href: "/settings?tab=integrations",
        },
        {
          key: "signature",
          done: onboarding.hasSignature,
          optional: false,
          label: t.inbox.setupSignatureTitle,
          description: t.inbox.setupSignatureDesc,
          cta: t.inbox.setupSignatureCta,
          href: "/settings?tab=policy",
        },
        {
          key: "knowledge",
          done: onboarding.knowledgeDocCount > 0,
          optional: true,
          label: t.inbox.setupKnowledgeTitle,
          description: t.inbox.setupKnowledgeDesc,
          cta: t.inbox.setupKnowledgeCta,
          href: "/knowledge",
        },
      ]
    : [];

  const emptyState = {
    review: {
      title: t.inbox.noQueueItems,
      description: showSetupChecklist ? t.inbox.setupSubtitle : t.inbox.emptyDraft,
      cta: showSetupChecklist ? { href: "/settings?tab=integrations", label: t.inbox.setupForwardingCta } : null,
      icon: <IconInbox />,
    },
    sent: {
      title: t.inbox.queueSent,
      description: t.inbox.emptySent,
      cta: null,
      icon: <IconPaperPlane />,
    },
    escalated: {
      title: t.inbox.queueEscalated,
      description: t.inbox.emptyEscalated,
      cta: null,
      icon: <IconArrowTurn />,
    },
  }[tab];

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 24px 56px" }}>
      <style>{`
        .sf-inbox-segmented {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px;
          border-radius: 16px;
          border: 1px solid var(--sf-border);
          background: var(--sf-surface);
          box-shadow: 0 14px 34px rgba(15, 23, 42, 0.04);
        }
        .sf-inbox-segment {
          height: 40px;
          border: none;
          background: transparent;
          border-radius: 12px;
          padding: 0 14px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 700;
          color: var(--sf-text-muted);
          cursor: pointer;
          transition: all 120ms ease;
        }
        .sf-inbox-segment--active {
          background: var(--sf-surface-2);
          color: var(--sf-text);
          box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
        }
        .sf-inbox-row {
          display: block;
          text-decoration: none;
          border: 1px solid var(--sf-border);
          background: var(--sf-surface);
          border-radius: 18px;
          padding: 18px;
          box-shadow: 0 16px 36px rgba(15, 23, 42, 0.03);
          transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease, background 120ms ease;
          position: relative;
          overflow: hidden;
        }
        .sf-inbox-row::before {
          content: "";
          position: absolute;
          inset: 16px auto 16px 0;
          width: 3px;
          border-radius: 999px;
          background: transparent;
          transition: background 120ms ease;
        }
        .sf-inbox-row:hover {
          background: var(--sf-surface-2);
          border-color: rgba(199, 245, 111, 0.35);
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
          transform: translateY(-1px);
        }
        .sf-inbox-row:hover::before {
          background: #C7F56F;
        }
      `}</style>

      <header style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 28 }}>
        <div style={{ maxWidth: 720 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sf-text-muted)" }}>
            {t.inbox.title}
          </p>
          <h1 style={{ margin: "10px 0 0", fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--sf-text)" }}>
            {t.inbox.decisionTitle}
          </h1>
          <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.72, color: "var(--sf-text-muted)" }}>
            {t.inbox.decisionSubtitle}
          </p>
        </div>

        {onboarding?.inboundEmail && (
          <div
            style={{
              minWidth: 280,
              maxWidth: 360,
              border: "1px solid var(--sf-border)",
              borderRadius: 16,
              background: "var(--sf-surface)",
              boxShadow: "0 14px 34px rgba(15, 23, 42, 0.04)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--sf-border)" }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sf-text-muted)" }}>
                {t.inbox.setupForwardingAddressLabel}
              </p>
            </div>
            <div style={{ padding: 18, display: "flex", gap: 12, alignItems: "flex-start" }}>
              <p
                style={{
                  margin: 0,
                  flex: 1,
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: "var(--sf-text)",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  wordBreak: "break-word",
                }}
              >
                {onboarding.inboundEmail}
              </p>
              <button
                type="button"
                className="sf-btn sf-btn-secondary"
                style={{ height: 40, width: 40, padding: 0, flexShrink: 0 }}
                onClick={() => {
                  navigator.clipboard.writeText(onboarding.inboundEmail);
                  setCopiedForwarding(true);
                  setTimeout(() => setCopiedForwarding(false), 2000);
                }}
                aria-label={copiedForwarding ? t.dashboard.supportCopied : t.dashboard.supportCopy}
                title={copiedForwarding ? t.dashboard.supportCopied : t.dashboard.supportCopy}
              >
                {copiedForwarding ? <IconCheck /> : <IconCopy />}
              </button>
            </div>
          </div>
        )}
      </header>

      {showSetupChecklist && (
        <section
          style={{
            marginBottom: 28,
            border: "1px solid rgba(199,245,111,0.18)",
            borderRadius: 20,
            background: "linear-gradient(180deg, rgba(199,245,111,0.06), rgba(199,245,111,0.02))",
            padding: 22,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 18, flexWrap: "wrap", marginBottom: 18 }}>
            <div style={{ maxWidth: 720 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#7c9a2d" }}>
                {t.inbox.setupEyebrow}
              </p>
              <h2 style={{ margin: "8px 0 0", fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--sf-text)" }}>
                {t.inbox.setupTitle}
              </h2>
              <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.68, color: "var(--sf-text-muted)" }}>
                {t.inbox.setupSubtitle}
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {setupSteps.map((step) => (
              <div
                key={step.key}
                style={{
                  display: "flex",
                  alignItems: "stretch",
                  justifyContent: "space-between",
                  gap: 18,
                  flexWrap: "wrap",
                  border: "1px solid var(--sf-border)",
                  borderLeft: step.done
                    ? "1px solid var(--sf-border)"
                    : step.optional
                      ? "1px solid var(--sf-border)"
                      : "3px solid rgba(251,191,36,0.7)",
                  borderRadius: 16,
                  background: step.done ? "rgba(199,245,111,0.05)" : "var(--sf-surface)",
                  padding: "16px 18px",
                  opacity: step.done ? 0.75 : 1,
                }}
              >
                <div style={{ display: "flex", gap: 14, minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      flexShrink: 0,
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: step.done ? "rgba(199,245,111,0.28)" : "var(--sf-surface-2)",
                      color: step.done ? "#5a7d00" : "var(--sf-text-muted)",
                    }}
                  >
                    {step.done ? <IconCheck /> : <IconSetup />}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 14,
                          fontWeight: 700,
                          color: "var(--sf-text)",
                          textDecoration: step.done ? "line-through" : "none",
                        }}
                      >
                        {step.label}
                      </p>
                      <span
                        style={{
                          borderRadius: 6,
                          padding: "4px 8px",
                          fontSize: 11,
                          fontWeight: 700,
                          background: step.optional ? "rgba(96,165,250,0.12)" : "rgba(251,191,36,0.16)",
                          color: step.optional ? "#2563eb" : "#a16207",
                        }}
                      >
                        {step.optional ? t.inbox.setupOptional : t.inbox.setupRequired}
                      </span>
                    </div>
                    <p style={{ margin: "7px 0 0", fontSize: 13, lineHeight: 1.65, color: "var(--sf-text-muted)" }}>
                      {step.description}
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {step.done ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        height: 40,
                        padding: "0 14px",
                        borderRadius: 12,
                        border: "1px solid rgba(199,245,111,0.22)",
                        background: "rgba(199,245,111,0.12)",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#5a7d00",
                      }}
                    >
                      <IconCheck />
                      {t.common.saved}
                    </span>
                  ) : (
                    <Link
                      href={step.href}
                      className="sf-btn sf-btn-secondary"
                      style={{
                        textDecoration: "none",
                        height: 40,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        padding: "0 14px",
                      }}
                    >
                      {step.cta}
                      <IconArrowRight />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <div className="sf-inbox-segmented" role="tablist" aria-label={t.inbox.title}>
          {[
            { id: "review" as const, label: t.inbox.queueReview },
            { id: "sent" as const, label: t.inbox.queueSent },
            { id: "escalated" as const, label: t.inbox.queueEscalated },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`sf-inbox-segment${tab === item.id ? " sf-inbox-segment--active" : ""}`}
            >
              <span>{item.label}</span>
              <span
                style={{
                  minWidth: 22,
                  borderRadius: 6,
                  padding: "2px 6px",
                  background: tab === item.id ? "rgba(199,245,111,0.34)" : "var(--sf-surface-2)",
                  color: tab === item.id ? "#4c6c00" : "var(--sf-text-muted)",
                  fontSize: 11,
                  fontWeight: 700,
                  textAlign: "center",
                }}
              >
                {counts[item.id]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 18,
            borderRadius: 16,
            border: "1px solid rgba(248,113,113,0.28)",
            background: "rgba(248,113,113,0.08)",
            padding: "14px 16px",
            fontSize: 13,
            lineHeight: 1.65,
            color: "#b42318",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "grid", gap: 14 }}>
        {loading &&
          Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              style={{
                border: "1px solid var(--sf-border)",
                borderRadius: 18,
                background: "var(--sf-surface)",
                padding: 18,
                boxShadow: "0 16px 36px rgba(15, 23, 42, 0.03)",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: 4,
                  borderRadius: 999,
                  background: "linear-gradient(90deg, var(--sf-surface) 25%, var(--sf-surface-2) 50%, var(--sf-surface) 75%)",
                  backgroundSize: "400% 100%",
                  animation: "shimmer 1.5s ease-in-out infinite",
                  marginBottom: 16,
                }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div
                    style={{
                      width: "55%",
                      height: 18,
                      borderRadius: 10,
                      background: "linear-gradient(90deg, var(--sf-surface) 25%, var(--sf-surface-2) 50%, var(--sf-surface) 75%)",
                      backgroundSize: "400% 100%",
                      animation: "shimmer 1.5s ease-in-out infinite",
                      marginBottom: 10,
                    }}
                  />
                  <div
                    style={{
                      width: "32%",
                      height: 12,
                      borderRadius: 10,
                      background: "linear-gradient(90deg, var(--sf-surface) 25%, var(--sf-surface-2) 50%, var(--sf-surface) 75%)",
                      backgroundSize: "400% 100%",
                      animation: "shimmer 1.5s ease-in-out infinite",
                    }}
                  />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[110, 82].map((width) => (
                    <div
                      key={width}
                      style={{
                        width,
                        height: 28,
                        borderRadius: 8,
                        background: "linear-gradient(90deg, var(--sf-surface) 25%, var(--sf-surface-2) 50%, var(--sf-surface) 75%)",
                        backgroundSize: "400% 100%",
                        animation: "shimmer 1.5s ease-in-out infinite",
                      }}
                    />
                  ))}
                </div>
              </div>
              <div
                style={{
                  width: "100%",
                  height: 14,
                  borderRadius: 10,
                  background: "linear-gradient(90deg, var(--sf-surface) 25%, var(--sf-surface-2) 50%, var(--sf-surface) 75%)",
                  backgroundSize: "400% 100%",
                  animation: "shimmer 1.5s ease-in-out infinite",
                  marginBottom: 8,
                }}
              />
              <div
                style={{
                  width: "68%",
                  height: 12,
                  borderRadius: 10,
                  background: "linear-gradient(90deg, var(--sf-surface) 25%, var(--sf-surface-2) 50%, var(--sf-surface) 75%)",
                  backgroundSize: "400% 100%",
                  animation: "shimmer 1.5s ease-in-out infinite",
                }}
              />
            </div>
          ))}

        {!loading && visibleTickets.length === 0 && (
          <div
            style={{
              border: "1px solid var(--sf-border)",
              borderRadius: 20,
              background: "var(--sf-surface)",
              padding: "36px 28px",
              display: "grid",
              placeItems: "center",
              textAlign: "center",
              gap: 14,
              boxShadow: "0 16px 36px rgba(15, 23, 42, 0.03)",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 18,
                background: "var(--sf-surface-2)",
                color: "var(--sf-text-muted)",
                display: "grid",
                placeItems: "center",
              }}
            >
              {emptyState.icon}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--sf-text)" }}>
                {emptyState.title}
              </p>
              <p style={{ margin: "8px 0 0", maxWidth: 520, fontSize: 14, lineHeight: 1.72, color: "var(--sf-text-muted)" }}>
                {emptyState.description}
              </p>
            </div>
            {emptyState.cta && (
              <Link
                href={emptyState.cta.href}
                className="sf-btn sf-btn-secondary"
                style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                {emptyState.cta.label}
                <IconArrowRight />
              </Link>
            )}
          </div>
        )}

        {!loading &&
          visibleTickets.map((ticket) => {
            const meta = confidenceMeta(ticket.confidence);
            const primaryPreview =
              language === "en" ? ticket.previewEnglish ?? ticket.preview : ticket.preview ?? ticket.previewEnglish;
            const secondaryPreview =
              language === "en" ? ticket.preview : ticket.previewEnglish;
            const primarySubject =
              language === "en" ? ticket.subjectEnglish ?? ticket.subject : ticket.subject;
            const secondarySubject =
              language === "en" ? ticket.subject : ticket.subjectEnglish;

            return (
              <Link key={`${ticket.source}:${ticket.id}`} href={`/inbox/${ticket.id}`} className="sf-inbox-row">
                <div
                  style={{
                    width: "100%",
                    height: 4,
                    borderRadius: 999,
                    background: "rgba(148,163,184,0.14)",
                    overflow: "hidden",
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      width: `${ticket.confidence != null ? Math.max(10, Math.round(ticket.confidence * 100)) : 18}%`,
                      height: "100%",
                      borderRadius: 999,
                      background: meta.fill,
                    }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 220px", gap: 18, alignItems: "start" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--sf-text)" }}>
                        {ticket.customerName ?? ticket.customerEmail}
                      </p>
                      <span style={{ width: 4, height: 4, borderRadius: 999, background: "var(--sf-border-strong)" }} />
                      <p style={{ margin: 0, fontSize: 12, color: "var(--sf-text-muted)" }}>
                        {ticket.customerEmail}
                      </p>
                      <span style={{ width: 4, height: 4, borderRadius: 999, background: "var(--sf-border-strong)" }} />
                      <p style={{ margin: 0, fontSize: 12, color: "var(--sf-text-muted)" }}>
                        {formatRelativeTime(ticket.updatedAt, language)}
                      </p>
                    </div>

                    <p style={{ margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--sf-text)", lineHeight: 1.4 }}>
                      {primarySubject}
                    </p>
                    {secondarySubject && secondarySubject !== primarySubject && (
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--sf-text-muted)", lineHeight: 1.55 }}>
                        {secondarySubject}
                      </p>
                    )}

                    <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.7, color: "var(--sf-text-secondary)" }}>
                      {primaryPreview?.slice(0, 220) || t.inbox.noPreview}
                    </p>
                    {secondaryPreview && secondaryPreview !== primaryPreview && (
                      <p style={{ margin: "6px 0 0", fontSize: 12, lineHeight: 1.6, color: "var(--sf-text-muted)" }}>
                        {secondaryPreview.slice(0, 160)}
                      </p>
                    )}
                  </div>

                  <div style={{ minWidth: 0, display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {ticket.intent && (() => {
                        const im = intentMeta(ticket.intent);
                        return (
                          <span
                            style={{
                              borderRadius: 6,
                              padding: "4px 8px",
                              fontSize: 11,
                              fontWeight: 700,
                              background: im.bg,
                              color: im.color,
                              textTransform: "lowercase",
                            }}
                          >
                            {ticket.intent.replace(/_/g, " ")}
                          </span>
                        );
                      })()}
                      {ticket.decision && (
                        <span
                          style={{
                            borderRadius: 6,
                            padding: "4px 8px",
                            fontSize: 11,
                            fontWeight: 700,
                            background: "rgba(96,165,250,0.12)",
                            color: "#2563eb",
                          }}
                        >
                          {ticket.decision.replace(/_/g, " ")}
                        </span>
                      )}
                      {ticket.requiresHuman && (
                        <span
                          style={{
                            borderRadius: 6,
                            padding: "4px 8px",
                            fontSize: 11,
                            fontWeight: 700,
                            background: "rgba(251,191,36,0.14)",
                            color: "#a16207",
                          }}
                        >
                          {t.inbox.needsHuman}
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--sf-text-muted)" }}>
                        <span style={{ width: 8, height: 8, borderRadius: 999, background: statusDot(ticket.status), boxShadow: `0 0 0 4px ${ticket.status === "review" ? "rgba(199,245,111,0.14)" : ticket.status === "sent" ? "rgba(96,165,250,0.12)" : "rgba(248,113,113,0.12)"}` }} />
                        {ticket.source === "conversation" ? t.inbox.sourceAiFirst : t.inbox.sourceLegacy}
                      </span>

                      <span
                        style={{
                          borderRadius: 6,
                          padding: "5px 8px",
                          fontSize: 11,
                          fontWeight: 700,
                          background: meta.badgeBg,
                          color: meta.badgeColor,
                        }}
                      >
                        {ticket.confidence != null
                          ? `${Math.round(ticket.confidence * 100)}% ${t.inbox.confidenceSuffix}`
                          : ticket.status}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
      </div>
        </div>

        <aside style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12, position: "sticky", top: 24 }}>
          <div
            style={{
              border: "1px solid var(--sf-border)",
              borderRadius: 18,
              background: "var(--sf-surface)",
              padding: 18,
              boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
            }}
          >
            <p style={{ margin: "0 0 14px", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--sf-text-muted)" }}>
              Queue
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {([
                { label: "Review", count: counts.review, bg: "rgba(199,245,111,0.18)", color: "#4c6c00" },
                { label: "Sent", count: counts.sent, bg: "rgba(96,165,250,0.14)", color: "#1d4ed8" },
                { label: "Escalated", count: counts.escalated, bg: "rgba(248,113,113,0.12)", color: "#b42318" },
              ] as const).map((item) => (
                <div key={item.label} style={{ borderRadius: 10, background: item.bg, padding: "10px 8px", textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: item.color }}>{item.count}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 10, fontWeight: 600, color: item.color, opacity: 0.8 }}>{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              border: "1px solid var(--sf-border)",
              borderRadius: 18,
              background: "var(--sf-surface)",
              padding: 18,
              boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
            }}
          >
            <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--sf-text-muted)" }}>
              Avg. Confidence
            </p>
            {metrics.avgConfidence != null ? (
              <>
                <p style={{ margin: "0 0 8px", fontSize: 26, fontWeight: 800, color: "var(--sf-text)" }}>
                  {Math.round(metrics.avgConfidence * 100)}%
                </p>
                <div style={{ height: 6, borderRadius: 999, background: "var(--sf-surface-2)", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 999,
                      width: `${Math.round(metrics.avgConfidence * 100)}%`,
                      background: metrics.avgConfidence >= 0.85 ? "#C7F56F" : metrics.avgConfidence >= 0.65 ? "#fbbf24" : "#f87171",
                    }}
                  />
                </div>
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: "var(--sf-text-muted)" }}>No data</p>
            )}
          </div>

          <div
            style={{
              border: metrics.needsHuman > 0 ? "1px solid rgba(251,191,36,0.32)" : "1px solid var(--sf-border)",
              borderRadius: 18,
              background: metrics.needsHuman > 0 ? "rgba(251,191,36,0.06)" : "var(--sf-surface)",
              padding: 18,
              boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
            }}
          >
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: metrics.needsHuman > 0 ? "#a16207" : "var(--sf-text-muted)" }}>
              Needs Human
            </p>
            <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: metrics.needsHuman > 0 ? "#a16207" : "var(--sf-text)" }}>
              {metrics.needsHuman}
            </p>
          </div>

          <div
            style={{
              border: "1px solid var(--sf-border)",
              borderRadius: 18,
              background: "var(--sf-surface)",
              padding: 18,
              boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
            }}
          >
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--sf-text-muted)" }}>
              Auto-sent Today
            </p>
            <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "var(--sf-text)" }}>
              {metrics.autoSentToday}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
