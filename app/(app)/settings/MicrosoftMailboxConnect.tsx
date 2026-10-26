"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Check, Loader2, Mail, Send, Unplug } from "lucide-react";

import { appFetch } from "@/lib/shopify/client";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

type MicrosoftState = {
  available: boolean;
  connected: boolean;
  status: "not_connected" | "active" | "needs_reconnect" | "revoked";
  email: string | null;
  lastSyncedAt: string | null;
};
type Notice = { type: "success" | "error"; text: string };

const copy = {
  nl: {
    title: "Outlook of Microsoft 365 koppelen",
    badge: "Zonder wachtwoord",
    intro: "Log in met Microsoft. Support One leest dan nieuwe klantmail direct uit je inbox en verstuurt antwoorden vanaf je eigen adres. Geen doorsturen, geen app-wachtwoord.",
    detail: "Kies het Outlook- of Microsoft 365-account waarop klanten je mailen. Support One kan je mail lezen en versturen, maar nooit verplaatsen of verwijderen. Alleen mail die binnenkomt na het koppelen wordt gelezen.",
    signIn: "Inloggen met Microsoft",
    reconnect: "Opnieuw inloggen met Microsoft",
    reconnectDetail: "De Microsoft-toegang is verlopen of ingetrokken. Log opnieuw in, dan gaan ontvangen en versturen weer verder waar ze gebleven waren.",
    connectedVia: "Ontvangen en versturen via",
    lastSync: (time: string) => `Laatst gecontroleerd: ${time}`,
    notSynced: "Nieuwe mail wordt elke minuut opgehaald.",
    disconnect: "Ontkoppelen",
    waiting: "Wacht op Microsoft…",
    popupBlocked: "Je browser blokkeerde het Microsoft-venster. Sta pop-ups toe voor deze pagina en probeer opnieuw.",
    test: "Stuur testmail",
    testSent: (to: string) => `Testmail verstuurd naar ${to}. Kijk in Outlook: hij staat in je inbox en bij Verzonden items.`,
    adminNote: "Werkt je bedrijf met Microsoft 365 en zie je ‘Goedkeuring van beheerder vereist’? Dan moet je IT-beheerder Support One eenmalig toestaan.",
    failed: "Dat lukte niet. Probeer het opnieuw.",
  },
  en: {
    title: "Connect Outlook or Microsoft 365",
    badge: "No password",
    intro: "Sign in with Microsoft. Support One then reads new customer email straight from your inbox and sends replies from your own address. No forwarding, no app password.",
    detail: "Choose the Outlook or Microsoft 365 account customers email. Support One can read and send your email, but never move or delete it. Only email arriving after you connect is read.",
    signIn: "Sign in with Microsoft",
    reconnect: "Sign in with Microsoft again",
    reconnectDetail: "Microsoft access expired or was revoked. Sign in again and receiving and sending continue where they left off.",
    connectedVia: "Receiving and sending through",
    lastSync: (time: string) => `Last checked: ${time}`,
    notSynced: "New email is picked up every minute.",
    disconnect: "Disconnect",
    waiting: "Waiting for Microsoft…",
    popupBlocked: "Your browser blocked the Microsoft window. Allow pop-ups for this page and try again.",
    test: "Send test mail",
    testSent: (to: string) => `Test mail sent to ${to}. Check Outlook: it is in your inbox and Sent Items.`,
    adminNote: "Does your company use Microsoft 365 and do you see ‘Need admin approval’? Then your IT admin has to allow Support One once.",
    failed: "That did not work. Please try again.",
  },
} as const;

/**
 * "Sign in with Microsoft": reads the inbox and sends through Microsoft Graph.
 * Renders inside the mailbox settings and stays hidden until the feature is
 * on, or while Gmail is connected through Google instead.
 */
export default function MicrosoftMailboxConnect({ onChange }: { onChange?: () => void }) {
  const { language } = useTranslation();
  const text = copy[language];
  const locale = language === "nl" ? "nl-NL" : "en-GB";
  const [microsoft, setMicrosoft] = useState<MicrosoftState | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [busy, setBusy] = useState<"idle" | "signin" | "test" | "disconnect">("idle");
  const [notice, setNotice] = useState<Notice | null>(null);

  const load = useCallback(async () => {
    const response = await appFetch("/api/integrations/email/setup", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setMicrosoft(data.microsoft ?? null);
    setGoogleConnected(Boolean(data.google?.connected));
  }, []);

  useEffect(() => { void load().catch(() => undefined); }, [load]);

  // The Microsoft window tells us (same origin only) when sign-in is done.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.data?.type !== "sf-microsoft-connected") return;
      setBusy("idle");
      void load().then(() => onChange?.());
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [load, onChange]);

  if (!microsoft?.available) return null;
  if (googleConnected && microsoft.status === "not_connected") return null;

  async function signIn() {
    setNotice(null);
    // Open the tab inside the click so pop-up blockers allow it.
    const win = window.open("about:blank", "sf-microsoft-signin");
    if (!win) { setNotice({ type: "error", text: text.popupBlocked }); return; }
    setBusy("signin");
    try {
      const response = await appFetch("/api/integrations/email/microsoft/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginHint: microsoft?.email ?? undefined }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) throw new Error(data.error || text.failed);
      win.location.href = data.url;
      const watcher = window.setInterval(() => {
        if (win.closed) { window.clearInterval(watcher); setBusy("idle"); void load().catch(() => undefined); }
      }, 800);
    } catch (error) {
      win.close();
      setBusy("idle");
      setNotice({ type: "error", text: error instanceof Error ? error.message : text.failed });
    }
  }

  async function disconnect() {
    setBusy("disconnect");
    setNotice(null);
    try {
      const response = await appFetch("/api/integrations/email/microsoft", { method: "DELETE" });
      if (!response.ok) throw new Error(text.failed);
      await load();
      onChange?.();
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : text.failed });
    } finally { setBusy("idle"); }
  }

  async function sendTest() {
    setBusy("test");
    setNotice(null);
    try {
      const response = await appFetch("/api/integrations/email/microsoft/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || text.failed);
      setNotice({ type: "success", text: text.testSent(data.to) });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : text.failed });
      await load().catch(() => undefined);
    } finally { setBusy("idle"); }
  }

  const needsReconnect = microsoft.status === "needs_reconnect" || microsoft.status === "revoked";
  const lastSync = microsoft.lastSyncedAt
    ? text.lastSync(new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(microsoft.lastSyncedAt)))
    : text.notSynced;

  return (
    <section className="mailbox-ms" aria-label={text.title}>
      <div className="mailbox-ms-head"><strong>{text.title}</strong><span>{text.badge}</span></div>

      {notice ? (
        <div className={`mailbox-notice ${notice.type}`} role="status">
          {notice.type === "success" ? <Check size={18} /> : <AlertCircle size={18} />}<div><strong>{notice.text}</strong></div>
        </div>
      ) : null}

      {microsoft.connected && !needsReconnect ? (
        <>
          <div className="mailbox-ms-row">
            <span className="mailbox-ms-ok"><Check size={15} />{text.connectedVia} <b>{microsoft.email}</b></span>
            <button type="button" className="mailbox-secondary" onClick={() => void disconnect()} disabled={busy !== "idle"}>
              {busy === "disconnect" ? <Loader2 size={15} className="mailbox-spin" /> : <Unplug size={15} />}{text.disconnect}
            </button>
          </div>
          <p>{lastSync}</p>
          <button type="button" className="mailbox-secondary" onClick={() => void sendTest()} disabled={busy !== "idle"}>
            {busy === "test" ? <Loader2 size={15} className="mailbox-spin" /> : <Send size={15} />}{text.test}
          </button>
        </>
      ) : (
        <>
          <p>{needsReconnect ? text.reconnectDetail : text.intro}</p>
          {!needsReconnect ? <p>{text.detail}</p> : null}
          <button type="button" className="mailbox-primary" onClick={() => void signIn()} disabled={busy !== "idle"}>
            {busy === "signin" ? <Loader2 size={16} className="mailbox-spin" /> : <Mail size={16} />}
            {busy === "signin" ? text.waiting : needsReconnect ? text.reconnect : text.signIn}
          </button>
          <p className="mailbox-ms-note">{text.adminNote}</p>
        </>
      )}
      <style>{`
        .mailbox-ms{display:grid;gap:10px;padding:18px;margin-bottom:20px;border:1px solid var(--border);border-radius:16px;background:rgba(255,255,255,.02)}
        .mailbox-ms-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.mailbox-ms-head strong{font-size:15px;font-weight:600;color:var(--text)}
        .mailbox-ms-head span{font-size:11px;font-weight:600;padding:3px 8px;border-radius:999px;background:rgba(199,245,111,.14);color:var(--tone-success)}
        .mailbox-ms>p{margin:0;font-size:13px;line-height:1.55;color:var(--muted)}.mailbox-ms>p.mailbox-ms-note{font-size:12px}
        .mailbox-ms>button,.mailbox-ms-row>button{justify-self:start;min-height:40px;border-radius:10px;padding:0 14px;display:inline-flex;align-items:center;justify-content:center;gap:8px;font:600 13px/1 inherit;cursor:pointer;white-space:nowrap}
        .mailbox-ms>button:disabled,.mailbox-ms-row>button:disabled{cursor:not-allowed;opacity:.55}
        .mailbox-ms-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
        .mailbox-ms-ok{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--muted)}.mailbox-ms-ok svg{color:var(--tone-success)}.mailbox-ms-ok b{color:var(--text);font-weight:600}
      `}</style>
    </section>
  );
}
