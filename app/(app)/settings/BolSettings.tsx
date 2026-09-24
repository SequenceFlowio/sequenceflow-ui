"use client";

import {
  AlertCircle,
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
  X,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

import { ConfirmDialog } from "./SettingsUi";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import {
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
      text: "Open in je bol.com verkoopaccount Instellingen, kies Diensten via API en maak Client credentials voor Support One.",
      action: "Open bol.com verkoopaccount",
      href: "https://partnerplatform.bol.com/",
    },
    {
      icon: <ShieldCheck size={26} />,
      title: "Plak twee gegevens",
      text: "Neem de Client ID en client secret over. Support One versleutelt ze en controleert de API-toegang automatisch.",
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
      text: "Na de eerste herkenbare bol.com-mail koppelt Support One de bestelling. Dan is alles klaar.",
    },
  ] : [
    { icon: <KeyRound size={26} />, title: "Create API credentials", text: "Open your bol.com seller account, choose Services via API, and create client credentials for Support One.", action: "Open bol.com seller account", href: "https://partnerplatform.bol.com/" },
    { icon: <ShieldCheck size={26} />, title: "Paste two values", text: "Copy the Client ID and client secret. Support One encrypts them and verifies access automatically." },
    { icon: <MailCheck size={26} />, title: "Enable customer questions by email", text: "Ask bol Partner Service to enable the official CRM email integration and route messages into your connected support mailbox.", action: "View bol CRM guide", href: "https://partnerplatform.bol.com/nl/idp/klantvragen-beantwoorden-in-je-eigen-crm-systeem" },
    { icon: <CheckCircle2 size={26} />, title: "Verify a real question", text: "After the first recognized bol.com email, Support One links the order. Then everything is ready." },
  ];
  const current = steps[step];
  return (
    <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 90, display: "grid", placeItems: "center", padding: 18, background: "rgba(0,0,0,.6)", backdropFilter: "blur(5px)" }}>
      <section role="dialog" aria-modal="true" aria-labelledby="bol-guide-title" style={{ width: "min(720px,100%)", border: "1px solid var(--border)", borderRadius: 20, background: "var(--surface)", boxShadow: "0 24px 70px rgba(0,0,0,.45)", overflow: "hidden" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 18px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}><BolMark /><div><strong id="bol-guide-title" style={{ display: "block", fontSize: 15, fontWeight: 500 }}>{nl ? "bol.com koppelen" : "Connect bol.com"}</strong><span style={{ color: "var(--muted)", fontSize: 12 }}>{nl ? "Vier korte stappen" : "Four short steps"}</span></div></div>
          <button type="button" onClick={onClose} aria-label={nl ? "Sluiten" : "Close"} style={{ ...commerceButtonStyle, width: 34, padding: 0 }}><X size={16} /></button>
        </header>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(220px,.8fr) minmax(0,1.2fr)", minHeight: 330 }}>
          <aside style={{ padding: 20, borderRight: "1px solid var(--border)", background: "var(--surface-2)" }}>
            {steps.map((item, index) => <button type="button" key={item.title} onClick={() => setStep(index)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 0", border: 0, background: "transparent", color: index === step ? "var(--text)" : "var(--muted)", textAlign: "left", cursor: "pointer" }}><span style={{ display: "grid", placeItems: "center", width: 24, height: 24, borderRadius: "50%", background: index <= step ? "#C7F56F" : "var(--border)", color: "#10180a", fontSize: 11, fontWeight: 600 }}>{index + 1}</span><span style={{ fontSize: 12, fontWeight: 500 }}>{item.title}</span></button>)}
          </aside>
          <div style={{ display: "grid", alignContent: "center", padding: 30 }}>
            <span style={{ width: 56, height: 56, display: "grid", placeItems: "center", borderRadius: 16, background: "rgba(199,245,111,.1)", color: "var(--sf-green)" }}>{current.icon}</span>
            <p style={{ margin: "18px 0 6px", color: "var(--muted)", fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase" }}>{nl ? `Stap ${step + 1} van 4` : `Step ${step + 1} of 4`}</p>
            <h2 style={{ margin: 0, fontSize: 23, fontWeight: 500, letterSpacing: "-.01em" }}>{current.title}</h2>
            <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: 13, lineHeight: 1.65 }}>{current.text}</p>
            {current.href ? <a href={current.href} target="_blank" rel="noreferrer" style={{ ...commerceButtonStyle, width: "fit-content", marginTop: 18, textDecoration: "none" }}>{current.action}<ExternalLink size={14} /></a> : null}
          </div>
        </div>
        <footer style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "13px 18px", borderTop: "1px solid var(--border)" }}>
          {step > 0 ? <button type="button" style={commerceButtonStyle} onClick={() => setStep((value) => value - 1)}><ChevronLeft size={14} />{nl ? "Vorige" : "Previous"}</button> : null}
          {step < steps.length - 1 ? <button type="button" style={{ ...commerceButtonStyle, background: "var(--sf-green)", borderColor: "var(--sf-green)", color: "#10180a" }} onClick={() => setStep((value) => value + 1)}>{nl ? "Volgende" : "Next"}<ChevronRight size={14} /></button> : <button type="button" style={{ ...commerceButtonStyle, background: "var(--sf-green)", borderColor: "var(--sf-green)", color: "#10180a" }} onClick={onClose}>{nl ? "Begrepen" : "Done"}<CheckCircle2 size={14} /></button>}
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
  // De opgeslagen koppelfout komt van de server en staat los van `notice`;
  // wegklikken verbergt precies deze fout, een nieuwe fout verschijnt weer.
  const [hiddenLastError, setHiddenLastError] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

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
            ? "De koppeling met bol.com werkt. Zodra er een echte bol-klantvraag binnenkomt, koppelt Support One die automatisch aan de bestelling."
            : "The bol.com connection works. As soon as a real bol customer question arrives, Support One links it to the order automatically.",
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
  const needsRepair = active && (connection?.eventsStatus === "failed" || Boolean(connection?.lastError));
  const status = complete
    ? { tone: "success" as const, label: nl ? "Actief" : "Active" }
    : active && connection?.eventsStatus === "failed" ? { tone: "error" as const, label: nl ? "Actie nodig" : "Action needed" }
      : active && !connection?.mailboxVerifiedAt ? { tone: "warning" as const, label: nl ? "Wacht op eerste klantvraag" : "Waiting for first question" }
        : active ? { tone: "warning" as const, label: nl ? "Wordt ingesteld" : "Setting up" }
      : connection?.status === "failed" ? { tone: "error" as const, label: nl ? "Actie nodig" : "Action needed" }
        : { tone: "neutral" as const, label: nl ? "Instellen" : "Set up" };

  return (
    <section style={{ border: "1px solid var(--border)", borderRadius: 20, background: "var(--surface)", overflow: "hidden" }}>
      <header style={{ padding: "18px 20px 4px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 15, minWidth: 0 }}><div style={{ width: 104, flexShrink: 0 }}><BolMark /></div><p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>{nl ? "Bestellingen, verzendingen en retouren als context bij elk antwoord." : "Orders, shipments and returns as context for every reply."}</p></div>
        <StatusPill tone={status.tone} label={status.label} />
      </header>
      <div style={{ padding: "14px 20px 20px", display: "grid", gap: 16 }}>
        {active ? (
          <>
            <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", color: "var(--muted)", fontSize: 13 }}>
              {needsRepair ? <AlertCircle size={15} style={{ color: "var(--tone-danger)", flexShrink: 0 }} /> : <CheckCircle2 size={15} style={{ color: "var(--sf-green)", flexShrink: 0 }} />}
              <strong style={{ color: "var(--text)", fontWeight: 600 }}>{needsRepair ? (nl ? "De koppeling vraagt aandacht" : "The connection needs attention") : (nl ? "Bestelcontext actief" : "Order context active")}</strong>
              <span>· {nl ? "laatst bijgewerkt" : "last updated"} {formatDate(connection.lastSyncedAt, language)}</span>
            </p>
            {!connection.mailboxVerifiedAt ? (
              <div role="note" style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: 11, padding: "14px 16px", border: "1px solid var(--border)", borderRadius: 16, background: "var(--surface-2)", color: "var(--sf-green)" }}>
                <MailCheck size={18} style={{ marginTop: 1, flexShrink: 0 }} />
                <div>
                  <strong style={{ display: "block", color: "var(--text)", fontSize: 13, fontWeight: 600 }}>
                    {nl ? "De API is klaar. Klantvragen lopen apart via e-mail." : "The API is ready. Customer questions arrive separately by email."}
                  </strong>
                  <p style={{ margin: "3px 0 0", color: "var(--muted)", fontSize: 12, lineHeight: 1.55 }}>
                    {nl
                      ? "bol.com deelt orders, verzendingen en retouren via de API, maar geen klantgesprekken. Activeer daarom de officiële bol CRM-e-mailintegratie en laat die berichten binnenkomen op je supportmailbox."
                      : "bol.com shares orders, shipments, and returns through the API, but not customer conversations. Enable the official bol CRM email integration and route those messages to your support mailbox."}
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    <a href="#support-mailbox" style={{ ...commerceButtonStyle, minHeight: 34, textDecoration: "none", background: "var(--surface)" }}>
                      <MailCheck size={14} />{nl ? "Supportmailbox instellen" : "Set up support mailbox"}
                    </a>
                    <button type="button" disabled={Boolean(busy)} style={{ ...commerceButtonStyle, minHeight: 34, background: "var(--surface)" }} onClick={() => run("mailbox", () => fetch("/api/integrations/bol/mailbox/verify", { method: "POST" }), () => ({ tone: "success", title: nl ? "Klantvragen zijn gekoppeld" : "Customer questions connected", text: nl ? "Een echte bol.com-klantvraag is herkend en kan worden beantwoord." : "A real bol.com customer question was recognized and can be answered." }))}>
                      <CheckCircle2 size={14} />{nl ? "Nu controleren" : "Check now"}
                    </button>
                    <button type="button" style={{ ...commerceButtonStyle, minHeight: 34, border: 0, background: "transparent", color: "var(--muted)" }} onClick={() => setGuideOpen(true)}>
                      <BookOpen size={14} />{nl ? "Uitleg" : "Guide"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            {connection.lastError && connection.lastError !== hiddenLastError ? <FeedbackNotice notice={{ tone: "error", title: nl ? "Een onderdeel vraagt aandacht" : "One part needs attention", text: connection.lastError }} closeLabel={nl ? "Sluiten" : "Close"} onClose={() => setHiddenLastError(connection.lastError)} /> : null}
            {notice ? <FeedbackNotice notice={notice} closeLabel={nl ? "Sluiten" : "Close"} onClose={() => setNotice(null)} /> : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {needsRepair ? (
                <button type="button" disabled={Boolean(busy)} style={{ ...commerceButtonStyle, background: "var(--sf-green)", borderColor: "var(--sf-green)", color: "#10180a" }} onClick={() => run("test", () => fetch("/api/integrations/bol/test", { method: "POST" }), () => ({ tone: "success", title: nl ? "Koppeling hersteld" : "Connection repaired", text: nl ? "De koppeling met bol.com is opnieuw gecontroleerd." : "The bol.com connection was checked again." }))}><ShieldCheck size={14} />{busy === "test" ? (nl ? "Controleren…" : "Checking…") : (nl ? "Koppeling herstellen" : "Repair connection")}</button>
              ) : (
                <button type="button" disabled={Boolean(busy)} style={{ ...commerceButtonStyle, background: "var(--sf-green)", borderColor: "var(--sf-green)", color: "#10180a" }} onClick={() => run("sync", () => fetch("/api/integrations/bol/sync", { method: "POST" }), (data) => ({ tone: "success", title: nl ? "bol.com is bijgewerkt" : "bol.com is up to date", text: nl ? `${Number(data.orders ?? 0)} bestellingen en ${Number(data.returns ?? 0)} retouren bijgewerkt.` : `${Number(data.orders ?? 0)} orders and ${Number(data.returns ?? 0)} returns updated.` }))}><RefreshCw size={14} />{busy === "sync" ? (nl ? "Bijwerken…" : "Updating…") : (nl ? "Nu bijwerken" : "Update now")}</button>
              )}
              <button type="button" disabled={Boolean(busy)} style={{ ...commerceButtonStyle, border: 0, background: "transparent", color: "var(--muted)" }} onClick={() => setConfirmDisconnect(true)}><Unplug size={14} />{nl ? "Ontkoppelen" : "Disconnect"}</button>
            </div>
          </>
        ) : (
          <>
            <div><p style={{ margin: 0, color: "var(--text)", fontSize: 14, fontWeight: 500 }}>{nl ? "bol.com koppelen" : "Connect bol.com"}</p><p style={{ maxWidth: 650, margin: "4px 0 0", color: "var(--muted)", fontSize: 13, lineHeight: 1.55 }}>{nl ? "Vul de Client ID en secret uit je bol.com-verkoopaccount in. Support One controleert de toegang en houdt bestellingen, verzendingen en retouren bij." : "Enter the Client ID and secret from your bol.com seller account. Support One checks access and keeps orders, shipments and returns up to date."}</p></div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" style={{ ...commerceButtonStyle, color: "var(--sf-green)" }} onClick={() => setGuideOpen(true)}><BookOpen size={14} />{nl ? "Bekijk installatiehulp" : "View setup guide"}</button>
              <a href="https://partnerplatform.bol.com/" target="_blank" rel="noreferrer" style={{ ...commerceButtonStyle, textDecoration: "none" }}>{nl ? "Open bol.com verkoopaccount" : "Open bol.com seller account"}<ExternalLink size={14} /></a>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 11 }}>
              <label style={{ display: "grid", gap: 6, color: "var(--muted)", fontSize: 12, fontWeight: 600 }}>Client ID<input value={clientId} onChange={(event) => setClientId(event.target.value)} autoComplete="off" style={commerceInputStyle} /></label>
              <label style={{ display: "grid", gap: 6, color: "var(--muted)", fontSize: 12, fontWeight: 600 }}>{connection?.hasSecret ? (nl ? "Client secret vervangen" : "Replace client secret") : "Client secret"}<input type="password" value={clientSecret} onChange={(event) => setClientSecret(event.target.value)} autoComplete="new-password" placeholder={connection?.hasSecret ? "••••••••" : ""} style={commerceInputStyle} /></label>
            </div>
            <div style={{ display: "flex", gap: 10, padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 14, background: "var(--surface-2)", color: "var(--sf-green)" }}><ShieldCheck size={17} style={{ flex: "none" }} /><div><strong style={{ display: "block", color: "var(--text)", fontSize: 13, fontWeight: 600 }}>{nl ? "Alleen lezen" : "Read only"}</strong><p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: 12, lineHeight: 1.5 }}>{nl ? "Support One leest bestelgegevens, maar annuleert, retourneert, verzendt of wijzigt nooit iets bij bol.com." : "Support One reads order data but never cancels, returns, ships, or changes inventory through bol.com."}</p></div></div>
            {notice ? <FeedbackNotice notice={notice} closeLabel={nl ? "Sluiten" : "Close"} onClose={() => setNotice(null)} /> : null}
            <button type="button" disabled={Boolean(busy) || !clientId || (!clientSecret && !connection?.hasSecret)} style={{ ...commerceButtonStyle, width: "fit-content", background: "var(--sf-green)", borderColor: "var(--sf-green)", color: "#10180a", opacity: !clientId || (!clientSecret && !connection?.hasSecret) ? .55 : 1 }} onClick={() => run("save", saveAndTest, () => ({ tone: "success", title: nl ? "bol.com API is actief" : "bol.com API is active", text: nl ? "Toegang en events zijn gecontroleerd. Controleer nu een echte klantvraag." : "Access and events were verified. Now verify a real customer question." }))}><ShieldCheck size={14} />{busy === "save" ? (nl ? "Controleren..." : "Verifying...") : (nl ? "Opslaan en controleren" : "Save and verify")}</button>
          </>
        )}
      </div>
      <BolGuide open={guideOpen} onClose={() => setGuideOpen(false)} language={language} />
      {confirmDisconnect ? <ConfirmDialog title={nl ? "bol.com ontkoppelen?" : "Disconnect bol.com?"} description={nl ? "De inloggegevens en de bewaarde bestelgegevens worden verwijderd." : "Credentials and stored order data will be removed."} confirmLabel={nl ? "Ontkoppelen" : "Disconnect"} danger busy={busy === "delete"} onCancel={() => setConfirmDisconnect(false)} onConfirm={() => { setConfirmDisconnect(false); void run("delete", () => fetch("/api/integrations/bol", { method: "DELETE" }), () => ({ tone: "success", title: nl ? "bol.com ontkoppeld" : "bol.com disconnected", text: nl ? "De koppeling is verwijderd." : "The connection was removed." })); }} /> : null}
    </section>
  );
}
