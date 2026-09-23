"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, CircleAlert, Inbox, Mail, RefreshCw, Send, Store } from "lucide-react";
import { SequenceMark } from "@/components/marketing/SequenceMark";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import type { TicketListItem } from "@/types/aiInbox";
import styles from "./page.module.css";

type Setup = {
  isForwardingActive: boolean;
  isImapActive: boolean;
  hasSignature: boolean;
  knowledgeDocCount: number;
  smtp: { status: string };
  commerce: Array<{ status: string; setupStage?: string; eventsStatus?: string }>;
};
const reviewStatuses = new Set(["open", "review", "draft", "approved", "pending_autosend"]);

export default function HomePage() {
  const { language } = useTranslation();
  const nl = language === "nl";
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (signal?: AbortSignal, quiet = false) => {
    if (quiet) setRefreshing(true);
    try {
      const [ticketsRes, setupRes] = await Promise.all([
        fetch("/api/tickets", { cache: "no-store", signal }),
        fetch("/api/integrations/email/setup", { cache: "no-store", signal }),
      ]);
      if (!ticketsRes.ok || !setupRes.ok) throw new Error("Workspace unavailable");
      const [ticketsData, setupData] = await Promise.all([ticketsRes.json(), setupRes.json()]);
      if (signal?.aborted) return;
      setTickets(Array.isArray(ticketsData.tickets) ? ticketsData.tickets : []);
      setSetup(setupData);
      setError(false);
    } catch {
      if (!signal?.aborted) setError(true);
    } finally {
      if (!signal?.aborted) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const interval = window.setInterval(() => void load(controller.signal, true), 60_000);
    const onFocus = () => void load(controller.signal, true);
    window.addEventListener("focus", onFocus);
    return () => { controller.abort(); window.clearInterval(interval); window.removeEventListener("focus", onFocus); };
  }, [load]);

  const review = useMemo(() => tickets.filter((item) => reviewStatuses.has(item.status)), [tickets]);
  const sent = tickets.filter((item) => item.status === "sent").length;
  const escalated = tickets.filter((item) => item.status === "escalated").length;
  const inbound = Boolean(setup?.isForwardingActive || setup?.isImapActive);
  const outbound = setup?.smtp?.status === "active";
  const connectedCommerce = setup?.commerce?.some((item) => item.status === "active" && item.setupStage === "complete" && item.eventsStatus === "active") ?? false;
  const nextStep = !inbound
    ? { title: nl ? "Koppel je supportmailbox" : "Connect your support mailbox", detail: nl ? "Ontvang klantvragen via doorsturen of IMAP. Zodra de eerste mail aankomt, zie je die in de inbox." : "Receive questions through forwarding or IMAP. The first email will appear in your inbox.", href: "/integrations", action: nl ? "Inkomende mail instellen" : "Set up incoming mail" }
    : !outbound
      ? { title: nl ? "Test het versturen van antwoorden" : "Test sending replies", detail: nl ? "Stel SMTP in en voer een verzendtest uit voordat je echte klantmails beantwoordt." : "Set up SMTP and run a send test before replying to customers.", href: "/integrations", action: nl ? "Uitgaande mail instellen" : "Set up outgoing mail" }
      : !setup?.hasSignature
        ? { title: nl ? "Leg je antwoordstijl vast" : "Set your reply style", detail: nl ? "Voeg je handtekening en afspraken toe. Zo sluiten concepten beter aan op je team." : "Add your signature and policies so drafts fit your team.", href: "/settings?tab=policy", action: nl ? "Antwoordstijl instellen" : "Set reply style" }
        : !setup?.knowledgeDocCount
          ? { title: nl ? "Voeg je eerste kennisbron toe" : "Add your first knowledge source", detail: nl ? "Begin bijvoorbeeld met je retourbeleid. Test daarna apart of Support de juiste passage vindt." : "Start with your returns policy, then test whether Support can find the right passage.", href: "/knowledge", action: nl ? "Naar kennisbank" : "Open knowledge base" }
          : { title: review.length ? (nl ? "Je concepten wachten op controle" : "Drafts need your review") : (nl ? "Je werkruimte is ingericht" : "Your workspace is configured"), detail: review.length ? (nl ? "Open de inbox om klantvragen en concepten te beoordelen." : "Open the inbox to review customer questions and drafts.") : (nl ? "Nieuwe klantvragen verschijnen in de inbox. Test apart of je kennisbronnen gevonden worden." : "New questions appear in the inbox. Test knowledge search separately."), href: review.length ? "/inbox" : "/knowledge", action: review.length ? (nl ? "Bekijk de inbox" : "Open inbox") : (nl ? "Kennis testen" : "Test knowledge") };
  const statusLabel = (status: string) => status === "sent" ? (nl ? "Verzonden" : "Sent") : status === "escalated" ? (nl ? "Geëscaleerd" : "Escalated") : reviewStatuses.has(status) ? (nl ? "Te beoordelen" : "Review") : status === "archived" ? (nl ? "Gearchiveerd" : "Archived") : status;

  return <main className={styles.page}><div className={styles.container}>
    <header className={styles.header}><div><span className={styles.eyebrow}>{nl ? "JOUW SUPPORTWERKRUIMTE" : "YOUR SUPPORT WORKSPACE"}</span><h1>{nl ? "Overzicht" : "Overview"}</h1><p>{nl ? "Echte klantvragen, verbindingsstatus en je volgende stap op één plek." : "Real customer questions, connection status and your next step in one place."}</p></div><button className={styles.refresh} type="button" onClick={() => void load(undefined, true)} disabled={refreshing} aria-label={nl ? "Overzicht vernieuwen" : "Refresh overview"}><RefreshCw size={17} aria-hidden /><span>{nl ? "Vernieuwen" : "Refresh"}</span></button></header>
    {error && <div className={styles.error} role="alert">{nl ? "De actuele gegevens konden niet worden geladen. Probeer het opnieuw." : "Current data could not be loaded. Please try again."}</div>}
    <section className={styles.nextStep} aria-labelledby="next-step-title"><div className={styles.mascot}><SequenceMark size={100} state={loading ? "thinking" : review.length ? "reading" : "idle"} title="" /></div><div className={styles.nextCopy}><span className={styles.eyebrow}>{nl ? "VOLGENDE STAP" : "NEXT STEP"}</span><h2 id="next-step-title">{loading || !setup || error ? (nl ? "We controleren je werkruimte…" : "Checking your workspace…") : nextStep.title}</h2><p>{loading || !setup || error ? (nl ? "Je actuele instellingen worden geladen." : "Loading your current settings.") : nextStep.detail}</p></div>{!loading && setup && !error && <Link className={styles.primaryLink} href={nextStep.href}>{nextStep.action}<ArrowRight size={17} aria-hidden /></Link>}</section>
    <section aria-label={nl ? "Klantvragen" : "Customer questions"} className={styles.metrics}>{[
      { icon: Inbox, label: nl ? "Te beoordelen" : "To review", value: review.length, note: nl ? "Klantvragen en concepten" : "Questions and drafts" },
      { icon: Send, label: nl ? "Verzonden" : "Sent", value: sent, note: nl ? "Totaal in de inbox" : "Total in the inbox" },
      { icon: CircleAlert, label: nl ? "Geëscaleerd" : "Escalated", value: escalated, note: nl ? "Vraagt menselijke opvolging" : "Needs human follow-up" },
    ].map(({ icon: Icon, label, value, note }) => <Link href="/inbox" className={styles.metric} key={label}><Icon size={20} aria-hidden /><span>{label}</span><strong>{loading || error ? "—" : value}</strong><small>{note}</small></Link>)}</section>
    <div className={styles.columns}>
      <section className={styles.panel} aria-labelledby="recent-title"><div className={styles.panelHeader}><div><span className={styles.eyebrow}>{nl ? "ACTUEEL" : "LIVE"}</span><h2 id="recent-title">{nl ? "Recente klantvragen" : "Recent questions"}</h2></div><Link href="/inbox">{nl ? "Open inbox" : "Open inbox"}<ArrowRight size={15} aria-hidden /></Link></div>{loading || error ? <p className={styles.empty}>{loading ? (nl ? "Klantvragen laden…" : "Loading questions…") : (nl ? "Geen actuele gegevens beschikbaar." : "No current data available.")}</p> : tickets.length ? tickets.slice(0, 4).map((ticket) => <Link key={`${ticket.source}-${ticket.id}`} href={`/inbox/${ticket.id}`} className={styles.ticket}><div><strong>{ticket.subject || (nl ? "Zonder onderwerp" : "No subject")}</strong><span>{ticket.customerName || ticket.customerEmail || (nl ? "Klant" : "Customer")}</span></div><small>{statusLabel(ticket.status)}</small></Link>) : <div className={styles.empty}><Mail size={24} aria-hidden /><strong>{inbound ? (nl ? "Nog geen klantvragen" : "No customer questions yet") : (nl ? "Nog geen mailbox verbonden" : "No mailbox connected yet")}</strong><p>{inbound ? (nl ? "Nieuwe mail verschijnt hier zodra die is ontvangen." : "New mail appears here when received.") : (nl ? "Koppel eerst inkomende mail om echte klantvragen te zien." : "Connect incoming mail to see real questions.")}</p></div>}</section>
      <section className={styles.panel} aria-labelledby="connections-title"><div className={styles.panelHeader}><div><span className={styles.eyebrow}>{nl ? "INSTELLINGEN" : "SETUP"}</span><h2 id="connections-title">{nl ? "Status van je werkruimte" : "Workspace status"}</h2></div></div>{[
        { icon: Mail, label: nl ? "Inkomende mail" : "Incoming mail", detail: inbound ? (setup?.isImapActive ? "IMAP" : nl ? "Mail ontvangen via doorsturen" : "Mail received via forwarding") : (nl ? "Verbinding nodig" : "Connection needed"), href: "/integrations" },
        { icon: Send, label: nl ? "Uitgaande mail" : "Outgoing mail", detail: outbound ? (nl ? "Verzendtest geslaagd" : "Send test passed") : (nl ? "SMTP-test nodig" : "SMTP test needed"), href: "/integrations" },
        { icon: BookOpen, label: nl ? "Kennisbronnen" : "Knowledge sources", detail: `${setup?.knowledgeDocCount ?? 0} ${nl ? "documenten verwerkt · zoektest apart" : "documents processed · search test separate"}`, href: "/knowledge" },
        { icon: Store, label: nl ? "Webshopgegevens" : "Store data", detail: connectedCommerce ? (nl ? "Koppeling actief" : "Connection active") : (nl ? "Optioneel · niet gekoppeld" : "Optional · not connected"), href: "/integrations" },
      ].map(({ icon: Icon, label, detail, href }) => <Link href={href} className={styles.status} key={label}><Icon size={19} aria-hidden /><span><strong>{label}</strong><small>{loading || error ? "—" : detail}</small></span><ArrowRight size={17} aria-hidden /></Link>)}</section>
    </div><p className={styles.footnote}>{nl ? "Deze pagina toont alleen gegevens uit je eigen werkruimte. Wil je een voorbeeld zien?" : "This page shows only data from your own workspace. Want to see an example?"} <Link href="/#voorbeelden">{nl ? "Bekijk de demo" : "View the demo"}</Link></p>
  </div></main>;
}
