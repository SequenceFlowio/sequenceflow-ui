"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LanguageProvider, useTranslation, type Language } from "@/lib/i18n/LanguageProvider";
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

type Session = { shop: string; role: string; linked: boolean; origin?: string | null };

const card: React.CSSProperties = { borderWidth: 1, borderStyle: "solid", borderColor: "var(--border)", borderRadius: 16, padding: 20, background: "var(--surface)" };
const muted: React.CSSProperties = { color: "var(--muted)", fontSize: 13, lineHeight: 1.6, margin: "6px 0 0" };
const button: React.CSSProperties = { minHeight: 38, padding: "0 14px", borderRadius: 999, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", font: "600 13px inherit", cursor: "pointer", whiteSpace: "nowrap" };
const primary: React.CSSProperties = { ...button, border: 0, background: "#c7f56f", color: "#0a0a0a" };

function pricingUrl(shop: string, appHandle: string) {
  return appHandle ? `https://admin.shopify.com/store/${shop.replace(".myshopify.com", "")}/charges/${encodeURIComponent(appHandle)}/pricing_plans` : null;
}

/** Dutch or English, following the Shopify admin's language. */
function useText() {
  const { language } = useTranslation();
  return { language, t: (nl: string, en: string) => (language === "nl" ? nl : en) };
}

/** First visit of the shop owner: one button to start; linking an existing account is the exception. */
/** A random one-time intent; only this browser knows it (see /link-shopify). */
function newLinkIntent() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * "I already have an account": open the website in a new tab, where the owner
 * signs in; the website creates a link code for this intent and we claim it.
 * Works for a new install and for moving an installed shop to that account.
 */
function useAccountLink(onLinked: () => void) {
  const { t } = useText();
  const [waiting, setWaiting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const intent = useRef<string | null>(null);
  const linking = useRef(false);

  const linkWith = useCallback(async (body: Record<string, string>) => {
    if (linking.current) return false;
    linking.current = true;
    setBusy(true);
    try {
      const res = await appFetch("/api/shopify/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("Koppelen is niet gelukt. Probeer het opnieuw.", "Linking did not work. Please try again."));
      if (data.pending) return false;
      setWaiting(false);
      onLinked();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Koppelen is niet gelukt.", "Linking did not work."));
      setWaiting(false);
      return false;
    } finally { linking.current = false; setBusy(false); }
  }, [onLinked, t]);

  // Poll until the website has created the code (the owner may first sign in).
  useEffect(() => {
    if (!waiting) return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (!intent.current) return;
      if (Date.now() - started > 15 * 60 * 1000) { window.clearInterval(timer); setWaiting(false); return; }
      void linkWith({ mode: "claim", intent: intent.current });
    }, 3000);
    return () => window.clearInterval(timer);
  }, [waiting, linkWith]);

  // Faster path: the website tab hands over the code directly when it can.
  useEffect(() => {
    if (!waiting) return;
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.data?.type !== "sf-shopify-link-code" || typeof event.data.code !== "string") return;
      void linkWith({ mode: "link", code: event.data.code });
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [waiting, linkWith]);

  function start() {
    setError("");
    intent.current = newLinkIntent();
    // Open synchronously inside the click so pop-up blockers allow it.
    window.open(`${window.location.origin}/link-shopify?intent=${intent.current}`, "_blank");
    setWaiting(true);
  }
  function reopen() {
    if (intent.current) window.open(`${window.location.origin}/link-shopify?intent=${intent.current}`, "_blank");
  }
  return { start, reopen, waiting, busy, error, linkWithCode: (code: string) => linkWith({ mode: "link", code }), cancel: () => setWaiting(false) };
}

function LinkWaiting({ link }: { link: ReturnType<typeof useAccountLink> }) {
  const { t } = useText();
  const [code, setCode] = useState("");
  return <div style={{ ...card, display: "grid", gap: 10 }} aria-live="polite">
    <strong>{t("Log in op het tabblad dat net openging", "Sign in on the tab that just opened")}</strong>
    <p style={{ ...muted, marginTop: 0 }}>{t("Log daar in met je SequenceFlow-account. Daarna wordt deze winkel vanzelf aan je werkruimte gekoppeld; je hoeft niets over te typen.", "Sign in there with your SequenceFlow account. This store is then linked to your workspace automatically; there is nothing to type.")}</p>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ ...muted, marginTop: 0 }}>{t("Wachten op inloggen…", "Waiting for sign-in…")}</span>
      <button type="button" style={button} onClick={link.reopen}>{t("Tabblad opnieuw openen", "Open the tab again")}</button>
      <button type="button" style={{ ...button, background: "none" }} onClick={link.cancel}>{t("Annuleren", "Cancel")}</button>
    </div>
    <details>
      <summary style={{ ...muted, cursor: "pointer" }}>{t("Lukt het niet? Vul een koppelcode in", "Not working? Enter a link code")}</summary>
      <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
        <p style={{ ...muted, marginTop: 0 }}>{t("Op support.sequenceflow.io → Koppelingen → Shopify-app maak je een koppelcode.", "Create a link code at support.sequenceflow.io → Connections → Shopify app.")}</p>
        <input aria-label={t("Koppelcode", "Link code")} value={code} onChange={(event) => setCode(event.target.value)} placeholder="K7PM-3QXR" autoComplete="off" style={{ minHeight: 44, padding: "0 12px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", font: "600 16px inherit", letterSpacing: ".1em", maxWidth: 240 }} />
        <div><button type="button" style={{ ...button, opacity: link.busy || code.trim().length < 8 ? 0.45 : 1 }} disabled={link.busy || code.trim().length < 8} onClick={() => void link.linkWithCode(code)}>{link.busy ? t("Bezig…", "Working…") : t("Koppelen", "Link")}</button></div>
      </div>
    </details>
  </div>;
}

/** First visit of the owner: link an existing account (the default question) or start fresh. */
function WorkspaceChoice({ onDone }: { onDone: (mode: "new" | "link") => void }) {
  const { t } = useText();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const link = useAccountLink(useCallback(() => onDone("link"), [onDone]));
  async function startNew() {
    setBusy(true);
    setError("");
    try {
      const res = await appFetch("/api/shopify/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "new" }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("Dat is niet gelukt. Probeer het opnieuw.", "That didn't work. Please try again."));
      onDone("new");
    } catch (e) { setError(e instanceof Error ? e.message : t("Dat is niet gelukt.", "That didn't work.")); }
    finally { setBusy(false); }
  }
  const step = (n: number, title: string, text: string) => <li style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
    <span style={{ flex: "none", width: 28, height: 28, borderRadius: 999, display: "grid", placeItems: "center", background: "rgba(199,245,111,.18)", color: "var(--tone-success)", fontWeight: 600, fontSize: 13 }}>{n}</span>
    <div><strong style={{ fontSize: 15 }}>{title}</strong><p style={{ ...muted, marginTop: 2 }}>{text}</p></div>
  </li>;
  return <section style={{ display: "grid", gap: 22, maxWidth: 620 }}>
    <div>
      <h1 style={{ margin: 0, fontSize: 30, fontWeight: 500 }}>{t("Welkom bij Support One", "Welcome to Support One")}</h1>
      <p style={muted}>{t("Je AI-collega voor klantvragen. Support One leest je bestellingen en schrijft een antwoord dat jij alleen nog hoeft goed te keuren.", "Your AI teammate for customer emails. Support One reads your orders and drafts a reply that you only have to approve.")}</p>
    </div>
    <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 14 }}>
      {step(1, t("Koppel je supportmailbox", "Connect your support mailbox"), t("Het mailadres waarop klanten je mailen, zoals je Gmail. Zo komen klantvragen binnen.", "The address customers email, such as your Gmail. That's how customer questions come in."))}
      {step(2, t("Voeg je kennis toe", "Add your knowledge"), t("Bijvoorbeeld je retour- en verzendbeleid, zodat antwoorden kloppen met jouw winkel.", "For example your return and shipping policy, so replies match your store."))}
      {step(3, t("Keur antwoorden goed", "Approve replies"), t("Bij elke klantvraag staat een concept klaar, met de juiste bestelling erbij.", "Every customer question gets a draft reply, with the right order next to it."))}
    </ol>
    {link.waiting ? <LinkWaiting link={link} /> : <div style={{ ...card, display: "grid", gap: 12 }}>
      <strong style={{ fontSize: 16 }}>{t("Heb je al een SequenceFlow-account?", "Do you already have a SequenceFlow account?")}</strong>
      <p style={{ ...muted, marginTop: 0 }}>{t("Gebruik je Support One al op de website? Koppel dan deze winkel aan dat account: je kennis, antwoordstijl en mailbox gelden dan ook hier, en je hebt één werkruimte.", "Already using Support One on the website? Link this store to that account: your knowledge, answer style and mailbox then apply here too, and you keep one workspace.")}</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" style={{ ...primary, minHeight: 46, padding: "0 22px", fontSize: 15 }} disabled={busy || link.busy} onClick={link.start}>{t("Ja, koppel mijn account", "Yes, link my account")}</button>
        <button type="button" style={{ ...button, minHeight: 46, padding: "0 22px", fontSize: 15 }} disabled={busy || link.busy} onClick={() => void startNew()}>{busy ? t("Bezig…", "Working…") : t("Nee, nieuw beginnen", "No, start fresh")}</button>
      </div>
    </div>}
    {error || link.error ? <p role="alert" style={{ color: "var(--tone-danger)", margin: 0 }}>{error || link.error}</p> : null}
  </section>;
}

/**
 * Moving an installed shop needs migration 052 (relink without a duplicate
 * Shopify connection). Until that is applied, the move button stays hidden.
 */
const SHOP_MOVE_AVAILABLE = false;

/** On the Plan page: which workspace this store uses, and moving it to an existing account. */
function WorkspaceAccountCard({ origin, onMoved }: { origin: string | null; onMoved: () => void }) {
  const { t } = useText();
  const [confirming, setConfirming] = useState(false);
  const link = useAccountLink(onMoved);
  if (origin !== "linked" && !SHOP_MOVE_AVAILABLE) return null;
  if (origin === "linked") {
    return <section style={{ ...card, display: "grid", gap: 6, marginTop: 24 }} aria-label={t("Werkruimte", "Workspace")}>
      <strong>{t("Werkruimte", "Workspace")}</strong>
      <p style={{ ...muted, marginTop: 0 }}>{t("Deze winkel is gekoppeld aan je SequenceFlow-account. Op support.sequenceflow.io zie je dezelfde werkruimte.", "This store is linked to your SequenceFlow account. You see the same workspace at support.sequenceflow.io.")}</p>
    </section>;
  }
  return <section style={{ ...card, display: "grid", gap: 10, marginTop: 24 }} aria-label={t("Werkruimte", "Workspace")}>
    <strong>{t("Werkruimte", "Workspace")}</strong>
    <p style={{ ...muted, marginTop: 0 }}>{t("Deze winkel heeft een eigen werkruimte. Gebruik je Support One ook op de website? Verhuis deze winkel dan naar dat account, zodat je één werkruimte hebt.", "This store has its own workspace. Do you also use Support One on the website? Move this store to that account, so you have one workspace.")}</p>
    {link.waiting ? <LinkWaiting link={link} />
      : confirming ? <div style={{ display: "grid", gap: 10 }}>
        <p style={{ ...muted, marginTop: 0, color: "var(--text)" }}>{t("Gesprekken, kennis en mailbox-instellingen van deze winkel-werkruimte gaan niet mee; ze blijven bewaard maar zijn daarna niet meer zichtbaar. Je werkt verder met wat er in je bestaande account staat.", "Conversations, knowledge and mailbox settings of this store's workspace do not move along; they are kept but no longer visible. You continue with what is in your existing account.")}</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" style={primary} onClick={link.start}>{t("Verhuizen naar mijn account", "Move to my account")}</button>
          <button type="button" style={button} onClick={() => setConfirming(false)}>{t("Annuleren", "Cancel")}</button>
        </div>
      </div>
      : <div><button type="button" style={button} onClick={() => setConfirming(true)}>{t("Verhuizen naar mijn bestaande account", "Move to my existing account")}</button></div>}
    {link.error ? <p role="alert" style={{ color: "var(--tone-danger)", margin: 0 }}>{link.error}</p> : null}
  </section>;
}

/** Onboarding status: Shopify, support mailbox and a tested order lookup, plus a sample question. */
function SetupStatus({ isAdmin }: { isAdmin: boolean }) {
  const { t, language } = useText();
  const router = useRouter();
  const [mailbox, setMailbox] = useState<{ inbound: boolean; outbound: boolean } | null>(null);
  const [order, setOrder] = useState<{ tested: boolean; lastError: string | null } | null>(null);
  const [testing, setTesting] = useState(false);
  const [sampling, setSampling] = useState(false);
  const [testResult, setTestResult] = useState("");
  const [syncing, setSyncing] = useState(false);
  const load = useCallback(async () => {
    const [setupRes, orderRes] = await Promise.all([appFetch("/api/integrations/email/setup", { cache: "no-store" }), appFetch("/api/shopify/order-context", { cache: "no-store" })]);
    const setup = setupRes.ok ? await setupRes.json() : null;
    setMailbox({ inbound: Boolean(setup?.isForwardingActive || setup?.isImapActive), outbound: Boolean(setup?.isOutboundActive ?? setup?.smtp?.status === "active") });
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
      if (!res.ok) throw new Error(data.error || t("De test is niet gelukt.", "The test failed."));
      setTestResult(data.latestOrder ? t(`Gelukt: bestelling ${data.latestOrder} gevonden.`, `Success: found order ${data.latestOrder}.`) : t("Gelukt: de winkel is bereikbaar. Er zijn nog geen bestellingen.", "Success: the store is reachable. There are no orders yet."));
    } catch (e) { setTestResult(e instanceof Error ? e.message : t("De test is niet gelukt.", "The test failed.")); }
    finally { setTesting(false); void load().catch(() => undefined); }
  }
  async function trySample() {
    setSampling(true);
    setTestResult(t("Voorbeeld wordt gemaakt… dit duurt zo'n 20 seconden.", "Creating an example… this takes about 20 seconds."));
    try {
      const res = await appFetch("/api/shopify/sample", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("Het voorbeeld kon niet worden gemaakt.", "The example could not be created."));
      router.push(embeddedPath(data.conversationId ? `/inbox/${data.conversationId}` : "/inbox"));
    } catch (e) { setTestResult(e instanceof Error ? e.message : t("Het voorbeeld kon niet worden gemaakt.", "The example could not be created.")); }
    finally { setSampling(false); }
  }
  async function syncOrders() {
    setSyncing(true);
    setTestResult(t("Bestellingen ophalen…", "Fetching orders…"));
    try {
      const res = await appFetch("/api/shopify/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("Synchroniseren is niet gelukt.", "Sync failed."));
      setTestResult(t(`${data.synced} recente bestellingen bijgewerkt.`, `${data.synced} recent orders updated.`));
    } catch (e) { setTestResult(e instanceof Error ? e.message : t("Synchroniseren is niet gelukt.", "Sync failed.")); }
    finally { setSyncing(false); }
  }
  const row = (ok: boolean | null, title: string, detail: string, action?: React.ReactNode) => <div style={{ display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "space-between", padding: "12px 0", borderTop: "1px solid var(--border)" }}>
    <div style={{ display: "flex", gap: 10 }}><span aria-hidden style={{ width: 10, height: 10, marginTop: 6, borderRadius: 999, background: ok ? "#9fd34a" : ok === null ? "var(--border)" : "#d69e00", flex: "none" }} /><div><strong style={{ fontSize: 14 }}>{title}</strong><p style={{ ...muted, marginTop: 2 }}>{detail}</p></div></div>
    {action}
  </div>;
  const mailboxReady = mailbox ? mailbox.inbound && mailbox.outbound : null;
  const orderReady = order === null ? null : order.tested && !order.lastError;
  return <section style={{ ...card, marginBottom: 24 }} aria-label={t("Inrichting", "Setup")}>
    <strong>{t("Inrichting", "Setup")}</strong>
    <div style={{ marginTop: 10 }}>
      {row(true, t("Shopify verbonden", "Shopify connected"), t("Support One leest je bestellingen. Er wordt niets in je winkel aangepast.", "Support One reads your orders. Nothing in your store is changed."))}
      {row(mailboxReady, t("Supportmailbox verbonden", "Support mailbox connected"), mailbox === null ? t("Status laden…", "Loading status…") : mailboxReady ? t("Klantmails komen binnen en antwoorden gaan via je eigen adres.", "Customer emails come in and replies go out from your own address.") : t("Koppel het mailadres waarop klanten je mailen. Zonder mailbox komen er geen klantvragen binnen.", "Connect the address customers email. Without a mailbox no customer questions come in."), isAdmin && !mailboxReady ? <AppLink href="/integrations" style={{ ...button, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>{t("Mailbox koppelen", "Connect mailbox")}</AppLink> : undefined)}
      {row(orderReady, t("Bestelcontext", "Order context"), order === null ? t("Status laden…", "Loading status…") : orderReady ? t("Getest en actief: bij een klantvraag zoekt Support One de juiste bestelling erbij.", "Tested and active: Support One finds the right order for each customer question.") : order.lastError ?? t("Test of Support One een bestelling kan vinden voordat je erop vertrouwt.", "Test that Support One can find an order before you rely on it."), isAdmin ? <button type="button" style={button} disabled={testing} onClick={() => void runTest()}>{testing ? t("Testen…", "Testing…") : t("Test bestelcontext", "Test order context")}</button> : undefined)}
      {row(null, t("Probeer een voorbeeld", "Try an example"), t("Maak een voorbeeldvraag over je laatste bestelling en zie direct het antwoordconcept, ook zonder mailbox.", "Create a sample question about your latest order and see the draft reply right away, even without a mailbox."), <button type="button" style={primary} disabled={sampling} onClick={() => void trySample()}>{sampling ? t("Bezig…", "Working…") : t("Voorbeeld maken", "Create example")}</button>)}
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginTop: 8 }}>
      {isAdmin ? <button type="button" style={button} disabled={syncing} onClick={() => void syncOrders()}>{syncing ? t("Bezig…", "Working…") : t("Recente bestellingen ophalen", "Fetch recent orders")}</button> : null}
      <span role="status" style={{ ...muted, marginTop: 0 }}>{testResult}</span>
    </div>
  </section>;
}

/** Email signature: added under every reply. Only this field, not the rest of the agent config. */
function SignatureCard({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useText();
  const [signature, setSignature] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => {
    appFetch("/api/agent-config", { cache: "no-store" }).then((res) => res.ok ? res.json() : null)
      .then((data) => { setSignature(data?.config?.signature ?? ""); setLoaded(true); }).catch(() => setLoaded(true));
  }, []);
  async function save() {
    setSaving(true);
    setStatus("");
    try {
      const res = await appFetch("/api/agent-config/signature", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signature }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("Opslaan is niet gelukt.", "Saving failed."));
      setStatus(t("Handtekening opgeslagen.", "Signature saved."));
    } catch (e) { setStatus(e instanceof Error ? e.message : t("Opslaan is niet gelukt.", "Saving failed.")); }
    finally { setSaving(false); }
  }
  return <section id="signature" style={{ ...card, display: "grid", gap: 10, marginBottom: 24, scrollMarginTop: 24 }} aria-label={t("Handtekening", "Signature")}>
    <strong>{t("Handtekening", "Email signature")}</strong>
    <p style={{ ...muted, marginTop: 0 }}>{t("Komt onder elk antwoord dat Support One verstuurt, bijvoorbeeld je naam en winkelnaam.", "Added under every reply Support One sends, for example your name and store name.")}</p>
    <textarea value={signature} onChange={(event) => setSignature(event.target.value)} disabled={!isAdmin || !loaded} rows={4} maxLength={1000}
      placeholder={t("Met vriendelijke groet,\nTeam klantenservice", "Kind regards,\nThe customer service team")}
      style={{ width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", font: "14px/1.5 inherit", resize: "vertical" }} />
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      {isAdmin ? <button type="button" style={primary} disabled={saving || !signature.trim()} onClick={() => void save()}>{saving ? t("Opslaan…", "Saving…") : t("Handtekening opslaan", "Save signature")}</button> : <span style={{ ...muted, marginTop: 0 }}>{t("Alleen de winkeleigenaar kan dit aanpassen.", "Only the store owner can change this.")}</span>}
      <span role="status" style={{ ...muted, marginTop: 0 }}>{status}</span>
    </div>
  </section>;
}

/** Plan and usage; changes happen in Shopify (Stripe is never shown inside Shopify). */
function ShopifyBilling({ shop, appHandle, isAdmin }: { shop: string; appHandle: string; isAdmin: boolean }) {
  const { t, language } = useText();
  const [usage, setUsage] = useState<{ plan: string; used: number; limit: number | null; trialEndsAt: string | null } | null>(null);
  useEffect(() => {
    appFetch("/api/billing/usage", { cache: "no-store" }).then((res) => res.ok ? res.json() : null).then(setUsage).catch(() => setUsage(null));
  }, []);
  const names: Record<string, string> = { trial: t("Proefperiode", "Trial"), starter: "Starter", pro: "Growth", agency: "Scale", expired: t("Geen actief abonnement", "No active plan"), custom: t("Maatwerk", "Custom") };
  const url = pricingUrl(shop, appHandle);
  return <section style={{ ...card, display: "grid", gap: 10, maxWidth: 640 }}>
    <strong>{t("Abonnement", "Plan")}</strong>
    {usage ? <>
      <p style={{ margin: 0, fontSize: 22 }}>{names[usage.plan] ?? usage.plan}</p>
      <p style={{ ...muted, marginTop: 0 }}>{t(`${usage.used} van ${usage.limit ?? "onbeperkt"} antwoordconcepten deze periode`, `${usage.used} of ${usage.limit ?? "unlimited"} draft replies this period`)}{usage.trialEndsAt ? ` · ${t("proefperiode tot", "trial until")} ${new Date(usage.trialEndsAt).toLocaleDateString(language === "nl" ? "nl-NL" : "en-GB")}` : ""}.</p>
    </> : <p style={muted}>{t("Abonnement laden…", "Loading plan…")}</p>}
    <p style={{ ...muted, marginTop: 0 }}>{t("Je abonnement loopt via Shopify en staat op je Shopify-factuur.", "Your plan is billed through Shopify, on your Shopify invoice.")}</p>
    {isAdmin && url ? <div><a href={url} target="_top" style={{ ...primary, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>{t("Abonnement kiezen of wijzigen", "Choose or change plan")}</a></div> : null}
  </section>;
}

/**
 * Without an active Shopify plan no drafts are written. Shopify requires apps
 * with managed pricing to send the merchant to plan selection: the owner is
 * redirected once per session, with this notice as the fallback.
 */
function PlanRequired({ shop, appHandle, isAdmin }: { shop: string; appHandle: string; isAdmin: boolean }) {
  const { t } = useText();
  const [expired, setExpired] = useState(false);
  const url = pricingUrl(shop, appHandle);
  useEffect(() => {
    appFetch("/api/billing/usage", { cache: "no-store" })
      .then((res) => res.ok ? res.json() : null)
      .then((usage) => {
        const isExpired = usage?.plan === "expired";
        setExpired(isExpired);
        if (isExpired && isAdmin && url) {
          let alreadyRedirected = false;
          try { alreadyRedirected = sessionStorage.getItem("sf_plan_redirect") === "1"; sessionStorage.setItem("sf_plan_redirect", "1"); } catch { /* storage blocked */ }
          if (!alreadyRedirected) window.open(url, "_top");
        }
      })
      .catch(() => setExpired(false));
  }, [isAdmin, url]);
  if (!expired) return null;
  return <section role="alert" style={{ ...card, borderColor: "rgba(214,158,0,.4)", background: "rgba(214,158,0,.08)", marginBottom: 24, display: "grid", gap: 10 }}>
    <strong>{t("Kies een abonnement om te starten", "Choose a plan to get started")}</strong>
    <p style={{ ...muted, marginTop: 0 }}>{t("Zonder actief abonnement schrijft Support One geen antwoordconcepten. Elk abonnement begint met 14 dagen gratis.", "Without an active plan Support One writes no draft replies. Every plan starts with a 14-day free trial.")}</p>
    {isAdmin && url ? <div><a href={url} target="_top" style={{ ...primary, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>{t("Abonnement kiezen", "Choose a plan")}</a></div>
      : <p style={{ ...muted, marginTop: 0 }}>{t("Vraag de winkeleigenaar een abonnement te kiezen.", "Ask the store owner to choose a plan.")}</p>}
  </section>;
}

/** Inside Shopify the upgrade prompt points to Shopify's own plan page. */
function ShopifyUpgradePrompt({ shop, appHandle }: { shop: string; appHandle: string }) {
  const { t } = useText();
  const { state, close } = useUpgradeModal();
  if (!state.isOpen) return null;
  const url = pricingUrl(shop, appHandle);
  return <div role="dialog" aria-modal="true" aria-labelledby="sf-upgrade-title" style={{ position: "fixed", inset: 0, zIndex: 50, display: "grid", placeItems: "center", background: "rgba(0,0,0,.6)", padding: 16 }}>
    <div style={{ ...card, maxWidth: 440, display: "grid", gap: 12 }}>
      <strong id="sf-upgrade-title">{t("Kies een groter pakket", "Choose a bigger plan")}</strong>
      <p style={{ ...muted, marginTop: 0 }}>{t("Je pakket laat dit niet meer toe. Kies in Shopify een pakket dat past; je betaalt via je Shopify-factuur.", "Your plan doesn't allow this. Choose a plan in Shopify; you pay through your Shopify invoice.")}</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {url ? <a href={url} target="_top" style={{ ...primary, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>{t("Naar pakketten in Shopify", "Go to plans in Shopify")}</a> : null}
        {state.forced ? null : <button type="button" style={button} onClick={close}>{t("Sluiten", "Close")}</button>}
      </div>
    </div>
  </div>;
}

function EmbeddedShell({ path, appHandle }: { path: string[]; appHandle: string }) {
  const { t } = useText();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const ticketParams = useMemo(() => Promise.resolve({ id: path[1] ?? "" }), [path]);
  const connect = useCallback(async () => {
    setError("");
    try {
      const res = await appFetch("/api/shopify/session", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Shopify connection failed.");
      setSession(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Shopify connection failed."); }
  }, []);
  // App Bridge is loaded by a blocking script in the page; wait until it is ready.
  useEffect(() => {
    let cancelled = false;
    const started = Date.now();
    const tryConnect = () => {
      if (cancelled) return;
      if (window.shopify) { void connect(); return; }
      if (Date.now() - started > 8000) { setError("Shopify App Bridge could not load. Please reopen the app from Shopify."); return; }
      window.setTimeout(tryConnect, 100);
    };
    tryConnect();
    return () => { cancelled = true; };
  }, [connect]);
  const page = path[0] ?? "dashboard";
  const isAdmin = session?.role === "admin";
  return <UpgradeModalProvider>
    <main style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", padding: "24px clamp(16px,4vw,56px)" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 14, borderBottom: "1px solid var(--border)", paddingBottom: 20, marginBottom: 28 }}>
        <SequenceMark size={48} state={!session ? "thinking" : "idle"} />
        <div><strong>Support One</strong><div style={{ color: "var(--muted)", fontSize: 13 }}>{session?.shop ?? t("Verbinden met Shopify…", "Connecting to Shopify…")}</div></div>
      </header>
      {error ? <div role="alert"><p>{error}</p><button style={button} onClick={connect}>{t("Opnieuw proberen", "Try again")}</button></div>
        : !session ? <p role="status">{t("Je werkruimte wordt veilig geopend…", "Opening your workspace securely…")}</p>
        : !session.linked ? (isAdmin
          ? <WorkspaceChoice onDone={(mode) => { if (mode === "new") router.push(embeddedPath("/dashboard")); void connect(); }} />
          : <p>{t("De winkeleigenaar richt Support One eerst in. Daarna kun je hier aan de slag.", "The store owner sets up Support One first. After that you can get started here.")}</p>)
        : <>
        <ShopifyUpgradePrompt shop={session.shop} appHandle={appHandle} />
        <PlanRequired shop={session.shop} appHandle={appHandle} isAdmin={isAdmin} />
        <nav aria-label={t("Hoofdnavigatie", "Main navigation")} style={{ display: "flex", flexWrap: "wrap", gap: 24, marginBottom: 28 }}>
          <AppLink href="/dashboard">{t("Overzicht", "Overview")}</AppLink><AppLink href="/inbox">Inbox</AppLink>
          <AppLink href="/knowledge">{t("Jouw kennis", "Knowledge")}</AppLink><AppLink href="/agent-profile">{t("Antwoordstijl", "Answer style")}</AppLink>
          {isAdmin && <AppLink href="/integrations">Mailbox</AppLink>}
          <AppLink href="/settings">{t("Abonnement", "Plan")}</AppLink>
        </nav>
        {page === "dashboard" && <SetupStatus isAdmin={isAdmin} />}
        {page === "dashboard" ? <Dashboard /> : page === "inbox" ? (path[1] ? <Ticket params={ticketParams} /> : <Inbox />)
          : page === "knowledge" ? <Knowledge isAdmin={isAdmin} />
          : page === "agent-profile" ? <><SignatureCard isAdmin={isAdmin} /><AnswerStyle /></>
          : page === "integrations" && isAdmin ? <div style={{ display: "grid", gap: 16 }}>
            <div style={{ ...card, display: "grid", gap: 4 }}>
              <strong>{t("Stap 1: koppel je supportmailbox", "Step 1: connect your support mailbox")}</strong>
              <p style={{ ...muted, marginTop: 0 }}>{t("Kies het mailadres waarop klanten je mailen, bijvoorbeeld je Gmail. Support One leest nieuwe klantvragen en schrijft een concept; je originele mail blijft gewoon staan.", "Choose the address customers email, for example your Gmail. Support One reads new customer questions and drafts a reply; your original email stays where it is.")} <AppLink href="/knowledge">{t("Daarna: voeg je kennis toe →", "Next: add your knowledge →")}</AppLink></p>
            </div>
            <SupportMailboxSettings />
          </div>
          : page === "settings" || page === "upgrade" ? <>
            <ShopifyBilling shop={session.shop} appHandle={appHandle} isAdmin={isAdmin} />
            {isAdmin && page === "settings" ? <WorkspaceAccountCard origin={session.origin ?? null} onMoved={() => { router.push(embeddedPath("/dashboard")); void connect(); }} /> : null}
          </>
          : <p>{t("Dit onderdeel is niet beschikbaar in Shopify.", "This section is not available in Shopify.")} <AppLink href="/dashboard">{t("Terug naar overzicht", "Back to overview")}</AppLink></p>}
      </>}
    </main>
  </UpgradeModalProvider>;
}

export default function EmbeddedSupport({ path, appHandle, language }: { path: string[]; appHandle: string; language: Language }) {
  return <LanguageProvider forcedLanguage={language}>
    <EmbeddedShell path={path} appHandle={appHandle} />
  </LanguageProvider>;
}
