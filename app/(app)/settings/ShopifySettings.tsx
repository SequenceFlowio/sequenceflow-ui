"use client";

import { useCallback, useEffect, useState } from "react";

import { useTranslation } from "@/lib/i18n/LanguageProvider";

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

const field: React.CSSProperties = {
  width: "100%",
  minHeight: 44,
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  padding: "10px 12px",
  fontSize: 13,
};

const button: React.CSSProperties = {
  minHeight: 40,
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  padding: "0 14px",
  fontSize: 12,
  fontWeight: 750,
  cursor: "pointer",
};

function formatTimestamp(value: string | null, language: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ error?: boolean; text: string } | null>(null);

  const labels = nl ? {
    description: "Koppel een merchant-owned Shopify-app voor live orders en gecontroleerde annuleringen.",
    setupTitle: "Shopify-app voorbereiden",
    setupSteps: [
      "Maak in Shopify Dev Dashboard een app aan die eigendom is van de merchant en installeer die op de eigen shop.",
      "Stel Admin API en webhook API in op 2026-07 en geef exact read_orders en write_orders, zonder customer-, address- of all-orders-scope.",
      "Activeer bij Protected customer data alleen Orders en het veld Email, zodat afzenders veilig aan orders gekoppeld kunnen worden.",
    ],
    openDashboard: "Open Shopify Dev Dashboard",
    shopDomain: "Shopdomein",
    clientId: "Client ID",
    secret: connection?.hasSecret ? "Client secret vervangen" : "Client secret",
    merchantConfirm: "Deze app is eigendom van de merchant en alleen op deze shop geïnstalleerd.",
    scopesConfirm: "De app gebruikt exact read_orders en write_orders, webhookversie 2026-07 en alleen het beschermde e-mailveld.",
    save: "Opslaan",
    saved: "Opgeslagen. Test nu de verbinding.",
    test: "Verbinding testen",
    tested: "Shopify is actief en de webhooks zijn gekoppeld.",
    sync: "Orders synchroniseren",
    synced: (count: number) => `${count} recente orders gesynchroniseerd.`,
    approval: "Orderannulering met goedkeuring",
    approvalDescription: "Alleen admins kunnen goedkeuren. Direct voor uitvoering worden status, bedrag, fulfillment en scopes opnieuw gecontroleerd.",
    maximum: "Maximumbedrag",
    saveLimit: "Limiet opslaan",
    enable: "Approval-acties inschakelen",
    disable: "Approval-acties uitschakelen",
    pause: "Pauzeren",
    resume: "Hervatten",
    disconnect: "Ontkoppelen",
    notConnected: "Niet gekoppeld",
    lastSync: "Laatste sync",
    privacy: "Shopify-secrets en tokens blijven versleuteld op de server. Ruwe Shopify-responses worden niet opgeslagen.",
  } : {
    description: "Connect a merchant-owned Shopify app for live orders and controlled cancellations.",
    setupTitle: "Prepare the Shopify app",
    setupSteps: [
      "Create an app in Shopify Dev Dashboard that is owned by the merchant and install it on the merchant's own shop.",
      "Set the Admin API and webhook API to 2026-07 and grant exactly read_orders and write_orders, without customer, address, or all-orders scope.",
      "Under Protected customer data, enable only Orders and the Email field so senders can be matched to orders safely.",
    ],
    openDashboard: "Open Shopify Dev Dashboard",
    shopDomain: "Shop domain",
    clientId: "Client ID",
    secret: connection?.hasSecret ? "Replace client secret" : "Client secret",
    merchantConfirm: "This app is owned by the merchant and installed only on this shop.",
    scopesConfirm: "The app uses exactly read_orders and write_orders, webhook version 2026-07, and only the protected email field.",
    save: "Save",
    saved: "Saved. Test the connection now.",
    test: "Test connection",
    tested: "Shopify is active and webhooks are connected.",
    sync: "Sync orders",
    synced: (count: number) => `${count} recent orders synchronized.`,
    approval: "Order cancellation with approval",
    approvalDescription: "Only admins can approve. Status, amount, fulfillment, and scopes are rechecked immediately before execution.",
    maximum: "Maximum amount",
    saveLimit: "Save limit",
    enable: "Enable approval actions",
    disable: "Disable approval actions",
    pause: "Pause",
    resume: "Resume",
    disconnect: "Disconnect",
    notConnected: "Not connected",
    lastSync: "Last sync",
    privacy: "Shopify secrets and tokens remain encrypted on the server. Raw Shopify responses are not stored.",
  };

  const load = useCallback(async () => {
    const response = await fetch("/api/integrations/shopify", { cache: "no-store" });
    if (!response.ok) {
      setAuthorized(false);
      return;
    }
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

  useEffect(() => {
    void load();
  }, [load]);

  if (authorized !== true) return null;

  async function run(
    key: string,
    action: () => Promise<Response>,
    success: string | ((data: Record<string, unknown>) => string),
  ) {
    setBusy(key);
    setNotice(null);
    try {
      const response = await action();
      const data = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (!response.ok) throw new Error(String(data.error || "Shopify action failed."));
      setNotice({ text: typeof success === "function" ? success(data) : success });
      setClientSecret("");
      if (key === "save") {
        setMerchantOwnedConfirmed(false);
        setScopesConfirmed(false);
      }
      await load();
    } catch (error) {
      setNotice({ error: true, text: error instanceof Error ? error.message : "Shopify action failed." });
    } finally {
      setBusy(null);
    }
  }

  const statusLabel = connection?.status ?? labels.notConnected;
  const active = connection?.status === "active";
  const lastSync = formatTimestamp(connection?.lastSyncedAt ?? null, language);
  const controlsDisabled = Boolean(busy);

  return (
    <section style={{ border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", overflow: "hidden" }}>
      <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase" }}>Commerce</p>
          <p style={{ margin: "5px 0 0", fontSize: 15, fontWeight: 800 }}>Shopify</p>
          <p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>{labels.description}</p>
        </div>
        <span style={{ flexShrink: 0, padding: "4px 9px", borderRadius: 6, fontSize: 10, fontWeight: 800, background: active ? "rgba(199,245,111,.15)" : connection?.status === "failed" ? "rgba(239,68,68,.12)" : "rgba(251,191,36,.12)", color: active ? "var(--tone-success-strong)" : connection?.status === "failed" ? "#f87171" : "#a16207" }}>
          {statusLabel}
        </span>
      </div>

      <div style={{ padding: 18, display: "grid", gap: 18 }}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800 }}>{labels.setupTitle}</p>
            <a href="https://dev.shopify.com/dashboard" target="_blank" rel="noreferrer" style={{ color: "var(--text)", fontSize: 11, fontWeight: 750, textDecoration: "underline", textUnderlineOffset: 3 }}>
              {labels.openDashboard}
            </a>
          </div>
          <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 7 }}>
            {labels.setupSteps.map((step) => <li key={step} style={{ fontSize: 11, lineHeight: 1.55, color: "var(--muted)" }}>{step}</li>)}
          </ol>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 11, fontWeight: 750, color: "var(--muted)" }}>
            {labels.shopDomain}
            <input value={shopDomain} onChange={(event) => setShopDomain(event.target.value)} placeholder="store.myshopify.com" autoComplete="off" style={field} />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 11, fontWeight: 750, color: "var(--muted)" }}>
            {labels.clientId}
            <input value={clientId} onChange={(event) => setClientId(event.target.value)} autoComplete="off" style={field} />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 11, fontWeight: 750, color: "var(--muted)" }}>
            {labels.secret}
            <input type="password" value={clientSecret} onChange={(event) => setClientSecret(event.target.value)} placeholder={connection?.hasSecret ? "••••••••" : ""} autoComplete="new-password" style={field} />
          </label>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 11, lineHeight: 1.5, color: "var(--text)", cursor: "pointer" }}>
            <input type="checkbox" checked={merchantOwnedConfirmed} onChange={(event) => setMerchantOwnedConfirmed(event.target.checked)} style={{ marginTop: 2 }} />
            {labels.merchantConfirm}
          </label>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 11, lineHeight: 1.5, color: "var(--text)", cursor: "pointer" }}>
            <input type="checkbox" checked={scopesConfirmed} onChange={(event) => setScopesConfirmed(event.target.checked)} style={{ marginTop: 2 }} />
            {labels.scopesConfirm}
          </label>
          <p style={{ margin: 0, fontSize: 11, lineHeight: 1.55, color: "var(--muted)" }}>{labels.privacy}</p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            disabled={controlsDisabled || !merchantOwnedConfirmed || !scopesConfirmed}
            style={{ ...button, background: "#C7F56F", color: "#0f1a00", border: "none", opacity: merchantOwnedConfirmed && scopesConfirmed && !controlsDisabled ? 1 : 0.55, cursor: merchantOwnedConfirmed && scopesConfirmed && !controlsDisabled ? "pointer" : "not-allowed" }}
            onClick={() => run("save", () => fetch("/api/integrations/shopify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ shopDomain, clientId, clientSecret, confirmMerchantOwnedApp: merchantOwnedConfirmed, confirmScopes: scopesConfirmed }),
            }), labels.saved)}
          >
            {busy === "save" ? "..." : labels.save}
          </button>
          <button disabled={controlsDisabled || !connection} style={{ ...button, opacity: controlsDisabled || !connection ? 0.55 : 1 }} onClick={() => run("test", () => fetch("/api/integrations/shopify/test", { method: "POST" }), labels.tested)}>
            {busy === "test" ? "..." : labels.test}
          </button>
          <button disabled={controlsDisabled || !active} style={{ ...button, opacity: controlsDisabled || !active ? 0.55 : 1 }} onClick={() => run("sync", () => fetch("/api/integrations/shopify/sync", { method: "POST" }), (data) => labels.synced(Number(data.processed ?? 0)))}>
            {busy === "sync" ? "..." : labels.sync}
          </button>
        </div>

        {connection ? (
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11, color: "var(--muted)" }}>
            {connection.displayName ? <span>{connection.displayName}</span> : null}
            {connection.shopCurrency ? <span>{connection.shopCurrency}</span> : null}
            {connection.scopes.length ? <span>{connection.scopes.join(" · ")}</span> : null}
            {lastSync ? <span>{labels.lastSync}: {lastSync}</span> : null}
          </div>
        ) : null}

        {connection?.lastError ? <p role="alert" style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: "#f87171" }}>{connection.lastError}</p> : null}

        {active ? (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12, alignItems: "end" }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 800 }}>{labels.approval}</p>
                <p style={{ margin: "4px 0 0", fontSize: 12, lineHeight: 1.55, color: "var(--muted)" }}>{labels.approvalDescription}</p>
              </div>
              <label style={{ display: "grid", gap: 6, fontSize: 11, fontWeight: 750, color: "var(--muted)" }}>
                {labels.maximum} ({connection.shopCurrency ?? "EUR"})
                <input inputMode="decimal" value={maxAmount} onChange={(event) => setMaxAmount(event.target.value)} style={field} />
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button disabled={controlsDisabled} style={button} onClick={() => run("limit", () => fetch("/api/integrations/shopify", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ maxCancelAmount: Number(maxAmount) }) }), nl ? "Limiet bijgewerkt." : "Limit updated.")}>{labels.saveLimit}</button>
              <button disabled={controlsDisabled} style={button} onClick={() => run("policy", () => fetch("/api/integrations/shopify", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actionMode: connection.actionMode === "approval_required" ? "disabled" : "approval_required" }) }), nl ? "Actiebeleid bijgewerkt." : "Action policy updated.")}>{connection.actionMode === "approval_required" ? labels.disable : labels.enable}</button>
              <button disabled={controlsDisabled} style={button} onClick={() => run("pause", () => fetch("/api/integrations/shopify", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "paused" }) }), nl ? "Gepauzeerd." : "Paused.")}>{labels.pause}</button>
            </div>
          </div>
        ) : null}

        {connection?.status === "paused" ? (
          <button disabled={controlsDisabled} style={{ ...button, justifySelf: "start" }} onClick={() => run("resume", () => fetch("/api/integrations/shopify", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "active" }) }), nl ? "Hervat." : "Resumed.")}>{labels.resume}</button>
        ) : null}

        {connection ? (
          <button
            disabled={controlsDisabled}
            style={{ ...button, color: "#f87171", justifySelf: "start" }}
            onClick={() => {
              const confirmed = window.confirm(nl
                ? "Shopify ontkoppelen? Live orderdata, tokens en webhooks worden verwijderd. Pseudonieme case-history en auditmetadata blijven maximaal 24 maanden bewaard."
                : "Disconnect Shopify? Live order data, tokens, and webhooks are removed. Pseudonymous case history and audit metadata remain for up to 24 months.");
              if (confirmed) void run("delete", () => fetch("/api/integrations/shopify", { method: "DELETE" }), nl ? "Ontkoppeld." : "Disconnected.");
            }}
          >
            {labels.disconnect}
          </button>
        ) : null}

        {notice ? <p role={notice.error ? "alert" : "status"} style={{ margin: 0, fontSize: 12, color: notice.error ? "#f87171" : "var(--tone-success-strong)" }}>{notice.text}</p> : null}
      </div>
    </section>
  );
}
