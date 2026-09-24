"use client";

import { use, useEffect, useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Bookmark,
  Check,
  ChevronDown,
  Clock3,
  Forward,
  Loader2,
  MoreHorizontal,
  Paperclip,
  PenLine,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Undo2,
  X,
} from "lucide-react";

import { SequenceMark } from "@/components/marketing/SequenceMark";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { supportLabel } from "@/lib/support/labels";
import type { TicketDetailResponse } from "@/types/aiInbox";
import { computeNextAutoSend, formatAutoSendWhen, formatAutoSendCountdown } from "@/lib/autosend/nextSendTime";
import CommercePanel from "./CommercePanel";
import SpamControl from "./SpamControl";

type ViewMode = "english" | "original";

type Panel = "adjust" | "schedule" | "spam" | null;

function orderStatusLabel(status: string | null, nl: boolean) {
  if (!status) return null;
  const labels: Record<string, string> = nl
    ? { OPEN: "Nog niet verzonden", SHIPPED: "Verzonden", PARTIALLY_SHIPPED: "Deels verzonden", CANCELLED: "Geannuleerd", fulfilled: "Verzonden", unfulfilled: "Nog niet verzonden", partial: "Deels verzonden" }
    : { OPEN: "Not shipped yet", SHIPPED: "Shipped", PARTIALLY_SHIPPED: "Partially shipped", CANCELLED: "Cancelled", fulfilled: "Shipped", unfulfilled: "Not shipped yet", partial: "Partially shipped" };
  return labels[status] ?? status;
}

/**
 * De feiten die Support One bij deze klantvraag kent, als korte regels —
 * hetzelfde "Beschikbare context"-blok als in de demo op de landing.
 */
function commerceFacts(context: TicketDetailResponse["commerceContext"], language: string) {
  const order = context?.order;
  if (!order) return [];
  const nl = language === "nl";
  const locale = nl ? "nl-NL" : "en-GB";
  const date = (value: string) => new Date(value).toLocaleDateString(locale, { day: "numeric", month: "long" });
  const money = new Intl.NumberFormat(locale, { style: "currency", currency: order.currencyCode || "EUR" }).format(order.totalAmount);
  const facts: string[] = [
    `${nl ? "Bestelling" : "Order"} ${order.displayName} · ${nl ? "besteld op" : "ordered"} ${date(order.orderCreatedAt)} · ${money}`,
  ];
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  if (order.items.length) facts.push(`${itemCount}× ${order.items[0].title}${order.items.length > 1 ? ` ${nl ? `en ${order.items.length - 1} meer` : `and ${order.items.length - 1} more`}` : ""}`);
  const shipment = order.fulfillments[0];
  if (shipment) {
    facts.push([
      nl ? "Verzonden" : "Shipped",
      shipment.trackingCompany ? `${nl ? "met" : "with"} ${shipment.trackingCompany}` : null,
      shipment.transportStatusDescription ? `· ${shipment.transportStatusDescription}` : null,
    ].filter(Boolean).join(" "));
  } else {
    const status = orderStatusLabel(order.fulfillmentStatus, nl);
    if (status) facts.push(status);
  }
  const promise = order.items.find((item) => item.latestDeliveryAt)?.latestDeliveryAt;
  if (promise && !shipment) facts.push(`${nl ? "Bezorgbelofte" : "Delivery promise"} ${date(promise)}`);
  const orderReturn = order.returns[0];
  if (orderReturn) facts.push(orderReturn.handled ? (nl ? "Retour ontvangen en verwerkt" : "Return received and processed") : (nl ? "Retour aangemeld" : "Return registered"));
  if (order.items.some((item) => item.cancellationRequested)) facts.push(nl ? "Klant heeft annulering aangevraagd" : "Customer requested cancellation");
  return facts.slice(0, 5);
}

function getInitials(name: string | null, email: string) {
  const source = (name?.trim() || email.split("@")[0] || "SF").replace(/[._-]+/g, " ");
  const parts = source.split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "SF";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageAttachment(contentType: string | null | undefined) {
  return Boolean(contentType?.toLowerCase().startsWith("image/"));
}

type TicketDetailApiResponse = TicketDetailResponse & {
  messages?: TicketDetailResponse["messages"];
  error?: string;
};

function formatDateTimeLocal(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function nextMorningEight() {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setHours(8, 0, 0, 0);
  if (date.getTime() <= Date.now()) {
    date.setDate(date.getDate() + 1);
  }
  return formatDateTimeLocal(date);
}

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, language } = useTranslation();
  const router = useRouter();
  const [ticket, setTicket] = useState<TicketDetailResponse | null>(null);
  const [draftBody, setDraftBody] = useState("");
  const [lastSavedDraftBody, setLastSavedDraftBody] = useState("");
  const [draftSaveState, setDraftSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("original");
  const [sendState, setSendState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [sendErrorMessage, setSendErrorMessage] = useState<string | null>(null);
  const [selectedAttachments, setSelectedAttachments] = useState<File[]>([]);
  const [escalateState, setEscalateState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [regenerateState, setRegenerateState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [regenerateInstructions, setRegenerateInstructions] = useState("");
  const [scheduleState, setScheduleState] = useState<"idle" | "scheduling" | "done" | "error">("idle");
  const [scheduleErrorMessage, setScheduleErrorMessage] = useState<string | null>(null);
  const [scheduleDateTime, setScheduleDateTime] = useState(() => nextMorningEight());
  const [billingPlan, setBillingPlan] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteState, setDeleteState] = useState<"idle" | "deleting" | "error">("idle");
  const [archiveState, setArchiveState] = useState<"idle" | "updating" | "error">("idle");
  const [retentionExempt, setRetentionExempt] = useState(false);
  const [retentionSaving, setRetentionSaving] = useState(false);
  const [retentionError, setRetentionError] = useState<string | null>(null);
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
  const [panel, setPanel] = useState<Panel>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [restoreState, setRestoreState] = useState<"idle" | "restoring" | "error">("idle");
  const [departments, setDepartments] = useState<Array<{ name: string; email: string }>>([]);

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
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/billing/usage");
        if (!res.ok) return;
        const data = await res.json() as { plan?: string };
        if (!cancelled) setBillingPlan(data.plan ?? null);
      } catch {
        // Keep schedule-send locked until the plan is known.
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
        const loadedDraftBody = data.draft?.original.body ?? "";
        setDraftBody(loadedDraftBody);
        setLastSavedDraftBody(loadedDraftBody);
        setDraftSaveState("idle");
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

  // Keep the local retention toggle in sync with whatever the API last returned.
  useEffect(() => {
    if (ticket) setRetentionExempt(Boolean(ticket.retentionExempt));
  }, [ticket]);

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
          setLastSavedDraftBody(data.draft.original.body);
          setDraftSaveState("idle");
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

  useEffect(() => {
    if (!ticket?.draft) return;
    if (ticket.status === "sent" || ticket.status === "escalated") return;
    if (draftBody === lastSavedDraftBody) return;

    let cancelled = false;
    const timeout = setTimeout(async () => {
      setDraftSaveState("saving");
      try {
        const res = await fetch(`/api/tickets/${ticket.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draftBody }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Draft save failed");
        if (!cancelled) {
          setLastSavedDraftBody(draftBody);
          setDraftSaveState("saved");
        }
      } catch (err) {
        console.error("[ticket-detail/draft-autosave]", err);
        if (!cancelled) setDraftSaveState("error");
      }
    }, 900);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [draftBody, lastSavedDraftBody, ticket?.draft, ticket?.id, ticket?.status]);

  useEffect(() => {
    if (!ticket?.draft) return;
    if (ticket.status === "sent" || ticket.status === "escalated") return;
    if (draftBody === lastSavedDraftBody) return;

    const saveBeforeUnload = () => {
      fetch(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftBody }),
        keepalive: true,
      }).catch(() => undefined);
    };

    window.addEventListener("beforeunload", saveBeforeUnload);
    return () => window.removeEventListener("beforeunload", saveBeforeUnload);
  }, [draftBody, lastSavedDraftBody, ticket?.draft, ticket?.id, ticket?.status]);

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
    const loadedDraftBody = data.draft?.original.body ?? "";
    setDraftBody(loadedDraftBody);
    setLastSavedDraftBody(loadedDraftBody);
    setDraftSaveState("idle");
  }

  async function handleApproveSend() {
    if (!ticket || draftBody.trim().length === 0) return;
    setSendErrorMessage(null);
    setSendState("sending");
    try {
      const endpoint = ticket.source === "conversation"
        ? `/api/tickets/${ticket.id}/approve-send`
        : `/api/tickets/${ticket.id}/send`;

      const requestInit: RequestInit = { method: "POST" };
      if (selectedAttachments.length > 0) {
        const formData = new FormData();
        formData.set("draftBody", draftBody);
        for (const file of selectedAttachments) {
          formData.append("attachments", file, file.name);
        }
        requestInit.body = formData;
      } else {
        requestInit.headers = { "Content-Type": "application/json" };
        requestInit.body = JSON.stringify({ draftBody });
      }

      const res = await fetch(endpoint, requestInit);
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

  async function handleScheduleSend() {
    if (!ticket || draftBody.trim().length === 0) return;
    const scheduledDate = new Date(scheduleDateTime);
    if (Number.isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) {
      setScheduleErrorMessage(language === "nl" ? "Kies een verzendtijd in de toekomst." : "Choose a future send time.");
      setScheduleState("error");
      return;
    }

    setScheduleErrorMessage(null);
    setScheduleState("scheduling");
    try {
      const requestInit: RequestInit = { method: "POST" };
      if (selectedAttachments.length > 0) {
        const formData = new FormData();
        formData.set("draftBody", draftBody);
        formData.set("scheduledSendAt", scheduledDate.toISOString());
        for (const file of selectedAttachments) {
          formData.append("attachments", file, file.name);
        }
        requestInit.body = formData;
      } else {
        requestInit.headers = { "Content-Type": "application/json" };
        requestInit.body = JSON.stringify({
          draftBody,
          scheduledSendAt: scheduledDate.toISOString(),
        });
      }

      const res = await fetch(`/api/tickets/${ticket.id}/schedule-send`, requestInit);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? (language === "nl" ? "Inplannen mislukt." : "Scheduling failed."));
      setSelectedAttachments([]);
      await reloadTicket();
      setScheduleState("done");
      setPanel(null);
    } catch (err) {
      console.error("[ticket-detail/schedule-send]", err);
      setScheduleErrorMessage(err instanceof Error ? err.message : (language === "nl" ? "Inplannen mislukt." : "Scheduling failed."));
      setScheduleState("error");
    }
  }

  function handleAttachmentInput(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    if (files.length > 0) {
      setSelectedAttachments((current) => [...current, ...files].slice(0, 5));
    }
    event.currentTarget.value = "";
  }

  async function openEscalationModal() {
    setEscalateFormError(null);
    setEscalateModalOpen(true);
    setMoreOpen(false);
    try {
      const response = await fetch("/api/agent-config", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setDepartments(Array.isArray(data.config?.escalationDepartments) ? data.config.escalationDepartments : []);
    } catch {
      // Zonder afdelingen blijft het vrije e-mailveld gewoon werken.
    }
  }

  async function handleRestoreSpam() {
    if (!ticket) return;
    setRestoreState("restoring");
    try {
      const response = await fetch(`/api/tickets/${ticket.id}/spam`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spam: false }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Restore failed");
      router.push("/inbox");
    } catch {
      setRestoreState("error");
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
      const res = await fetch(`/api/tickets/${ticket.id}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions: regenerateInstructions }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? t.ticketDetail.regenerateError);
      await reloadTicket();
      setViewMode("original");
      setRegenerateState("done");
      setRegenerateInstructions("");
      setPanel(null);
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

  async function handleArchive(archived: boolean) {
    if (!ticket || archiveState === "updating") return;
    setArchiveState("updating");
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Archive update failed");
      if (archived) {
        router.push("/inbox");
        return;
      }
      await reloadTicket();
      setArchiveState("idle");
    } catch (archiveError) {
      console.error("[ticket-detail/archive]", archiveError);
      setArchiveState("error");
    }
  }

  async function handleToggleRetention() {
    if (!ticket || retentionSaving) return;
    const next = !retentionExempt;
    setRetentionSaving(true);
    setRetentionError(null);
    setRetentionExempt(next); // optimistic
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/retention`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exempt: next }),
      });
      if (!res.ok) throw new Error("retention");
    } catch {
      setRetentionExempt(!next); // revert
      setRetentionError(t.ticketDetail.keepTicketError);
    } finally {
      setRetentionSaving(false);
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

  const detailStyles = (
    <style jsx global>{`
      .td-page{width:min(100%,1180px);margin:0 auto;padding:36px 24px 64px;display:grid;gap:18px;color:var(--text)}
      .td-back{display:inline-flex;align-items:center;gap:6px;width:fit-content;color:var(--muted);font-size:13px;text-decoration:none}.td-back:hover{color:var(--text)}
      .td-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;flex-wrap:wrap}
      .td-head-main{min-width:0;display:grid;gap:12px}
      .td-head h1{margin:0;max-width:760px;font-size:26px;font-weight:500;line-height:1.2;letter-spacing:-.02em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .td-customer{display:flex;align-items:center;gap:10px;min-width:0}
      .td-avatar{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;flex:none;background:var(--surface-2);border:1px solid var(--border);font-size:12px;font-weight:600}
      .td-customer>div>strong{display:block;font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .td-customer>div>span{display:block;color:var(--muted);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .td-head-side{display:flex;align-items:center;gap:8px;position:relative}
      .td-pill{display:inline-flex;align-items:center;gap:6px;min-height:26px;padding:0 11px;border:1px solid var(--border);border-radius:999px;background:var(--surface-2);color:var(--muted);font-size:12px;font-weight:600;white-space:nowrap}
      .td-pill.good{border-color:rgba(199,245,111,.28);background:rgba(199,245,111,.1);color:var(--sf-green)}
      .td-pill.warn{border-color:rgba(245,196,88,.3);background:rgba(245,196,88,.1);color:var(--tone-warning)}
      .td-pill.bad{border-color:rgba(248,113,113,.3);background:rgba(248,113,113,.1);color:var(--tone-danger)}
      .td-btn{min-height:40px;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 15px;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--text);font:600 13px inherit;cursor:pointer;text-decoration:none;white-space:nowrap}
      .td-btn:hover:not(:disabled){background:var(--surface-2)}
      .td-btn:disabled{opacity:.5;cursor:not-allowed}
      .td-btn.primary{border-color:var(--sf-green);background:var(--sf-green);color:#10180a}.td-btn.primary:hover:not(:disabled){background:var(--sf-green);filter:brightness(1.06)}
      .td-btn.ghost{border-color:transparent;background:transparent;color:var(--muted)}.td-btn.ghost:hover:not(:disabled){color:var(--text)}
      .td-btn.icon{width:40px;padding:0}
      .td-menu{position:absolute;z-index:40;top:calc(100% + 8px);right:0;min-width:240px;padding:6px;border:1px solid var(--border);border-radius:14px;background:var(--surface);box-shadow:0 18px 50px rgba(0,0,0,.45)}
      .td-menu button{width:100%;display:flex;align-items:center;gap:10px;padding:10px 12px;border:0;border-radius:10px;background:transparent;color:var(--text);font:500 13px inherit;text-align:left;cursor:pointer}
      .td-menu button:hover:not(:disabled){background:var(--surface-2)}.td-menu button:disabled{opacity:.5;cursor:not-allowed}
      .td-menu button svg{flex:none;color:var(--muted)}
      .td-menu button.danger,.td-menu button.danger svg{color:var(--tone-danger)}
      .td-menu hr{margin:6px 4px;border:0;border-top:1px solid var(--border)}
      .td-menu-backdrop{position:fixed;inset:0;z-index:30}
      .td-banner{display:flex;align-items:center;gap:12px;padding:12px 16px;border:1px solid var(--border);border-radius:16px;background:var(--surface);font-size:13px;line-height:1.5}
      .td-banner>svg{flex:none}
      .td-banner>div{flex:1;min-width:0}.td-banner strong{display:block;font-weight:600}.td-banner span{color:var(--muted)}
      .td-banner.warn{border-color:rgba(245,196,88,.3);background:rgba(245,196,88,.07)}.td-banner.warn>svg{color:var(--tone-warning)}
      .td-banner.good{border-color:rgba(199,245,111,.25);background:rgba(199,245,111,.06)}.td-banner.good>svg{color:var(--sf-green)}
      .td-lang{display:inline-flex;gap:4px;width:fit-content;padding:3px;border:1px solid var(--border);border-radius:12px;background:var(--surface)}
      .td-lang button{border:0;border-radius:9px;padding:7px 14px;background:transparent;color:var(--muted);font:500 13px inherit;cursor:pointer}
      .td-lang button.active{background:var(--surface-2);color:var(--text)}
      .td-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:18px;align-items:start}
      .td-card{border:1px solid var(--border);border-radius:20px;background:var(--surface);overflow:hidden}
      .td-card-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px 0}
      .td-label{margin:0;color:var(--muted);font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase}
      .td-card-body{padding:14px 20px 20px;display:grid;gap:14px}
      .td-messages{display:grid;gap:14px}
      .td-message{display:grid;gap:6px;justify-items:start}
      .td-message-meta{display:flex;align-items:center;gap:8px;max-width:100%;font-size:12px;color:var(--muted)}
      .td-message-meta strong{color:var(--text);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .td-bubble{max-width:100%;padding:12px 15px;border:1px solid var(--border);border-radius:4px 16px 16px 16px;background:var(--surface-2)}
      .td-bubble p{margin:0;white-space:pre-wrap;font-size:14px;line-height:1.7;overflow-wrap:anywhere}
      .td-attachments{display:flex;flex-wrap:wrap;gap:8px}
      .td-attachment{display:grid;gap:6px;max-width:220px;padding:8px 10px;border:1px solid var(--border);border-radius:12px;background:var(--bg);color:var(--text);text-decoration:none;overflow:hidden}
      .td-attachment img{width:100%;height:92px;object-fit:cover;border-radius:8px;display:block}
      .td-attachment strong{font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .td-attachment span{font-size:11px;color:var(--muted)}
      .td-context{display:grid;gap:10px;padding-top:16px;border-top:1px solid var(--border)}
      .td-facts{margin:0;padding:0;list-style:none;display:grid;gap:8px}
      .td-facts li{display:flex;align-items:flex-start;gap:10px;font-size:13px;line-height:1.5}
      .td-facts li svg{flex:none;margin-top:2px;padding:2px;border-radius:50%;background:rgba(199,245,111,.14);color:var(--sf-green)}
      .td-details{border:1px solid var(--border);border-radius:14px;overflow:hidden}
      .td-details>summary{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 14px;list-style:none;cursor:pointer;color:var(--muted);font-size:13px;font-weight:500}
      .td-details>summary::-webkit-details-marker{display:none}
      .td-details>summary svg{transition:transform .2s}.td-details[open]>summary svg{transform:rotate(180deg)}
      .td-details>.td-commerce{border-top:1px solid var(--border)}
      .td-draft-head{display:flex;align-items:center;gap:12px;padding:16px 20px 0}
      .td-draft-head>div{flex:1;min-width:0}
      .td-draft-subject{margin:4px 0 0;color:var(--muted);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .td-save{color:var(--muted);font-size:12px;white-space:nowrap}
      .td-save.error{color:var(--tone-danger)}.td-save.saving{color:var(--tone-warning)}
      .td-textarea{width:100%;min-height:420px;box-sizing:border-box;resize:vertical;border:1px solid var(--border);border-radius:16px;background:var(--bg);color:var(--text);padding:16px 18px;font:14px/1.75 inherit;outline:none}
      .td-textarea:focus{border-color:rgba(199,245,111,.45);box-shadow:0 0 0 3px rgba(199,245,111,.1)}
      .td-textarea:disabled{opacity:.85}
      .td-readonly{min-height:420px;border:1px solid var(--border);border-radius:16px;background:var(--bg);padding:16px 18px}
      .td-readonly p{margin:0;white-space:pre-wrap;font-size:14px;line-height:1.75}
      .td-note{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;color:var(--muted);font-size:12px;line-height:1.5}
      .td-generating{display:grid;gap:14px;padding:20px 22px;border:1px solid var(--border);border-radius:16px;background:var(--surface-2)}
      .td-generating strong{display:block;font-size:14px;font-weight:600}.td-generating span{color:var(--muted);font-size:13px}
      .td-skeleton{height:10px;border-radius:999px;background:linear-gradient(90deg,var(--surface) 20%,#262626 50%,var(--surface) 80%);background-size:400% 100%;animation:td-shimmer 1.5s ease-in-out infinite}
      .td-failed{display:flex;align-items:flex-start;gap:12px;padding:16px 18px;border:1px solid rgba(245,196,88,.3);border-radius:16px;background:rgba(245,196,88,.07);font-size:13px;line-height:1.5}
      .td-failed svg{flex:none;margin-top:2px;color:var(--tone-warning)}.td-failed strong{display:block;font-weight:600}.td-failed span{color:var(--muted)}
      .td-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      .td-actions .td-btn.primary{min-height:44px;padding:0 18px;font-size:14px}
      .td-panel{display:grid;gap:10px;padding:14px;border:1px solid var(--border);border-radius:16px;background:var(--surface-2)}
      .td-panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .td-panel-head strong{font-size:13px;font-weight:600}
      .td-panel p{margin:0;color:var(--muted);font-size:12px;line-height:1.5}
      .td-input{width:100%;box-sizing:border-box;border:1px solid var(--border);border-radius:12px;background:var(--bg);color:var(--text);padding:10px 12px;font:13px/1.5 inherit;outline:none}
      .td-input:focus{border-color:rgba(199,245,111,.45)}
      .td-files{display:grid;gap:6px}
      .td-file{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 10px;border:1px solid var(--border);border-radius:10px;background:var(--bg);font-size:12px}
      .td-file span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .td-file button{display:grid;place-items:center;border:0;background:transparent;color:var(--muted);cursor:pointer}
      .td-error{margin:0;color:var(--tone-danger);font-size:13px;line-height:1.5}
      .td-confirm{display:grid;gap:10px;padding:14px;border:1px solid rgba(248,113,113,.3);border-radius:16px;background:rgba(248,113,113,.06)}
      .td-confirm p{margin:0;font-size:13px}.td-confirm div{display:flex;gap:8px;justify-content:flex-end}
      .td-commerce{display:grid;gap:12px;padding:14px}
      .td-commerce-block{display:grid;gap:8px}
      .td-commerce-note{margin:0;color:var(--muted);font-size:12px;line-height:1.55}
      .td-commerce-error{margin:0;color:var(--tone-danger);font-size:12px;line-height:1.5}
      .td-commerce-candidate{display:flex;justify-content:space-between;gap:12px;min-height:42px;padding:8px 12px;border:1px solid var(--border);border-radius:12px;background:var(--bg);color:var(--text);font:inherit;font-size:13px;cursor:pointer}
      .td-commerce-candidate strong{font-weight:600}.td-commerce-candidate span{color:var(--muted)}
      .td-commerce-fields{margin:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px}
      .td-commerce-fields dt{color:var(--muted);font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase}
      .td-commerce-fields dd{margin:4px 0 0;font-size:13px;font-weight:500}
      .td-commerce-list{display:grid;gap:6px}
      .td-commerce-list>div{display:grid;gap:3px;padding:9px 11px;border:1px solid var(--border);border-radius:10px}
      .td-commerce-list strong{font-size:12px;font-weight:600}.td-commerce-list span{color:var(--muted);font-size:12px;overflow-wrap:anywhere}
      .td-commerce-list a{color:var(--sf-green)}
      .td-commerce-foot{display:flex;align-items:center;gap:10px;flex-wrap:wrap;color:var(--muted);font-size:12px}
      .td-commerce-foot .td-btn{min-height:34px;padding:0 12px;font-size:12px}
      .td-commerce-action{padding-top:12px;border-top:1px solid var(--border)}
      .td-commerce-action-head{display:flex;justify-content:space-between;gap:12px}
      .td-commerce-action-head strong{font-size:13px;font-weight:600}.td-commerce-action-head p{margin:4px 0 0;color:var(--muted);font-size:12px;line-height:1.5}
      .td-commerce-actions{display:flex;gap:8px;flex-wrap:wrap}
      .td-commerce-confirm{display:grid;gap:10px;padding:12px;border:1px solid rgba(248,113,113,.3);border-radius:12px;background:rgba(248,113,113,.06)}
      .td-commerce-confirm p{margin:0;font-size:12px;line-height:1.55}.td-commerce-confirm div{display:flex;gap:8px;justify-content:flex-end}
      .td-commerce-timeline{padding-top:10px;border-top:1px solid var(--border)}
      .td-commerce-timeline summary{cursor:pointer;color:var(--muted);font-size:12px;font-weight:500}
      .td-commerce-timeline div{display:grid;gap:6px;margin-top:8px}
      .td-commerce-timeline p{margin:0;display:flex;justify-content:space-between;gap:12px;font-size:12px}.td-commerce-timeline p span:last-child{color:var(--muted)}
      .td-modal-backdrop{position:fixed;inset:0;z-index:70;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.6)}
      .td-modal{width:min(100%,520px);border:1px solid var(--border);border-radius:20px;background:var(--surface);box-shadow:0 24px 70px rgba(0,0,0,.45);overflow:hidden}
      .td-modal header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:18px 20px 0}
      .td-modal h2{margin:0;font-size:17px;font-weight:500}.td-modal header p{margin:4px 0 0;color:var(--muted);font-size:13px;line-height:1.5}
      .td-modal-body{display:grid;gap:14px;padding:16px 20px}
      .td-modal-body label{display:grid;gap:7px}.td-modal-body label>span{color:var(--muted);font-size:12px;font-weight:600}
      .td-chips{display:flex;gap:6px;flex-wrap:wrap}
      .td-chip{min-height:30px;padding:0 11px;border:1px solid var(--border);border-radius:999px;background:var(--surface-2);color:var(--text);font:500 12px inherit;cursor:pointer}
      .td-chip.active{border-color:rgba(199,245,111,.4);background:rgba(199,245,111,.1);color:var(--sf-green)}
      .td-modal footer{display:flex;justify-content:flex-end;gap:8px;padding:14px 20px 18px;border-top:1px solid var(--border)}
      .td-spin{animation:td-spin .85s linear infinite}
      @keyframes td-shimmer{0%{background-position:100% 50%}100%{background-position:0% 50%}}
      @keyframes td-spin{to{transform:rotate(360deg)}}
      @media(max-width:960px){.td-grid{grid-template-columns:1fr}.td-textarea,.td-readonly{min-height:320px}}
      @media(max-width:640px){.td-page{padding:24px 16px 48px}.td-head h1{font-size:22px}.td-actions .td-btn{flex:1}.td-menu{left:0;right:auto}}
      @media(prefers-reduced-motion:reduce){.td-skeleton,.td-spin{animation:none}}
    `}</style>
  );

  if (loading) {
    return (
      <>
        {detailStyles}
        <div className="td-page" role="status" aria-label={t.common.loading}>
          <div className="td-skeleton" style={{ width: 70 }} />
          <div className="td-skeleton" style={{ width: "min(520px,100%)", height: 26 }} />
          <div className="td-skeleton" style={{ width: 220, height: 14 }} />
          <div className="td-grid">
            {[0, 1].map((index) => (
              <div key={index} className="td-card" style={{ padding: 20, display: "grid", gap: 14, minHeight: index ? 520 : 360 }}>
                <div className="td-skeleton" style={{ width: 120 }} />
                <div className="td-skeleton" style={{ width: "86%" }} />
                <div className="td-skeleton" style={{ width: "72%" }} />
                <div className="td-skeleton" style={{ width: "64%" }} />
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  if (error || !ticket) {
    return (
      <>
        {detailStyles}
        <div className="td-page">
          <Link href="/inbox" className="td-back"><ArrowLeft size={14} />{t.ticketDetail.backToInbox}</Link>
          <p className="td-error">{error ?? t.ticketDetail.ticketNotFound}</p>
        </div>
      </>
    );
  }

  const nl = language === "nl";
  const isArchived = ticket.status === "archived";
  const isSpam = ticket.status === "spam";
  const isFinal = ticket.status === "sent" || ticket.status === "escalated" || isArchived || isSpam;
  // Legacy/bugged rows can have customer.email pointing at our own inbound
  // routing domain (the forwarding envelope). Show a friendly label there
  // instead of leaking the internal `t-...@inbox.emailreply...` address.
  const rawCustomerEmail = ticket.customer.email ?? "";
  const isForwardingArtifact = rawCustomerEmail.toLowerCase().endsWith("@inbox.emailreply.sequenceflow.io");
  const trimmedCustomerName = ticket.customer.name?.trim() || null;
  const customerDisplayName = isForwardingArtifact ? (nl ? "Onbekende afzender" : "Unknown sender") : trimmedCustomerName;
  const customerDisplayEmail = isForwardingArtifact
    ? (nl ? "Oorspronkelijke afzender niet beschikbaar" : "Original sender unavailable")
    : rawCustomerEmail;
  const customerInitials = getInitials(isForwardingArtifact ? null : ticket.customer.name, isForwardingArtifact ? "?" : rawCustomerEmail);
  const statusText = supportLabel("status", ticket.status, language) || t.ticketDetail.none;
  const statusToneClass = ticket.status === "sent" ? "good"
    : ticket.status === "pending_autosend" ? "warn"
      : isFinal ? ""
        : "good";
  const draftSubject = ticket.draft
    ? viewMode === "english"
      ? (ticket.draft.english.subject || ticket.draft.original.subject)
      : ticket.draft.original.subject
    : "";
  const readOnlyMode = viewMode === "english";
  // De vertaling bestaat alleen als er echt een Engelse versie is; anders
  // geen schakelaar en geen uitleg over talen.
  const hasTranslation = ticket.messages.some((message) => Boolean(message.english?.body || message.english?.subject));
  const isSchedulePlanAllowed = ["pro", "agency", "custom"].includes(billingPlan ?? "");
  const scheduledSendDate = ticket.scheduledSendAt ? new Date(ticket.scheduledSendAt) : nextAutoSend;
  const commerceActionReady = !ticket.blockingAction || (
    ticket.blockingAction.status === "succeeded" && ticket.blockingAction.confirmationStatus === "prepared"
  );
  const canSend = !isFinal && commerceActionReady && sendState !== "sending" && draftBody.trim().length > 0;
  const canSchedule = canSend && scheduleState !== "scheduling" && isSchedulePlanAllowed;
  const actionError =
    sendState === "error"
      ? sendErrorMessage ?? t.ticketDetail.sendError
      : escalateState === "error"
        ? t.ticketDetail.escalateError
        : regenerateState === "error"
          ? t.ticketDetail.regenerateError
          : scheduleState === "error"
            ? scheduleErrorMessage ?? (nl ? "Inplannen mislukt." : "Scheduling failed.")
            : archiveState === "error"
              ? (nl ? "Archief bijwerken mislukt." : "Could not update the archive.")
              : restoreState === "error"
                ? (nl ? "Herstellen mislukt." : "Restore failed.")
                : deleteState === "error"
                  ? (nl ? "Verwijderen mislukt." : "Delete failed.")
                  : retentionError;
  const finalBannerText = isSpam
    ? (nl ? "Gemarkeerd als spam. De originele mail bij je provider is niet verwijderd." : "Marked as spam. The original email at your provider was not deleted.")
    : isArchived
      ? t.ticketDetail.archivedBanner
      : ticket.status === "escalated"
        ? t.ticketDetail.escalatedBanner.replace("{department}", ticket.escalation?.department ?? t.ticketDetail.none)
        : t.ticketDetail.sentBanner;
  const inboundMessages = ticket.messages.filter((message) => message.direction !== "outbound");
  const facts = commerceFacts(ticket.commerceContext, language);
  const commerceNeedsAttention = Boolean(ticket.blockingAction) || Boolean(ticket.commerceContext && !ticket.commerceContext.order && ticket.commerceContext.candidates.length > 0);
  const saveText = isFinal || readOnlyMode ? ""
    : draftSaveState === "saving" ? (nl ? "Opslaan…" : "Saving…")
      : draftSaveState === "saved" ? (nl ? "Opgeslagen" : "Saved")
        : draftSaveState === "error" ? (nl ? "Opslaan mislukt" : "Save failed")
          : draftBody !== lastSavedDraftBody ? (nl ? "Nog niet opgeslagen" : "Unsaved changes") : "";
  const draftPill = awaitingDraft
    ? { tone: "", text: nl ? "Wordt geschreven…" : "Being written…" }
    : !isFinal && draftBody
      ? { tone: "good", text: nl ? "Klaar voor controle" : "Ready for review" }
      : null;

  return (
    <>
      {detailStyles}
      <div className="td-page">
        <Link href="/inbox" className="td-back"><ArrowLeft size={14} />{t.ticketDetail.backToInbox}</Link>

        <header className="td-head">
          <div className="td-head-main">
            <h1>{headerSubject}</h1>
            <div className="td-customer">
              <span className="td-avatar" aria-hidden>{customerInitials}</span>
              <div style={{ minWidth: 0 }}>
                {customerDisplayName ? <><strong>{customerDisplayName}</strong><span title={isForwardingArtifact ? undefined : customerDisplayEmail} style={{ fontStyle: isForwardingArtifact ? "italic" : "normal" }}>{customerDisplayEmail}</span></> : <strong title={customerDisplayEmail}>{customerDisplayEmail}</strong>}
              </div>
            </div>
          </div>
          <div className="td-head-side">
            <span className={`td-pill ${statusToneClass}`}>{statusText}</span>
            <button type="button" className="td-btn" aria-haspopup="menu" aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)}>
              <MoreHorizontal size={16} />{nl ? "Meer" : "More"}
            </button>
            {moreOpen ? (
              <>
                <div className="td-menu-backdrop" onClick={() => setMoreOpen(false)} />
                <div className="td-menu" role="menu">
                  {!isFinal ? <button type="button" role="menuitem" onClick={() => { setPanel("schedule"); setMoreOpen(false); }}><Clock3 size={15} />{nl ? "Inplannen" : "Schedule"}</button> : null}
                  {!isFinal ? <button type="button" role="menuitem" onClick={() => void openEscalationModal()}><Forward size={15} />{t.ticketDetail.escalate}</button> : null}
                  {!isFinal && !isForwardingArtifact ? <button type="button" role="menuitem" onClick={() => { setPanel("spam"); setMoreOpen(false); }}><ShieldAlert size={15} />{nl ? "Markeer als spam" : "Mark as spam"}</button> : null}
                  {isSpam ? <button type="button" role="menuitem" disabled={restoreState === "restoring"} onClick={() => { setMoreOpen(false); void handleRestoreSpam(); }}><Undo2 size={15} />{restoreState === "restoring" ? (nl ? "Herstellen…" : "Restoring…") : (nl ? "Geen spam, herstellen" : "Not spam, restore")}</button> : null}
                  {!isSpam ? <button type="button" role="menuitem" disabled={archiveState === "updating"} onClick={() => { setMoreOpen(false); void handleArchive(!isArchived); }}>{isArchived ? <ArchiveRestore size={15} /> : <Archive size={15} />}{isArchived ? (nl ? "Terugzetten uit archief" : "Restore from archive") : (nl ? "Archiveren" : "Archive")}</button> : null}
                  <button type="button" role="menuitem" disabled={retentionSaving} title={t.ticketDetail.keepTicketHint} onClick={() => { setMoreOpen(false); void handleToggleRetention(); }}><Bookmark size={15} fill={retentionExempt ? "currentColor" : "none"} />{retentionExempt ? t.ticketDetail.keepTicketKept : t.ticketDetail.keepTicket}</button>
                  {isArchived || isSpam ? <><hr /><button type="button" role="menuitem" className="danger" onClick={() => { setMoreOpen(false); setDeleteConfirm(true); }}><Trash2 size={15} />{nl ? "Verwijderen" : "Delete"}</button></> : null}
                </div>
              </>
            ) : null}
          </div>
        </header>

        {ticket.status === "pending_autosend" && scheduledSendDate ? (
          <div className="td-banner warn">
            <Clock3 size={18} />
            <div>
              <strong>{`${ticket.scheduledSendAt ? (nl ? "Ingepland" : "Scheduled") : t.inbox.autosendScheduledTitle} · ${formatAutoSendWhen(scheduledSendDate, language, new Date(badgeNow))} · ${formatAutoSendCountdown(scheduledSendDate, language, new Date(badgeNow))}`}</strong>
              <span>{cancelAutosendState === "error" ? t.ticketDetail.cancelAutosendError : ticket.scheduledSendAt ? (nl ? "Dit antwoord gaat op dit moment automatisch de deur uit." : "This reply will be sent automatically at this exact time.") : t.inbox.autosendScheduledDesc}</span>
            </div>
            <button type="button" className="td-btn" onClick={handleCancelAutosend} disabled={cancelAutosendState === "cancelling"}>{t.autosend.cancelAutosend}</button>
          </div>
        ) : null}

        {isFinal ? (
          <div className={`td-banner ${ticket.status === "sent" ? "good" : ""}`}>
            {ticket.status === "escalated" ? <Forward size={18} /> : isSpam ? <ShieldAlert size={18} /> : isArchived ? <Archive size={18} /> : <Check size={18} />}
            <div><strong>{finalBannerText}</strong></div>
          </div>
        ) : null}

        {deleteConfirm ? (
          <div className="td-confirm" role="alertdialog">
            <p>{nl ? "Deze klantvraag definitief verwijderen? Dit kan niet ongedaan worden gemaakt." : "Permanently delete this customer question? This cannot be undone."}</p>
            <div>
              <button type="button" className="td-btn" onClick={() => setDeleteConfirm(false)}>{nl ? "Annuleren" : "Cancel"}</button>
              <button type="button" className="td-btn" style={{ borderColor: "rgba(248,113,113,.4)", color: "var(--tone-danger)" }} disabled={deleteState === "deleting"} onClick={() => void handleDelete()}>{deleteState === "deleting" ? <Loader2 size={14} className="td-spin" /> : <Trash2 size={14} />}{nl ? "Ja, verwijderen" : "Yes, delete"}</button>
            </div>
          </div>
        ) : null}

        {hasTranslation ? (
          <div className="td-lang" role="group" aria-label={nl ? "Taal" : "Language"}>
            {(["original", "english"] as const).map((mode) => (
              <button key={mode} type="button" className={viewMode === mode ? "active" : ""} aria-pressed={viewMode === mode} onClick={() => setViewMode(mode)}>
                {mode === "english" ? t.ticketDetail.englishTab : t.ticketDetail.originalTab}
              </button>
            ))}
          </div>
        ) : null}

        <div className="td-grid">
          <section className="td-card" aria-labelledby="td-question">
            <div className="td-card-head">
              <p className="td-label" id="td-question">{t.ticketDetail.customerMessage}</p>
              {inboundMessages.length > 1 ? <span className="td-pill">{inboundMessages.length} {nl ? "berichten" : "messages"}</span> : null}
            </div>
            <div className="td-card-body">
              <div className="td-messages">
                {inboundMessages.length === 0 ? <p className="td-commerce-note">{t.ticketDetail.noMessageContent}</p> : null}
                {inboundMessages.map((message, index) => {
                  const body = viewMode === "english" ? (message.english.body || message.original.body) : message.original.body;
                  const sender = (() => {
                    const address = message.fromEmail ?? "";
                    if (address && address.toLowerCase().endsWith("@inbox.emailreply.sequenceflow.io")) return customerDisplayName ?? customerDisplayEmail;
                    // De klant zelf heet gewoon bij naam; alleen andere afzenders tonen hun adres.
                    if (customerDisplayName && (!address || address.toLowerCase() === rawCustomerEmail.toLowerCase())) return customerDisplayName;
                    return address || customerDisplayName || customerDisplayEmail;
                  })();
                  const time = message.receivedAt
                    ? new Date(message.receivedAt).toLocaleString(nl ? "nl-NL" : "en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                    : null;
                  return (
                    <div className="td-message" key={index}>
                      <div className="td-message-meta"><strong>{sender}</strong>{time ? <span>{time}</span> : null}</div>
                      <div className="td-bubble"><p>{body || t.ticketDetail.noMessageContent}</p></div>
                      {message.attachments?.length ? (
                        <div className="td-attachments">
                          {message.attachments.map((attachment) => {
                            const image = isImageAttachment(attachment.contentType);
                            return (
                              <a key={attachment.id} className="td-attachment" href={attachment.url} target="_blank" rel="noreferrer" style={image ? { width: 132, padding: 6 } : undefined}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                {image ? <img src={attachment.url} alt={attachment.filename} /> : null}
                                <strong>{attachment.filename}</strong>
                                <span>{image ? (nl ? "Foto openen" : "Open photo") : `${nl ? "Bijlage openen" : "Open attachment"} · ${formatFileSize(attachment.byteSize)}`}</span>
                              </a>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {ticket.commerceContext ? (
                <div className="td-context">
                  <p className="td-label">{nl ? "Beschikbare context" : "Available context"}</p>
                  {facts.length ? (
                    <ul className="td-facts">
                      {facts.map((fact) => <li key={fact}><Check size={16} strokeWidth={3} />{fact}</li>)}
                    </ul>
                  ) : null}
                  <details className="td-details" open={commerceNeedsAttention}>
                    <summary>{commerceNeedsAttention ? (nl ? "Actie nodig bij de bestelling" : "Order needs attention") : (nl ? "Alle bestelgegevens" : "All order details")}<ChevronDown size={15} /></summary>
                    <CommercePanel ticketId={ticket.id} context={ticket.commerceContext} action={ticket.blockingAction} timeline={ticket.operationalTimeline} language={language} canAdminister={ticket.viewerRole === "admin"} onChanged={reloadTicket} />
                  </details>
                </div>
              ) : null}
            </div>
          </section>

          <section className="td-card" aria-labelledby="td-draft">
            <div className="td-draft-head">
              <SequenceMark size={34} state={awaitingDraft || regenerateState === "running" ? "thinking" : isFinal ? "idle" : "reading"} title="" />
              <div>
                <p className="td-label" id="td-draft">{ticket.status === "sent" ? (nl ? "Verzonden antwoord" : "Sent reply") : t.ticketDetail.aiDraft}</p>
                {draftSubject ? <p className="td-draft-subject">{draftSubject}</p> : null}
              </div>
              {saveText ? <span className={`td-save ${draftSaveState === "error" ? "error" : draftSaveState === "saving" ? "saving" : ""}`}>{saveText}</span> : null}
              {draftPill ? <span className={`td-pill ${draftPill.tone}`}>{draftPill.text}</span> : null}
            </div>

            <div className="td-card-body">
              {!isFinal && ticket.source === "conversation" && !draftBody && awaitingDraft ? (
                <div className="td-generating" aria-live="polite" aria-busy="true">
                  <div><strong>{t.ticketDetail.draftGeneratingTitle}</strong><span>{t.ticketDetail.draftGeneratingHint}</span></div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {["92%", "78%", "85%", "60%"].map((width) => <span key={width} className="td-skeleton" style={{ width }} />)}
                  </div>
                </div>
              ) : null}
              {!isFinal && ticket.source === "conversation" && !draftBody && !awaitingDraft ? (
                <div className="td-failed">
                  <AlertTriangle size={16} />
                  <div>
                    <strong>{nl ? "Support One kon geen antwoordconcept schrijven" : "Support One couldn't write a reply draft"}</strong>
                    <span>{nl ? "Kies Aanpassen om het opnieuw te proberen." : "Choose Adjust to try again."}</span>
                  </div>
                </div>
              ) : null}

              {awaitingDraft ? null : readOnlyMode ? (
                <>
                  <div className="td-readonly"><p>{translatedDraft || t.ticketDetail.noMessageContent}</p></div>
                  <div className="td-note">
                    <span>{t.ticketDetail.sendLanguageHint}</span>
                    <button type="button" className="td-btn ghost" onClick={() => setViewMode("original")}>{t.ticketDetail.switchToOriginal}</button>
                  </div>
                </>
              ) : (draftBody || isFinal) ? (
                <>
                  <textarea
                    className="td-textarea"
                    value={draftBody}
                    onChange={(event) => setDraftBody(event.target.value)}
                    disabled={isFinal}
                    aria-label={t.ticketDetail.aiDraft}
                  />
                </>
              ) : null}

              {selectedAttachments.length > 0 ? (
                <div className="td-files">
                  {selectedAttachments.map((file, index) => (
                    <div className="td-file" key={`${file.name}-${file.lastModified}-${index}`}>
                      <span><Paperclip size={12} style={{ verticalAlign: "-2px", marginRight: 6 }} />{file.name} · {formatFileSize(file.size)}</span>
                      <button type="button" aria-label={`${t.ticketDetail.removeAttachment}: ${file.name}`} onClick={() => setSelectedAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X size={14} /></button>
                    </div>
                  ))}
                </div>
              ) : null}

              {panel === "adjust" && ticket.source === "conversation" && !isFinal ? (
                <div className="td-panel">
                  <div className="td-panel-head"><strong>{nl ? "Wat moet er anders?" : "What should change?"}</strong><button type="button" className="td-btn ghost icon" aria-label={nl ? "Sluiten" : "Close"} onClick={() => setPanel(null)}><X size={15} /></button></div>
                  <textarea className="td-input" rows={3} value={regenerateInstructions} onChange={(event) => setRegenerateInstructions(event.currentTarget.value)} placeholder={nl ? "Bijv. maak het korter of bied een retourlabel aan" : "E.g. make it shorter or offer a return label"} />
                  <div className="td-actions">
                    <button type="button" className="td-btn primary" onClick={handleRegenerate} disabled={regenerateState === "running"}>
                      {regenerateState === "running" ? <Loader2 size={15} className="td-spin" /> : <RefreshCw size={15} />}
                      {regenerateState === "running" ? t.ticketDetail.regenerating : t.ticketDetail.regenerate}
                    </button>
                    <span className="td-commerce-note">{nl ? "Of pas de tekst hierboven zelf aan; dat wordt vanzelf bewaard." : "Or edit the text above yourself; it saves automatically."}</span>
                  </div>
                </div>
              ) : null}

              {panel === "schedule" && !isFinal ? (
                <div className="td-panel">
                  <div className="td-panel-head"><strong>{nl ? "Later versturen" : "Send later"}{!isSchedulePlanAllowed ? <span className="td-pill good" style={{ marginLeft: 8 }}>Pro</span> : null}</strong><button type="button" className="td-btn ghost icon" aria-label={nl ? "Sluiten" : "Close"} onClick={() => setPanel(null)}><X size={15} /></button></div>
                  <input type="datetime-local" className="td-input" value={scheduleDateTime} onChange={(event) => setScheduleDateTime(event.currentTarget.value)} disabled={!isSchedulePlanAllowed || scheduleState === "scheduling"} />
                  <div className="td-actions">
                    <button type="button" className="td-btn primary" onClick={handleScheduleSend} disabled={!canSchedule} title={!isSchedulePlanAllowed ? (nl ? "Beschikbaar vanaf Pro" : "Available on Pro") : undefined}>
                      {scheduleState === "scheduling" ? <Loader2 size={15} className="td-spin" /> : <Clock3 size={15} />}
                      {scheduleState === "scheduling" ? (nl ? "Inplannen…" : "Scheduling…") : (nl ? "Inplannen" : "Schedule")}
                    </button>
                  </div>
                  <p>{isSchedulePlanAllowed ? (nl ? "Handig als je 's avonds controleert maar pas om 08:00 wilt versturen." : "Useful when reviewing late but sending during business hours.") : (nl ? "Later versturen zit in Pro en hoger." : "Scheduled sending is included in Pro and up.")}</p>
                </div>
              ) : null}

              {panel === "spam" && !isFinal && !isForwardingArtifact ? (
                <SpamControl ticketId={ticket.id} senderEmail={ticket.customer.email} language={language} canBlockFuture={ticket.viewerRole === "admin"} initiallyOpen onClose={() => setPanel(null)} />
              ) : null}

              {!isFinal ? (
                <div className="td-actions">
                  <button type="button" className="td-btn primary" onClick={handleApproveSend} disabled={!canSend} title={readOnlyMode ? t.ticketDetail.sendLanguageHint : undefined}>
                    {sendState === "sending" ? <Loader2 size={16} className="td-spin" /> : <Check size={16} />}
                    {sendState === "sending" ? t.ticketDetail.sending : t.ticketDetail.approveAndSend}
                  </button>
                  {ticket.source === "conversation" ? (
                    <button type="button" className="td-btn" onClick={() => setPanel(panel === "adjust" ? null : "adjust")} aria-expanded={panel === "adjust"}>
                      <PenLine size={15} />{nl ? "Aanpassen" : "Adjust"}
                    </button>
                  ) : null}
                  <label className="td-btn ghost icon" title={`${t.ticketDetail.attachFiles} · ${t.ticketDetail.attachmentLimitHint}`} aria-label={t.ticketDetail.attachFiles}>
                    <input type="file" multiple onChange={handleAttachmentInput} style={{ display: "none" }} />
                    <Paperclip size={16} />
                  </label>
                </div>
              ) : null}
              {!isFinal && !commerceActionReady ? <p className="td-commerce-note">{nl ? "Versturen kan zodra de actie bij de bestelling is afgerond." : "Sending is possible once the order action is complete."}</p> : null}
              {actionError ? <p role="alert" className="td-error">{actionError}</p> : null}
            </div>
          </section>
        </div>

        {escalateModalOpen ? (
          <div className="td-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) closeEscalationModal(); }}>
            <div className="td-modal" role="dialog" aria-modal="true" aria-labelledby="td-escalate-title">
              <header>
                <div><h2 id="td-escalate-title">{t.ticketDetail.escalateModalTitle}</h2><p>{t.ticketDetail.escalateModalSubtitle}</p></div>
                <button type="button" className="td-btn ghost icon" onClick={() => closeEscalationModal()} aria-label={t.ticketDetail.escalateCancel}><X size={16} /></button>
              </header>
              <div className="td-modal-body">
                {departments.length ? (
                  <div className="td-chips">
                    {departments.map((department) => (
                      <button type="button" key={department.email} className={`td-chip ${escalateDepartment === department.email ? "active" : ""}`} onClick={() => setEscalateDepartment(department.email)}>{department.name}</button>
                    ))}
                  </div>
                ) : null}
                <label>
                  <span>{t.ticketDetail.escalateDepartmentLabel}</span>
                  <input type="email" className="td-input" value={escalateDepartment} onChange={(event) => setEscalateDepartment(event.target.value)} placeholder={t.ticketDetail.escalateDepartmentPlaceholder} />
                </label>
                <label>
                  <span>{t.ticketDetail.escalateReasonLabel}</span>
                  <textarea className="td-input" rows={5} value={escalateReason} onChange={(event) => setEscalateReason(event.target.value)} placeholder={t.ticketDetail.escalateReasonPlaceholder} style={{ resize: "vertical", minHeight: 120 }} />
                </label>
                {escalateFormError ? <p className="td-error">{escalateFormError}</p> : null}
              </div>
              <footer>
                <button type="button" className="td-btn" onClick={() => closeEscalationModal()} disabled={escalateState === "sending"}>{t.ticketDetail.escalateCancel}</button>
                <button type="button" className="td-btn primary" onClick={handleEscalateSubmit} disabled={escalateState === "sending"}>
                  {escalateState === "sending" ? <Loader2 size={15} className="td-spin" /> : <Forward size={15} />}
                  {escalateState === "sending" ? t.ticketDetail.escalateSending : t.ticketDetail.escalateConfirm}
                </button>
              </footer>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
