"use client";

import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  KeyRound,
  MailCheck,
  RefreshCw,
  ShieldCheck,
  Unplug,
  Webhook,
  X,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

import { useTranslation } from "@/lib/i18n/LanguageProvider";
import {
  CommerceMetric,
  FeedbackNotice,
  StatusPill,
  commerceButtonStyle,
  commerceInputStyle,
  type CommerceFeedback,
} from "./CommerceIntegrationUi";

type ConnectionState = {
  status: "test_required" | "active" | "paused" | "failed";
  clientId: string;
  hasSecret: boolean;
  displayName: string | null;
  externalAccountId: string | null;
  setupStage: "credentials" | "api" | "events" | "mailbox" | "complete";
  mailboxVerifiedAt: string | null;
  eventsStatus: "not_configured" | "pending" | "active" | "failed" | "paused";
  lastSyncedAt: string | null;
  lastReturnsSyncedAt: string | null;
  lastError: string | null;
};

function formatDate(value: string | null, language: string) {
  const missing = language === "nl" ? "Nog niet" : "Not yet";
  if (!value) return missing;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? missing : new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function BolMark() {
  return (
    <span style={{ position: "relative", display: "block", width: 91, height: 36, overflow: "hidden", flexShrink: 0 }}>
      <Image
        src="/integrations/bol-logo.jpg"
        alt="bol.com"
        width={121}
        height={66}
        style={{ position: "absolute", left: -15, top: -15, width: 121, height: 66, maxWidth: "none" }}
      />
    </span>
  );
}

function BolGuide({ open, onClose, language }: { open: boolean; onClose: () => void; language: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);
  if (!open) return null;
  const nl = language === "nl";
  const steps = nl ? [
    {
      icon: <KeyRound size={26} />,
      title: "Maak API-gegevens aan",
      text: "Open in je bol.com verkoopaccount Instellingen, kies Diensten via API en maak Client credentials voor SequenceFlow.",
      action: "Open bol.com verkoopaccount",
      href: "https://partnerplatform.bol.com/",
    },
    {
      icon: <ShieldCheck size={26} />,
      title: "Plak twee gegevens",
      text: "Neem de Client ID en client secret over. SequenceFlow versleutelt ze en controleert de API-toegang automatisch.",
    },
    {
      icon: <MailCheck size={26} />,
      title: "Zet klantvragen via e-mail aan",
      text: "Vraag bol Partner Service om de officiële CRM-e-mailintegratie te activeren en laat de berichten binnenkomen op je gekoppelde supportmailbox.",
      action: "Bekijk bol CRM-uitleg",
      href: "https://partnerplatform.bol.com/nl/idp/klantvragen-beantwoorden-in-je-eigen-crm-systeem",
    },
    {
      icon: <CheckCircle2 size={26} />,
      title: "Controleer een echte klantvraag",
      text: "Na de eerste herkenbare bol.com-mail koppelt SequenceFlow de live order. Pas dan staat de integratie op Volledig klaar.",
    },
  ] : [
    { icon: <KeyRound size={26} />, title: "Create API credentials", text: "Open your bol.com seller account, choose Services via API, and create client credentials for SequenceFlow.", action: "Open bol.com seller account", href: "https://partnerplatform.bol.com/" },
    { icon: <ShieldCheck size={26} />, title: "Paste two values", text: "Copy the Client ID and client secret. SequenceFlow encrypts them and verifies access automatically." },
    { icon: <MailCheck size={26} />, title: "Enable customer questions by email", text: "Ask bol Partner Service to enable the official CRM email integration and route messages into your connected support mailbox.", action: "View bol CRM guide", href: "https://partnerplatform.bol.com/nl/idp/klantvragen-beantwoorden-in-je-eigen-crm-systeem" },
    { icon: <CheckCircle2 size={26} />, title: "Verify a real question", text: "After the first recognized bol.com email, SequenceFlow links the live order. Only then is setup Complete." },
  ];
  const current = steps[step];
  return (
    <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 90, display: "grid", placeItems: "center", padding: 18, background: "rgba(15,23,20,.62)", backdropFilter: "blur(5px)" }}>
      <section role="dialog" aria-modal="true" aria-labelledby="bol-guide-title" style={{ width: "min(720px,100%)", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", boxShadow: "0 24px 70px rgba(15,23,20,.26)", overflow: "hidden" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 18px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}><BolMark /><div><strong id="bol-guide-title" style={{ display: "block", fontSize: 14 }}>{nl ? "bol.com koppelen" : "Connect bol.com"}</strong><span style={{ color: "var(--muted)", fontSize: 11 }}>{nl ? "Vier korte stappen" : "Four short steps"}</span></div></div>
          <button type="button" onClick={onClose} aria-label={nl ? "Sluiten" : "Close"} style={{ ...commerceButtonStyle, width: 34, padding: 0 }}><X size={16} /></button>
        </header>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(220px,.8fr) minmax(0,1.2fr)", minHeight: 330 }}>
          <aside style={{ padding: 20, borderRight: "1px solid var(--border)", background: "var(--surface-subtle)" }}>
            {steps.map((item, index) => <button type="button" key={item.title} onClick={() => setStep(index)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 0", border: 0, background: "transparent", color: index === step ? "var(--text)" : "var(--muted)", textAlign: "left", cursor: "pointer" }}><span style={{ display: "grid", placeItems: "center", width: 24, height: 24, borderRadius: "50%", background: index <= step ? "#C7F56F" : "var(--border)", color: "#172300", fontSize: 10, fontWeight: 900 }}>{index + 1}</span><span style={{ fontSize: 11, fontWeight: 750 }}>{item.title}</span></button>)}
          </aside>
          <div style={{ display: "grid", alignContent: "center", padding: 30 }}>
            <span style={{ width: 56, height: 56, display: "grid", placeItems: "center", borderRadius: 8, background: "#f0f6ff", color: "#0000a4" }}>{current.icon}</span>
            <p style={{ margin: "18px 0 6px", color: "var(--muted)", fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>{nl ? `Stap ${step + 1} van 4` : `Step ${step + 1} of 4`}</p>
            <h2 style={{ margin: 0, fontSize: 23, letterSpacing: 0 }}>{current.title}</h2>
            <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: 13, lineHeight: 1.65 }}>{current.text}</p>
            {current.href ? <a href={current.href} target="_blank" rel="noreferrer" style={{ ...commerceButtonStyle, width: "fit-content", marginTop: 18, textDecoration: "none" }}>{current.action}<ExternalLink size={14} /></a> : null}
          </div>
        </div>
        <footer style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "13px 18px", borderTop: "1px solid var(--border)" }}>
          {step > 0 ? <button type="button" style={commerceButtonStyle} onClick={() => setStep((value) => value - 1)}><ChevronLeft size={14} />{nl ? "Vorige" : "Previous"}</button> : null}
          {step < steps.length - 1 ? <button type="button" style={{ ...commerceButtonStyle, background: "#C7F56F", borderColor: "#C7F56F", color: "#172300" }} onClick={() => setStep((value) => value + 1)}>{nl ? "Volgende" : "Next"}<ChevronRight size={14} /></button> : <button type="button" style={{ ...commerceButtonStyle, background: "#C7F56F", borderColor: "#C7F56F", color: "#172300" }} onClick={onClose}>{nl ? "Begrepen" : "Done"}<CheckCircle2 size={14} /></button>}
        </footer>
      </section>
    </div>
  );
}

export default function BolSettings() {
  const { language } = useTranslation();
  const nl = language === "nl";
  const [connection, setConnection] = useState<ConnectionState | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<CommerceFeedback | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/integrations/bol", { cache: "no-store" });
    if (!response.ok) return setAuthorized(false);
    const data = await response.json();
    const next = data.connection as ConnectionState | null;
    setConnection(next);
    setAuthorized(true);
    if (next) setClientId(next.clientId);
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (authorized !== true) return null;

  async function run(key: string, action: () => Promise<Response>, success: (data: Record<string, unknown>) => CommerceFeedback) {
    setBusy(key);
    setNotice(null);
    try {
      const response = await action();
      const data = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (key === "mailbox" && response.status === 409) {
        setNotice({
          tone: "warning",
          title: nl ? "Klaar voor de eerste klantvraag" : "Ready for the first customer question",
          text: nl
            ? "De bol.com API, events en synchronisatie werken. Zodra een echte bol-klantvraag binnenkomt, controleert SequenceFlow automatisch de order en e-mailthread."
            : "The bol.com API, events, and sync are working. As soon as a real bol customer question arrives, SequenceFlow will verify the order and email thread automatically.",
        });
        await load();
        return;
      }
      if (!response.ok) throw new Error(String(data.error || "bol.com actie mislukt."));
      setNotice(success(data));
      setClientSecret("");
      await load();
    } catch (error) {
      setNotice({ tone: "error", title: nl ? "Actie niet voltooid" : "Action not completed", text: error instanceof Error ? error.message : "bol.com action failed." });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function saveAndTest() {
    const saved = await fetch("/api/integrations/bol", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, clientSecret }),
    });
    if (!saved.ok) return saved;
    return fetch("/api/integrations/bol/test", { method: "POST" });
  }

  const active = connection?.status === "active";
  const complete = active && connection?.setupStage === "complete";
  const status = complete
    ? { tone: "success" as const, label: nl ? "Volledig klaar" : "Complete" }
    : active && connection?.eventsStatus === "failed" ? { tone: "error" as const, label: nl ? "Events herstellen" : "Repair events" }
      : active && !connection?.mailboxVerifiedAt ? { tone: "warning" as const, label: nl ? "Klantvraag controleren" : "Verify customer question" }
        : active ? { tone: "warning" as const, label: nl ? "Events worden ingesteld" : "Events configuring" }
      : connection?.status === "failed" ? { tone: "error" as const, label: nl ? "Actie nodig" : "Action needed" }
        : { tone: "neutral" as const, label: nl ? "Instellen" : "Set up" };

  return (
    <section style={{ border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", overflow: "hidden" }}>
      <header style={{ padding: "15px 17px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 15, minWidth: 0 }}><div style={{ width: 104, flexShrink: 0 }}><BolMark /></div><p style={{ margin: 0, color: "var(--muted)", fontSize: 11 }}>{nl ? "Live order-, verzending-, retour- en voorraadcontext." : "Live order, shipment, return, and stock context."}</p></div>
        <StatusPill tone={status.tone} label={status.label} />
      </header>
      <div style={{ padding: "16px 17px", display: "grid", gap: 16 }}>
        {active ? (
          <>
            <div className="commerce-metrics" style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
              <CommerceMetric label={nl ? "API" : "API"} value={connection.displayName || "bol.com"} detail={connection.externalAccountId || undefined} icon={<ShieldCheck size={12} />} />
              <div style={{ borderLeft: "1px solid var(--border)", paddingLeft: 16 }}><CommerceMetric label={nl ? "Events" : "Events"} value={connection.eventsStatus === "active" ? (nl ? "Actief" : "Active") : connection.eventsStatus === "pending" ? (nl ? "Wordt ingesteld" : "Configuring") : (nl ? "Herstel via sync" : "Polling fallback")} detail="ORDER · SHIPMENT" icon={<Webhook size={12} />} /></div>
              <div style={{ borderLeft: "1px solid var(--border)", paddingLeft: 16 }}><CommerceMetric label={nl ? "Klantvragen" : "Customer questions"} value={connection.mailboxVerifiedAt ? (nl ? "Geverifieerd" : "Verified") : (nl ? "Test nodig" : "Test needed")} detail={connection.mailboxVerifiedAt ? formatDate(connection.mailboxVerifiedAt, language) : (nl ? "Echte bol-mail vereist" : "Real bol email required")} icon={<MailCheck size={12} />} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
              <div style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 8 }}><CommerceMetric label={nl ? "Laatste ordersync" : "Last order sync"} value={formatDate(connection.lastSyncedAt, language)} /></div>
              <div style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 8 }}><CommerceMetric label={nl ? "Laatste retoursync" : "Last return sync"} value={formatDate(connection.lastReturnsSyncedAt, language)} /></div>
            </div>
            {connection.lastError ? <FeedbackNotice notice={{ tone: "error", title: nl ? "Een onderdeel vraagt aandacht" : "One part needs attention", text: connection.lastError }} closeLabel={nl ? "Sluiten" : "Close"} onClose={() => setNotice(null)} /> : null}
            {notice ? <FeedbackNotice notice={notice} closeLabel={nl ? "Sluiten" : "Close"} onClose={() => setNotice(null)} /> : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" disabled={Boolean(busy)} style={commerceButtonStyle} onClick={() => run("test", () => fetch("/api/integrations/bol/test", { method: "POST" }), () => ({ tone: "success", title: nl ? "API opnieuw gecontroleerd" : "API checked again", text: nl ? "Toegang en eventconfiguratie zijn opnieuw gecontroleerd." : "Access and event configuration were checked again." }))}><ShieldCheck size={14} />{busy === "test" ? (nl ? "Controleren..." : "Checking...") : (nl ? "API controleren" : "Check API")}</button>
              <button type="button" disabled={Boolean(busy)} style={{ ...commerceButtonStyle, background: "#C7F56F", borderColor: "#C7F56F", color: "#172300" }} onClick={() => run("sync", () => fetch("/api/integrations/bol/sync", { method: "POST" }), (data) => ({ tone: "success", title: nl ? "bol.com is bijgewerkt" : "bol.com is up to date", text: nl ? `${Number(data.orders ?? 0)} orders en ${Number(data.returns ?? 0)} retouren gecontroleerd.` : `${Number(data.orders ?? 0)} orders and ${Number(data.returns ?? 0)} returns checked.` }))}><RefreshCw size={14} />{busy === "sync" ? (nl ? "Synchroniseren..." : "Syncing...") : (nl ? "Nu synchroniseren" : "Sync now")}</button>
              {!connection.mailboxVerifiedAt ? <button type="button" disabled={Boolean(busy)} style={commerceButtonStyle} onClick={() => run("mailbox", () => fetch("/api/integrations/bol/mailbox/verify", { method: "POST" }), () => ({ tone: "success", title: nl ? "Klantvragen zijn gekoppeld" : "Customer questions connected", text: nl ? "Een echte bol.com klantvraag is herkend en kan worden beantwoord." : "A real bol.com customer question was recognized and is replyable." }))}><MailCheck size={14} />{nl ? "Klantvraag controleren" : "Verify customer question"}</button> : null}
              <button type="button" style={commerceButtonStyle} onClick={() => setGuideOpen(true)}><BookOpen size={14} />{nl ? "Installatiehulp" : "Setup guide"}</button>
              <button type="button" disabled={Boolean(busy)} style={{ ...commerceButtonStyle, marginLeft: "auto", color: "#dc2626" }} onClick={() => { if (window.confirm(nl ? "bol.com ontkoppelen? De credentials en gesynchroniseerde context worden verwijderd." : "Disconnect bol.com? Credentials and synchronized context will be removed.")) void run("delete", () => fetch("/api/integrations/bol", { method: "DELETE" }), () => ({ tone: "success", title: nl ? "bol.com ontkoppeld" : "bol.com disconnected", text: nl ? "De koppeling is verwijderd." : "The connection was removed." })); }}><Unplug size={14} />{nl ? "Ontkoppelen" : "Disconnect"}</button>
            </div>
          </>
        ) : (
          <>
            <div><p style={{ margin: 0, color: "var(--text)", fontSize: 14, fontWeight: 800 }}>{nl ? "bol.com koppelen" : "Connect bol.com"}</p><p style={{ maxWidth: 650, margin: "4px 0 0", color: "var(--muted)", fontSize: 11, lineHeight: 1.55 }}>{nl ? "Vul de Client ID en secret uit je bol.com verkoopaccount in. SequenceFlow controleert de toegang, stelt ORDER- en SHIPMENT-events in en houdt retouren bij via veilige sync." : "Enter the Client ID and secret from your bol.com seller account. SequenceFlow verifies access, configures ORDER and SHIPMENT events, and tracks returns through secure sync."}</p></div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" style={{ ...commerceButtonStyle, color: "#0000a4" }} onClick={() => setGuideOpen(true)}><BookOpen size={14} />{nl ? "Bekijk installatiehulp" : "View setup guide"}</button>
              <a href="https://partnerplatform.bol.com/" target="_blank" rel="noreferrer" style={{ ...commerceButtonStyle, textDecoration: "none" }}>{nl ? "Open bol.com verkoopaccount" : "Open bol.com seller account"}<ExternalLink size={14} /></a>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 11 }}>
              <label style={{ display: "grid", gap: 6, color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>Client ID<input value={clientId} onChange={(event) => setClientId(event.target.value)} autoComplete="off" style={commerceInputStyle} /></label>
              <label style={{ display: "grid", gap: 6, color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>{connection?.hasSecret ? (nl ? "Client secret vervangen" : "Replace client secret") : "Client secret"}<input type="password" value={clientSecret} onChange={(event) => setClientSecret(event.target.value)} autoComplete="new-password" placeholder={connection?.hasSecret ? "••••••••" : ""} style={commerceInputStyle} /></label>
            </div>
            <div style={{ display: "flex", gap: 10, padding: "11px 12px", border: "1px solid #d4edaa", borderRadius: 8, background: "#f7fbea", color: "#527717" }}><ShieldCheck size={17} style={{ flex: "none" }} /><div><strong style={{ display: "block", fontSize: 11 }}>{nl ? "Read-only in v1" : "Read-only in v1"}</strong><p style={{ margin: "2px 0 0", fontSize: 10, lineHeight: 1.5 }}>{nl ? "SequenceFlow leest context, maar annuleert, retourneert, verzendt of wijzigt nooit voorraad via bol.com." : "SequenceFlow reads context but never cancels, returns, ships, or changes inventory through bol.com."}</p></div></div>
            {notice ? <FeedbackNotice notice={notice} closeLabel={nl ? "Sluiten" : "Close"} onClose={() => setNotice(null)} /> : null}
            <button type="button" disabled={Boolean(busy) || !clientId || (!clientSecret && !connection?.hasSecret)} style={{ ...commerceButtonStyle, width: "fit-content", background: "#C7F56F", borderColor: "#C7F56F", color: "#172300", opacity: !clientId || (!clientSecret && !connection?.hasSecret) ? .55 : 1 }} onClick={() => run("save", saveAndTest, () => ({ tone: "success", title: nl ? "bol.com API is actief" : "bol.com API is active", text: nl ? "Toegang en events zijn gecontroleerd. Controleer nu een echte klantvraag." : "Access and events were verified. Now verify a real customer question." }))}><ShieldCheck size={14} />{busy === "save" ? (nl ? "Controleren..." : "Verifying...") : (nl ? "Opslaan en controleren" : "Save and verify")}</button>
          </>
        )}
      </div>
      <BolGuide open={guideOpen} onClose={() => setGuideOpen(false)} language={language} />
    </section>
  );
}
