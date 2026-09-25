"use client";

import { appFetch } from "@/lib/shopify/client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  CircleHelp,
  Copy,
  ExternalLink,
  Inbox,
  Loader2,
  LockKeyhole,
  Mail,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  ServerCog,
  Unplug,
} from "lucide-react";

import { ConfirmDialog } from "./SettingsUi";
import { SequenceMark } from "@/components/marketing/SequenceMark";
import { configuredMailboxEmail } from "@/lib/email/outbound/configuredMailboxEmail";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import {
  IMAP_PRESETS,
  SMTP_PRESETS,
  type ImapEncryption,
  type ImapPresetKey,
  type SmtpEncryption,
} from "@/lib/email/outbound/smtpPresets";

type ConnectionStatus = "not_configured" | "test_required" | "active" | "failed";
type BusyState = "idle" | "saving" | "testing" | "syncing" | "disconnecting";
type Notice = { type: "success" | "error" | "warning"; title: string; detail?: string };

type SetupResponse = {
  inboundEmail?: string;
  smtp?: {
    provider?: ImapPresetKey;
    host?: string;
    port?: number;
    encryption?: SmtpEncryption;
    username?: string;
    fromEmail?: string;
    fromName?: string;
    status?: ConnectionStatus;
    lastTestedAt?: string | null;
    lastError?: string | null;
    hasPassword?: boolean;
  };
  imap?: {
    provider?: ImapPresetKey;
    host?: string;
    port?: number;
    encryption?: ImapEncryption;
    username?: string;
    mailbox?: string;
    status?: ConnectionStatus;
    lastTestedAt?: string | null;
    lastSyncedAt?: string | null;
    lastError?: string | null;
    hasPassword?: boolean;
  };
};

const providerKeys: ImapPresetKey[] = ["google_workspace", "hostinger", "mijndomein", "other", "microsoft_365"];

const copy = {
  nl: {
    title: "Supportmailbox",
    description: "Koppel het adres waar je klantvragen ontvangt. Daarna testen we ontvangen en versturen.",
    routeYours: "Jouw mailbox",
    routeCaption: "Support One leest een kopie. Er wordt nooit iets verplaatst of verwijderd.",
    modeForwardDetail: "Ontvang nieuwe vragen via doorsturen. Voor versturen vanaf dit adres is nog een uitgaande koppeling nodig.",
    forwardTitle: "Stuur je supportmail door naar dit adres",
    forwardDetail: "Stel bij je mailprovider een automatische doorsturing in van je supportadres naar het adres hieronder. Nieuwe klantvragen verschijnen dan vanzelf in de inbox.",
    none: "Geen",
    disconnectTitle: "Mailbox ontkoppelen?",
    setup: "Instellen",
    connected: "Verbonden",
    attention: "Actie nodig",
    email: "E-mailadres van de klantmailbox",
    emailHelp: "Vul het adres van de Google-mailbox in waar klantvragen binnenkomen. Het moet een echte mailbox zijn, geen alias.",
    emailHelpOther: "Vul het bestaande adres in waar klantvragen binnenkomen. Het moet een echte mailbox zijn, geen alias.",
    name: "Afzendernaam (optioneel)",
    nameHelp: "Deze naam staat als afzender boven je antwoorden, bijvoorbeeld DeepRest Support.",
    password: "Mailboxwachtwoord",
    replacePassword: "Wachtwoord vervangen (optioneel)",
    passwordHelp: "Gebruik het wachtwoord dat specifiek bij deze mailbox hoort, niet automatisch het wachtwoord van je hostingaccount.",
    hostingerPassword: "Wachtwoord van deze Hostinger-mailbox",
    hostingerPasswordHelp: "Gebruik het wachtwoord dat je in hPanel bij dit specifieke e-mailadres hebt ingesteld. Dit is niet je Hostinger-accountwachtwoord.",
    mijndomeinPassword: "Wachtwoord van deze MijnDomein-mailbox",
    mijndomeinPasswordHelp: "Gebruik het wachtwoord waarmee je op deze specifieke mailbox inlogt. Dit is niet per se je MijnDomein-accountwachtwoord.",
    googlePassword: "Google app-wachtwoord (16 tekens)",
    googlePasswordHelp: "De klant zet tweestapsverificatie aan, opent Google App-wachtwoorden en maakt er één voor Support One. Plak de 16 tekens hier. Gebruik nooit het gewone Google-wachtwoord.",
    googlePasswordUnavailable: "Zie je geen App-wachtwoorden? Google kan deze optie voor sommige werk- of beveiligde accounts blokkeren. Gebruik dan voorlopig doorsturen.",
    createGooglePassword: "Google app-wachtwoord maken",
    microsoftTitle: "Microsoft vereist beveiligd verbinden",
    microsoftDetail: "Microsoft 365 accepteert hiervoor geen normaal mailbox- of app-wachtwoord meer. We zetten Microsoft OAuth klaar; tot die tijd kun je deze provider niet veilig nieuw koppelen.",
    microsoftSoon: "Binnenkort beschikbaar",
    passwordStored: "Er is al een versleuteld wachtwoord opgeslagen.",
    save: "Opslaan en verbinding testen",
    test: "Verbinding testen",
    retry: "Opnieuw testen",
    sync: "Nu synchroniseren",
    manage: "Instellingen beheren",
    closeManage: "Beheer sluiten",
    automaticServers: "Servergegevens automatisch ingesteld",
    automaticServersDetail: "Support One kent de instellingen van {provider}. Je hoeft verder niets in te vullen.",
    customRequired: "Servergegevens invullen",
    customRequiredDetail: "Bij een andere provider hebben we deze gegevens uit de handleiding van je mailprovider nodig.",
    stepProvider: "Waar staat deze mailbox?",
    stepProviderDetail: "Voor @gmail.com staat Gmail al klaar. Bij een eigen domein op Google kies je ook Gmail / Google Workspace.",
    stepIdentity: "Welk e-mailadres wil je koppelen?",
    stepIdentityDetail: "Gebruik het adres waarop de klant nu zijn klantvragen ontvangt.",
    stepAccess: "Maak een Google app-wachtwoord",
    stepAccessDetail: "Dat is een aparte toegangscode voor Support One, geen normaal Google-wachtwoord.",
    stepAccessOther: "Geef Support One toegang tot de mailbox",
    stepAccessOtherDetail: "Gebruik het wachtwoord van deze mailbox. We slaan het versleuteld op.",
    workspaceNote: "Deze mailbox wordt gekoppeld aan de huidige Support One-werkruimte. Gebruik voor een andere klant een apart account, zodat klantvragen gescheiden blijven.",
    directMethod: "Rechtstreeks koppelen: inkomende mail lezen en antwoorden versturen vanaf hetzelfde adres.",
    switchToForward: "Lukt rechtstreeks koppelen niet? Gebruik doorsturen",
    switchToMailbox: "Terug naar rechtstreeks koppelen",
    afterConnect: "Test het met een nieuwe klantvraag: stuur vanaf een ander adres een proefmail naar deze mailbox. Klik daarna op ‘Nu synchroniseren’ en controleer de Inbox. Oude mails worden niet automatisch geïmporteerd.",
    testSendsEmail: "Bij de verbindingstest sturen we één testmail naar deze mailbox. Daarna halen we alleen nieuwe berichten op.",
    incoming: "Inkomende mail",
    outgoing: "Uitgaande mail",
    active: "Actief",
    needsTest: "Klaar om te testen",
    failed: "Verbinding mislukt",
    notConfigured: "Niet ingesteld",
    receivedVia: "Nieuwe mails worden direct opgehaald",
    sentVia: "Antwoorden vertrekken vanuit je eigen adres",
    lastSync: "Laatst gesynchroniseerd",
    never: "Nog niet",
    testingTitle: "We controleren je mailbox",
    successTitle: "Je supportmailbox is klaar",
    successDetail: "Inkomende en uitgaande mail werken. De eerste synchronisatie is ook uitgevoerd.",
    syncTitle: "Mailbox is bijgewerkt",
    syncDetail: "{count} nieuwe berichten geïmporteerd.",
    disconnectedTitle: "Mailbox ontkoppeld",
    mismatchTitle: "Deze instellingen lijken niet bij het e-mailadres te passen",
    mismatchDetail: "We herkennen {domain} als {provider}. Gebruik de aanbevolen instellingen om verbindingsfouten te voorkomen.",
    useRecommended: "Aanbevolen instellingen gebruiken",
    customServers: "Serverinstellingen",
    imapHost: "Inkomende server (IMAP)",
    imapHostHelp: "IMAP is de server waarmee Support nieuwe berichten uit je mailbox leest.",
    smtpHost: "Uitgaande server (SMTP)",
    smtpHostHelp: "SMTP is de server waarmee Support antwoorden vanuit je mailbox verstuurt.",
    port: "Poort",
    portHelp: "De poort en beveiliging horen bij elkaar en komen uit de handleiding van je mailprovider.",
    security: "Beveiliging",
    username: "Gebruikersnaam",
    usernameHelp: "Meestal is dit je volledige e-mailadres.",
    folder: "Mailboxmap",
    folderHelp: "Nieuwe klantmails staan normaal in INBOX.",
    outgoingPassword: "Afwijkend SMTP-wachtwoord (optioneel)",
    forwardingAddress: "Jouw doorstuuradres",
    copy: "Kopiëren",
    copied: "Gekopieerd",
    disconnect: "Mailbox ontkoppelen",
    disconnectConfirm: "Weet je zeker dat je deze mailbox wilt ontkoppelen? Nieuwe mails worden dan niet meer opgehaald.",
    testPartial: "Een deel van de verbinding werkt nog niet",
    loading: "Mailbox laden",
    saveError: "Mailbox opslaan mislukt.",
    testError: "De mailboxverbinding kon niet volledig worden geactiveerd.",
    syncError: "Synchroniseren mislukt.",
    other: "Andere provider",
    otherProviders: "Overige mailproviders",
    requiredFieldsGoogle: "Vul een geldig klantadres en een Google app-wachtwoord van 16 tekens in.",
    requiredFieldsOther: "Vul een geldig klantadres en het mailboxwachtwoord in.",
  },
  en: {
    title: "Support mailbox",
    description: "Connect the address that receives customer questions. Then we test receiving and sending.",
    routeYours: "Your mailbox",
    routeCaption: "Support One reads a copy. Nothing is ever moved or deleted.",
    modeForwardDetail: "Receive new questions through forwarding. Sending from this address still needs an outgoing connection.",
    forwardTitle: "Forward your support email to this address",
    forwardDetail: "Set up automatic forwarding from your support address to the address below at your email provider. New customer questions then appear in the inbox.",
    none: "None",
    disconnectTitle: "Disconnect mailbox?",
    setup: "Set up",
    connected: "Connected",
    attention: "Action needed",
    email: "Customer mailbox email address",
    emailHelp: "Enter the Google mailbox address that receives customer questions. It must be a real mailbox, not an alias.",
    emailHelpOther: "Enter the existing address that receives customer questions. It must be a real mailbox, not an alias.",
    name: "Sender name (optional)",
    nameHelp: "This sender name appears above your replies, for example DeepRest Support.",
    password: "Mailbox password",
    replacePassword: "Replace password (optional)",
    passwordHelp: "Use the password belonging to this specific mailbox, which is not automatically your hosting account password.",
    hostingerPassword: "Password for this Hostinger mailbox",
    hostingerPasswordHelp: "Use the password configured for this specific email address in hPanel. This is not your Hostinger account password.",
    mijndomeinPassword: "Password for this MijnDomein mailbox",
    mijndomeinPasswordHelp: "Use the password for this specific mailbox. It is not necessarily your MijnDomein account password.",
    googlePassword: "Google app password (16 characters)",
    googlePasswordHelp: "The customer turns on 2-Step Verification, opens Google App Passwords, and creates one for Support One. Paste the 16 characters here. Never use the regular Google password.",
    googlePasswordUnavailable: "Can't see App Passwords? Google can block this option for some work or protected accounts. Use forwarding for now.",
    createGooglePassword: "Create Google app password",
    microsoftTitle: "Microsoft requires secure connection",
    microsoftDetail: "Microsoft 365 no longer accepts a normal mailbox or app password for this connection. Microsoft OAuth is being prepared; until then this provider cannot be connected safely.",
    microsoftSoon: "Coming soon",
    passwordStored: "An encrypted password is already stored.",
    save: "Save and test connection",
    test: "Test connection",
    retry: "Test again",
    sync: "Sync now",
    manage: "Manage settings",
    closeManage: "Close settings",
    automaticServers: "Server details configured automatically",
    automaticServersDetail: "Support One knows the settings for {provider}. You do not need to enter anything else.",
    customRequired: "Enter server details",
    customRequiredDetail: "For another provider, use the details from your email provider's documentation.",
    stepProvider: "Where is this mailbox hosted?",
    stepProviderDetail: "Gmail is ready for @gmail.com. For a custom domain hosted by Google, also choose Gmail / Google Workspace.",
    stepIdentity: "Which email address do you want to connect?",
    stepIdentityDetail: "Use the address where the customer currently receives support questions.",
    stepAccess: "Create a Google app password",
    stepAccessDetail: "This is a separate access code for Support One, not the normal Google password.",
    stepAccessOther: "Give Support One access to the mailbox",
    stepAccessOtherDetail: "Use the password for this mailbox. We store it encrypted.",
    workspaceNote: "This mailbox connects to the current Support One workspace. Use a separate account for another customer so their messages stay separate.",
    directMethod: "Direct connection: read incoming mail and send replies from the same address.",
    switchToForward: "Direct connection unavailable? Use forwarding",
    switchToMailbox: "Back to direct connection",
    afterConnect: "Test it with a new customer question: send a sample email to this mailbox from another address. Then click ‘Sync now’ and check the Inbox. Old emails are not imported automatically.",
    testSendsEmail: "The connection test sends one test email to this mailbox. After that, we retrieve only new messages.",
    incoming: "Incoming mail",
    outgoing: "Outgoing mail",
    active: "Active",
    needsTest: "Ready to test",
    failed: "Connection failed",
    notConfigured: "Not configured",
    receivedVia: "New messages are retrieved directly",
    sentVia: "Replies are sent from your own address",
    lastSync: "Last synchronized",
    never: "Not yet",
    testingTitle: "Checking your mailbox",
    successTitle: "Your support mailbox is ready",
    successDetail: "Incoming and outgoing mail work. The first synchronization has also completed.",
    syncTitle: "Mailbox is up to date",
    syncDetail: "Imported {count} new messages.",
    disconnectedTitle: "Mailbox disconnected",
    mismatchTitle: "These settings do not appear to match the email address",
    mismatchDetail: "We recognize {domain} as {provider}. Use the recommended settings to prevent connection errors.",
    useRecommended: "Use recommended settings",
    customServers: "Server settings",
    imapHost: "Incoming server (IMAP)",
    imapHostHelp: "IMAP is the server Support uses to read new messages from your mailbox.",
    smtpHost: "Outgoing server (SMTP)",
    smtpHostHelp: "SMTP is the server Support uses to send replies from your mailbox.",
    port: "Port",
    portHelp: "The port and security setting belong together and come from your email provider's documentation.",
    security: "Security",
    username: "Username",
    usernameHelp: "This is usually your full email address.",
    folder: "Mailbox folder",
    folderHelp: "New customer messages are normally stored in INBOX.",
    outgoingPassword: "Different SMTP password (optional)",
    forwardingAddress: "Your forwarding address",
    copy: "Copy",
    copied: "Copied",
    disconnect: "Disconnect mailbox",
    disconnectConfirm: "Are you sure you want to disconnect this mailbox? New email will no longer be retrieved.",
    testPartial: "Part of the connection still needs attention",
    loading: "Loading mailbox",
    saveError: "Could not save mailbox.",
    testError: "The mailbox connection could not be fully activated.",
    syncError: "Synchronization failed.",
    other: "Other provider",
    otherProviders: "Other email providers",
    requiredFieldsGoogle: "Enter a valid customer address and a 16-character Google app password.",
    requiredFieldsOther: "Enter a valid customer address and the mailbox password.",
  },
} as const;

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 44,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: 14,
  fontFamily: "inherit",
  boxSizing: "border-box",
  outline: "none",
};

function FieldLabel({ children, help, htmlFor }: { children: React.ReactNode; help?: string; htmlFor?: string }) {
  return (
    <div className="mailbox-field-label">
      <label htmlFor={htmlFor}>{children}</label>
      {help ? (
        <details className="mailbox-help">
          <summary aria-label={`Uitleg: ${String(children)}`}><CircleHelp size={14} /></summary>
          <p>{help}</p>
        </details>
      ) : null}
    </div>
  );
}

function SetupStep({ number, title, detail, children }: { number: number; title: string; detail: string; children: React.ReactNode }) {
  return (
    <section className="mailbox-step">
      <div className="mailbox-step-heading">
        <span>{number}</span>
        <div><h3>{title}</h3><p>{detail}</p></div>
      </div>
      <div className="mailbox-step-content">{children}</div>
    </section>
  );
}

function detectProvider(email: string): ImapPresetKey | null {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  if (["gmail.com", "googlemail.com"].includes(domain)) return "google_workspace";
  if (["outlook.com", "hotmail.com", "live.com", "live.nl", "msn.com"].includes(domain)) return "microsoft_365";
  return null;
}

function statusLabel(status: ConnectionStatus, text: typeof copy.nl | typeof copy.en) {
  if (status === "active") return text.active;
  if (status === "test_required") return text.needsTest;
  if (status === "failed") return text.failed;
  return text.notConfigured;
}

function formatDate(value: string | null, locale: string, fallback: string) {
  if (!value) return fallback;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function SupportMailboxSettings() {
  const { language } = useTranslation();
  const text = copy[language];
  const locale = language === "nl" ? "nl-NL" : "en-GB";
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<ImapPresetKey>("google_workspace");
  const [email, setEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [password, setPassword] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [imapHost, setImapHost] = useState<string>(IMAP_PRESETS.google_workspace.host);
  const [imapPort, setImapPort] = useState(String(IMAP_PRESETS.google_workspace.port));
  const [imapEncryption, setImapEncryption] = useState<ImapEncryption>(IMAP_PRESETS.google_workspace.encryption);
  const [imapUsername, setImapUsername] = useState("");
  const [imapMailbox, setImapMailbox] = useState("INBOX");
  const [smtpHost, setSmtpHost] = useState<string>(SMTP_PRESETS.google_workspace.host);
  const [smtpPort, setSmtpPort] = useState(String(SMTP_PRESETS.google_workspace.port));
  const [smtpEncryption, setSmtpEncryption] = useState<SmtpEncryption>(SMTP_PRESETS.google_workspace.encryption);
  const [smtpUsername, setSmtpUsername] = useState("");
  const [imapStatus, setImapStatus] = useState<ConnectionStatus>("not_configured");
  const [smtpStatus, setSmtpStatus] = useState<ConnectionStatus>("not_configured");
  const [imapError, setImapError] = useState<string | null>(null);
  const [smtpError, setSmtpError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [inboundEmail, setInboundEmail] = useState("");
  const [busy, setBusy] = useState<BusyState>("idle");
  const [dirty, setDirty] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [mode, setMode] = useState<"mailbox" | "forward">("mailbox");
  const [showOtherProviders, setShowOtherProviders] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    appFetch("/api/integrations/email/setup")
      .then(async (response) => (response.ok ? response.json() as Promise<SetupResponse> : null))
      .then((data) => {
        if (!data) return;
        const imap = data.imap;
        const smtp = data.smtp;
        const mailboxConfigured = Boolean(imap?.host || smtp?.host || imap?.hasPassword || smtp?.hasPassword);
        const matchingProvider = imap?.provider && imap.provider === smtp?.provider ? imap.provider : null;
        const loadedProvider: ImapPresetKey = mailboxConfigured ? matchingProvider ?? "other" : "google_workspace";
        setProvider(loadedProvider);
        setEmail(configuredMailboxEmail({ smtp, imap }));
        setFromName(mailboxConfigured ? smtp?.fromName || "" : "");
        setImapHost(imap?.host || IMAP_PRESETS[loadedProvider].host);
        setImapPort(String(imap?.port ?? IMAP_PRESETS[loadedProvider].port));
        setImapEncryption(imap?.encryption ?? IMAP_PRESETS[loadedProvider].encryption);
        setImapUsername(mailboxConfigured ? imap?.username || smtp?.fromEmail || "" : "");
        setImapMailbox(imap?.mailbox || "INBOX");
        setSmtpHost(smtp?.host || SMTP_PRESETS[loadedProvider].host);
        setSmtpPort(String(smtp?.port ?? SMTP_PRESETS[loadedProvider].port));
        setSmtpEncryption(smtp?.encryption ?? SMTP_PRESETS[loadedProvider].encryption);
        setSmtpUsername(mailboxConfigured ? smtp?.username || smtp?.fromEmail || "" : "");
        setImapStatus(imap?.status ?? "not_configured");
        setSmtpStatus(smtp?.status ?? "not_configured");
        setImapError(imap?.lastError ?? null);
        setSmtpError(smtp?.lastError ?? null);
        setLastSyncedAt(imap?.lastSyncedAt ?? null);
        setInboundEmail(data.inboundEmail ?? "");
        setHasPassword(Boolean(imap?.hasPassword && smtp?.hasPassword));
      })
      .finally(() => setLoading(false));
  }, []);

  const connected = imapStatus === "active" && smtpStatus === "active" && !dirty;
  const detectedProvider = detectProvider(email);
  const providerMismatch = detectedProvider && provider !== detectedProvider;
  const providerLabel = provider === "other" ? text.other : IMAP_PRESETS[provider].label;
  const customProvider = provider === "other";
  const microsoftBlocked = provider === "microsoft_365" && !connected;
  const passwordLabel = hasPassword
    ? text.replacePassword
    : provider === "hostinger"
      ? text.hostingerPassword
      : provider === "mijndomein"
        ? text.mijndomeinPassword
        : provider === "google_workspace"
          ? text.googlePassword
          : text.password;
  const passwordGuidance = hasPassword && !password
    ? text.passwordStored
    : provider === "hostinger"
      ? text.hostingerPasswordHelp
      : provider === "mijndomein"
        ? text.mijndomeinPasswordHelp
        : provider === "google_workspace"
          ? text.googlePasswordHelp
          : text.passwordHelp;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const serverDetailsValid = !customProvider || Boolean(
    imapHost.trim() && smtpHost.trim() && imapUsername.trim() && smtpUsername.trim() && Number(imapPort) && Number(smtpPort),
  );
  const cleanPassword = provider === "google_workspace" ? password.replace(/\s/g, "") : password.trim();
  const credentialsReady = cleanPassword ? provider !== "google_workspace" || cleanPassword.length === 16 : hasPassword;
  const setupReady = emailValid && credentialsReady && serverDetailsValid && !microsoftBlocked;

  function markDirty() {
    setDirty(true);
    setNotice(null);
  }

  function chooseProvider(nextProvider: ImapPresetKey) {
    const imap = IMAP_PRESETS[nextProvider];
    const smtp = SMTP_PRESETS[nextProvider];
    setProvider(nextProvider);
    setImapHost(imap.host);
    setImapPort(String(imap.port));
    setImapEncryption(imap.encryption);
    setSmtpHost(smtp.host);
    setSmtpPort(String(smtp.port));
    setSmtpEncryption(smtp.encryption);
    setImapError(null);
    setSmtpError(null);
    markDirty();
  }

  function updateEmail(nextEmail: string) {
    const oldEmail = email;
    setEmail(nextEmail);
    if (!imapUsername || imapUsername === oldEmail) setImapUsername(nextEmail);
    if (!smtpUsername || smtpUsername === oldEmail) setSmtpUsername(nextEmail);
    markDirty();
  }

  async function saveMailbox(): Promise<boolean> {
    setBusy("saving");
    setNotice(null);
    setImapError(null);
    setSmtpError(null);
    try {
      const response = await appFetch("/api/integrations/email/mailbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          email,
          fromName,
          password: cleanPassword,
          imap: { host: imapHost, port: Number(imapPort), encryption: imapEncryption, username: imapUsername || email, mailbox: imapMailbox },
          smtp: { host: smtpHost, port: Number(smtpPort), encryption: smtpEncryption, username: smtpUsername || email, password: smtpPassword },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? text.saveError);
      setImapStatus("test_required");
      setSmtpStatus("test_required");
      setHasPassword(true);
      setPassword("");
      setSmtpPassword("");
      setDirty(false);
      return true;
    } catch (error) {
      setNotice({ type: "error", title: text.saveError, detail: error instanceof Error ? error.message : undefined });
      return false;
    } finally {
      setBusy("idle");
    }
  }

  async function saveAndTestMailbox() {
    if (await saveMailbox()) await testMailbox();
  }

  async function callTest(url: string) {
    const response = await appFetch(url, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || text.testError);
    return data;
  }

  async function syncMailbox(showNotice = true) {
    setBusy("syncing");
    try {
      const response = await appFetch("/api/integrations/email/imap/sync", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || text.syncError);
      setLastSyncedAt(new Date().toISOString());
      if (showNotice) {
        setNotice({ type: "success", title: text.syncTitle, detail: text.syncDetail.replace("{count}", String(data.processed ?? 0)) });
      }
      return true;
    } catch (error) {
      setNotice({ type: "error", title: text.syncError, detail: error instanceof Error ? error.message : undefined });
      return false;
    } finally {
      setBusy("idle");
    }
  }

  async function testMailbox() {
    setBusy("testing");
    setNotice({ type: "warning", title: text.testingTitle });
    setImapError(null);
    setSmtpError(null);
    const [imapResult, smtpResult] = await Promise.allSettled([
      callTest("/api/integrations/email/imap/test"),
      callTest("/api/integrations/email/smtp/test"),
    ]);
    const imapOk = imapResult.status === "fulfilled";
    const smtpOk = smtpResult.status === "fulfilled";
    setImapStatus(imapOk ? "active" : "failed");
    setSmtpStatus(smtpOk ? "active" : "failed");
    if (!imapOk) setImapError(imapResult.reason instanceof Error ? imapResult.reason.message : text.testError);
    if (!smtpOk) setSmtpError(smtpResult.reason instanceof Error ? smtpResult.reason.message : text.testError);

    if (imapOk && smtpOk) {
      setBusy("syncing");
      const synced = await syncMailbox(false);
      setNotice({
        type: synced ? "success" : "warning",
        title: text.successTitle,
        detail: synced ? text.successDetail : text.syncError,
      });
      setManageOpen(false);
    } else {
      setBusy("idle");
      const details = [
        !imapOk ? `${text.incoming}: ${imapResult.status === "rejected" ? String(imapResult.reason?.message ?? text.testError) : text.testError}` : null,
        !smtpOk ? `${text.outgoing}: ${smtpResult.status === "rejected" ? String(smtpResult.reason?.message ?? text.testError) : text.testError}` : null,
      ].filter(Boolean).join(" ");
      setNotice({ type: "error", title: text.testPartial, detail: details });
    }
  }

  async function disconnectMailbox() {
    setConfirmDisconnect(false);
    setBusy("disconnecting");
    try {
      const responses = await Promise.all([
        appFetch("/api/integrations/email/imap", { method: "DELETE" }),
        appFetch("/api/integrations/email/smtp", { method: "DELETE" }),
      ]);
      if (responses.some((response) => !response.ok)) throw new Error(text.testError);
      setImapStatus("not_configured");
      setSmtpStatus("not_configured");
      setHasPassword(false);
      setDirty(false);
      setManageOpen(false);
      setNotice({ type: "success", title: text.disconnectedTitle });
    } catch (error) {
      setNotice({ type: "error", title: text.testError, detail: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy("idle");
    }
  }

  const shouldSave = dirty || imapStatus === "not_configured" || smtpStatus === "not_configured";
  const primaryAction = shouldSave ? saveAndTestMailbox : testMailbox;
  const primaryLabel = shouldSave ? text.save : busy === "testing" ? text.testingTitle : imapStatus === "failed" || smtpStatus === "failed" ? text.retry : text.test;

  if (loading) {
    return (
      <section id="support-mailbox" className="mailbox-shell mailbox-loading">
        <Loader2 size={18} className="mailbox-spin" />
        <span>{text.loading}</span>
        <MailboxStyles />
      </section>
    );
  }

  return (
    <section id="support-mailbox" className="mailbox-shell" style={{ scrollMarginTop: 24 }}>
      <MailboxStyles />
      <header className="mailbox-header">
        <div>
          <h2>{text.title}</h2>
          <p>{text.description}</p>
        </div>
        <span className={`mailbox-state ${connected ? "is-active" : imapStatus === "failed" || smtpStatus === "failed" ? "is-error" : "is-pending"}`}>
          <span />{connected ? text.connected : imapStatus === "failed" || smtpStatus === "failed" ? text.attention : text.setup}
        </span>
      </header>

      {connected ? <div className="mailbox-route" role="note">
        <div className="mailbox-route-line">
          <span className="mailbox-route-node"><Mail size={15} aria-hidden />{connected && email.trim() ? email.trim() : text.routeYours}</span>
          <span className={`mailbox-route-link ${connected ? "is-live" : ""}`} aria-hidden />
          <span className="mailbox-route-node is-brand"><SequenceMark size={22} state={connected ? "idle" : "thinking"} title="" />Support One</span>
        </div>
        <p>{text.routeCaption}</p>
      </div> : null}

      <div className="mailbox-body">
        {notice ? (
          <div className={`mailbox-notice ${notice.type}`} role="status">
            {notice.type === "success" ? <Check size={18} /> : <AlertCircle size={18} />}
            <div><strong>{notice.title}</strong>{notice.detail ? <p>{notice.detail}</p> : null}</div>
          </div>
        ) : null}

        {connected && !manageOpen ? (
          <div className="mailbox-summary">
            <div className="mailbox-account">
              <div className="mailbox-account-icon"><Mail size={20} /></div>
              <div><strong>{email}</strong><span>{fromName || providerLabel} · {providerLabel}</span></div>
              <ShieldCheck size={20} className="mailbox-shield" />
            </div>
            <div className="mailbox-health">
              <StatusItem icon={<Inbox size={18} />} title={text.incoming} status={imapStatus} detail={text.receivedVia} text={text} />
              <StatusItem icon={<Send size={18} />} title={text.outgoing} status={smtpStatus} detail={text.sentVia} text={text} />
              <div className="mailbox-health-item">
                <RefreshCw size={18} /><div><span>{text.lastSync}</span><strong>{formatDate(lastSyncedAt, locale, text.never)}</strong></div>
              </div>
            </div>
            <div className="mailbox-actions">
              <button className="mailbox-primary" onClick={() => syncMailbox()} disabled={busy !== "idle"}>
                <RefreshCw size={16} className={busy === "syncing" ? "mailbox-spin" : ""} />{text.sync}
              </button>
              <button className="mailbox-secondary" onClick={() => setManageOpen(true)}><Settings2 size={16} />{text.manage}</button>
            </div>
            <p className="mailbox-after-connect">{text.afterConnect}</p>
          </div>
        ) : (
          <div className="mailbox-form">
            {inboundEmail && !connected ? (
              <div className="mailbox-method">
                <p>{mode === "mailbox" ? text.directMethod : text.modeForwardDetail}</p>
                <button type="button" onClick={() => setMode(mode === "mailbox" ? "forward" : "mailbox")}>
                  {mode === "mailbox" ? text.switchToForward : text.switchToMailbox}
                </button>
              </div>
            ) : null}

            {mode === "forward" && inboundEmail && !connected ? (
              <div className="mailbox-forwarding">
                <strong>{text.forwardTitle}</strong>
                <p>{text.forwardDetail}</p>
                <div className="mailbox-forwarding-address">
                  <div><FieldLabel>{text.forwardingAddress}</FieldLabel><code>{inboundEmail}</code></div>
                  <button type="button" onClick={() => { navigator.clipboard.writeText(inboundEmail); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }}><Copy size={15} />{copied ? text.copied : text.copy}</button>
                </div>
              </div>
            ) : <>
            <p className="mailbox-workspace-note"><ShieldCheck size={16} aria-hidden />{text.workspaceNote}</p>

            <SetupStep number={1} title={text.stepIdentity} detail={text.stepIdentityDetail}>
              <div>
                <FieldLabel htmlFor="support-mailbox-email" help={provider === "google_workspace" ? text.emailHelp : text.emailHelpOther}>{text.email}</FieldLabel>
                <input id="support-mailbox-email" type="email" value={email} onChange={(event) => updateEmail(event.target.value)} placeholder="support@klant.nl" autoComplete="off" style={inputStyle} />
              </div>
              <details className="mailbox-optional-name">
                <summary>{text.name}</summary>
                <div><FieldLabel htmlFor="support-mailbox-name" help={text.nameHelp}>{text.name}</FieldLabel><input id="support-mailbox-name" value={fromName} onChange={(event) => { setFromName(event.target.value); markDirty(); }} placeholder="Klantenservice" style={inputStyle} /></div>
              </details>
            </SetupStep>

            <SetupStep number={2} title={text.stepProvider} detail={text.stepProviderDetail}>
              <div className="mailbox-provider-choice">
                <button type="button" className={provider === "google_workspace" ? "selected" : ""} aria-pressed={provider === "google_workspace"} onClick={() => { chooseProvider("google_workspace"); setShowOtherProviders(false); }}>
                  <strong>Gmail / Google Workspace</strong>{provider === "google_workspace" ? <Check size={16} /> : null}
                </button>
                {provider === "google_workspace" ? <button type="button" className="mailbox-provider-more" aria-expanded={showOtherProviders} onClick={() => setShowOtherProviders((current) => !current)}>{text.otherProviders}</button> : null}
              </div>
              {showOtherProviders || provider !== "google_workspace" ? <div className="mailbox-providers">
                {providerKeys.filter((key) => key !== "google_workspace").map((key) => (
                  <button key={key} type="button" className={provider === key ? "selected" : ""} aria-pressed={provider === key} onClick={() => { chooseProvider(key); setShowOtherProviders(true); }}>
                    <span>{key === "other" ? text.other : IMAP_PRESETS[key].label}{key === "microsoft_365" ? <small>{text.microsoftSoon}</small> : null}</span>
                    {provider === key ? <Check size={14} /> : null}
                  </button>
                ))}
              </div> : null}
            </SetupStep>

            {providerMismatch ? (
              <div className="mailbox-mismatch">
                <AlertCircle size={18} />
                <div><strong>{text.mismatchTitle}</strong><p>{text.mismatchDetail.replace("{domain}", email.split("@")[1] || "").replace("{provider}", IMAP_PRESETS[detectedProvider].label)}</p></div>
                <button type="button" onClick={() => chooseProvider(detectedProvider)}>{text.useRecommended}</button>
              </div>
            ) : null}

            <SetupStep number={3} title={provider === "google_workspace" ? text.stepAccess : text.stepAccessOther} detail={provider === "google_workspace" ? text.stepAccessDetail : text.stepAccessOtherDetail}>
              {microsoftBlocked ? (
                <div className="mailbox-oauth-block">
                  <LockKeyhole size={20} />
                  <div><strong>{text.microsoftTitle}</strong><p>{text.microsoftDetail}</p><span>{text.microsoftSoon}</span></div>
                </div>
              ) : (
                <div className="mailbox-password-field">
                  {provider === "google_workspace" && !hasPassword ? (
                    <ol className="mailbox-google-guide">
                      <li>{language === "nl" ? "Log in op het Google-account van deze mailbox en zet tweestapsverificatie aan." : "Sign in to this mailbox's Google Account and enable 2-Step Verification."}</li>
                      <li><a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">{text.createGooglePassword}<ExternalLink size={13} /></a></li>
                      <li>{language === "nl" ? "Kopieer de 16 tekens en plak ze hieronder." : "Copy the 16 characters and paste them below."}</li>
                    </ol>
                  ) : null}
                  <FieldLabel htmlFor="support-mailbox-password" help={passwordGuidance}>{passwordLabel}</FieldLabel>
                  <input id="support-mailbox-password" type="password" value={password} onChange={(event) => { setPassword(event.target.value); markDirty(); }} placeholder={hasPassword ? "••••••••" : passwordLabel} autoComplete="new-password" style={inputStyle} />
                  <div className="mailbox-password-help">
                    <p>{provider === "google_workspace" ? text.googlePasswordUnavailable : passwordGuidance}</p>
                  </div>
                </div>
              )}
              {!customProvider && !microsoftBlocked ? (
                <div className="mailbox-auto-servers">
                  <ServerCog size={19} />
                  <div><strong>{text.automaticServers}</strong><p>{text.automaticServersDetail.replace("{provider}", providerLabel)}</p></div>
                  <Check size={17} />
                </div>
              ) : null}
            </SetupStep>

            {customProvider ? (
              <div className="mailbox-custom-heading"><ServerCog size={18} /><div><strong>{text.customRequired}</strong><p>{text.customRequiredDetail}</p></div></div>
            ) : null}

            {customProvider ? (
              <div className="mailbox-advanced">
                <h3>{text.customServers}</h3>
                <div className="mailbox-server-grid">
                  <div><FieldLabel help={text.imapHostHelp}>{text.imapHost}</FieldLabel><input required value={imapHost} onChange={(event) => { setImapHost(event.target.value); markDirty(); }} style={inputStyle} /></div>
                  <div className="mailbox-port-grid"><div><FieldLabel help={text.portHelp}>{text.port}</FieldLabel><input required value={imapPort} inputMode="numeric" onChange={(event) => { setImapPort(event.target.value); markDirty(); }} style={inputStyle} /></div><div><FieldLabel>{text.security}</FieldLabel><select value={imapEncryption} onChange={(event) => { setImapEncryption(event.target.value as ImapEncryption); markDirty(); }} style={inputStyle}><option value="ssl">SSL</option><option value="starttls">STARTTLS</option><option value="none">{text.none}</option></select></div></div>
                  <div><FieldLabel help={text.usernameHelp}>{text.username}</FieldLabel><input required value={imapUsername} onChange={(event) => { setImapUsername(event.target.value); markDirty(); }} style={inputStyle} /></div>
                  <div><FieldLabel help={text.folderHelp}>{text.folder}</FieldLabel><input value={imapMailbox} onChange={(event) => { setImapMailbox(event.target.value); markDirty(); }} style={inputStyle} /></div>
                  <div><FieldLabel help={text.smtpHostHelp}>{text.smtpHost}</FieldLabel><input required value={smtpHost} onChange={(event) => { setSmtpHost(event.target.value); markDirty(); }} style={inputStyle} /></div>
                  <div className="mailbox-port-grid"><div><FieldLabel help={text.portHelp}>{text.port}</FieldLabel><input required value={smtpPort} inputMode="numeric" onChange={(event) => { setSmtpPort(event.target.value); markDirty(); }} style={inputStyle} /></div><div><FieldLabel>{text.security}</FieldLabel><select value={smtpEncryption} onChange={(event) => { setSmtpEncryption(event.target.value as SmtpEncryption); markDirty(); }} style={inputStyle}><option value="starttls">STARTTLS</option><option value="ssl">SSL</option><option value="none">{text.none}</option></select></div></div>
                  <div><FieldLabel help={text.usernameHelp}>{text.username}</FieldLabel><input required value={smtpUsername} onChange={(event) => { setSmtpUsername(event.target.value); markDirty(); }} style={inputStyle} /></div>
                  <div><FieldLabel>{text.outgoingPassword}</FieldLabel><input type="password" value={smtpPassword} onChange={(event) => { setSmtpPassword(event.target.value); markDirty(); }} placeholder="••••••••" style={inputStyle} /></div>
                </div>
              </div>
            ) : null}
            {imapError || smtpError ? (
              <div className="mailbox-errors">
                {imapError ? <p><strong>{text.incoming}:</strong> {imapError}</p> : null}
                {smtpError ? <p><strong>{text.outgoing}:</strong> {smtpError}</p> : null}
              </div>
            ) : null}

            <div className="mailbox-actions mailbox-form-actions">
              <button className="mailbox-primary" onClick={primaryAction} disabled={busy !== "idle" || (shouldSave && !setupReady) || microsoftBlocked}>
                {busy === "saving" || busy === "testing" ? <Loader2 size={16} className="mailbox-spin" /> : imapStatus === "test_required" && !dirty ? <ShieldCheck size={16} /> : <Mail size={16} />}
                {primaryLabel}
              </button>
              {connected || manageOpen ? <button className="mailbox-secondary" type="button" onClick={() => setManageOpen(false)}>{text.closeManage}</button> : null}
              {hasPassword ? <button className="mailbox-danger" type="button" onClick={() => setConfirmDisconnect(true)} disabled={busy !== "idle"}><Unplug size={15} />{text.disconnect}</button> : null}
            </div>
            <p className="mailbox-test-explainer">{text.testSendsEmail}</p>
            {shouldSave && !setupReady && !microsoftBlocked ? <p className="mailbox-required-hint">{provider === "google_workspace" ? text.requiredFieldsGoogle : text.requiredFieldsOther}</p> : null}
            </>}
          </div>
        )}
      </div>
      {confirmDisconnect ? <ConfirmDialog title={text.disconnectTitle} description={text.disconnectConfirm} confirmLabel={text.disconnect} danger onCancel={() => setConfirmDisconnect(false)} onConfirm={() => void disconnectMailbox()} /> : null}
    </section>
  );
}

function StatusItem({ icon, title, status, detail, text }: { icon: React.ReactNode; title: string; status: ConnectionStatus; detail: string; text: typeof copy.nl | typeof copy.en }) {
  return <div className="mailbox-health-item">{icon}<div><span>{title}</span><strong className={status === "active" ? "ok" : ""}>{statusLabel(status, text)}</strong><small>{detail}</small></div></div>;
}

function MailboxStyles() {
  return <style>{`
    .mailbox-shell{background:var(--surface);border:1px solid var(--border);border-radius:20px;overflow:hidden}
    .mailbox-shell button:focus-visible,.mailbox-shell input:focus-visible,.mailbox-shell select:focus-visible{outline:2px solid var(--sf-green)!important;outline-offset:2px}
    .mailbox-loading{min-height:120px;display:flex;align-items:center;justify-content:center;gap:10px;color:var(--muted);font-size:13px}
    .mailbox-header{padding:18px 20px 4px;display:flex;align-items:flex-start;justify-content:space-between;gap:18px}
    .mailbox-header h2{margin:0;font-size:16px;font-weight:500;color:var(--text);letter-spacing:-.01em}.mailbox-header p{margin:4px 0 0;font-size:13px;color:var(--muted);line-height:1.5}
    .mailbox-route{margin:14px 20px 0;padding:14px 16px;border:1px solid var(--border);border-radius:16px;background:var(--surface-2)}
    .mailbox-route-line{display:flex;align-items:center;gap:10px;min-width:0}
    .mailbox-route-node{display:inline-flex;align-items:center;gap:8px;min-width:0;max-width:46%;padding:7px 12px;border:1px solid var(--border);border-radius:999px;background:var(--surface);color:var(--text);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .mailbox-route-node svg{flex:none;color:var(--muted)}
    .mailbox-route-node.is-brand{padding:4px 12px 4px 5px;border-color:rgba(199,245,111,.28);background:rgba(199,245,111,.08);font-weight:500}
    .mailbox-route-link{flex:1;min-width:24px;height:1px;background:repeating-linear-gradient(90deg,var(--border) 0 6px,transparent 6px 11px)}
    .mailbox-route-link.is-live{background:linear-gradient(90deg,var(--border),var(--sf-green))}
    .mailbox-route p{margin:10px 0 0;color:var(--muted);font-size:12px;line-height:1.5}
    .mailbox-state{display:inline-flex;align-items:center;gap:7px;padding:5px 10px;border:1px solid var(--border);border-radius:999px;font-size:11px;font-weight:600;white-space:nowrap}.mailbox-state span{width:7px;height:7px;border-radius:50%;background:currentColor}.mailbox-state.is-active{color:var(--sf-green);border-color:rgba(199,245,111,.28);background:rgba(199,245,111,.1)}.mailbox-state.is-error{color:var(--tone-danger);background:rgba(248,113,113,.1)}.mailbox-state.is-pending{color:var(--tone-warning);background:rgba(245,196,88,.1)}
    .mailbox-body{padding:18px 20px 20px}.mailbox-notice{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:14px;margin-bottom:18px;font-size:13px}.mailbox-notice svg{flex:none;margin-top:1px}.mailbox-notice strong{display:block;color:var(--text);font-weight:600}.mailbox-notice p{margin:3px 0 0;color:var(--muted);line-height:1.5}.mailbox-notice.success{background:rgba(199,245,111,.08);border:1px solid rgba(199,245,111,.28);color:var(--sf-green)}.mailbox-notice.warning{background:rgba(245,196,88,.1);border:1px solid rgba(245,196,88,.32);color:var(--tone-warning)}.mailbox-notice.error{background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.32);color:var(--tone-danger)}
    .mailbox-summary,.mailbox-form{display:grid;gap:18px}.mailbox-account{display:grid;grid-template-columns:40px minmax(0,1fr) auto;align-items:center;gap:12px;padding-bottom:18px;border-bottom:1px solid var(--border)}.mailbox-account-icon{width:40px;height:40px;border-radius:12px;background:var(--surface-2);display:grid;place-items:center;color:var(--text)}.mailbox-account strong,.mailbox-account span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mailbox-account strong{font-size:14px;font-weight:600;color:var(--text)}.mailbox-account span{font-size:12px;color:var(--muted);margin-top:3px}.mailbox-shield{color:var(--sf-green)}
    .mailbox-method{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 14px;border:1px solid var(--border);border-radius:12px;background:var(--surface-2)}.mailbox-method p{margin:0;color:var(--text);font-size:12px;line-height:1.5}.mailbox-method button{flex:none;border:0;background:none;color:var(--sf-green);font:600 12px inherit;cursor:pointer;text-align:right}
    .mailbox-workspace-note,.mailbox-after-connect,.mailbox-test-explainer{margin:0;color:var(--muted);font-size:12px;line-height:1.55}.mailbox-workspace-note{display:flex;align-items:flex-start;gap:9px;padding:12px 14px;border:1px solid var(--border);border-radius:12px}.mailbox-workspace-note svg{flex:none;color:var(--sf-green);margin-top:1px}.mailbox-after-connect{padding:12px 14px;border:1px solid rgba(199,245,111,.25);border-radius:12px;background:rgba(199,245,111,.05);color:var(--text)}
    .mailbox-optional-name{font-size:12px;color:var(--muted)}.mailbox-optional-name summary{width:fit-content;cursor:pointer}.mailbox-optional-name>div{margin-top:12px;max-width:420px}
    .mailbox-google-guide{margin:0 0 16px;padding:14px 16px 14px 36px;border:1px solid rgba(199,245,111,.24);border-radius:12px;background:rgba(199,245,111,.045);color:var(--text);font-size:12px;line-height:1.6}.mailbox-google-guide li+li{margin-top:6px}.mailbox-google-guide li::marker{color:var(--sf-green);font-weight:700}.mailbox-google-guide a{display:inline-flex;align-items:center;gap:5px;color:var(--sf-green);font-weight:600;text-decoration:underline;text-underline-offset:3px}
    .mailbox-step{display:grid;gap:14px;padding-bottom:18px;border-bottom:1px solid var(--border)}.mailbox-step-heading{display:flex;align-items:flex-start;gap:11px}.mailbox-step-heading>span{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;flex:none;background:rgba(199,245,111,.1);color:var(--sf-green);font-size:12px;font-weight:600}.mailbox-step-heading h3{margin:1px 0 0;font-size:14px;font-weight:500;color:var(--text);letter-spacing:0}.mailbox-step-heading p{margin:3px 0 0;font-size:12px;line-height:1.5;color:var(--muted)}.mailbox-step-content{display:grid;gap:13px;margin-left:37px}
    .mailbox-field-label{display:flex;align-items:center;gap:6px;margin-bottom:7px;color:var(--muted);font-size:12px;font-weight:600}.mailbox-field-label label{min-width:0}.mailbox-help{position:relative;display:inline-flex}.mailbox-help summary{display:grid;place-items:center;color:var(--muted);cursor:pointer;list-style:none}.mailbox-help summary::-webkit-details-marker{display:none}.mailbox-help>p{position:absolute;z-index:20;left:22px;top:-10px;width:250px;margin:0;padding:10px 11px;border:1px solid var(--border);border-radius:12px;background:var(--surface);box-shadow:0 12px 28px rgba(0,0,0,.35);color:var(--text);font-size:12px;font-weight:400;line-height:1.5}.mailbox-help:not([open])>p{display:none}
    .mailbox-health{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid var(--border);border-radius:14px;overflow:hidden}.mailbox-health-item{display:flex;align-items:flex-start;gap:10px;padding:14px;min-width:0}.mailbox-health-item+ .mailbox-health-item{border-left:1px solid var(--border)}.mailbox-health-item>svg{color:var(--muted);flex:none;margin-top:1px}.mailbox-health-item span,.mailbox-health-item strong,.mailbox-health-item small{display:block}.mailbox-health-item span{font-size:12px;color:var(--muted);font-weight:500}.mailbox-health-item strong{font-size:13px;font-weight:600;color:var(--text);margin-top:2px}.mailbox-health-item strong.ok{color:var(--sf-green)}.mailbox-health-item small{font-size:12px;line-height:1.45;color:var(--muted);margin-top:3px}
    .mailbox-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.mailbox-actions button{min-height:42px;border-radius:10px;padding:0 14px;display:inline-flex;align-items:center;justify-content:center;gap:8px;font:600 13px inherit;cursor:pointer}.mailbox-actions button:disabled{cursor:not-allowed;opacity:.55}.mailbox-primary{border:0;background:var(--sf-green);color:#10180a}.mailbox-secondary{border:1px solid var(--border);background:var(--surface);color:var(--text)}.mailbox-danger{border:0;background:transparent;color:var(--tone-danger);padding-inline:8px!important;margin-left:auto}
    .mailbox-provider-choice{display:flex;align-items:center;justify-content:space-between;gap:12px}.mailbox-provider-choice>button:first-child{display:inline-flex;align-items:center;justify-content:space-between;gap:14px;min-width:250px;min-height:48px;padding:10px 14px;border:1px solid var(--border);border-radius:12px;background:var(--bg);color:var(--text);font:inherit;font-size:13px;cursor:pointer}.mailbox-provider-choice>button:first-child.selected{border-color:rgba(199,245,111,.4);background:rgba(199,245,111,.08);color:var(--sf-green)}.mailbox-provider-choice strong{font-weight:600}.mailbox-provider-more{border:0;background:none;color:var(--muted);font:600 12px inherit;cursor:pointer}.mailbox-provider-more:hover{color:var(--sf-green)}
    .mailbox-providers{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.mailbox-providers button{min-height:48px;padding:7px 9px;border:1px solid var(--border);border-radius:12px;background:var(--bg);color:var(--text);font:500 12px inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px}.mailbox-providers button>span{display:grid;gap:2px}.mailbox-providers button small{font-size:11px;font-weight:500;color:var(--tone-warning)}.mailbox-providers button.selected{border-color:rgba(199,245,111,.4);background:rgba(199,245,111,.08);color:var(--sf-green)}
    .mailbox-server-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.mailbox-password-field{min-width:0}.mailbox-password-help{margin-top:7px}.mailbox-password-help p{margin:0;color:var(--muted);font-size:12px;line-height:1.5}.mailbox-port-grid{display:grid;grid-template-columns:90px minmax(0,1fr);gap:9px}
    .mailbox-auto-servers{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:start;padding:12px 14px;border:1px solid var(--border);border-radius:14px;background:var(--surface-2);color:var(--sf-green)}.mailbox-auto-servers svg{margin-top:1px}.mailbox-auto-servers strong,.mailbox-auto-servers p{display:block}.mailbox-auto-servers strong{font-size:12px;font-weight:600;color:var(--text)}.mailbox-auto-servers p{margin:3px 0 0;font-size:12px;line-height:1.45;color:var(--muted)}
    .mailbox-oauth-block{display:flex;align-items:flex-start;gap:11px;padding:13px;border:1px solid var(--border);border-radius:14px;background:var(--bg);color:var(--muted)}.mailbox-oauth-block>svg{flex:none}.mailbox-oauth-block strong{display:block;font-size:13px;font-weight:600;color:var(--text)}.mailbox-oauth-block p{margin:4px 0 8px;font-size:12px;line-height:1.55}.mailbox-oauth-block span{display:inline-flex;padding:4px 9px;border-radius:999px;background:var(--surface-2);color:var(--muted);font-size:11px;font-weight:600}
    .mailbox-custom-heading,.mailbox-mismatch{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border:1px solid rgba(245,196,88,.32);border-radius:14px;background:rgba(245,196,88,.08);color:var(--tone-warning)}.mailbox-custom-heading>svg,.mailbox-mismatch>svg{flex:none}.mailbox-custom-heading strong,.mailbox-mismatch strong{display:block;font-size:13px;font-weight:600;color:var(--text)}.mailbox-custom-heading p,.mailbox-mismatch p{margin:3px 0 0;font-size:12px;line-height:1.5;color:var(--muted)}
    .mailbox-mismatch{display:grid;grid-template-columns:auto minmax(0,1fr) auto}.mailbox-mismatch button{border:1px solid rgba(245,196,88,.35);background:transparent;border-radius:10px;padding:8px 10px;color:var(--tone-warning);font:600 12px inherit;cursor:pointer}
    .mailbox-advanced{border-top:1px solid var(--border);padding-top:18px;display:grid;gap:15px}.mailbox-advanced h3{margin:0;font-size:14px;font-weight:500;color:var(--text)}
    .mailbox-forwarding{display:grid;gap:6px;padding:16px;border:1px solid var(--border);border-radius:16px;background:var(--surface-2)}.mailbox-forwarding>strong{font-size:14px;font-weight:500;color:var(--text)}.mailbox-forwarding>p{margin:0;color:var(--muted);font-size:13px;line-height:1.55}.mailbox-forwarding-address{margin-top:8px;padding:12px;background:var(--bg);border-radius:12px;display:flex;gap:12px;align-items:end;justify-content:space-between}.mailbox-forwarding-address code{font-size:13px;color:var(--text);overflow-wrap:anywhere}.mailbox-forwarding-address button{min-height:36px;padding:0 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text);display:flex;align-items:center;gap:6px;font:600 12px inherit;cursor:pointer}
    .mailbox-errors{border-left:3px solid var(--tone-danger);padding:2px 0 2px 12px}.mailbox-errors p{margin:3px 0;font-size:12px;line-height:1.55;color:var(--tone-danger)}.mailbox-form-actions{padding-top:2px}.mailbox-required-hint{margin:-10px 0 0;font-size:12px;color:var(--muted)}.mailbox-spin{animation:mailboxSpin .8s linear infinite}@keyframes mailboxSpin{to{transform:rotate(360deg)}}
    @media(max-width:720px){.mailbox-providers{grid-template-columns:repeat(2,minmax(0,1fr))}.mailbox-health{grid-template-columns:1fr}.mailbox-health-item+ .mailbox-health-item{border-left:0;border-top:1px solid var(--border)}}
    @media(max-width:560px){.mailbox-header{padding:16px 16px 4px}.mailbox-route{margin:12px 16px 0}.mailbox-route-node{max-width:none}.mailbox-route-line{flex-wrap:wrap}.mailbox-route-link{display:none}.mailbox-body{padding:16px}.mailbox-method{align-items:flex-start;flex-direction:column}.mailbox-method button{text-align:left}.mailbox-step-content{margin-left:0}.mailbox-provider-choice{align-items:flex-start;flex-direction:column}.mailbox-provider-choice>button:first-child{width:100%;min-width:0}.mailbox-providers{grid-template-columns:repeat(2,minmax(0,1fr))}.mailbox-server-grid{grid-template-columns:1fr}.mailbox-mismatch{grid-template-columns:auto 1fr}.mailbox-mismatch button{grid-column:2}.mailbox-actions button{width:100%}.mailbox-danger{margin-left:0!important}.mailbox-forwarding-address{align-items:stretch;flex-direction:column}.mailbox-forwarding-address button{align-self:flex-start}.mailbox-help>p{left:auto;right:-10px;width:min(250px,75vw)}}
  `}</style>;
}
