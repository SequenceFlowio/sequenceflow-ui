"use client";

import { BookOpen, ChevronDown, ExternalLink, Pause, RefreshCw, Save, Settings2, ShieldCheck, Unplug, Webhook } from "lucide-react";
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
import WooCommerceSetupGuide from "./WooCommerceSetupGuide";

type ConnectionState = {
  shopDomain: string;
  clientId: string;
  status: "test_required" | "active" | "paused" | "failed";
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

function getWooCommerceDashboardUrl(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const installationPath = url.pathname.replace(/\/$/, "");
    return `${url.origin}${installationPath}/wp-admin/admin.php?page=wc-settings&tab=advanced&section=keys`;
  } catch {
    return null;
  }
}

export default function WooCommerceSettings() {
  const { language } = useTranslation();
  const nl = language === "nl";
  const [connection, setConnection] = useState<ConnectionState | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [shopDomain, setShopDomain] = useState("");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [maxAmount, setMaxAmount] = useState("250");
  const [manageOpen, setManageOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<CommerceFeedback | null>(null);

  const labels = nl ? {
    description: "Live orders en gecontroleerde annuleringen.",
    connected: "Verbonden", paused: "Gepauzeerd", failed: "Actie nodig", setup: "Instellen",
    store: "Webshop", lastSync: "Laatste synchronisatie", never: "Nog niet uitgevoerd", syncDetail: "Recente 30 dagen",
    liveUpdates: "Live updates", webhooksActive: "Webhooks actief", webhooksPaused: "Tijdelijk gestopt",
    sync: "Orders synchroniseren", syncing: "Synchroniseren...", manage: "Beheren", hideManage: "Beheer sluiten",
    syncTitle: "Orders zijn bijgewerkt", synced: (count: number) => count === 1 ? "1 recente order is gecontroleerd." : `${count} recente orders zijn gecontroleerd.`,
    approvalTitle: "Annuleringen met goedkeuring", approvalDescription: "Refund, restock en annulering worden pas uitgevoerd nadat een admin expliciet goedkeurt.",
    max: "Maximumbedrag", saveLimit: "Limiet opslaan", limitSaved: "Limiet opgeslagen",
    policyEnabled: "Approval-acties ingeschakeld", policyEnabledText: "Annuleringen vereisen altijd goedkeuring van een admin.",
    policyDisabled: "Approval-acties uitgeschakeld", policyDisabledText: "SequenceFlow voert geen WooCommerce-annuleringen uit.",
    connectionSettings: "Verbindingsgegevens", connectionDescription: "Pas de API-sleutels alleen aan wanneer ze zijn vervangen.",
    setupTitle: "WooCommerce koppelen", setupDescription: "Koppel je webshop om orders live te gebruiken in klantvragen en annuleringen veilig te laten goedkeuren.",
    openGuide: "Bekijk installatiehulp", openDashboard: "Open WooCommerce-beheer", dashboardHint: "Vul eerst een geldige HTTPS-webshop-URL in.",
    url: "Webshop URL", key: "Consumer key", secret: connection?.hasSecret ? "Consumer secret vervangen" : "Consumer secret",
    automaticCheck: "Automatische veiligheidscontrole", automaticCheckText: "SequenceFlow controleert de ordertoegang en maakt een beveiligde webhook aan. Daarmee wordt Read/Write-toegang bewezen zonder een order te wijzigen.",
    save: "Opslaan en controleren", saving: "Controleren...", savedTitle: "WooCommerce is gekoppeld", savedText: "Toegang, Read/Write-rechten en webhooks zijn gecontroleerd.",
    test: "Verbinding testen", testing: "Verbinding testen...", testedTitle: "Verbinding werkt", testedText: "WooCommerce en de webhooks zijn actief.",
    pause: "Pauzeren", resume: "Hervatten", disconnect: "Ontkoppelen", closeNotice: "Melding sluiten", errorTitle: "Actie niet voltooid",
  } : {
    description: "Live orders and controlled cancellations.",
    connected: "Connected", paused: "Paused", failed: "Action needed", setup: "Set up",
    store: "Store", lastSync: "Last synchronization", never: "Not run yet", syncDetail: "Recent 30 days",
    liveUpdates: "Live updates", webhooksActive: "Webhooks active", webhooksPaused: "Temporarily stopped",
    sync: "Sync orders", syncing: "Synchronizing...", manage: "Manage", hideManage: "Close management",
    syncTitle: "Orders are up to date", synced: (count: number) => count === 1 ? "1 recent order was checked." : `${count} recent orders were checked.`,
    approvalTitle: "Cancellations with approval", approvalDescription: "Refund, restock, and cancellation only run after explicit admin approval.",
    max: "Maximum amount", saveLimit: "Save limit", limitSaved: "Limit saved",
    policyEnabled: "Approval actions enabled", policyEnabledText: "Cancellations always require admin approval.",
    policyDisabled: "Approval actions disabled", policyDisabledText: "SequenceFlow won't execute WooCommerce cancellations.",
    connectionSettings: "Connection details", connectionDescription: "Only change the API keys when they have been replaced.",
    setupTitle: "Connect WooCommerce", setupDescription: "Connect your store to use live orders in customer conversations and approve cancellations safely.",
    openGuide: "View setup guide", openDashboard: "Open WooCommerce admin", dashboardHint: "Enter a valid HTTPS store URL first.",
    url: "Store URL", key: "Consumer key", secret: connection?.hasSecret ? "Replace consumer secret" : "Consumer secret",
    automaticCheck: "Automatic security check", automaticCheckText: "SequenceFlow checks order access and creates a secure webhook. This proves Read/Write access without changing an order.",
    save: "Save and verify", saving: "Verifying...", savedTitle: "WooCommerce is connected", savedText: "Access, Read/Write permissions, and webhooks were verified.",
    test: "Test connection", testing: "Testing connection...", testedTitle: "Connection works", testedText: "WooCommerce and its webhooks are active.",
    pause: "Pause", resume: "Resume", disconnect: "Disconnect", closeNotice: "Dismiss notification", errorTitle: "Action not completed",
  };

  const load = useCallback(async () => {
    const response = await fetch("/api/integrations/woocommerce", { cache: "no-store" });
    if (!response.ok) return setAuthorized(false);
    const data = await response.json();
    const next = data.connection as ConnectionState | null;
    setAuthorized(true);
    setConnection(next);
    if (next) {
      setShopDomain(next.shopDomain);
      setConsumerKey(next.clientId);
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
      if (!response.ok) throw new Error(String(data.error || "WooCommerce action failed."));
      setNotice(typeof success === "function" ? success(data) : success);
      setConsumerSecret("");
      await load();
    } catch (error) {
      setNotice({ tone: "error", title: labels.errorTitle, text: error instanceof Error ? error.message : "WooCommerce action failed." });
      await load();
    } finally {
      setBusy(null);
    }
  }

  const active = connection?.status === "active";
  const connectedState = active || connection?.status === "paused";
  const lastSync = formatTimestamp(connection?.lastSyncedAt ?? null, language);
  const controlsDisabled = Boolean(busy);
  const dashboardUrl = getWooCommerceDashboardUrl(shopDomain);
  const status = active
    ? { tone: "success" as const, label: labels.connected }
    : connection?.status === "paused"
      ? { tone: "warning" as const, label: labels.paused }
      : connection?.status === "failed"
        ? { tone: "error" as const, label: labels.failed }
        : { tone: "neutral" as const, label: labels.setup };

  async function saveAndVerify() {
    const saved = await fetch("/api/integrations/woocommerce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopDomain, consumerKey, consumerSecret }),
    });
    if (!saved.ok) return saved;
    return fetch("/api/integrations/woocommerce/test", { method: "POST" });
  }

  const connectionForm = (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 11 }}>
        <label style={{ display: "grid", gap: 6, color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>{labels.url}<input value={shopDomain} onChange={(event) => setShopDomain(event.target.value)} placeholder="https://shop.nl" style={commerceInputStyle} /></label>
        <label style={{ display: "grid", gap: 6, color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>{labels.key}<input value={consumerKey} onChange={(event) => setConsumerKey(event.target.value)} placeholder="ck_..." style={commerceInputStyle} /></label>
        <label style={{ display: "grid", gap: 6, color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>{labels.secret}<input type="password" value={consumerSecret} onChange={(event) => setConsumerSecret(event.target.value)} placeholder={connection?.hasSecret ? "••••••••" : "cs_..."} style={commerceInputStyle} /></label>
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 12px", border: "1px solid #d4edaa", borderRadius: 8, background: "#f7fbea", color: "#527717" }}>
        <ShieldCheck size={17} style={{ flex: "none", marginTop: 1 }} />
        <div><strong style={{ display: "block", fontSize: 11 }}>{labels.automaticCheck}</strong><p style={{ margin: "2px 0 0", fontSize: 10, lineHeight: 1.5 }}>{labels.automaticCheckText}</p></div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button disabled={controlsDisabled} style={{ ...commerceButtonStyle, background: "#C7F56F", borderColor: "#C7F56F", color: "#172300", opacity: controlsDisabled ? 0.5 : 1 }} onClick={() => run("save", saveAndVerify, { tone: "success", title: labels.savedTitle, text: labels.savedText })}><ShieldCheck size={14} />{busy === "save" ? labels.saving : labels.save}</button>
        {connection ? <button disabled={controlsDisabled} style={commerceButtonStyle} onClick={() => run("test", () => fetch("/api/integrations/woocommerce/test", { method: "POST" }), { tone: "success", title: labels.testedTitle, text: labels.testedText })}><ShieldCheck size={14} />{busy === "test" ? labels.testing : labels.test}</button> : null}
      </div>
    </div>
  );

  return (
    <section style={{ border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", overflow: "hidden" }}>
      <style>{`@keyframes commerce-spin{to{transform:rotate(360deg)}} @media(max-width:680px){.commerce-metrics{grid-template-columns:1fr!important}.commerce-metric-cell{border-left:0!important;border-top:1px solid var(--border);padding:12px 0!important}.commerce-metric-cell:first-child{border-top:0!important}} @media(max-width:520px){.commerce-provider-description{display:none!important}}`}</style>
      <header style={{ padding: "15px 17px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13, minWidth: 0 }}><div style={{ width: 104, flexShrink: 0 }}><Image src="/integrations/woocommerce-logo.svg" alt="WooCommerce" width={77} height={20} /></div><p className="commerce-provider-description" style={{ margin: 0, color: "var(--muted)", fontSize: 11, lineHeight: 1.45 }}>{labels.description}</p></div>
        <StatusPill tone={status.tone} label={status.label} />
      </header>

      <div style={{ padding: "16px 17px", display: "grid", gap: 16 }}>
        {connectedState ? (
          <>
            <div className="commerce-metrics" style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr", borderBottom: "1px solid var(--border)", paddingBottom: 14 }}>
              <div className="commerce-metric-cell"><CommerceMetric label={labels.store} value={connection?.displayName || connection?.shopDomain || "WooCommerce"} detail={connection?.shopDomain} /></div>
              <div className="commerce-metric-cell" style={{ borderLeft: "1px solid var(--border)", paddingLeft: 16 }}><CommerceMetric label={labels.lastSync} value={lastSync || labels.never} detail={labels.syncDetail} icon={<RefreshCw size={12} />} /></div>
              <div className="commerce-metric-cell" style={{ borderLeft: "1px solid var(--border)", paddingLeft: 16 }}><CommerceMetric label={labels.liveUpdates} value={active ? labels.webhooksActive : labels.webhooksPaused} icon={<Webhook size={12} />} /></div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <button disabled={controlsDisabled || !active} style={{ ...commerceButtonStyle, background: active ? "#C7F56F" : "var(--surface-subtle)", borderColor: active ? "#C7F56F" : "var(--border)", color: active ? "#172300" : "var(--muted)", opacity: controlsDisabled || !active ? 0.58 : 1 }} onClick={() => run("sync", () => fetch("/api/integrations/woocommerce/sync", { method: "POST" }), (data) => ({ tone: "success", title: labels.syncTitle, text: labels.synced(Number(data.processed ?? 0)), detail: formatTimestamp(typeof data.syncedAt === "string" ? data.syncedAt : null, language) }))}><RefreshCw size={14} style={busy === "sync" ? { animation: "commerce-spin .8s linear infinite" } : undefined} />{busy === "sync" ? labels.syncing : labels.sync}</button>
              <button style={commerceButtonStyle} onClick={() => setManageOpen((open) => !open)}><Settings2 size={14} />{manageOpen ? labels.hideManage : labels.manage}<ChevronDown size={13} style={{ transform: manageOpen ? "rotate(180deg)" : "none", transition: "transform 140ms ease" }} /></button>
            </div>
            {notice ? <FeedbackNotice notice={notice} closeLabel={labels.closeNotice} onClose={() => setNotice(null)} /> : null}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 15, display: "grid", gap: 13 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}><div><p style={{ margin: 0, color: "var(--text)", fontSize: 13, fontWeight: 800 }}>{labels.approvalTitle}</p><p style={{ margin: "3px 0 0", maxWidth: 520, color: "var(--muted)", fontSize: 11, lineHeight: 1.55 }}>{labels.approvalDescription}</p></div><ApprovalSwitch checked={connection?.actionMode === "approval_required"} disabled={controlsDisabled || !active} label={labels.approvalTitle} onChange={() => run("policy", () => fetch("/api/integrations/woocommerce", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actionMode: connection?.actionMode === "approval_required" ? "disabled" : "approval_required" }) }), connection?.actionMode === "approval_required" ? { tone: "success", title: labels.policyDisabled, text: labels.policyDisabledText } : { tone: "success", title: labels.policyEnabled, text: labels.policyEnabledText })} /></div>
              {connection?.actionMode === "approval_required" ? <div style={{ display: "flex", alignItems: "end", gap: 8, flexWrap: "wrap" }}><label style={{ display: "grid", gap: 6, width: 190, color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>{labels.max} ({connection.shopCurrency ?? "EUR"})<input inputMode="decimal" value={maxAmount} onChange={(event) => setMaxAmount(event.target.value)} style={commerceInputStyle} /></label><button disabled={controlsDisabled} style={commerceButtonStyle} onClick={() => run("limit", () => fetch("/api/integrations/woocommerce", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ maxCancelAmount: Number(maxAmount) }) }), { tone: "success", title: labels.limitSaved, text: nl ? `Orders boven ${connection.shopCurrency ?? "EUR"} ${maxAmount} worden geblokkeerd.` : `Orders over ${connection.shopCurrency ?? "EUR"} ${maxAmount} will be blocked.` })}><Save size={14} />{labels.saveLimit}</button></div> : null}
            </div>
            {manageOpen ? <div style={{ borderTop: "1px solid var(--border)", paddingTop: 15, display: "grid", gap: 14 }}><div><p style={{ margin: 0, fontSize: 12, fontWeight: 800 }}>{labels.connectionSettings}</p><p style={{ margin: "3px 0 0", color: "var(--muted)", fontSize: 11 }}>{labels.connectionDescription}</p></div>{connectionForm}<div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 13 }}><button disabled={controlsDisabled} style={commerceButtonStyle} onClick={() => run(connection?.status === "paused" ? "resume" : "pause", () => fetch("/api/integrations/woocommerce", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: connection?.status === "paused" ? "active" : "paused" }) }), { tone: "success", title: connection?.status === "paused" ? labels.resume : labels.pause, text: connection?.status === "paused" ? labels.webhooksActive : labels.webhooksPaused })}><Pause size={14} />{connection?.status === "paused" ? labels.resume : labels.pause}</button><button disabled={controlsDisabled} style={{ ...commerceButtonStyle, marginLeft: "auto", color: "#dc2626" }} onClick={() => { if (window.confirm(nl ? "WooCommerce ontkoppelen? De live koppeling en orderdata worden verwijderd." : "Disconnect WooCommerce? The live connection and order data will be removed.")) void run("delete", () => fetch("/api/integrations/woocommerce", { method: "DELETE" }), { tone: "success", title: labels.disconnect, text: nl ? "WooCommerce is veilig ontkoppeld." : "WooCommerce was safely disconnected." }); }}><Unplug size={14} />{labels.disconnect}</button></div></div> : null}
          </>
        ) : (
          <>
            <div style={{ display: "grid", gap: 12 }}>
              <div><p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>{labels.setupTitle}</p><p style={{ margin: "4px 0 0", maxWidth: 560, color: "var(--muted)", fontSize: 11, lineHeight: 1.55 }}>{labels.setupDescription}</p></div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" style={{ ...commerceButtonStyle, background: "#f5faeb", borderColor: "#d7e8ba", color: "#527717" }} onClick={() => setGuideOpen(true)}><BookOpen size={14} />{labels.openGuide}</button>
                {dashboardUrl ? (
                  <a href={dashboardUrl} target="_blank" rel="noreferrer" style={{ ...commerceButtonStyle, textDecoration: "none" }}><ExternalLink size={14} />{labels.openDashboard}</a>
                ) : (
                  <button type="button" disabled title={labels.dashboardHint} style={{ ...commerceButtonStyle, opacity: 0.5, cursor: "not-allowed" }}><ExternalLink size={14} />{labels.openDashboard}</button>
                )}
              </div>
            </div>
            {connectionForm}
            {notice ? <FeedbackNotice notice={notice} closeLabel={labels.closeNotice} onClose={() => setNotice(null)} /> : connection?.lastError ? <FeedbackNotice notice={{ tone: "error", title: labels.errorTitle, text: connection.lastError }} closeLabel={labels.closeNotice} onClose={() => undefined} /> : null}
          </>
        )}
      </div>
      {guideOpen ? <WooCommerceSetupGuide language={language} open onClose={() => setGuideOpen(false)} /> : null}
    </section>
  );
}
