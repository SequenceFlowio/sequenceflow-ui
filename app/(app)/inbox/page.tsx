"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  ChevronRight,
  CircleAlert,
  MailCheck,
  ShieldAlert,
} from "lucide-react";

import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { usageHardLimit } from "@/lib/billingPlans";
import { supportLabel } from "@/lib/support/labels";
import { SequenceMark } from "@/components/marketing/SequenceMark";
import type { TicketListItem } from "@/types/aiInbox";
import { computeNextAutoSend, formatAutoSendWhen, formatAutoSendCountdown } from "@/lib/autosend/nextSendTime";

type Tab = "review" | "sent" | "escalated" | "other" | "archived" | "spam";

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
    setupStage?: string;
    eventsStatus?: string;
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

function initialsOf(name: string | null, email: string | null) {
  const source = (name?.trim() || email?.split("@")[0] || "?").replace(/[._-]+/g, " ");
  return source.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "?";
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
  if (status === "spam") return "spam";
  // Geen klantvraag (filter of poortwachter): niet weg, wel uit de werkrij.
  if (status === "ignored") return "other";
  if (["open", "review", "draft", "approved", "pending_autosend"].includes(status)) return "review";
  return null;
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


export default function InboxPage() {
  const { t, language } = useTranslation();
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<{ used: number; limit: number | null } | null>(null);
  useEffect(() => {
    fetch("/api/billing/usage", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => { if (data) setUsage({ used: Number(data.used ?? 0), limit: data.limit ?? null }); })
      .catch(() => undefined);
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("review");
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
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
        if (!ticketsRes.ok) throw new Error(ticketsData.error ?? t.inbox.loadError);
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
        if (!silent && !cancelled) setError(err instanceof Error ? err.message : t.inbox.loadError);
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
  }, [t.inbox.loadError]);

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
      if (tab === "spam") {
        const results = await Promise.all(idsToUpdate.map(async (id) => {
          const response = await fetch(`/api/tickets/${id}/spam`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ spam: false }),
          });
          const data = await response.json().catch(() => ({}));
          return { ok: response.ok, error: data.error };
        }));
        const failed = results.find((result) => !result.ok);
        if (failed) throw new Error(failed.error ?? t.inbox.bulkArchiveError);
      } else {
        const res = await fetch("/api/tickets/bulk-archive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: idsToUpdate, archived: shouldArchive }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? t.inbox.bulkArchiveError);
      }
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
      spam: tickets.filter((ticket) => statusTab(ticket.status) === "spam").length,
      other: tickets.filter((ticket) => statusTab(ticket.status) === "other").length,
    }),
    [tickets]
  );

  const metrics = useMemo(() => {
    // "Vandaag" in de tijdzone van de gebruiker; toISOString rekende in UTC.
    const localDay = (value: string | Date) => new Date(value).toLocaleDateString("sv-SE");
    const todayStr = localDay(new Date());
    const reviewQueue = tickets.filter((t) => statusTab(t.status) === "review");
    const confSum = reviewQueue.reduce((s, t) => s + (t.confidence ?? 0), 0);
    const avgConf = reviewQueue.length > 0 ? confSum / reviewQueue.length : null;
    return {
      needsHuman: tickets.filter((t) => t.requiresHuman).length,
      // Er wordt niet vastgelegd óf iets automatisch is verstuurd; dit telt alle verzonden klantvragen.
      autoSentToday: tickets.filter((t) => statusTab(t.status) === "sent" && !!t.updatedAt && localDay(t.updatedAt) === todayStr).length,
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
  const emptyState = {
    review: {
      title: !inboundActive && onboarding ? (language === "nl" ? "Nog geen inkomende mail verbonden" : "Incoming mail is not connected yet") : t.inbox.noQueueItems,
      description: !inboundActive && onboarding ? (language === "nl" ? "Koppel je supportmailbox of stuur je mail door naar Support One. Daarna verschijnen klantvragen hier." : "Connect your support mailbox or forward your email to Support One. Customer questions will then appear here.") : t.inbox.noQueueItemsDesc,
      cta: null,
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
    other: {
      title: language === "nl" ? "Niets onder Overig" : "Nothing under Other",
      description: language === "nl" ? "Hier komt mail die geen klantvraag is, zoals leveranciers, facturen en acquisitie. Die telt niet mee voor je pakket." : "Email that is not a customer question lands here, like suppliers, invoices and sales outreach. It does not count towards your plan.",
      cta: null,
      icon: <IconArchive />,
    },
    spam: {
      title: t.inbox.queueSpam,
      description: t.inbox.emptySpam,
      cta: null,
      icon: <ShieldAlert size={18} />,
    },
  }[tab];

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 24px 56px" }}>
      <style>{`
        .sf-inbox-segmented {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 0;
          max-width: 100%;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .sf-inbox-segmented::-webkit-scrollbar { display: none; }
        .sf-inbox-segment {
          height: 40px;
          border: none;
          background: transparent;
          border-radius: 10px;
          padding: 0 14px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 500;
          color: var(--sf-text-muted);
          cursor: pointer;
          transition: all 120ms ease;
          flex: 0 0 auto;
        }
        .sf-inbox-segment--active {
          background: var(--sf-surface-2);
          color: var(--sf-text);
          box-shadow: inset 0 0 0 1px var(--sf-border);
        }
        .sf-inbox-controls {
          margin-bottom: 18px;
          overflow: hidden;
          border: 1px solid var(--sf-border);
          border-radius: 18px;
          background: var(--sf-surface);
        }
        .sf-inbox-setup-note {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 18px;
          padding: 12px 14px;
          border: 1px solid rgba(245, 196, 88, 0.28);
          border-radius: 14px;
          background: rgba(245, 196, 88, 0.07);
          color: var(--sf-text);
          font-size: 13px;
          line-height: 1.5;
          text-decoration: none;
        }
        .sf-inbox-setup-note > svg { flex: none; color: var(--tone-warning); }
        .sf-inbox-setup-note > span { flex: 1; min-width: 0; color: var(--sf-text-muted); }
        .sf-inbox-setup-note > strong { display: inline-flex; align-items: center; gap: 4px; flex: none; font-weight: 600; white-space: nowrap; }
        .sf-inbox-setup-note:hover > strong { color: var(--sf-green); }
        @media (max-width: 640px) {
          .sf-inbox-setup-note { flex-wrap: wrap; align-items: flex-start; }
          .sf-inbox-setup-note > span { flex-basis: calc(100% - 26px); }
          .sf-inbox-setup-note > strong { margin-left: 26px; }
        }
        .sf-inbox-countdown {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          border-top: 1px solid var(--sf-border);
          font-size: 12px;
          font-weight: 600;
        }
        .sf-inbox-controls-head {
          min-height: 58px;
          padding: 8px 10px;
          display: flex;
          align-items: center;
        }

        .sf-inbox-empty {
          min-height: 250px;
          padding: 44px 28px;
          display: grid;
          place-items: center;
          text-align: center;
          border: 1px solid var(--sf-border);
          border-radius: 8px;
          background: var(--sf-surface);
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.04);
        }
        .sf-inbox-empty-icon {
          width: 44px;
          height: 44px;
          margin: 0 auto 14px;
          border-radius: 8px;
          display: grid;
          place-items: center;
          background: var(--sf-surface-2);
          color: var(--sf-text-muted);
        }
        .sf-inbox-empty-icon--mascot { width: 72px; height: 72px; background: transparent; }
        .sf-inbox-row {
          display: grid;
          grid-template-columns: 36px minmax(0, 1fr) auto;
          align-items: start;
          gap: 14px;
          text-decoration: none;
          border: 1px solid var(--sf-border);
          background: var(--sf-surface);
          border-radius: 16px;
          padding: 16px 48px 16px 18px;
          transition: border-color 120ms ease, background 120ms ease;
          position: relative;
          color: var(--sf-text);
        }
        .sf-inbox-row:hover { background: var(--sf-surface-2); border-color: rgba(199, 245, 111, 0.3); }
        .sf-inbox-row--selecting { cursor: pointer; }
        .sf-inbox-row--selected { border-color: rgba(199, 245, 111, 0.45); background: rgba(199, 245, 111, 0.07); }
        .sf-inbox-avatar { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; background: var(--sf-surface-2); border: 1px solid var(--sf-border); color: var(--sf-text); font-size: 12px; font-weight: 600; }
        .sf-inbox-row-main { min-width: 0; display: grid; gap: 4px; }
        .sf-inbox-row-meta { display: flex; align-items: center; gap: 8px; min-width: 0; color: var(--sf-text-muted); font-size: 12px; }
        .sf-inbox-row-meta strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--sf-text); font-size: 13px; font-weight: 600; }
        .sf-inbox-row-meta span { flex: none; }
        .sf-inbox-row-meta svg { flex: none; }
        .sf-inbox-row-subject { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; font-weight: 500; letter-spacing: -0.01em; }
        .sf-inbox-row-preview { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--sf-text-muted); font-size: 13px; line-height: 1.5; }
        .sf-inbox-row-side { display: flex; align-items: center; min-height: 24px; }
        .sf-inbox-pill { display: inline-flex; align-items: center; min-height: 24px; padding: 0 10px; border: 1px solid var(--sf-border); border-radius: 999px; background: var(--sf-surface-2); color: var(--sf-text-muted); font-size: 12px; font-weight: 600; white-space: nowrap; }
        .sf-inbox-pill.good { border-color: rgba(199, 245, 111, 0.28); background: rgba(199, 245, 111, 0.1); color: var(--sf-green); }
        .sf-inbox-pill.warn { border-color: rgba(245, 196, 88, 0.3); background: rgba(245, 196, 88, 0.1); color: var(--tone-warning); }
        .sf-inbox-skeleton { height: 12px; border-radius: 999px; background: linear-gradient(90deg, var(--sf-surface) 25%, var(--sf-surface-2) 50%, var(--sf-surface) 75%); background-size: 400% 100%; animation: shimmer 1.5s ease-in-out infinite; }

        @media (max-width: 640px) {
          .sf-inbox-row { grid-template-columns: 32px minmax(0, 1fr); padding: 14px 44px 14px 14px; }
          .sf-inbox-avatar { width: 32px; height: 32px; }
          .sf-inbox-row-side { grid-column: 2; }
        }
        @media (max-width: 760px) {

          .sf-inbox-empty { min-height: 220px; padding: 36px 20px; }
        }
        @keyframes shimmer {
          0% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>

      <header style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 28 }}>
        <div style={{ maxWidth: 720 }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 500, lineHeight: 1.15, letterSpacing: "-0.02em", color: "var(--sf-text)" }}>
            {t.inbox.decisionTitle}
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.65, color: "var(--sf-text-muted)" }}>
            {t.inbox.decisionSubtitle}
          </p>
        </div>

        {/* The forwarding-address card that used to live here was removed:
            tenants on SMTP+IMAP don't need it surfaced on /inbox, and for
            forwarding-only tenants it stays available in Settings →
            Integrations. */}
      </header>

      {/* Configuratie hoort bij Koppelingen, niet boven de werkrij. Alleen als
          er echt nog iets openstaat, staat hier één regel. */}
      {/* Verbruik: melding vanaf 80%, en duidelijk als er geen concepten meer komen. */}
      {usage && usage.limit != null && usage.limit > 0 && usage.used >= usage.limit * 0.8 ? (() => {
        const hardLimit = usageHardLimit(usage.limit);
        const stopped = usage.used >= hardLimit;
        const over = usage.used >= usage.limit;
        const nl = language === "nl";
        return (
          <Link href="/settings?tab=billing" className="sf-inbox-setup-note">
            <CircleAlert size={16} aria-hidden />
            <span>
              {stopped
                ? (nl ? `Limiet bereikt (${usage.used} van ${usage.limit}). Support One schrijft geen nieuwe concepten tot je volgende periode of een upgrade.` : `Limit reached (${usage.used} of ${usage.limit}). Support One writes no new drafts until your next period or an upgrade.`)
                : over
                  ? (nl ? `Je zit over je pakket (${usage.used} van ${usage.limit}). Nog ${hardLimit - usage.used} concepten speling, daarna stopt het schrijven.` : `You are over your plan (${usage.used} of ${usage.limit}). ${hardLimit - usage.used} drafts of headroom left, then drafting stops.`)
                  : (nl ? `Je hebt ${usage.used} van je ${usage.limit} antwoordconcepten deze periode gebruikt.` : `You have used ${usage.used} of your ${usage.limit} reply drafts this period.`)}
            </span>
            <strong>{nl ? "Bekijk pakketten" : "View plans"} <ChevronRight size={14} aria-hidden /></strong>
          </Link>
        );
      })() : null}

      {showSetupChecklist && (
        <Link href="/integrations" className="sf-inbox-setup-note">
          <CircleAlert size={16} aria-hidden />
          <span>
            {language === "nl" ? "Nog te doen voordat klantvragen binnenkomen: " : "Still to do before customer questions arrive: "}
            {incompleteSetupSteps.map((step) => step.label).join(" · ")}
          </span>
          <strong>{language === "nl" ? "Naar koppelingen" : "Go to connections"} <ChevronRight size={14} aria-hidden /></strong>
        </Link>
      )}

      <section className="sf-inbox-controls" aria-label={language === "nl" ? "Inboxoverzicht" : "Inbox overview"}>
        <div className="sf-inbox-controls-head">
          <div className="sf-inbox-segmented" role="tablist" aria-label={t.inbox.title}>
            {[
              { id: "review" as const, label: t.inbox.queueReview },
              { id: "sent" as const, label: t.inbox.queueSent },
              { id: "escalated" as const, label: t.inbox.queueEscalated },
              { id: "archived" as const, label: t.inbox.queueArchived },
              { id: "other" as const, label: language === "nl" ? "Overig" : "Other" },
              { id: "spam" as const, label: t.inbox.queueSpam },
            ].filter((item) => !["escalated", "other", "spam"].includes(item.id) || counts[item.id] > 0 || tab === item.id).map((item) => (
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
        {countdownSecs !== null && (
          <span className="sf-inbox-countdown" style={{ color: countdownSecs <= 120 ? "var(--tone-danger)" : "var(--tone-warning)" }}>
            <MailCheck size={14} aria-hidden />
            {metrics.pendingAutosend > 0
              ? t.inbox.pendingAutosendCountdown.replace("{count}", String(metrics.pendingAutosend))
              : t.inbox.autosendCountdown}
            <strong style={{ fontVariantNumeric: "tabular-nums" }}>{formatCountdown(countdownSecs)}</strong>
          </span>
        )}
      </section>

      {error && (
        <div
          style={{
            marginBottom: 18,
            borderRadius: 14,
            border: "1px solid rgba(248,113,113,0.28)",
            background: "rgba(248,113,113,0.08)",
            padding: "14px 16px",
            fontSize: 13,
            lineHeight: 1.65,
            color: "var(--tone-danger)",
          }}
        >
          {error}
        </div>
      )}

      {!loading && visibleTickets.length > 0 && (
        <div
          style={{
            marginBottom: 10,
            border: "1px solid var(--sf-border)",
            borderRadius: 14,
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
                : tab === "archived" || tab === "spam" ? t.inbox.restoreSelectedBtn : t.inbox.archiveSelectedBtn}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {loading &&
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="sf-inbox-row" aria-hidden style={{ pointerEvents: "none" }}>
              <span className="sf-inbox-avatar" />
              <div className="sf-inbox-row-main" style={{ gap: 9, paddingTop: 2 }}>
                <span className="sf-inbox-skeleton" style={{ width: 140 }} />
                <span className="sf-inbox-skeleton" style={{ width: "55%", height: 14 }} />
                <span className="sf-inbox-skeleton" style={{ width: "80%" }} />
              </div>
              <span className="sf-inbox-skeleton" style={{ width: 96, height: 24 }} />
            </div>
          ))}

        {!loading && visibleTickets.length === 0 && (
          <div className="sf-inbox-empty">
            <div>
              <div className={`sf-inbox-empty-icon${tab === "review" ? " sf-inbox-empty-icon--mascot" : ""}`}>
                {tab === "review" ? <SequenceMark size={68} state="idle" title="" /> : emptyState.icon}
              </div>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 500, color: "var(--sf-text)" }}>
                {emptyState.title}
              </p>
              <p style={{ margin: "7px auto 0", maxWidth: 480, fontSize: 13, lineHeight: 1.6, color: "var(--sf-text-muted)" }}>
                {emptyState.description}
              </p>
              {tab === "review" && onboarding && !inboundActive && (
                <Link href="/integrations" className="sf-btn sf-btn-primary" style={{ display: "inline-flex", marginTop: 18, textDecoration: "none" }}>
                  {language === "nl" ? "Mailbox koppelen" : "Connect mailbox"}
                </Link>
              )}
            </div>
          </div>
        )}

        {!loading &&
          visibleTickets.map((ticket) => {
            const primaryPreview = formatSnippet(
              language === "en" ? ticket.previewEnglish ?? ticket.preview : ticket.preview ?? ticket.previewEnglish
            );
            const primarySubject =
              language === "en" ? ticket.subjectEnglish ?? ticket.subject : ticket.subject;
            const secondarySubject =
              language === "en" ? ticket.subject : ticket.subjectEnglish;
            const showSecondarySubject =
              Boolean(secondarySubject && secondarySubject !== primarySubject && !String(primarySubject).toLowerCase().startsWith("re:"));
            // Eén pill in plaats van een zekerheidsbalk en percentage.
            const needsAttention = ticket.requiresHuman || ticket.decision === "escalate" || (ticket.confidence != null && ticket.confidence < 0.65);
            const rowPill = ticket.status === "pending_autosend" && nextAutoSend
              ? { tone: "warn", text: `${t.inbox.autosendScheduledShort} ${formatAutoSendWhen(nextAutoSend, language, new Date(badgeNow))}`, title: formatAutoSendCountdown(nextAutoSend, language, new Date(badgeNow)) }
              : ticket.status === "ignored"
                ? { tone: "", text: ticket.intent?.startsWith("non_customer_") ? supportLabel("intent", ticket.intent, language) : (language === "nl" ? "Automatische mail" : "Automated email"), title: undefined }
              : statusTab(ticket.status) !== "review"
                ? { tone: ticket.status === "sent" ? "good" : "", text: supportLabel("status", ticket.status, language), title: undefined }
                : needsAttention
                  ? { tone: "warn", text: language === "nl" ? "Aandacht nodig" : "Needs attention", title: undefined }
                  : ticket.confidence == null
                    ? { tone: "", text: supportLabel("status", ticket.status, language), title: undefined }
                    : { tone: "good", text: language === "nl" ? "Klaar voor controle" : "Ready for review", title: undefined };
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
                    top: 18,
                    right: 16,
                    width: 17,
                    height: 17,
                    accentColor: "#9bdc22",
                    cursor: "pointer",
                    zIndex: 2,
                  }}
                />
                <span className="sf-inbox-avatar" aria-hidden>{initialsOf(ticket.customerName, ticket.customerEmail)}</span>
                <div className="sf-inbox-row-main">
                  <div className="sf-inbox-row-meta">
                    <strong>{ticket.customerName ?? ticket.customerEmail}</strong>
                    <span>{formatRelativeTime(ticket.updatedAt, language)}</span>
                    {ticket.retentionExempt ? <Bookmark size={12} fill="currentColor" aria-label={language === "nl" ? "Bewaard" : "Kept"} /> : null}
                  </div>
                  <p className="sf-inbox-row-subject">{primarySubject}</p>
                  {showSecondarySubject ? <p className="sf-inbox-row-preview">{secondarySubject}</p> : null}
                  <p className="sf-inbox-row-preview">{primaryPreview || t.inbox.noPreview}</p>
                </div>
                <div className="sf-inbox-row-side">
                  <span className={`sf-inbox-pill ${rowPill.tone}`} title={rowPill.title}>{rowPill.text}</span>
                </div>
              </Link>
            );
          })}
      </div>
    </div>
  );
}
