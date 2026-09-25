"use client";
import Script from "next/script";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { UpgradeModalProvider, useUpgradeModal } from "@/lib/upgradeModal";
import { SequenceMark } from "@/components/marketing/SequenceMark";
import { appFetch } from "@/lib/shopify/client";
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
function WorkspaceChoice({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"new" | "link" | null>(null);
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
      onDone();
    } catch (e) { setError(e instanceof Error ? e.message : "Dat is niet gelukt."); }
    finally { setBusy(false); }
  }
  return <section style={{ display: "grid", gap: 16, maxWidth: 720 }}>
    <div><h1 style={{ margin: 0, fontSize: 28, fontWeight: 500 }}>Welkom bij Support One</h1><p style={muted}>Kies eenmalig waar deze winkel in Support One komt te staan.</p></div>
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
      <button type="button" onClick={() => setMode("new")} style={{ ...card, textAlign: "left", cursor: "pointer", color: "inherit", borderColor: mode === "new" ? "#c7f56f" : "#262626" }}>
        <strong>Nieuwe werkruimte</strong><p style={muted}>Je begint met een lege werkruimte en richt kennis, antwoordstijl en mailbox hier in.</p>
      </button>
      <button type="button" onClick={() => setMode("link")} style={{ ...card, textAlign: "left", cursor: "pointer", color: "inherit", borderColor: mode === "link" ? "#c7f56f" : "#262626" }}>
        <strong>Bestaande werkruimte koppelen</strong><p style={muted}>Gebruik je Support One al? Dan gaan je kennis, antwoordstijl en mailbox mee.</p>
      </button>
    </div>
    {mode === "link" ? <div style={{ ...card, display: "grid", gap: 10 }}>
      <label htmlFor="sf-link-code"><strong>Koppelcode</strong></label>
      <p style={{ ...muted, marginTop: 0 }}>Log in op Support One, ga naar Koppelingen → Shopify-app en maak een koppelcode. Die werkt 15 minuten.</p>
      <input id="sf-link-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="K7PM-3QXR" autoComplete="off" style={{ minHeight: 44, padding: "0 12px", borderRadius: 12, border: "1px solid #333", background: "#0a0a0a", color: "#f5f5f5", font: "600 16px inherit", letterSpacing: ".1em", maxWidth: 240 }} />
      <div><button type="button" style={{ ...primary, opacity: busy || code.trim().length < 8 ? 0.45 : 1 }} disabled={busy || code.trim().length < 8} onClick={() => void submit("link")}>{busy ? "Bezig…" : "Werkruimte koppelen"}</button></div>
    </div> : null}
    {mode === "new" ? <div><button type="button" style={primary} disabled={busy} onClick={() => void submit("new")}>{busy ? "Bezig…" : "Nieuwe werkruimte maken"}</button></div> : null}
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
  const page = path[0] ?? "dashboard";
  const isAdmin = session?.role === "admin";
  return <LanguageProvider>
    <UpgradeModalProvider>
    <Script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" strategy="afterInteractive" onReady={() => { void connect(); }} onError={() => setError("Shopify App Bridge kon niet laden. Open de app opnieuw vanuit Shopify.")} />
    <main style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", padding: "24px clamp(16px,4vw,56px)" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 14, borderBottom: "1px solid #242424", paddingBottom: 20, marginBottom: 28 }}>
        <SequenceMark size={48} state={!session ? "thinking" : "idle"} />
        <div><strong>Support One</strong><div style={{ color: "#94999f", fontSize: 13 }}>{session?.shop ?? "Verbinden met Shopify…"}</div></div>
      </header>
      {error ? <div role="alert"><p>{error}</p><button style={button} onClick={connect}>Opnieuw proberen</button></div>
        : !session ? <p role="status">Je werkruimte wordt veilig geopend…</p>
        : !session.linked ? (isAdmin
          ? <WorkspaceChoice onDone={() => void connect()} />
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
          : page === "integrations" && isAdmin ? <SupportMailboxSettings />
          : page === "settings" || page === "upgrade" ? <ShopifyBilling shop={session.shop} appHandle={appHandle} isAdmin={isAdmin} />
          : <p>Dit onderdeel is niet beschikbaar in Shopify. <AppLink href="/dashboard">Terug naar overzicht</AppLink></p>}
      </>}
    </main>
    </UpgradeModalProvider>
  </LanguageProvider>;
}
