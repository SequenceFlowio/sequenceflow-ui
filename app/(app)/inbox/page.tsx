"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { useTranslation } from "@/lib/i18n/LanguageProvider";
import type { TicketListItem } from "@/types/aiInbox";

type Tab = "review" | "sent" | "escalated";
type OnboardingState = {
  inboundEmail: string;
  isForwardingActive: boolean;
  hasSignature: boolean;
  knowledgeDocCount: number;
};

function confidenceTone(confidence: number | null) {
  if (confidence == null) return { bg: "rgba(107,114,128,0.12)", color: "#9ca3af" };
  if (confidence >= 0.85) return { bg: "rgba(199,245,111,0.22)", color: "#5c8200" };
  if (confidence >= 0.65) return { bg: "rgba(251,191,36,0.16)", color: "#fbbf24" };
  return { bg: "rgba(239,68,68,0.14)", color: "#f87171" };
}

function statusTab(status: string): Tab {
  if (status === "sent") return "sent";
  if (status === "escalated") return "escalated";
  return "review";
}

export default function InboxPage() {
  const { t, language } = useTranslation();
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("review");
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);

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

  const primaryLanguageIsEnglish = language === "en";
  const showSetupChecklist =
    !loading &&
    (
      !onboarding?.isForwardingActive ||
      !onboarding?.hasSignature ||
      (onboarding?.knowledgeDocCount ?? 0) === 0
    );

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

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-10 sm:px-6 lg:px-10 lg:py-12">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text)", margin: 0 }}>
            {t.inbox.decisionTitle}
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--muted)", maxWidth: 620, lineHeight: 1.6 }}>
            {t.inbox.decisionSubtitle}
          </p>
        </div>
        <div style={{
          border: "1px solid var(--border)",
          background: "var(--surface)",
          borderRadius: 999,
          padding: "8px 12px",
          fontSize: 12,
          fontWeight: 600,
          color: "var(--muted)",
        }}>
          {primaryLanguageIsEnglish ? t.inbox.readingModeEnglish : t.inbox.readingModeOriginal}
        </div>
      </div>

      {showSetupChecklist && (
        <section
          style={{
            marginBottom: 24,
            border: "1px solid rgba(199,245,111,0.16)",
            background: "linear-gradient(180deg, rgba(199,245,111,0.06), rgba(199,245,111,0.02))",
            borderRadius: 20,
            padding: "22px 22px 20px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8aa93a" }}>
                {t.inbox.setupEyebrow}
              </p>
              <h2 style={{ margin: "6px 0 0", fontSize: 20, fontWeight: 700, color: "var(--text)" }}>
                {t.inbox.setupTitle}
              </h2>
              <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--muted)", maxWidth: 680, lineHeight: 1.65 }}>
                {t.inbox.setupSubtitle}
              </p>
            </div>
            {onboarding?.inboundEmail && (
              <div style={{
                minWidth: 260,
                maxWidth: 360,
                border: "1px solid var(--border)",
                background: "rgba(0,0,0,0.08)",
                borderRadius: 14,
                padding: "12px 14px",
              }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>
                  {t.inbox.setupForwardingAddressLabel}
                </p>
                <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.55, color: "var(--text)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", wordBreak: "break-word" }}>
                  {onboarding.inboundEmail}
                </p>
              </div>
            )}
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {setupSteps.map((step, index) => (
              <div
                key={step.key}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                  border: "1px solid var(--border)",
                  background: step.done ? "rgba(199,245,111,0.06)" : "var(--surface)",
                  borderRadius: 16,
                  padding: "14px 16px",
                }}
              >
                <div style={{ display: "flex", gap: 12, minWidth: 0, flex: 1 }}>
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: 999,
                    flexShrink: 0,
                    background: step.done ? "#C7F56F" : "rgba(107,114,128,0.16)",
                    color: step.done ? "#111" : "var(--muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 800,
                    marginTop: 2,
                  }}>
                    {step.done ? "✓" : index + 1}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <p style={{
                        margin: 0,
                        fontSize: 14,
                        fontWeight: 700,
                        color: "var(--text)",
                        textDecoration: step.done ? "line-through" : "none",
                        opacity: step.done ? 0.72 : 1,
                      }}>
                        {step.label}
                      </p>
                      <span style={{
                        borderRadius: 999,
                        padding: "3px 8px",
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        background: step.optional ? "rgba(59,130,246,0.10)" : "rgba(251,191,36,0.14)",
                        color: step.optional ? "#60a5fa" : "#fbbf24",
                      }}>
                        {step.optional ? t.inbox.setupOptional : t.inbox.setupRequired}
                      </span>
                    </div>
                    <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
                      {step.description}
                    </p>
                  </div>
                </div>

                {!step.done && (
                  <Link
                    href={step.href}
                    style={{
                      textDecoration: "none",
                      border: "1px solid var(--border)",
                      background: "var(--bg)",
                      color: "var(--text)",
                      borderRadius: 999,
                      padding: "9px 12px",
                      fontSize: 12,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {step.cta}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { id: "review" as const, label: t.inbox.queueReview },
          { id: "sent" as const, label: t.inbox.queueSent },
          { id: "escalated" as const, label: t.inbox.queueEscalated },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            style={{
              border: tab === item.id ? "1px solid rgba(199,245,111,0.45)" : "1px solid var(--border)",
              background: tab === item.id ? "rgba(199,245,111,0.10)" : "var(--surface)",
              color: tab === item.id ? "var(--text)" : "var(--muted)",
              borderRadius: 999,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {item.label}
            <span style={{
              minWidth: 20,
              borderRadius: 999,
              background: tab === item.id ? "#C7F56F" : "rgba(107,114,128,0.12)",
              color: tab === item.id ? "#000" : "var(--muted)",
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 6px",
              textAlign: "center",
            }}>
              {counts[item.id]}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <div style={{
          marginBottom: 18,
          padding: "12px 14px",
          borderRadius: 12,
          border: "1px solid rgba(239,68,68,0.28)",
          background: "rgba(239,68,68,0.08)",
          color: "#f87171",
          fontSize: 13,
          fontWeight: 500,
        }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gap: 14 }}>
        {loading && Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            style={{
              border: "1px solid var(--border)",
              background: "var(--surface)",
              borderRadius: 18,
              minHeight: 132,
              opacity: 0.55,
            }}
          />
        ))}

        {!loading && visibleTickets.length === 0 && (
          <div style={{
            border: "1px solid var(--border)",
            background: "var(--surface)",
            borderRadius: 18,
            padding: "28px 24px",
          }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
              {t.inbox.noQueueItems}
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--muted)", lineHeight: 1.6 }}>
              {t.inbox.noQueueItemsDesc}
            </p>
          </div>
        )}

        {!loading && visibleTickets.map((ticket) => {
          const tone = confidenceTone(ticket.confidence);
          const primaryPreview = primaryLanguageIsEnglish ? ticket.previewEnglish ?? ticket.preview : ticket.preview ?? ticket.previewEnglish;
          const secondaryPreview = primaryLanguageIsEnglish ? ticket.preview : ticket.previewEnglish;
          const primarySubject = primaryLanguageIsEnglish ? ticket.subjectEnglish ?? ticket.subject : ticket.subject;
          const secondarySubject = primaryLanguageIsEnglish ? ticket.subject : ticket.subjectEnglish;

          return (
            <Link
              key={`${ticket.source}:${ticket.id}`}
              href={`/inbox/${ticket.id}`}
              style={{
                display: "block",
                textDecoration: "none",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                borderRadius: 18,
                padding: "18px 18px 16px",
                transition: "transform 0.12s ease, border-color 0.12s ease",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                      {ticket.customerName ?? ticket.customerEmail}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>
                      {ticket.source === "conversation" ? t.inbox.sourceAiFirst : t.inbox.sourceLegacy}
                    </span>
                    {ticket.decision && (
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 999,
                        padding: "3px 8px",
                        background: "rgba(59,130,246,0.12)",
                        color: "#60a5fa",
                      }}>
                        {ticket.decision.replace(/_/g, " ")}
                      </span>
                    )}
                    {ticket.requiresHuman && (
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 999,
                        padding: "3px 8px",
                        background: "rgba(251,191,36,0.16)",
                        color: "#fbbf24",
                      }}>
                        {t.inbox.needsHuman}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text)", lineHeight: 1.35 }}>
                    {primarySubject}
                  </p>
                  {secondarySubject && secondarySubject !== primarySubject && (
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)", lineHeight: 1.45 }}>
                      {secondarySubject}
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                  {ticket.intent && (
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 999,
                      padding: "4px 8px",
                      background: "rgba(107,114,128,0.12)",
                      color: "var(--muted)",
                    }}>
                      {ticket.intent}
                    </span>
                  )}
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 999,
                    padding: "4px 8px",
                    background: tone.bg,
                    color: tone.color,
                  }}>
                    {ticket.confidence != null ? `${Math.round(ticket.confidence * 100)}% ${t.inbox.confidenceSuffix}` : ticket.status}
                  </span>
                </div>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <p style={{ margin: 0, fontSize: 13, color: "var(--text)", lineHeight: 1.6 }}>
                  {primaryPreview?.slice(0, 220) || t.inbox.noPreview}
                </p>
                {secondaryPreview && secondaryPreview !== primaryPreview && (
                  <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.55 }}>
                    {secondaryPreview.slice(0, 220)}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
