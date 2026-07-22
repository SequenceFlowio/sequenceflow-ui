"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bot,
  Check,
  ChevronRight,
  CircleAlert,
  MailCheck,
  Plug,
  Send,
} from "lucide-react";

import { useTranslation } from "@/lib/i18n/LanguageProvider";
import type { TicketListItem } from "@/types/aiInbox";
import { computeNextAutoSend, formatAutoSendWhen, formatAutoSendCountdown } from "@/lib/autosend/nextSendTime";

type Tab = "review" | "sent" | "escalated" | "archived";

type OnboardingState = {
  inboundEmail: string;
  isForwardingActive: boolean;
  isImapActive: boolean;
  hasSignature: boolean;
  knowledgeDocCount: number;
  smtpStatus: "not_configured" | "test_required" | "active" | "failed";
  imapStatus: "not_configured" | "test_required" | "active" | "failed";
  lastSyncedAt: string | null;
  commerce: Array<{
    provider: string;
    status: string;
    lastSyncedAt: string | null;
  }>;
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

function IconArchive() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }} aria-hidden>
      <path d="M3 5h18v4H3z" />
      <path d="M5 9v10h14V9" />
      <path d="M9 13h6" />
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

function formatCountdown(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function statusTab(status: string): Tab | null {
  if (status === "sent") return "sent";
  if (status === "escalated") return "escalated";
  if (status === "archived") return "archived";
  if (["open", "review", "draft", "approved", "pending_autosend"].includes(status)) return "review";
  return null;
}

function statusDot(status: string) {
  if (status === "sent") return "#60a5fa";
  if (status === "escalated") return "#f87171";
  if (status === "archived") return "#94a3b8";
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

function formatSnippet(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function formatDecisionLabel(decision: string | null, language: "en" | "nl") {
  switch (decision) {
    case "inform_customer":
      return language === "nl" ? "Informeren" : "Inform";
    case "ask_question":
      return language === "nl" ? "Vervolgvraag" : "Follow-up";
    case "escalate":
      return language === "nl" ? "Escaleren" : "Escalate";
    case "ignore":
      return language === "nl" ? "Negeren" : "Ignore";
    default:
      return decision ? decision.replace(/_/g, " ") : null;
  }
}

export default function InboxPage() {
  const { t, language } = useTranslation();
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("review");
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [statusCheckedAt, setStatusCheckedAt] = useState<string | null>(null);
  const [autosendTimes, setAutosendTimes] = useState<{ time1: string | null; time2: string | null; enabled: boolean }>({ time1: null, time2: null, enabled: false });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkArchiveState, setBulkArchiveState] = useState<"idle" | "updating">("idle");
  const [countdownSecs, setCountdownSecs] = useState<number | null>(null);
  // Ticks every 30s so per-ticket "sends in 3h 24m" badges stay fresh without
  // re-rendering on every 1s countdown tick.
  const [badgeNow, setBadgeNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setBadgeNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);
  const nextAutoSend = useMemo(
    () => computeNextAutoSend(autosendTimes, new Date(badgeNow)),
    [autosendTimes, badgeNow],
  );

  useEffect(() => {
    let cancelled = false;

    // `silent` skips the loading spinner + error banner so the background
    // auto-refresh doesn't flash the UI. `cache: "no-store"` on every fetch
    // guarantees we always pull the live tenant data — without it a browser
    // or CDN cache could pin the list to a stale snapshot (this is exactly
    // what made new mail appear "missing" until a hard refresh).
    async function load(silent = false) {
      if (!silent) setError(null);
      try {
        const [ticketsRes, onboardingRes, autosendRes] = await Promise.all([
          fetch("/api/tickets", { cache: "no-store" }),
          fetch("/api/integrations/email/setup", { cache: "no-store" }),
          fetch("/api/autosend-config", { cache: "no-store" }),
        ]);

        const ticketsData = await ticketsRes.json();
        if (!ticketsRes.ok) throw new Error(ticketsData.error ?? "Failed to load tickets.");
        if (cancelled) return;
        setTickets(ticketsData.tickets ?? []);

        if (onboardingRes.ok) {
          const onboardingData = await onboardingRes.json();
          if (cancelled) return;
          setOnboarding({
            inboundEmail: onboardingData.inboundEmail ?? "",
            isForwardingActive: Boolean(onboardingData.isForwardingActive),
            isImapActive: Boolean(onboardingData.isImapActive),
            hasSignature: Boolean(onboardingData.hasSignature),
            knowledgeDocCount: Number(onboardingData.knowledgeDocCount ?? 0),
            smtpStatus: (onboardingData.smtp?.status ?? "not_configured") as OnboardingState["smtpStatus"],
            imapStatus: (onboardingData.imap?.status ?? "not_configured") as OnboardingState["imapStatus"],
            lastSyncedAt: onboardingData.imap?.lastSyncedAt ?? null,
            commerce: Array.isArray(onboardingData.commerce) ? onboardingData.commerce : [],
          });
          setStatusCheckedAt(new Date().toISOString());
        }

        if (autosendRes.ok) {
          const asCfg = await autosendRes.json();
          if (cancelled) return;
          setAutosendTimes({
            time1: asCfg.autosendTime1 ?? null,
            time2: asCfg.autosendTime2 ?? null,
            enabled: Boolean(asCfg.autosendEnabled),
          });
        }
      } catch (err: unknown) {
        if (!silent && !cancelled) setError(err instanceof Error ? err.message : "Failed to load tickets.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    // Auto-refresh the inbox every 45s so newly-synced customer mail shows up
    // without the user having to reload the page. Also refresh whenever the
    // tab regains focus (covers the "left it open overnight" case).
    const iv = setInterval(() => load(true), 45_000);
    const onFocus = () => load(true);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      clearInterval(iv);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    function compute(): number | null {
      if (!autosendTimes.enabled) return null;
      const now = new Date();
      const nowSecs = now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();
      for (const t of [autosendTimes.time1, autosendTimes.time2]) {
        if (!t) continue;
        const [h, m] = t.split(":").map(Number);
        if (isNaN(h) || isNaN(m)) continue;
        const configSecs = h * 3600 + m * 60;
        const sendSecs = configSecs + 10 * 60;
        const secsLeft = sendSecs - nowSecs;
        if (secsLeft > 0 && secsLeft <= 10 * 60) return secsLeft;
      }
      return null;
    }
    setCountdownSecs(compute());
    const iv = setInterval(() => setCountdownSecs(compute()), 1000);
    return () => clearInterval(iv);
  }, [autosendTimes]);

  const visibleTickets = useMemo(
    () => tickets.filter((ticket) => statusTab(ticket.status) === tab),
    [tickets, tab]
  );
  const visibleTicketIds = useMemo(() => visibleTickets.map((ticket) => ticket.id), [visibleTickets]);
  const selectedVisibleIds = useMemo(
    () => selectedIds.filter((id) => visibleTicketIds.includes(id)),
    [selectedIds, visibleTicketIds],
  );
  const selectionMode = selectedVisibleIds.length > 0;
  const allVisibleSelected = visibleTicketIds.length > 0 && selectedVisibleIds.length === visibleTicketIds.length;

  useEffect(() => {
    setSelectedIds([]);
  }, [tab]);

  function toggleTicketSelection(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleAllVisible() {
    setSelectedIds(allVisibleSelected ? [] : visibleTicketIds);
  }

  async function handleBulkArchive() {
    const idsToUpdate = selectedVisibleIds;
    const shouldArchive = tab !== "archived";
    if (idsToUpdate.length === 0 || bulkArchiveState === "updating") return;

    setBulkArchiveState("updating");
    setError(null);
    try {
      const res = await fetch("/api/tickets/bulk-archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: idsToUpdate, archived: shouldArchive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? t.inbox.bulkArchiveError);
      const refreshed = await fetch("/api/tickets", { cache: "no-store" });
      const refreshedData = await refreshed.json().catch(() => ({}));
      if (!refreshed.ok) throw new Error(refreshedData.error ?? t.inbox.bulkArchiveError);
      setTickets(refreshedData.tickets ?? []);
      setSelectedIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.inbox.bulkArchiveError);
    } finally {
      setBulkArchiveState("idle");
    }
  }

  const counts = useMemo(
    () => ({
      review: tickets.filter((ticket) => statusTab(ticket.status) === "review").length,
      sent: tickets.filter((ticket) => statusTab(ticket.status) === "sent").length,
      escalated: tickets.filter((ticket) => statusTab(ticket.status) === "escalated").length,
      archived: tickets.filter((ticket) => statusTab(ticket.status) === "archived").length,
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
      pendingAutosend: tickets.filter((t) => t.status === "pending_autosend").length,
    };
  }, [tickets]);

  // Inbound is considered set up if either the IMAP poller is live OR mail is
  // arriving via the Resend forwarding webhook. Knowledge docs are optional —
  // they don't block the checklist from auto-clearing.
  const inboundActive = Boolean(
    onboarding && (onboarding.isImapActive || onboarding.isForwardingActive)
  );
  const setupSteps = onboarding
    ? [
        {
          key: "forwarding",
          done: inboundActive,
          optional: false,
          label: t.inbox.setupForwardingTitle,
          description: t.inbox.setupForwardingDesc,
          cta: t.inbox.setupForwardingCta,
          href: "/integrations",
        },
        {
          key: "smtp",
          done: onboarding.smtpStatus === "active",
          optional: false,
          label: t.inbox.setupSmtpTitle,
          description: t.inbox.setupSmtpDesc,
          cta: t.inbox.setupSmtpCta,
          href: "/integrations",
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

  const incompleteSetupSteps = setupSteps.filter((step) => !step.optional && !step.done);
  const showSetupChecklist = !loading && onboarding != null && incompleteSetupSteps.length > 0;
  const commerceAttentionCount = onboarding?.commerce.filter((connection) =>
    ["failed", "test_required"].includes(connection.status)
  ).length ?? 0;
  const activeCommerceCount = onboarding?.commerce.filter((connection) => connection.status === "active").length ?? 0;
  const pausedCommerceCount = onboarding?.commerce.filter((connection) => connection.status === "paused").length ?? 0;
  const allRequiredOperational = Boolean(onboarding) && incompleteSetupSteps.length === 0 && commerceAttentionCount === 0;

  const statusCopy = language === "nl"
    ? {
        healthy: "Alles operationeel",
        attention: "Aandacht nodig",
        checking: "Status controleren",
        healthyDetail: "Je inbox kan klantmail ontvangen en antwoorden versturen.",
        attentionDetail: `${incompleteSetupSteps.length + commerceAttentionCount} ${incompleteSetupSteps.length + commerceAttentionCount === 1 ? "onderdeel vraagt" : "onderdelen vragen"} aandacht.`,
        checkingDetail: "We halen de actuele verbindingsstatus op.",
        lastChecked: "Gecontroleerd",
        manage: "Integraties beheren",
        incoming: "Inkomend",
        outgoing: "Uitgaand",
        assistant: "AI-context",
        commerce: "Webshop",
        onlineImap: "Online via IMAP",
        onlineForwarding: "Online via doorsturen",
        connectionNeeded: "Verbinding nodig",
        sendingReady: "Verzenden actief",
        testNeeded: "Test nodig",
        configured: "Klaar voor antwoorden",
        signatureMissing: "Handtekening ontbreekt",
        sources: "kennisbronnen",
        connected: "gekoppeld",
        paused: "gepauzeerd",
        notConnected: "Niet gekoppeld",
        finishSetup: "Rond je inbox af",
        finishDetail: "Alleen deze verplichte stappen staan nog open.",
      }
    : {
        healthy: "Everything operational",
        attention: "Attention needed",
        checking: "Checking status",
        healthyDetail: "Your inbox can receive customer mail and send replies.",
        attentionDetail: `${incompleteSetupSteps.length + commerceAttentionCount} ${incompleteSetupSteps.length + commerceAttentionCount === 1 ? "item needs" : "items need"} attention.`,
        checkingDetail: "We are retrieving the current connection status.",
        lastChecked: "Checked",
        manage: "Manage integrations",
        incoming: "Incoming",
        outgoing: "Outgoing",
        assistant: "AI context",
        commerce: "Store",
        onlineImap: "Online via IMAP",
        onlineForwarding: "Online via forwarding",
        connectionNeeded: "Connection needed",
        sendingReady: "Sending active",
        testNeeded: "Test required",
        configured: "Ready for replies",
        signatureMissing: "Signature missing",
        sources: "knowledge sources",
        connected: "connected",
        paused: "paused",
        notConnected: "Not connected",
        finishSetup: "Finish your inbox",
        finishDetail: "Only these required steps are still open.",
      };

  const systemStatusItems = [
    {
      key: "incoming",
      label: statusCopy.incoming,
      value: !onboarding
        ? statusCopy.checking
        : onboarding.isImapActive
          ? statusCopy.onlineImap
          : onboarding.isForwardingActive
            ? statusCopy.onlineForwarding
            : statusCopy.connectionNeeded,
      detail: onboarding?.lastSyncedAt ? formatRelativeTime(onboarding.lastSyncedAt, language) : null,
      tone: !onboarding ? "neutral" : inboundActive ? "success" : "warning",
      icon: MailCheck,
      href: "/integrations",
    },
    {
      key: "outgoing",
      label: statusCopy.outgoing,
      value: !onboarding
        ? statusCopy.checking
        : onboarding.smtpStatus === "active"
          ? statusCopy.sendingReady
          : statusCopy.testNeeded,
      detail: null,
      tone: !onboarding ? "neutral" : onboarding.smtpStatus === "active" ? "success" : "warning",
      icon: Send,
      href: "/integrations",
    },
    {
      key: "assistant",
      label: statusCopy.assistant,
      value: !onboarding
        ? statusCopy.checking
        : onboarding.hasSignature
          ? statusCopy.configured
          : statusCopy.signatureMissing,
      detail: onboarding ? `${onboarding.knowledgeDocCount} ${statusCopy.sources}` : null,
      tone: !onboarding ? "neutral" : onboarding.hasSignature ? "success" : "warning",
      icon: Bot,
      href: "/settings?tab=policy",
    },
    {
      key: "commerce",
      label: statusCopy.commerce,
      value: !onboarding
        ? statusCopy.checking
        : commerceAttentionCount > 0
          ? statusCopy.attention
          : activeCommerceCount > 0
            ? `${activeCommerceCount} ${statusCopy.connected}`
            : pausedCommerceCount > 0
              ? `${pausedCommerceCount} ${statusCopy.paused}`
              : statusCopy.notConnected,
      detail: null,
      tone: commerceAttentionCount > 0 ? "warning" : activeCommerceCount > 0 ? "success" : "neutral",
      icon: Plug,
      href: "/integrations",
    },
  ] as const;

  const emptyState = {
    review: {
      title: t.inbox.noQueueItems,
      description: showSetupChecklist ? t.inbox.setupSubtitle : t.inbox.emptyDraft,
      cta: showSetupChecklist ? { href: "/integrations", label: t.inbox.setupForwardingCta } : null,
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
    archived: {
      title: t.inbox.queueArchived,
      description: t.inbox.emptyArchived,
      cta: null,
      icon: <IconArchive />,
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
          max-width: 100%;
          overflow-x: auto;
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
          flex: 0 0 auto;
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
        .sf-inbox-row--selecting {
          cursor: pointer;
        }
        .sf-inbox-row--selected {
          border-color: rgba(155, 220, 34, 0.62);
          background: rgba(199, 245, 111, 0.10);
          box-shadow: 0 16px 36px rgba(90, 125, 0, 0.08);
        }
        .sf-inbox-row--selected::before {
          background: #9bdc22;
        }
        .sf-inbox-health {
          margin-bottom: 20px;
          overflow: hidden;
          border: 1px solid var(--sf-border);
          border-radius: 8px;
          background: var(--sf-surface);
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.04);
        }
        .sf-inbox-health-head {
          min-height: 68px;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .sf-inbox-health-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          border-top: 1px solid var(--sf-border);
        }
        .sf-inbox-health-item {
          min-width: 0;
          padding: 13px 14px;
          display: flex;
          align-items: center;
          gap: 10px;
          color: inherit;
          text-decoration: none;
          border-right: 1px solid var(--sf-border);
          transition: background 120ms ease;
        }
        .sf-inbox-health-item:last-child { border-right: 0; }
        .sf-inbox-health-item:hover { background: var(--sf-surface-2); }
        .sf-inbox-setup-compact {
          margin-bottom: 20px;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          gap: 16px;
          border: 1px solid rgba(251, 191, 36, 0.38);
          border-radius: 8px;
          background: rgba(251, 191, 36, 0.06);
        }
        .sf-inbox-setup-actions {
          margin-left: auto;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          flex-wrap: wrap;
        }
        .sf-inbox-setup-action {
          min-height: 38px;
          padding: 0 11px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid var(--sf-border);
          border-radius: 8px;
          background: var(--sf-surface);
          color: var(--sf-text);
          text-decoration: none;
          font-size: 12px;
          font-weight: 700;
          transition: border-color 120ms ease, background 120ms ease;
        }
        .sf-inbox-setup-action:hover {
          border-color: rgba(161, 98, 7, 0.42);
          background: rgba(251, 191, 36, 0.08);
        }
        @media (max-width: 900px) {
          .sf-inbox-row { border-radius: 14px; padding: 14px; }
        }
        @media (max-width: 760px) {
          .sf-inbox-health-head { align-items: flex-start; flex-wrap: wrap; }
          .sf-inbox-health-head > a { margin-left: 48px !important; }
          .sf-inbox-health-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .sf-inbox-health-item { border-bottom: 1px solid var(--sf-border); }
          .sf-inbox-health-item:nth-child(2n) { border-right: 0; }
          .sf-inbox-health-item:nth-last-child(-n + 2) { border-bottom: 0; }
          .sf-inbox-setup-compact { align-items: flex-start; flex-wrap: wrap; }
          .sf-inbox-setup-actions { width: 100%; margin-left: 0; justify-content: flex-start; }
        }
        @media (max-width: 1024px) {
          .sf-inbox-metrics-aside { display: none !important; }
          .sf-inbox-metrics-mobile { display: flex !important; }
        }
        @media (min-width: 1025px) {
          .sf-inbox-metrics-mobile { display: none !important; }
        }
        @keyframes shimmer {
          0% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
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

        {/* The forwarding-address card that used to live here was removed:
            tenants on SMTP+IMAP don't need it surfaced on /inbox, and for
            forwarding-only tenants it stays available in Settings →
            Integrations. */}
      </header>

      <section className="sf-inbox-health" aria-live="polite" aria-label={language === "nl" ? "Operationele status" : "Operational status"}>
        <div className="sf-inbox-health-head">
          <div
            style={{
              width: 36,
              height: 36,
              flexShrink: 0,
              borderRadius: 8,
              display: "grid",
              placeItems: "center",
              color: !onboarding ? "var(--sf-text-muted)" : allRequiredOperational ? "#5a7d00" : "#a16207",
              background: !onboarding ? "var(--sf-surface-2)" : allRequiredOperational ? "rgba(199,245,111,0.22)" : "rgba(251,191,36,0.14)",
            }}
          >
            {!onboarding ? <Activity size={18} aria-hidden /> : allRequiredOperational ? <Check size={19} aria-hidden /> : <CircleAlert size={18} aria-hidden />}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "var(--sf-text)" }}>
                {!onboarding ? statusCopy.checking : allRequiredOperational ? statusCopy.healthy : statusCopy.attention}
              </h2>
              {statusCheckedAt && (
                <span style={{ fontSize: 11, color: "var(--sf-text-muted)" }}>
                  {statusCopy.lastChecked} {formatRelativeTime(statusCheckedAt, language)}
                </span>
              )}
            </div>
            <p style={{ margin: "3px 0 0", fontSize: 12, lineHeight: 1.5, color: "var(--sf-text-muted)" }}>
              {!onboarding ? statusCopy.checkingDetail : allRequiredOperational ? statusCopy.healthyDetail : statusCopy.attentionDetail}
            </p>
          </div>
          <Link
            href="/integrations"
            style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, color: "var(--sf-text)", fontSize: 12, fontWeight: 700, textDecoration: "none" }}
          >
            {statusCopy.manage}
            <ChevronRight size={15} aria-hidden />
          </Link>
        </div>

        <div className="sf-inbox-health-grid">
          {systemStatusItems.map((item) => {
            const ItemIcon = item.icon;
            const toneColor = item.tone === "success" ? "#5a7d00" : item.tone === "warning" ? "#a16207" : "var(--sf-text-muted)";
            const toneBackground = item.tone === "success" ? "rgba(199,245,111,0.2)" : item.tone === "warning" ? "rgba(251,191,36,0.13)" : "var(--sf-surface-2)";
            return (
              <Link key={item.key} href={item.href} className="sf-inbox-health-item">
                <span style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 7, display: "grid", placeItems: "center", color: toneColor, background: toneBackground }}>
                  <ItemIcon size={15} aria-hidden />
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "var(--sf-text-muted)" }}>
                    {item.label}
                  </span>
                  <span style={{ display: "block", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, fontWeight: 700, color: "var(--sf-text)" }}>
                    {item.value}
                  </span>
                  {item.detail && <span style={{ display: "block", marginTop: 1, fontSize: 10, color: "var(--sf-text-muted)" }}>{item.detail}</span>}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {showSetupChecklist && (
        <section className="sf-inbox-setup-compact" aria-label={statusCopy.finishSetup}>
          <span style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 8, display: "grid", placeItems: "center", color: "#a16207", background: "rgba(251,191,36,0.14)" }}>
            <CircleAlert size={17} aria-hidden />
          </span>
          <div style={{ minWidth: 170 }}>
            <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "var(--sf-text)" }}>{statusCopy.finishSetup}</h2>
            <p style={{ margin: "3px 0 0", fontSize: 11, lineHeight: 1.45, color: "var(--sf-text-muted)" }}>{statusCopy.finishDetail}</p>
          </div>
          <div className="sf-inbox-setup-actions">
            {incompleteSetupSteps.map((step) => (
              <Link key={step.key} href={step.href} className="sf-inbox-setup-action">
                <span>{step.label}</span>
                <ChevronRight size={14} aria-hidden />
              </Link>
            ))}
          </div>
        </section>
      )}

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>

        <div className="sf-inbox-metrics-mobile" style={{ gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {([
            { label: "Review", count: counts.review, bg: "rgba(199,245,111,0.18)", color: "var(--tone-success)" },
            { label: "Sent", count: counts.sent, bg: "rgba(96,165,250,0.14)", color: "#1d4ed8" },
            { label: "Escalated", count: counts.escalated, bg: "rgba(248,113,113,0.12)", color: "#b42318" },
          ] as const).map((item) => (
            <div key={item.label} style={{ borderRadius: 10, background: item.bg, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: item.color }}>{item.count}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: item.color, opacity: 0.8 }}>{item.label}</span>
            </div>
          ))}
          {metrics.avgConfidence != null && (
            <div style={{ borderRadius: 10, background: "var(--sf-surface-2)", padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: "var(--sf-text)" }}>{Math.round(metrics.avgConfidence * 100)}%</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--sf-text-muted)" }}>Avg conf.</span>
            </div>
          )}
          {metrics.needsHuman > 0 && (
            <div style={{ borderRadius: 10, background: "rgba(251,191,36,0.14)", padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#a16207" }}>{metrics.needsHuman}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#a16207" }}>Needs human</span>
            </div>
          )}
          <div style={{ borderRadius: 10, background: "var(--sf-surface-2)", padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: "var(--sf-text)" }}>{metrics.autoSentToday}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--sf-text-muted)" }}>Auto-sent today</span>
          </div>
          {countdownSecs !== null && (
            <div style={{ borderRadius: 10, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8, background: countdownSecs <= 120 ? "rgba(239,68,68,0.12)" : "rgba(251,191,36,0.14)", border: `1px solid ${countdownSecs <= 120 ? "rgba(239,68,68,0.3)" : "rgba(251,191,36,0.3)"}` }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: countdownSecs <= 120 ? "#dc2626" : "#a16207", fontVariantNumeric: "tabular-nums" }}>{formatCountdown(countdownSecs)}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: countdownSecs <= 120 ? "#dc2626" : "#a16207" }}>until auto-send</span>
            </div>
          )}
        </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <div className="sf-inbox-segmented" role="tablist" aria-label={t.inbox.title}>
          {[
            { id: "review" as const, label: t.inbox.queueReview },
            { id: "sent" as const, label: t.inbox.queueSent },
            { id: "escalated" as const, label: t.inbox.queueEscalated },
            { id: "archived" as const, label: t.inbox.queueArchived },
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
                  color: tab === item.id ? "var(--tone-success)" : "var(--sf-text-muted)",
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

      {!loading && visibleTickets.length > 0 && (
        <div
          style={{
            marginBottom: 14,
            border: "1px solid var(--sf-border)",
            borderRadius: 16,
            background: selectedVisibleIds.length > 0 ? "rgba(199,245,111,0.08)" : "var(--sf-surface)",
            padding: "10px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <label style={{ display: "inline-flex", alignItems: "center", gap: 9, fontSize: 13, fontWeight: 700, color: "var(--sf-text)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleAllVisible}
              style={{ width: 16, height: 16, accentColor: "#9bdc22" }}
            />
            {selectedVisibleIds.length > 0
              ? `${selectedVisibleIds.length} ${t.inbox.selectedSuffix}`
              : t.inbox.selectCurrentQueue}
          </label>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {selectedVisibleIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="sf-btn sf-btn-secondary"
                style={{ height: 36, padding: "0 12px", fontSize: 12 }}
              >
                {t.inbox.deselectBtn}
              </button>
            )}
            <button
              type="button"
              onClick={handleBulkArchive}
              disabled={selectedVisibleIds.length === 0 || bulkArchiveState === "updating"}
              className="sf-btn"
              style={{
                height: 36,
                padding: "0 12px",
                fontSize: 12,
                background: selectedVisibleIds.length > 0 ? "rgba(199,245,111,0.16)" : "var(--sf-surface-2)",
                color: selectedVisibleIds.length > 0 ? "var(--tone-success-strong)" : "var(--sf-text-muted)",
                cursor: selectedVisibleIds.length > 0 ? "pointer" : "not-allowed",
                boxShadow: "none",
              }}
            >
              {bulkArchiveState === "updating"
                ? t.inbox.updatingArchiveBtn
                : tab === "archived" ? t.inbox.restoreSelectedBtn : t.inbox.archiveSelectedBtn}
            </button>
          </div>
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
            const primaryPreview = formatSnippet(
              language === "en" ? ticket.previewEnglish ?? ticket.preview : ticket.preview ?? ticket.previewEnglish
            );
            const primarySubject =
              language === "en" ? ticket.subjectEnglish ?? ticket.subject : ticket.subject;
            const secondarySubject =
              language === "en" ? ticket.subject : ticket.subjectEnglish;
            const showSecondarySubject =
              Boolean(secondarySubject && secondarySubject !== primarySubject && !String(primarySubject).toLowerCase().startsWith("re:"));
            const decisionLabel = formatDecisionLabel(ticket.decision, language);
            const selected = selectedIds.includes(ticket.id);

            return (
              <Link
                key={`${ticket.source}:${ticket.id}`}
                href={`/inbox/${ticket.id}`}
                className={`sf-inbox-row${selectionMode ? " sf-inbox-row--selecting" : ""}${selected ? " sf-inbox-row--selected" : ""}`}
                onClick={(event) => {
                  if (!selectionMode) return;
                  event.preventDefault();
                  toggleTicketSelection(ticket.id);
                }}
              >
                <input
                  type="checkbox"
                  aria-label={`${language === "nl" ? "Selecteer" : "Select"} ${primarySubject}`}
                  checked={selected}
                  onClick={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                  onChange={(event) => {
                    event.stopPropagation();
                    toggleTicketSelection(ticket.id);
                  }}
                  style={{
                    position: "absolute",
                    top: 16,
                    right: 16,
                    width: 17,
                    height: 17,
                    accentColor: "#9bdc22",
                    cursor: "pointer",
                    zIndex: 2,
                  }}
                />
                <div
                  style={{
                    width: "100%",
                    height: 4,
                    borderRadius: 999,
                    background: "rgba(148,163,184,0.14)",
                    overflow: "hidden",
                    marginBottom: 16,
                    paddingRight: 28,
                    boxSizing: "border-box",
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

                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 170px", gap: 18, alignItems: "start" }}>
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
                    {showSecondarySubject && (
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--sf-text-muted)", lineHeight: 1.55 }}>
                        {secondarySubject}
                      </p>
                    )}

                    <p
                      style={{
                        margin: "12px 0 0",
                        fontSize: 14,
                        lineHeight: 1.65,
                        color: "var(--sf-text-secondary)",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {primaryPreview || t.inbox.noPreview}
                    </p>
                  </div>

                  <div style={{ minWidth: 0, display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {ticket.retentionExempt && (
                        <span
                          title={language === "nl" ? "Bewaard — wordt niet automatisch opgeschoond" : "Kept — excluded from automatic cleanup"}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            color: "var(--sf-text-muted)",
                          }}
                        >
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M9 4v6l-2 4v2h10v-2l-2-4V4" />
                            <path d="M12 16v5" />
                            <path d="M8 4h8" />
                          </svg>
                        </span>
                      )}
                      {decisionLabel && (
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
                          {decisionLabel}
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
                      {ticket.status === "pending_autosend" && nextAutoSend && (
                        <span
                          title={formatAutoSendCountdown(nextAutoSend, language, new Date(badgeNow))}
                          style={{
                            borderRadius: 6,
                            padding: "4px 8px",
                            fontSize: 11,
                            fontWeight: 700,
                            background: "rgba(251,191,36,0.14)",
                            color: "#a16207",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            whiteSpace: "nowrap",
                          }}
                        >
                          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <circle cx="12" cy="12" r="9" />
                            <path d="M12 7v5l3 2" />
                          </svg>
                          {`${t.inbox.autosendScheduledShort} ${formatAutoSendWhen(nextAutoSend, language, new Date(badgeNow))}`}
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

        <aside className="sf-inbox-metrics-aside" style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12, position: "sticky", top: 24 }}>
          {countdownSecs !== null && (
            <div
              style={{
                border: `1px solid ${countdownSecs <= 120 ? "rgba(239,68,68,0.35)" : "rgba(251,191,36,0.35)"}`,
                borderRadius: 18,
                background: countdownSecs <= 120 ? "rgba(239,68,68,0.07)" : "rgba(251,191,36,0.07)",
                padding: 18,
                boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
              }}
            >
              <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: countdownSecs <= 120 ? "#dc2626" : "#a16207" }}>
                {metrics.pendingAutosend > 0 ? `${metrics.pendingAutosend} mail${metrics.pendingAutosend !== 1 ? "s" : ""} sending in` : "Auto-send in"}
              </p>
              <p style={{ margin: 0, fontSize: 32, fontWeight: 800, color: countdownSecs <= 120 ? "#dc2626" : "#a16207", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                {formatCountdown(countdownSecs)}
              </p>
            </div>
          )}
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
                { label: "Review", count: counts.review, bg: "rgba(199,245,111,0.18)", color: "var(--tone-success)" },
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
