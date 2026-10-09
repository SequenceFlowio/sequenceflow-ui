"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Copy, ExternalLink, Loader2, Mail, Send, Unplug } from "lucide-react";

import { appFetch } from "@/lib/shopify/client";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

type GoogleState = {
  available: boolean;
  connected: boolean;
  status: "not_connected" | "active" | "needs_reconnect" | "revoked";
  email: string | null;
};
type ForwardingState = { status: "none" | "pending" | "confirmed" | "rejected"; requestedBy: string | null; code: string | null };
type Notice = { type: "success" | "error"; text: string };

const copy = {
  nl: {
    title: "Gmail koppelen zonder wachtwoord",
    badge: "Aanbevolen",
    intro: "Log in met Google om antwoorden vanaf je eigen adres te versturen, en laat Gmail je klantmail doorsturen. Geen app-wachtwoord nodig.",
    step1: "Inloggen met Google",
    step1Detail: "Kies het Gmail-account waarop klanten je mailen en geef Support One toestemming om namens jou te versturen. Support One kan je mail niet lezen.",
    signIn: "Inloggen met Google",
    reconnect: "Opnieuw inloggen met Google",
    reconnectDetail: "De Google-toegang is verlopen of ingetrokken. Log opnieuw in om weer te kunnen versturen.",
    sendingFrom: "Versturen vanaf",
    disconnect: "Ontkoppelen",
    waiting: "Wacht op Google…",
    popupBlocked: "Je browser blokkeerde het Google-venster. Sta pop-ups toe voor deze pagina en probeer opnieuw.",
    step2: "Doorsturen aanzetten in Gmail",
    step2Detail: "Zo komen nieuwe klantvragen in Support One binnen. Je originele mail blijft gewoon in Gmail staan.",
    forwardingAddress: "Jouw doorstuuradres",
    copy: "Kopiëren",
    copied: "Gekopieerd",
    openGmail: "Open doorstuurinstellingen in Gmail",
    howTo: ["Klik op ‘Een doorstuuradres toevoegen’ en plak het adres hierboven.", "Klik op ‘Volgende’ en ‘Doorgaan’. Wij bevestigen de aanvraag automatisch.", "Kies daarna ‘Een kopie van inkomende e-mail doorsturen naar…’ en klik onderaan op ‘Wijzigingen opslaan’."],
    fwNone: "Nog geen aanvraag van Gmail ontvangen.",
    fwPending: "Gmail vroeg om bevestiging. We bevestigen het nu automatisch…",
    fwConfirmed: "Doorsturen is bevestigd. Controleer in Gmail dat ‘Een kopie doorsturen naar…’ aanstaat en opgeslagen is.",
    fwRejected: (from: string) => `Er kwam een doorstuuraanvraag van ${from}. Dat is niet je gekoppelde adres, dus we hebben hem niet automatisch bevestigd.`,
    fwCode: "Bevestigingscode (alleen nodig als Gmail erom vraagt)",
    step3: "Testen",
    step3Detail: "We sturen een testmail vanuit je Gmail naar jezelf. Staat doorsturen aan, dan verschijnt hij ook in je Support One-inbox.",
    test: "Stuur testmail",
    testSent: (to: string) => `Testmail verstuurd naar ${to}. Kijk over een minuut in je Inbox.`,
    failed: "Dat lukte niet. Probeer het opnieuw.",
    otherWay: "Liever met een app-wachtwoord of een andere mailprovider? Gebruik de instellingen hieronder.",
  },
  en: {
    title: "Connect Gmail without a password",
    badge: "Recommended",
    intro: "Sign in with Google to send replies from your own address, and let Gmail forward your customer email. No app password needed.",
    step1: "Sign in with Google",
    step1Detail: "Choose the Gmail account customers email and allow Support One to send on your behalf. Support One cannot read your email.",
    signIn: "Sign in with Google",
    reconnect: "Sign in with Google again",
    reconnectDetail: "Google access expired or was revoked. Sign in again to keep sending.",
    sendingFrom: "Sending from",
    disconnect: "Disconnect",
    waiting: "Waiting for Google…",
    popupBlocked: "Your browser blocked the Google window. Allow pop-ups for this page and try again.",
    step2: "Turn on forwarding in Gmail",
    step2Detail: "This brings new customer questions into Support One. Your original email stays in Gmail.",
    forwardingAddress: "Your forwarding address",
    copy: "Copy",
    copied: "Copied",
    openGmail: "Open forwarding settings in Gmail",
    howTo: ["Click ‘Add a forwarding address’ and paste the address above.", "Click ‘Next’ and ‘Proceed’. We confirm the request automatically.", "Then choose ‘Forward a copy of incoming mail to…’ and click ‘Save Changes’ at the bottom."],
    fwNone: "No request from Gmail yet.",
    fwPending: "Gmail asked for confirmation. We are confirming it automatically…",
    fwConfirmed: "Forwarding is confirmed. Check in Gmail that ‘Forward a copy of incoming mail to…’ is on and saved.",
    fwRejected: (from: string) => `A forwarding request came from ${from}. That is not your connected address, so we did not confirm it automatically.`,
    fwCode: "Confirmation code (only needed if Gmail asks for it)",
    step3: "Test",
    step3Detail: "We send a test from your Gmail to yourself. With forwarding on, it also shows up in your Support One inbox.",
    test: "Send test mail",
    testSent: (to: string) => `Test mail sent to ${to}. Check your Inbox in a minute.`,
    failed: "That did not work. Please try again.",
    otherWay: "Prefer an app password or another email provider? Use the settings below.",
  },
} as const;

/**
 * "Sign in with Google" (send only) + Gmail forwarding. Renders inside the
 * mailbox settings (uses its styles) and stays hidden until the feature is on.
 */
export default function GoogleMailboxConnect({ onChange }: { onChange?: () => void }) {
  const { language } = useTranslation();
  const text = copy[language];
  const [google, setGoogle] = useState<GoogleState | null>(null);
  const [forwarding, setForwarding] = useState<ForwardingState>({ status: "none", requestedBy: null, code: null });
  const [inboundEmail, setInboundEmail] = useState("");
  const [busy, setBusy] = useState<"idle" | "signin" | "test" | "disconnect">("idle");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [copied, setCopied] = useState(false);
  const popup = useRef<Window | null>(null);

  const load = useCallback(async () => {
    const response = await appFetch("/api/integrations/email/setup", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setGoogle(data.google ?? null);
    if (data.forwarding) setForwarding(data.forwarding);
    setInboundEmail(data.inboundEmail ?? "");
  }, []);

  useEffect(() => { void load().catch(() => undefined); }, [load]);

  // The Google window tells us (same origin only) when sign-in is done.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.data?.type !== "sf-google-connected") return;
      setBusy("idle");
      void load().then(() => onChange?.());
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [load, onChange]);

  // While waiting on Gmail's forwarding confirmation, check every few seconds.
  const waitingOnForwarding = Boolean(google?.connected) && forwarding.status !== "confirmed";
  useEffect(() => {
    if (!waitingOnForwarding) return;
    const timer = window.setInterval(() => { void load().catch(() => undefined); }, 6000);
    return () => window.clearInterval(timer);
  }, [waitingOnForwarding, load]);

  if (!google?.available) return null;

  async function signIn() {
    setNotice(null);
    // Open the window synchronously (inside the click) so pop-up blockers allow it.
    const win = window.open("about:blank", "sf-google-signin", "width=520,height=700");
    if (!win) { setNotice({ type: "error", text: text.popupBlocked }); return; }
    popup.current = win;
    setBusy("signin");
    try {
      const response = await appFetch("/api/integrations/email/google/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginHint: google?.email ?? undefined }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) throw new Error(data.error || text.failed);
      win.location.href = data.url;
      // If the window is closed without finishing, stop waiting.
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
      const response = await appFetch("/api/integrations/email/google", { method: "DELETE" });
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
      const response = await appFetch("/api/integrations/email/google/test", {
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

  const needsReconnect = google.status === "needs_reconnect" || google.status === "revoked";
  const gmailSettingsUrl = `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(google.email ?? "")}#settings/fwdandpop`;
  const forwardingLine = forwarding.status === "confirmed" ? text.fwConfirmed
    : forwarding.status === "pending" ? text.fwPending
    : forwarding.status === "rejected" ? text.fwRejected(forwarding.requestedBy ?? "?")
    : text.fwNone;

  return (
    <section className="mailbox-google" aria-label={text.title}>
      <div className="mailbox-google-head">
        <strong>{text.title}</strong><span>{text.badge}</span>
      </div>
      <p className="mailbox-google-intro">{text.intro}</p>

      {notice ? (
        <div className={`mailbox-notice ${notice.type}`} role="status">
          {notice.type === "success" ? <Check size={18} /> : <AlertCircle size={18} />}<div><strong>{notice.text}</strong></div>
        </div>
      ) : null}

      <ol className="mailbox-google-steps">
        <li>
          <h3>1. {text.step1}</h3>
          {google.connected && !needsReconnect ? (
            <div className="mailbox-google-row">
              <span className="mailbox-google-ok"><Check size={15} />{text.sendingFrom} <b>{google.email}</b></span>
              <button type="button" className="mailbox-secondary" onClick={() => void disconnect()} disabled={busy !== "idle"}>
                {busy === "disconnect" ? <Loader2 size={15} className="mailbox-spin" /> : <Unplug size={15} />}{text.disconnect}
              </button>
            </div>
          ) : (
            <>
              <p>{needsReconnect ? text.reconnectDetail : text.step1Detail}</p>
              <button type="button" className="mailbox-primary" onClick={() => void signIn()} disabled={busy !== "idle"}>
                {busy === "signin" ? <Loader2 size={16} className="mailbox-spin" /> : <Mail size={16} />}
                {busy === "signin" ? text.waiting : needsReconnect ? text.reconnect : text.signIn}
              </button>
            </>
          )}
        </li>

        {google.connected ? (
          <li>
            <h3>2. {text.step2}</h3>
            <p>{text.step2Detail}</p>
            <div className="mailbox-forwarding-address">
              <div><span className="mailbox-google-label">{text.forwardingAddress}</span><code>{inboundEmail}</code></div>
              <button type="button" onClick={() => { void navigator.clipboard.writeText(inboundEmail); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }}>
                <Copy size={15} />{copied ? text.copied : text.copy}
              </button>
            </div>
            <a className="mailbox-secondary mailbox-google-link" href={gmailSettingsUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} />{text.openGmail}</a>
            <ul className="mailbox-google-howto">{text.howTo.map((line) => <li key={line}>{line}</li>)}</ul>
            <p className={`mailbox-google-status is-${forwarding.status}`} role="status">
              {forwarding.status === "confirmed" ? <Check size={15} /> : forwarding.status === "rejected" ? <AlertCircle size={15} /> : <Loader2 size={15} className="mailbox-spin" />}
              {forwardingLine}
            </p>
            {forwarding.code && forwarding.status !== "confirmed" ? <p className="mailbox-google-code">{text.fwCode}: <code>{forwarding.code}</code></p> : null}
          </li>
        ) : null}

        {google.connected && !needsReconnect ? (
          <li>
            <h3>3. {text.step3}</h3>
            <p>{text.step3Detail}</p>
            <button type="button" className="mailbox-secondary" onClick={() => void sendTest()} disabled={busy !== "idle"}>
              {busy === "test" ? <Loader2 size={15} className="mailbox-spin" /> : <Send size={15} />}{text.test}
            </button>
          </li>
        ) : null}
      </ol>
      <p className="mailbox-google-other">{text.otherWay}</p>
      <style>{`
        .mailbox-google{display:grid;gap:12px;padding:18px;margin-bottom:20px;border:1px solid rgba(199,245,111,.28);border-radius:16px;background:rgba(199,245,111,.04)}
        .mailbox-google-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.mailbox-google-head strong{font-size:15px;font-weight:600;color:var(--text)}
        .mailbox-google-head span{font-size:11px;font-weight:600;padding:3px 8px;border-radius:999px;background:rgba(199,245,111,.14);color:var(--sf-green)}
        .mailbox-google-intro,.mailbox-google-other{margin:0;font-size:13px;line-height:1.55;color:var(--muted)}
        .mailbox-google-steps{list-style:none;margin:0;padding:0;display:grid;gap:16px}.mailbox-google-steps>li{display:grid;gap:9px;padding-top:14px;border-top:1px solid var(--border)}
        .mailbox-google-steps h3{margin:0;font-size:14px;font-weight:500;color:var(--text)}.mailbox-google-steps p{margin:0;font-size:13px;line-height:1.55;color:var(--muted)}
        .mailbox-google-steps>li>button,.mailbox-google-row>button,.mailbox-google-link{justify-self:start;min-height:40px;border-radius:10px;padding:0 14px;display:inline-flex;align-items:center;justify-content:center;gap:8px;font:600 13px/1 inherit;cursor:pointer;text-decoration:none;white-space:nowrap}
        .mailbox-google-steps>li>button:disabled,.mailbox-google-row>button:disabled{cursor:not-allowed;opacity:.55}
        .mailbox-google-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.mailbox-google-ok{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--muted)}.mailbox-google-ok svg{color:var(--sf-green)}.mailbox-google-ok b{color:var(--text);font-weight:600}
        .mailbox-google-label{display:block;font-size:12px;color:var(--muted);margin-bottom:4px}
        .mailbox-google-howto{margin:0;padding-left:18px;display:grid;gap:4px;font-size:13px;line-height:1.5;color:var(--muted)}
        .mailbox-google-status{display:flex!important;align-items:flex-start;gap:7px}.mailbox-google-status svg{flex:none;margin-top:2px}.mailbox-google-status.is-confirmed{color:var(--sf-green)!important}.mailbox-google-status.is-rejected{color:var(--tone-warning)!important}
        .mailbox-google-code code{color:var(--text);font-size:13px}
      `}</style>
    </section>
  );
}
