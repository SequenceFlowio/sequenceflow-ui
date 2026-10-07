"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { UpgradeModalProvider, useUpgradeModal } from "@/lib/upgradeModal";
import { SequenceMark } from "@/components/marketing/SequenceMark";
import { appFetch, embeddedPath } from "@/lib/shopify/client";
import { useRouter } from "next/navigation";
import AppLink from "./AppLink";
import dynamic from "next/dynamic";
const Dashboard = dynamic(() => import("@/app/(app)/dashboard/page"));
const Knowledge = dynamic(() => import("@/app/(app)/knowledge/KnowledgeClient").then(module => module.KnowledgeClient));
const AnswerStyle = dynamic(() => import("@/app/(app)/agent-profile/page"));
const Inbox = dynamic(() => import("@/app/(app)/inbox/page"));
const Ticket = dynamic(() => import("@/app/(app)/inbox/[id]/page"));
const SupportMailboxSettings = dynamic(() => import("@/app/(app)/settings/SupportMailboxSettings"));

type Session = { shop: string; role: string; linked: boolean };

const card: React.CSSProperties = { borderWidth: 1, borderStyle: "solid", borderColor: "#262626", borderRadius: 16, padding: 20, background: "#111" };
const muted: React.CSSProperties = { color: "#94999f", fontSize: 13, lineHeight: 1.6, margin: "6px 0 0" };
const button: React.CSSProperties = { minHeight: 38, padding: "0 14px", borderRadius: 999, border: "1px solid #333", background: "#161616", color: "#f5f5f5", font: "600 13px inherit", cursor: "pointer", whiteSpace: "nowrap" };
const primary: React.CSSProperties = { ...button, border: 0, background: "#c7f56f", color: "#0a0a0a" };

function pricingUrl(shop: string, appHandle: string) {
  return appHandle ? `https://admin.shopify.com/store/${shop.replace(".myshopify.com", "")}/charges/${encodeURIComponent(appHandle)}/pricing_plans` : null;
}

/** First visit of the shop owner: a new workspace, or an existing one via a one-time code. */
function WorkspaceChoice({ onDone }: { onDone: (mode: "new" | "link") => void }) {
  const [showLink, setShowLink] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(chosen: "new" | "link") {
    setBusy(true);
    setError("");
    try {
      const res = await appFetch("/api/shopify/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: chosen, code }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Dat is niet gelukt. Probeer het opnieuw.");
      onDone(chosen);
    } catch (e) { setError(e instanceof Error ? e.message : "Dat is niet gelukt."); }
    finally { setBusy(false); }
  }
  const step = (n: number, title: string, text: string) => <li style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
    <span style={{ flex: "none", width: 28, height: 28, borderRadius: 999, display: "grid", placeItems: "center", background: "#1d2614", color: "#c7f56f", fontWeight: 600, fontSize: 13 }}>{n}</span>
    <div><strong style={{ fontSize: 15 }}>{title}</strong><p style={{ ...muted, marginTop: 2 }}>{text}</p></div>
  </li>;
  return <section style={{ display: "grid", gap: 22, maxWidth: 620 }}>
    <div>
      <h1 style={{ margin: 0, fontSize: 30, fontWeight: 500 }}>Welkom bij Support One</h1>
      <p style={muted}>Je AI-collega voor klantvragen. Support One leest je bestellingen en schrijft een antwoord dat jij alleen nog hoeft goed te keuren.</p>
    </div>
    <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 14 }}>
      {step(1, "Koppel je supportmailbox", "Het mailadres waarop klanten je mailen, zoals je Gmail. Zo komen klantvragen binnen.")}
      {step(2, "Voeg je kennis toe", "Bijvoorbeeld je retour- en verzendbeleid, zodat antwoorden kloppen met jouw winkel.")}
      {step(3, "Keur antwoorden goed", "Bij elke klantvraag staat een concept klaar, met de juiste bestelling erbij.")}
    </ol>
    <div><button type="button" style={{ ...primary, minHeight: 46, padding: "0 22px", fontSize: 15 }} disabled={busy} onClick={() => void submit("new")}>{busy && !showLink ? "Bezig…" : "Aan de slag"}</button></div>
    {!showLink ? <button type="button" onClick={() => setShowLink(true)} style={{ justifySelf: "start", background: "none", border: 0, padding: 0, color: "#94999f", font: "13px inherit", textDecoration: "underline", cursor: "pointer" }}>
      Gebruik je Support One al via de website? Koppel je bestaande account.
    </button> : <div style={{ ...card, display: "grid", gap: 10 }}>
      <label htmlFor="sf-link-code"><strong>Bestaand account koppelen</strong></label>
      <p style={{ ...muted, marginTop: 0 }}>Log in op support.sequenceflow.io, ga naar Koppelingen → Shopify-app en maak een koppelcode. Je kennis, antwoordstijl en mailbox gaan dan mee.</p>
      <input id="sf-link-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="K7PM-3QXR" autoComplete="off" style={{ minHeight: 44, padding: "0 12px", borderRadius: 12, border: "1px solid #333", background: "#0a0a0a", color: "#f5f5f5", font: "600 16px inherit", letterSpacing: ".1em", maxWidth: 240 }} />
      <div><button type="button" style={{ ...button, opacity: busy || code.trim().length < 8 ? 0.45 : 1 }} disabled={busy || code.trim().length < 8} onClick={() => void submit("link")}>{busy ? "Bezig…" : "Account koppelen"}</button></div>
    </div>}
    {error ? <p role="alert" style={{ color: "#f08b82", margin: 0 }}>{error}</p> : null}
  </section>;
}

/** Onboarding status: Shopify, support mailbox and a tested order lookup, shown separately. */
function SetupStatus({ isAdmin }: { isAdmin: boolean }) {
  const [mailbox, setMailbox] = useState<{ inbound: boolean; outbound: boolean } | null>(null);
  const [order, setOrder] = useState<{ tested: boolean; lastError: string | null } | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState("");
  const [syncing, setSyncing] = useState(false);
  const load = useCallback(async () => {
    const [setupRes, orderRes] = await Promise.all([appFetch("/api/integrations/email/setup", { cache: "no-store" }), appFetch("/api/shopify/order-context", { cache: "no-store" })]);
    const setup = setupRes.ok ? await setupRes.json() : null;
    setMailbox({ inbound: Boolean(setup?.isForwardingActive || setup?.isImapActive), outbound: setup?.smtp?.status === "active" });
    const status = orderRes.ok ? await orderRes.json() : null;
    setOrder(status?.connected ? { tested: Boolean(status.tested), lastError: status.lastError ?? null } : { tested: false, lastError: null });
  }, []);
  useEffect(() => { void load().catch(() => undefined); }, [load]);
  async function runTest() {
    setTesting(true);
    setTestResult("");
    try {
      const res = await appFetch("/api/shopify/order-context", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "De test is niet gelukt.");
      setTestResult(data.latestOrder ? `Gelukt: bestelling ${data.latestOrder} gevonden.` : "Gelukt: de winkel is bereikbaar. Er zijn nog geen bestellingen.");
    } catch (e) { setTestResult(e instanceof Error ? e.message : "De test is niet gelukt."); }
    finally { setTesting(false); void load().catch(() => undefined); }
  }
  async function syncOrders() {
    setSyncing(true);
    setTestResult("Bestellingen ophalen…");
    try {
      const res = await appFetch("/api/shopify/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Synchroniseren is niet gelukt.");
      setTestResult(`${data.synced} recente bestellingen bijgewerkt.`);
    } catch (e) { setTestResult(e instanceof Error ? e.message : "Synchroniseren is niet gelukt."); }
    finally { setSyncing(false); }
  }
  const row = (ok: boolean | null, title: string, detail: string, action?: React.ReactNode) => <div style={{ display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "space-between", padding: "12px 0", borderTop: "1px solid #202020" }}>
    <div style={{ display: "flex", gap: 10 }}><span aria-hidden style={{ width: 10, height: 10, marginTop: 6, borderRadius: 999, background: ok ? "#c7f56f" : ok === null ? "#444" : "#d69e00", flex: "none" }} /><div><strong style={{ fontSize: 14 }}>{title}</strong><p style={{ ...muted, marginTop: 2 }}>{detail}</p></div></div>
    {action}
  </div>;
  const mailboxReady = mailbox ? mailbox.inbound && mailbox.outbound : null;
  return <section style={{ ...card, marginBottom: 24 }} aria-label="Inrichting">
    <strong>Inrichting</strong>
    <div style={{ marginTop: 10 }}>
      {row(true, "Shopify verbonden", "Support One leest je bestellingen. Er wordt niets in je winkel aangepast.")}
      {row(mailboxReady, "Supportmailbox verbonden", mailbox === null ? "Status laden…" : mailboxReady ? "Klantmails komen binnen en antwoorden gaan via je eigen adres." : "Koppel het mailadres waarop klanten je mailen. Zonder mailbox komen er geen klantvragen binnen.", isAdmin && !mailboxReady ? <AppLink href="/integrations" style={{ ...button, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Mailbox koppelen</AppLink> : undefined)}
      {row(order === null ? null : order.tested && !order.lastError, "Bestelcontext", order === null ? "Status laden…" : order.tested && !order.lastError ? "Getest en actief: bij een klantvraag zoekt Support One de juiste bestelling erbij." : order.lastError ?? "Test of Support One een bestelling kan vinden voordat je erop vertrouwt.", isAdmin ? <button type="button" style={button} disabled={testing} onClick={() => void runTest()}>{testing ? "Testen…" : "Test bestelcontext"}</button> : undefined)}
    </div>
    {isAdmin ? <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginTop: 8 }}>
      <button type="button" style={button} disabled={syncing} onClick={() => void syncOrders()}>{syncing ? "Bezig…" : "Recente bestellingen ophalen"}</button>
      <span role="status" style={{ ...muted, marginTop: 0 }}>{testResult}</span>
    </div> : null}
  </section>;
}

/** Plan and usage; changes happen in Shopify (Stripe is never shown inside Shopify). */
function ShopifyBilling({ shop, appHandle, isAdmin }: { shop: string; appHandle: string; isAdmin: boolean }) {
  const [usage, setUsage] = useState<{ plan: string; used: number; limit: number | null; trialEndsAt: string | null } | null>(null);
  useEffect(() => {
    appFetch("/api/billing/usage", { cache: "no-store" }).then((res) => res.ok ? res.json() : null).then(setUsage).catch(() => setUsage(null));
  }, []);
  const names: Record<string, string> = { trial: "Proefperiode", starter: "Starter", pro: "Growth", agency: "Scale", expired: "Geen actief abonnement", custom: "Maatwerk" };
  const url = pricingUrl(shop, appHandle);
  return <section style={{ ...card, display: "grid", gap: 10, maxWidth: 640 }}>
    <strong>Abonnement</strong>
    {usage ? <>
      <p style={{ margin: 0, fontSize: 22 }}>{names[usage.plan] ?? usage.plan}</p>
      <p style={{ ...muted, marginTop: 0 }}>{usage.used} van {usage.limit ?? "onbeperkt"} antwoordconcepten deze periode{usage.trialEndsAt ? ` · proefperiode tot ${new Date(usage.trialEndsAt).toLocaleDateString("nl-NL")}` : ""}.</p>
    </> : <p style={muted}>Abonnement laden…</p>}
    <p style={{ ...muted, marginTop: 0 }}>Je abonnement loopt via Shopify en staat op je Shopify-factuur.</p>
    {isAdmin && url ? <div><a href={url} target="_top" style={{ ...primary, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Abonnement kiezen of wijzigen</a></div> : null}
  </section>;
}

/**
 * Without an active Shopify plan no drafts are written. Shopify expects apps
 * with managed pricing to send the merchant to plan selection, so this says
 * so up front instead of leaving an inbox that silently stays empty.
 */
function PlanRequired({ shop, appHandle, isAdmin }: { shop: string; appHandle: string; isAdmin: boolean }) {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    appFetch("/api/billing/usage", { cache: "no-store" })
      .then((res) => res.ok ? res.json() : null)
      .then((usage) => setExpired(usage?.plan === "expired"))
      .catch(() => setExpired(false));
  }, []);
  if (!expired) return null;
  const url = pricingUrl(shop, appHandle);
  return <section role="alert" style={{ ...card, borderColor: "#6b5a1e", background: "#17140a", marginBottom: 24, display: "grid", gap: 10 }}>
    <strong>Kies een abonnement om te starten</strong>
    <p style={{ ...muted, marginTop: 0 }}>Zonder actief abonnement schrijft Support One geen antwoordconcepten. Elk abonnement begint met 14 dagen gratis.</p>
    {isAdmin && url ? <div><a href={url} target="_top" style={{ ...primary, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Abonnement kiezen</a></div>
      : <p style={{ ...muted, marginTop: 0 }}>Vraag de winkeleigenaar een abonnement te kiezen.</p>}
  </section>;
}

/** Inside Shopify the upgrade prompt points to Shopify's own plan page. */
function ShopifyUpgradePrompt({ shop, appHandle }: { shop: string; appHandle: string }) {
  const { state, close } = useUpgradeModal();
  if (!state.isOpen) return null;
  const url = pricingUrl(shop, appHandle);
  return <div role="dialog" aria-modal="true" aria-labelledby="sf-upgrade-title" style={{ position: "fixed", inset: 0, zIndex: 50, display: "grid", placeItems: "center", background: "rgba(0,0,0,.6)", padding: 16 }}>
    <div style={{ ...card, maxWidth: 440, display: "grid", gap: 12 }}>
      <strong id="sf-upgrade-title">Kies een groter pakket</strong>
      <p style={{ ...muted, marginTop: 0 }}>Je pakket laat dit niet meer toe. Kies in Shopify een pakket dat past; je betaalt via je Shopify-factuur.</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {url ? <a href={url} target="_top" style={{ ...primary, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Naar pakketten in Shopify</a> : null}
        {state.forced ? null : <button type="button" style={button} onClick={close}>Sluiten</button>}
      </div>
    </div>
  </div>;
}

export default function EmbeddedSupport({ path, appHandle }: { path: string[]; appHandle: string }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const ticketParams = useMemo(() => Promise.resolve({ id: path[1] ?? "" }), [path]);
  const connect = useCallback(async () => {
    setError("");
    try {
      const res = await appFetch("/api/shopify/session", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Shopify verbinden is niet gelukt.");
      setSession(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Shopify verbinden is niet gelukt."); }
  }, []);
  // App Bridge is loaded by a blocking script in the page; wait until it is ready.
  useEffect(() => {
    let cancelled = false;
    const started = Date.now();
    const tryConnect = () => {
      if (cancelled) return;
      if (window.shopify) { void connect(); return; }
      if (Date.now() - started > 8000) { setError("Shopify App Bridge kon niet laden. Open de app opnieuw vanuit Shopify."); return; }
      window.setTimeout(tryConnect, 100);
    };
    tryConnect();
    return () => { cancelled = true; };
  }, [connect]);
  const page = path[0] ?? "dashboard";
  const isAdmin = session?.role === "admin";
  return <LanguageProvider>
    <UpgradeModalProvider>
    <main style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", padding: "24px clamp(16px,4vw,56px)" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 14, borderBottom: "1px solid #242424", paddingBottom: 20, marginBottom: 28 }}>
        <SequenceMark size={48} state={!session ? "thinking" : "idle"} />
        <div><strong>Support One</strong><div style={{ color: "#94999f", fontSize: 13 }}>{session?.shop ?? "Verbinden met Shopify…"}</div></div>
      </header>
      {error ? <div role="alert"><p>{error}</p><button style={button} onClick={connect}>Opnieuw proberen</button></div>
        : !session ? <p role="status">Je werkruimte wordt veilig geopend…</p>
        : !session.linked ? (isAdmin
          ? <WorkspaceChoice onDone={(mode) => { if (mode === "new") router.push(embeddedPath("/integrations")); void connect(); }} />
          : <p>De winkeleigenaar richt Support One eerst in. Daarna kun je hier aan de slag.</p>)
        : <>
        <ShopifyUpgradePrompt shop={session.shop} appHandle={appHandle} />
        <PlanRequired shop={session.shop} appHandle={appHandle} isAdmin={isAdmin} />
        <nav aria-label="Hoofdnavigatie" style={{ display: "flex", flexWrap: "wrap", gap: 24, marginBottom: 28 }}>
          <AppLink href="/dashboard">Overzicht</AppLink><AppLink href="/inbox">Inbox</AppLink>
          <AppLink href="/knowledge">Jouw kennis</AppLink><AppLink href="/agent-profile">Antwoordstijl</AppLink>
          {isAdmin && <AppLink href="/integrations">Mailbox</AppLink>}
          <AppLink href="/settings">Abonnement</AppLink>
        </nav>
        {page === "dashboard" && <SetupStatus isAdmin={isAdmin} />}
        {page === "dashboard" ? <Dashboard /> : page === "inbox" ? (path[1] ? <Ticket params={ticketParams} /> : <Inbox />)
          : page === "knowledge" ? <Knowledge isAdmin={isAdmin} />
          : page === "agent-profile" ? <AnswerStyle />
          : page === "integrations" && isAdmin ? <div style={{ display: "grid", gap: 16 }}>
            <div style={{ ...card, display: "grid", gap: 4 }}>
              <strong>Stap 1: koppel je supportmailbox</strong>
              <p style={{ ...muted, marginTop: 0 }}>Kies het mailadres waarop klanten je mailen, bijvoorbeeld je Gmail. Support One leest nieuwe klantvragen en schrijft een concept; je originele mail blijft gewoon staan. Daarna voeg je bij <AppLink href="/knowledge">Jouw kennis</AppLink> je beleid toe.</p>
            </div>
            <SupportMailboxSettings />
          </div>
          : page === "settings" || page === "upgrade" ? <ShopifyBilling shop={session.shop} appHandle={appHandle} isAdmin={isAdmin} />
          : <p>Dit onderdeel is niet beschikbaar in Shopify. <AppLink href="/dashboard">Terug naar overzicht</AppLink></p>}
      </>}
    </main>
    </UpgradeModalProvider>
  </LanguageProvider>;
}
