"use client";

import { ChevronDown, Pause, RefreshCw, Save, Settings2, ShieldCheck, Unplug, Webhook } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

import { useTranslation } from "@/lib/i18n/LanguageProvider";
import {
  ApprovalSwitch,
  CommerceMetric,
  FeedbackNotice,
  StatusPill,
  commerceButtonStyle,
  commerceInputStyle,
  type CommerceFeedback,
} from "./CommerceIntegrationUi";

type ConnectionState = {
  shopDomain: string;
  clientId: string;
  status: "test_required" | "active" | "paused" | "failed";
  scopes: string[];
  actionMode: "disabled" | "approval_required";
  maxCancelAmount: number;
  shopCurrency: string | null;
  hasSecret: boolean;
  displayName: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
};

function formatTimestamp(value: string | null, language: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function ShopifySettings() {
  const { language } = useTranslation();
  const nl = language === "nl";
  const [connection, setConnection] = useState<ConnectionState | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [shopDomain, setShopDomain] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [maxAmount, setMaxAmount] = useState("250");
  const [merchantOwnedConfirmed, setMerchantOwnedConfirmed] = useState(false);
  const [scopesConfirmed, setScopesConfirmed] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<CommerceFeedback | null>(null);

  const labels = nl ? {
    description: "Live ordercontext en gecontroleerde annuleringen.",
    connected: "Verbonden",
    paused: "Gepauzeerd",
    failed: "Actie nodig",
    setup: "Instellen",
    store: "Webshop",
    lastSync: "Laatste synchronisatie",
    never: "Nog niet uitgevoerd",
    syncDetail: "Recente 30 dagen",
    liveUpdates: "Live updates",
    webhooksActive: "Webhooks actief",
    webhooksPaused: "Tijdelijk gestopt",
    policy: "Annuleringsbeleid",
    approvalOn: "Goedkeuring vereist",
    approvalOff: "Uitgeschakeld",
    sync: "Orders synchroniseren",
    syncing: "Synchroniseren...",
    manage: "Beheren",
    hideManage: "Beheer sluiten",
    syncTitle: "Orders zijn bijgewerkt",
    synced: (count: number) => count === 1 ? "1 recente order is gecontroleerd." : `${count} recente orders zijn gecontroleerd.`,
    approvalTitle: "Annuleringen met goedkeuring",
    approvalDescription: "SequenceFlow mag een annulering voorstellen. Een admin moet altijd goedkeuren voordat Shopify iets uitvoert.",
    max: "Maximumbedrag",
    saveLimit: "Limiet opslaan",
    policyEnabled: "Approval-acties ingeschakeld",
    policyEnabledText: "Annuleringen vereisen altijd expliciete goedkeuring van een admin.",
    policyDisabled: "Approval-acties uitgeschakeld",
    policyDisabledText: "SequenceFlow voert geen Shopify-annuleringen uit.",
    limitSaved: "Limiet opgeslagen",
    limitText: (currency: string, amount: string) => `Orders boven ${currency} ${amount} worden geblokkeerd.`,
    connectionSettings: "Verbindingsgegevens",
    connectionDescription: "Pas credentials alleen aan als de Shopify-app is gewijzigd.",
    setupTitle: "Shopify koppelen",
    setupDescription: "Voer de gegevens van de merchant-owned Shopify-app in. Secrets blijven versleuteld op de server.",
    openDashboard: "Open Shopify Dev Dashboard",
    shopDomain: "Shopdomein",
    clientId: "Client ID",
    secret: connection?.hasSecret ? "Client secret vervangen" : "Client secret",
    merchantConfirm: "Deze app is eigendom van de merchant en alleen op deze shop geïnstalleerd.",
    scopesConfirm: "De app gebruikt alleen orderrechten en webhookversie 2026-07.",
    save: "Gegevens opslaan",
    saving: "Opslaan...",
    savedTitle: "Gegevens opgeslagen",
    savedText: "Test de verbinding om Shopify te activeren.",
    test: "Verbinding testen",
    testing: "Verbinding testen...",
    testedTitle: "Verbinding werkt",
    testedText: "Shopify en de webhooks zijn actief.",
    pause: "Pauzeren",
    resume: "Hervatten",
    disconnect: "Ontkoppelen",
    closeNotice: "Melding sluiten",
    errorTitle: "Actie niet voltooid",
  } : {
    description: "Live order context and controlled cancellations.",
    connected: "Connected",
    paused: "Paused",
    failed: "Action needed",
    setup: "Set up",
    store: "Store",
    lastSync: "Last synchronization",
    never: "Not run yet",
    syncDetail: "Recent 30 days",
    liveUpdates: "Live updates",
    webhooksActive: "Webhooks active",
    webhooksPaused: "Temporarily stopped",
    policy: "Cancellation policy",
    approvalOn: "Approval required",
    approvalOff: "Disabled",
    sync: "Sync orders",
    syncing: "Synchronizing...",
    manage: "Manage",
    hideManage: "Close management",
    syncTitle: "Orders are up to date",
    synced: (count: number) => count === 1 ? "1 recent order was checked." : `${count} recent orders were checked.`,
    approvalTitle: "Cancellations with approval",
    approvalDescription: "SequenceFlow may propose a cancellation. An admin must always approve before Shopify executes anything.",
    max: "Maximum amount",
    saveLimit: "Save limit",
    policyEnabled: "Approval actions enabled",
    policyEnabledText: "Cancellations always require explicit admin approval.",
    policyDisabled: "Approval actions disabled",
    policyDisabledText: "SequenceFlow won't execute Shopify cancellations.",
    limitSaved: "Limit saved",
    limitText: (currency: string, amount: string) => `Orders over ${currency} ${amount} will be blocked.`,
    connectionSettings: "Connection details",
    connectionDescription: "Only change credentials when the Shopify app has changed.",
    setupTitle: "Connect Shopify",
    setupDescription: "Enter the merchant-owned Shopify app details. Secrets stay encrypted on the server.",
    openDashboard: "Open Shopify Dev Dashboard",
    shopDomain: "Shop domain",
    clientId: "Client ID",
    secret: connection?.hasSecret ? "Replace client secret" : "Client secret",
    merchantConfirm: "This app is owned by the merchant and installed only on this shop.",
    scopesConfirm: "The app only uses order scopes and webhook version 2026-07.",
    save: "Save details",
    saving: "Saving...",
    savedTitle: "Details saved",
    savedText: "Test the connection to activate Shopify.",
    test: "Test connection",
    testing: "Testing connection...",
    testedTitle: "Connection works",
    testedText: "Shopify and its webhooks are active.",
    pause: "Pause",
    resume: "Resume",
    disconnect: "Disconnect",
    closeNotice: "Dismiss notification",
    errorTitle: "Action not completed",
  };

  const load = useCallback(async () => {
    const response = await fetch("/api/integrations/shopify", { cache: "no-store" });
    if (!response.ok) return setAuthorized(false);
    const data = await response.json();
    const next = data.connection as ConnectionState | null;
    setAuthorized(true);
    setConnection(next);
    if (next) {
      setShopDomain(next.shopDomain);
      setClientId(next.clientId);
      setMaxAmount(String(next.maxCancelAmount));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  if (authorized !== true) return null;

  async function run(key: string, action: () => Promise<Response>, success: CommerceFeedback | ((data: Record<string, unknown>) => CommerceFeedback)) {
    setBusy(key);
    setNotice(null);
    try {
      const response = await action();
      const data = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (!response.ok) throw new Error(String(data.error || "Shopify action failed."));
      setNotice(typeof success === "function" ? success(data) : success);
      setClientSecret("");
      if (key === "save") {
        setMerchantOwnedConfirmed(false);
        setScopesConfirmed(false);
      }
      await load();
    } catch (error) {
      setNotice({ tone: "error", title: labels.errorTitle, text: error instanceof Error ? error.message : "Shopify action failed." });
    } finally {
      setBusy(null);
    }
  }

  const active = connection?.status === "active";
  const connectedState = active || connection?.status === "paused";
  const lastSync = formatTimestamp(connection?.lastSyncedAt ?? null, language);
  const controlsDisabled = Boolean(busy);
  const status = active
    ? { tone: "success" as const, label: labels.connected }
    : connection?.status === "paused"
      ? { tone: "warning" as const, label: labels.paused }
      : connection?.status === "failed"
        ? { tone: "error" as const, label: labels.failed }
        : { tone: "neutral" as const, label: labels.setup };

  const connectionForm = (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 11 }}>
        <label style={{ display: "grid", gap: 6, color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>{labels.shopDomain}<input value={shopDomain} onChange={(event) => setShopDomain(event.target.value)} placeholder="store.myshopify.com" autoComplete="off" style={commerceInputStyle} /></label>
        <label style={{ display: "grid", gap: 6, color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>{labels.clientId}<input value={clientId} onChange={(event) => setClientId(event.target.value)} autoComplete="off" style={commerceInputStyle} /></label>
        <label style={{ display: "grid", gap: 6, color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>{labels.secret}<input type="password" value={clientSecret} onChange={(event) => setClientSecret(event.target.value)} placeholder={connection?.hasSecret ? "••••••••" : ""} autoComplete="new-password" style={commerceInputStyle} /></label>
      </div>
      <div style={{ display: "grid", gap: 7 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "var(--text)", fontSize: 11, lineHeight: 1.5, cursor: "pointer" }}><input type="checkbox" checked={merchantOwnedConfirmed} onChange={(event) => setMerchantOwnedConfirmed(event.target.checked)} style={{ marginTop: 2 }} />{labels.merchantConfirm}</label>
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "var(--text)", fontSize: 11, lineHeight: 1.5, cursor: "pointer" }}><input type="checkbox" checked={scopesConfirmed} onChange={(event) => setScopesConfirmed(event.target.checked)} style={{ marginTop: 2 }} />{labels.scopesConfirm}</label>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button disabled={controlsDisabled || !merchantOwnedConfirmed || !scopesConfirmed} style={{ ...commerceButtonStyle, background: "#C7F56F", borderColor: "#C7F56F", color: "#172300", opacity: controlsDisabled || !merchantOwnedConfirmed || !scopesConfirmed ? 0.5 : 1 }} onClick={() => run("save", () => fetch("/api/integrations/shopify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shopDomain, clientId, clientSecret, confirmMerchantOwnedApp: merchantOwnedConfirmed, confirmScopes: scopesConfirmed }) }), { tone: "success", title: labels.savedTitle, text: labels.savedText })}><Save size={14} />{busy === "save" ? labels.saving : labels.save}</button>
        {connection ? <button disabled={controlsDisabled} style={commerceButtonStyle} onClick={() => run("test", () => fetch("/api/integrations/shopify/test", { method: "POST" }), { tone: "success", title: labels.testedTitle, text: labels.testedText })}><ShieldCheck size={14} />{busy === "test" ? labels.testing : labels.test}</button> : null}
      </div>
    </div>
  );

  return (
    <section style={{ border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", overflow: "hidden" }}>
      <style>{`@keyframes commerce-spin{to{transform:rotate(360deg)}} @media(max-width:680px){.commerce-metrics{grid-template-columns:1fr!important}.commerce-metric-cell{border-left:0!important;border-top:1px solid var(--border);padding:12px 0!important}.commerce-metric-cell:first-child{border-top:0!important}} @media(max-width:520px){.commerce-provider-description{display:none!important}}`}</style>
      <header style={{ padding: "15px 17px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13, minWidth: 0 }}>
          <div style={{ width: 104, flexShrink: 0 }}><Image src="/integrations/shopify-logo.svg" alt="Shopify" width={88} height={25} /></div>
          <p className="commerce-provider-description" style={{ margin: 0, color: "var(--muted)", fontSize: 11, lineHeight: 1.45 }}>{labels.description}</p>
        </div>
        <StatusPill tone={status.tone} label={status.label} />
      </header>

      <div style={{ padding: "16px 17px", display: "grid", gap: 16 }}>
        {connectedState ? (
          <>
            <div className="commerce-metrics" style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr", borderBottom: "1px solid var(--border)", paddingBottom: 14 }}>
              <div className="commerce-metric-cell"><CommerceMetric label={labels.store} value={connection?.displayName || connection?.shopDomain || "Shopify"} detail={connection?.shopDomain} /></div>
              <div className="commerce-metric-cell" style={{ borderLeft: "1px solid var(--border)", paddingLeft: 16 }}><CommerceMetric label={labels.lastSync} value={lastSync || labels.never} detail={labels.syncDetail} icon={<RefreshCw size={12} />} /></div>
              <div className="commerce-metric-cell" style={{ borderLeft: "1px solid var(--border)", paddingLeft: 16 }}><CommerceMetric label={labels.liveUpdates} value={active ? labels.webhooksActive : labels.webhooksPaused} detail={connection?.scopes.join(" · ")} icon={<Webhook size={12} />} /></div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <button disabled={controlsDisabled || !active} style={{ ...commerceButtonStyle, background: active ? "#C7F56F" : "var(--surface-subtle)", borderColor: active ? "#C7F56F" : "var(--border)", color: active ? "#172300" : "var(--muted)", opacity: controlsDisabled || !active ? 0.58 : 1 }} onClick={() => run("sync", () => fetch("/api/integrations/shopify/sync", { method: "POST" }), (data) => ({ tone: "success", title: labels.syncTitle, text: labels.synced(Number(data.processed ?? 0)), detail: formatTimestamp(typeof data.syncedAt === "string" ? data.syncedAt : null, language) }))}><RefreshCw size={14} style={busy === "sync" ? { animation: "commerce-spin .8s linear infinite" } : undefined} />{busy === "sync" ? labels.syncing : labels.sync}</button>
              <button style={commerceButtonStyle} onClick={() => setManageOpen((open) => !open)}><Settings2 size={14} />{manageOpen ? labels.hideManage : labels.manage}<ChevronDown size={13} style={{ transform: manageOpen ? "rotate(180deg)" : "none", transition: "transform 140ms ease" }} /></button>
            </div>

            {notice ? <FeedbackNotice notice={notice} closeLabel={labels.closeNotice} onClose={() => setNotice(null)} /> : null}

            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 15, display: "grid", gap: 13 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
                <div><p style={{ margin: 0, color: "var(--text)", fontSize: 13, fontWeight: 800 }}>{labels.approvalTitle}</p><p style={{ margin: "3px 0 0", maxWidth: 520, color: "var(--muted)", fontSize: 11, lineHeight: 1.55 }}>{labels.approvalDescription}</p></div>
                <ApprovalSwitch checked={connection?.actionMode === "approval_required"} disabled={controlsDisabled || !active} label={labels.approvalTitle} onChange={() => run("policy", () => fetch("/api/integrations/shopify", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actionMode: connection?.actionMode === "approval_required" ? "disabled" : "approval_required" }) }), connection?.actionMode === "approval_required" ? { tone: "success", title: labels.policyDisabled, text: labels.policyDisabledText } : { tone: "success", title: labels.policyEnabled, text: labels.policyEnabledText })} />
              </div>
              {connection?.actionMode === "approval_required" ? <div style={{ display: "flex", alignItems: "end", gap: 8, flexWrap: "wrap" }}><label style={{ display: "grid", gap: 6, width: 190, color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>{labels.max} ({connection.shopCurrency ?? "EUR"})<input inputMode="decimal" value={maxAmount} onChange={(event) => setMaxAmount(event.target.value)} style={commerceInputStyle} /></label><button disabled={controlsDisabled} style={commerceButtonStyle} onClick={() => run("limit", () => fetch("/api/integrations/shopify", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ maxCancelAmount: Number(maxAmount) }) }), { tone: "success", title: labels.limitSaved, text: labels.limitText(connection.shopCurrency ?? "EUR", maxAmount) })}><Save size={14} />{labels.saveLimit}</button></div> : null}
            </div>

            {manageOpen ? <div style={{ borderTop: "1px solid var(--border)", paddingTop: 15, display: "grid", gap: 14 }}><div><p style={{ margin: 0, fontSize: 12, fontWeight: 800 }}>{labels.connectionSettings}</p><p style={{ margin: "3px 0 0", color: "var(--muted)", fontSize: 11 }}>{labels.connectionDescription}</p></div>{connectionForm}<div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 13 }}><button disabled={controlsDisabled} style={commerceButtonStyle} onClick={() => run(connection?.status === "paused" ? "resume" : "pause", () => fetch("/api/integrations/shopify", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: connection?.status === "paused" ? "active" : "paused" }) }), { tone: "success", title: connection?.status === "paused" ? labels.resume : labels.pause, text: connection?.status === "paused" ? labels.webhooksActive : labels.webhooksPaused })}><Pause size={14} />{connection?.status === "paused" ? labels.resume : labels.pause}</button><button disabled={controlsDisabled} style={{ ...commerceButtonStyle, marginLeft: "auto", color: "#dc2626" }} onClick={() => { if (window.confirm(nl ? "Shopify ontkoppelen? De live koppeling en orderdata worden verwijderd." : "Disconnect Shopify? The live connection and order data will be removed.")) void run("delete", () => fetch("/api/integrations/shopify", { method: "DELETE" }), { tone: "success", title: labels.disconnect, text: nl ? "Shopify is veilig ontkoppeld." : "Shopify was safely disconnected." }); }}><Unplug size={14} />{labels.disconnect}</button></div></div> : null}
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}><div><p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>{labels.setupTitle}</p><p style={{ margin: "4px 0 0", maxWidth: 530, color: "var(--muted)", fontSize: 11, lineHeight: 1.55 }}>{labels.setupDescription}</p></div><a href="https://dev.shopify.com/dashboard" target="_blank" rel="noreferrer" style={{ color: "var(--text)", fontSize: 11, fontWeight: 750, textUnderlineOffset: 3 }}>{labels.openDashboard}</a></div>
            {connectionForm}
            {connection?.lastError ? <FeedbackNotice notice={{ tone: "error", title: labels.errorTitle, text: connection.lastError }} closeLabel={labels.closeNotice} onClose={() => setNotice(null)} /> : notice ? <FeedbackNotice notice={notice} closeLabel={labels.closeNotice} onClose={() => setNotice(null)} /> : null}
          </>
        )}
      </div>
    </section>
  );
}
