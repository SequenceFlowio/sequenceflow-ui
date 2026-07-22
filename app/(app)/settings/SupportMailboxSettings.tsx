"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
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

const providerKeys: ImapPresetKey[] = ["hostinger", "mijndomein", "google_workspace", "microsoft_365", "other"];

const copy = {
  nl: {
    eyebrow: "E-MAIL",
    title: "Supportmailbox",
    description: "Ontvang klantmails en verstuur antwoorden vanuit hetzelfde vertrouwde adres.",
    sourceSafeTitle: "Je mailbox blijft van jou",
    sourceSafeDetail: "Originele klantmails blijven precies waar ze staan. SequenceFlow leest een kopie en verwijdert, verplaatst of archiveert nooit iets bij Google, Hostinger of je andere mailprovider.",
    setup: "Instellen",
    connected: "Verbonden",
    attention: "Actie nodig",
    provider: "Waar draait je mailbox?",
    providerHelp: "Kies het bedrijf waar je dit e-mailadres beheert. Je webshopplatform of domeinnaamprovider is niet altijd ook je mailprovider.",
    email: "Supportadres voor klanten",
    emailHelp: "Vul het bestaande adres in waar klanten hun vragen naartoe sturen, bijvoorbeeld info@deepreststore.nl. Je moet op deze mailbox kunnen inloggen; alleen een doorstuur-alias is niet genoeg.",
    name: "Naam die klanten zien",
    nameHelp: "Deze naam staat als afzender boven je antwoorden, bijvoorbeeld DeepRest Support.",
    password: "Mailboxwachtwoord",
    replacePassword: "Wachtwoord vervangen (optioneel)",
    passwordHelp: "Gebruik het wachtwoord dat specifiek bij deze mailbox hoort, niet automatisch het wachtwoord van je hostingaccount.",
    hostingerPassword: "Wachtwoord van deze Hostinger-mailbox",
    hostingerPasswordHelp: "Gebruik het wachtwoord dat je in hPanel bij dit specifieke e-mailadres hebt ingesteld. Dit is niet je Hostinger-accountwachtwoord.",
    mijndomeinPassword: "Wachtwoord van deze MijnDomein-mailbox",
    mijndomeinPasswordHelp: "Gebruik het wachtwoord waarmee je op deze specifieke mailbox inlogt. Dit is niet per se je MijnDomein-accountwachtwoord.",
    googlePassword: "Google app-wachtwoord (16 tekens)",
    googlePasswordHelp: "Gebruik niet je normale Google-wachtwoord. Maak met tweestapsverificatie een apart app-wachtwoord voor SequenceFlow.",
    createGooglePassword: "Google app-wachtwoord maken",
    microsoftTitle: "Microsoft vereist beveiligd verbinden",
    microsoftDetail: "Microsoft 365 accepteert hiervoor geen normaal mailbox- of app-wachtwoord meer. We zetten Microsoft OAuth klaar; tot die tijd kun je deze provider niet veilig nieuw koppelen.",
    microsoftSoon: "Binnenkort beschikbaar",
    passwordStored: "Er is al een versleuteld wachtwoord opgeslagen.",
    save: "Mailbox opslaan",
    test: "Verbinding testen",
    retry: "Opnieuw testen",
    sync: "Nu synchroniseren",
    manage: "Instellingen beheren",
    closeManage: "Beheer sluiten",
    advanced: "Technische servergegevens bekijken",
    automaticServers: "Servergegevens automatisch ingesteld",
    automaticServersDetail: "SequenceFlow gebruikt de aanbevolen IMAP- en SMTP-instellingen voor {provider}. Je hoeft hieronder niets in te vullen.",
    customRequired: "Servergegevens invullen",
    customRequiredDetail: "Bij een andere provider hebben we deze gegevens uit de handleiding van je mailprovider nodig.",
    stepProvider: "Kies je mailprovider",
    stepProviderDetail: "Waar log je normaal in om deze mailbox te beheren?",
    stepIdentity: "Welke mailbox gebruiken klanten?",
    stepIdentityDetail: "Gebruik een echt bestaand supportadres waarop je mail ontvangt.",
    stepAccess: "Geef SequenceFlow veilige toegang",
    stepAccessDetail: "We versleutelen deze gegevens en sturen ze nooit terug naar je browser.",
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
    savedTitle: "Mailboxgegevens opgeslagen",
    savedDetail: "Test nu de verbinding. We controleren inkomende mail en sturen één testmail naar je eigen adres.",
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
    imapHostHelp: "IMAP is de server waarmee SequenceFlow nieuwe berichten uit je mailbox leest.",
    smtpHost: "Uitgaande server (SMTP)",
    smtpHostHelp: "SMTP is de server waarmee SequenceFlow antwoorden vanuit je mailbox verstuurt.",
    port: "Poort",
    portHelp: "De poort en beveiliging horen bij elkaar en komen uit de handleiding van je mailprovider.",
    security: "Beveiliging",
    username: "Gebruikersnaam",
    usernameHelp: "Meestal is dit je volledige e-mailadres.",
    folder: "Mailboxmap",
    folderHelp: "Nieuwe klantmails staan normaal in INBOX.",
    outgoingPassword: "Afwijkend SMTP-wachtwoord (optioneel)",
    forwarding: "Forwarding als fallback",
    forwardingDetail: "Alleen gebruiken als je provider IMAP blokkeert.",
    forwardingAddress: "Uniek forwarding-adres",
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
    requiredFields: "Vul eerst het supportadres en de vereiste toegangsgegevens in.",
  },
  en: {
    eyebrow: "EMAIL",
    title: "Support mailbox",
    description: "Receive customer emails and send replies from the same trusted address.",
    sourceSafeTitle: "Your mailbox stays yours",
    sourceSafeDetail: "Original customer emails stay exactly where they are. SequenceFlow reads a copy and never deletes, moves, or archives anything at Google, Hostinger, or your other email provider.",
    setup: "Set up",
    connected: "Connected",
    attention: "Action needed",
    provider: "Where is your mailbox hosted?",
    providerHelp: "Choose the company where this email address is managed. Your store platform or domain provider is not always your email provider.",
    email: "Customer-facing support address",
    emailHelp: "Enter the existing address customers use for questions, such as support@yourstore.com. You must be able to sign in to this mailbox; a forwarding alias alone is not enough.",
    name: "Name customers see",
    nameHelp: "This sender name appears above your replies, for example DeepRest Support.",
    password: "Mailbox password",
    replacePassword: "Replace password (optional)",
    passwordHelp: "Use the password belonging to this specific mailbox, which is not automatically your hosting account password.",
    hostingerPassword: "Password for this Hostinger mailbox",
    hostingerPasswordHelp: "Use the password configured for this specific email address in hPanel. This is not your Hostinger account password.",
    mijndomeinPassword: "Password for this MijnDomein mailbox",
    mijndomeinPasswordHelp: "Use the password for this specific mailbox. It is not necessarily your MijnDomein account password.",
    googlePassword: "Google app password (16 characters)",
    googlePasswordHelp: "Do not use your normal Google password. With two-step verification enabled, create a separate app password for SequenceFlow.",
    createGooglePassword: "Create Google app password",
    microsoftTitle: "Microsoft requires secure connection",
    microsoftDetail: "Microsoft 365 no longer accepts a normal mailbox or app password for this connection. Microsoft OAuth is being prepared; until then this provider cannot be connected safely.",
    microsoftSoon: "Coming soon",
    passwordStored: "An encrypted password is already stored.",
    save: "Save mailbox",
    test: "Test connection",
    retry: "Test again",
    sync: "Sync now",
    manage: "Manage settings",
    closeManage: "Close settings",
    advanced: "View technical server details",
    automaticServers: "Server details configured automatically",
    automaticServersDetail: "SequenceFlow uses the recommended IMAP and SMTP settings for {provider}. You do not need to enter anything below.",
    customRequired: "Enter server details",
    customRequiredDetail: "For another provider, use the details from your email provider's documentation.",
    stepProvider: "Choose your email provider",
    stepProviderDetail: "Where do you normally sign in to manage this mailbox?",
    stepIdentity: "Which mailbox do customers use?",
    stepIdentityDetail: "Use a real existing support address where you receive email.",
    stepAccess: "Give SequenceFlow secure access",
    stepAccessDetail: "We encrypt these details and never return them to your browser.",
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
    savedTitle: "Mailbox details saved",
    savedDetail: "Test the connection now. We check incoming mail and send one test message to your own address.",
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
    imapHostHelp: "IMAP is the server SequenceFlow uses to read new messages from your mailbox.",
    smtpHost: "Outgoing server (SMTP)",
    smtpHostHelp: "SMTP is the server SequenceFlow uses to send replies from your mailbox.",
    port: "Port",
    portHelp: "The port and security setting belong together and come from your email provider's documentation.",
    security: "Security",
    username: "Username",
    usernameHelp: "This is usually your full email address.",
    folder: "Mailbox folder",
    folderHelp: "New customer messages are normally stored in INBOX.",
    outgoingPassword: "Different SMTP password (optional)",
    forwarding: "Forwarding fallback",
    forwardingDetail: "Only use this if your provider blocks IMAP.",
    forwardingAddress: "Unique forwarding address",
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
    requiredFields: "Enter the support address and required access details first.",
  },
} as const;

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 44,
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: 14,
  fontFamily: "inherit",
  boxSizing: "border-box",
  outline: "none",
};

function FieldLabel({ children, help }: { children: React.ReactNode; help?: string }) {
  return (
    <div className="mailbox-field-label">
      <label>{children}</label>
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
  const [provider, setProvider] = useState<ImapPresetKey>("hostinger");
  const [email, setEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [password, setPassword] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [imapHost, setImapHost] = useState<string>(IMAP_PRESETS.hostinger.host);
  const [imapPort, setImapPort] = useState(String(IMAP_PRESETS.hostinger.port));
  const [imapEncryption, setImapEncryption] = useState<ImapEncryption>(IMAP_PRESETS.hostinger.encryption);
  const [imapUsername, setImapUsername] = useState("");
  const [imapMailbox, setImapMailbox] = useState("INBOX");
  const [smtpHost, setSmtpHost] = useState<string>(SMTP_PRESETS.hostinger.host);
  const [smtpPort, setSmtpPort] = useState(String(SMTP_PRESETS.hostinger.port));
  const [smtpEncryption, setSmtpEncryption] = useState<SmtpEncryption>(SMTP_PRESETS.hostinger.encryption);
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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [forwardingOpen, setForwardingOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    fetch("/api/integrations/email/setup")
      .then(async (response) => (response.ok ? response.json() as Promise<SetupResponse> : null))
      .then((data) => {
        if (!data) return;
        const imap = data.imap;
        const smtp = data.smtp;
        const loadedProvider = imap?.provider === smtp?.provider ? imap?.provider : "other";
        setProvider(loadedProvider ?? "hostinger");
        setEmail(smtp?.fromEmail || imap?.username || "");
        setFromName(smtp?.fromName || "");
        setImapHost(imap?.host || IMAP_PRESETS[loadedProvider ?? "hostinger"].host);
        setImapPort(String(imap?.port ?? IMAP_PRESETS[loadedProvider ?? "hostinger"].port));
        setImapEncryption(imap?.encryption ?? IMAP_PRESETS[loadedProvider ?? "hostinger"].encryption);
        setImapUsername(imap?.username || smtp?.fromEmail || "");
        setImapMailbox(imap?.mailbox || "INBOX");
        setSmtpHost(smtp?.host || SMTP_PRESETS[loadedProvider ?? "hostinger"].host);
        setSmtpPort(String(smtp?.port ?? SMTP_PRESETS[loadedProvider ?? "hostinger"].port));
        setSmtpEncryption(smtp?.encryption ?? SMTP_PRESETS[loadedProvider ?? "hostinger"].encryption);
        setSmtpUsername(smtp?.username || smtp?.fromEmail || "");
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
  const emailValid = email.trim().includes("@");
  const serverDetailsValid = !customProvider || Boolean(
    imapHost.trim() && smtpHost.trim() && imapUsername.trim() && smtpUsername.trim() && Number(imapPort) && Number(smtpPort),
  );
  const credentialsReady = hasPassword || Boolean(password.trim());
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
    setAdvancedOpen(nextProvider === "other");
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

  async function saveMailbox() {
    setBusy("saving");
    setNotice(null);
    setImapError(null);
    setSmtpError(null);
    try {
      const response = await fetch("/api/integrations/email/mailbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          email,
          fromName,
          password,
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
      setNotice({ type: "success", title: text.savedTitle, detail: text.savedDetail });
    } catch (error) {
      setNotice({ type: "error", title: text.saveError, detail: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy("idle");
    }
  }

  async function callTest(url: string) {
    const response = await fetch(url, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || text.testError);
    return data;
  }

  async function syncMailbox(showNotice = true) {
    setBusy("syncing");
    try {
      const response = await fetch("/api/integrations/email/imap/sync", { method: "POST" });
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
    if (!window.confirm(text.disconnectConfirm)) return;
    setBusy("disconnecting");
    try {
      const responses = await Promise.all([
        fetch("/api/integrations/email/imap", { method: "DELETE" }),
        fetch("/api/integrations/email/smtp", { method: "DELETE" }),
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
  const primaryAction = shouldSave ? saveMailbox : testMailbox;
  const primaryLabel = busy === "saving" ? text.save : busy === "testing" ? text.testingTitle : imapStatus === "failed" || smtpStatus === "failed" ? text.retry : imapStatus === "test_required" || smtpStatus === "test_required" ? text.test : text.save;

  if (loading) {
    return (
      <section className="mailbox-shell mailbox-loading">
        <Loader2 size={18} className="mailbox-spin" />
        <span>{text.loading}</span>
        <MailboxStyles />
      </section>
    );
  }

  return (
    <section className="mailbox-shell">
      <MailboxStyles />
      <header className="mailbox-header">
        <div className="mailbox-title-wrap">
          <span className="mailbox-icon"><Mail size={20} /></span>
          <div>
            <p className="mailbox-eyebrow">{text.eyebrow}</p>
            <h2>{text.title}</h2>
            <p>{text.description}</p>
          </div>
        </div>
        <span className={`mailbox-state ${connected ? "is-active" : imapStatus === "failed" || smtpStatus === "failed" ? "is-error" : "is-pending"}`}>
          <span />{connected ? text.connected : imapStatus === "failed" || smtpStatus === "failed" ? text.attention : text.setup}
        </span>
      </header>

      <div className="mailbox-preservation" role="note">
        <ShieldCheck size={18} aria-hidden />
        <div><strong>{text.sourceSafeTitle}</strong><span>{text.sourceSafeDetail}</span></div>
      </div>

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
          </div>
        ) : (
          <div className="mailbox-form">
            <SetupStep number={1} title={text.stepProvider} detail={text.stepProviderDetail}>
              <FieldLabel help={text.providerHelp}>{text.provider}</FieldLabel>
              <div className="mailbox-providers">
                {providerKeys.map((key) => (
                  <button key={key} type="button" className={provider === key ? "selected" : ""} aria-pressed={provider === key} onClick={() => chooseProvider(key)}>
                    <span>{key === "other" ? text.other : IMAP_PRESETS[key].label}{key === "microsoft_365" ? <small>{text.microsoftSoon}</small> : null}</span>
                    {provider === key ? <Check size={14} /> : null}
                  </button>
                ))}
              </div>
            </SetupStep>

            {providerMismatch ? (
              <div className="mailbox-mismatch">
                <AlertCircle size={18} />
                <div><strong>{text.mismatchTitle}</strong><p>{text.mismatchDetail.replace("{domain}", email.split("@")[1] || "").replace("{provider}", IMAP_PRESETS[detectedProvider].label)}</p></div>
                <button type="button" onClick={() => chooseProvider(detectedProvider)}>{text.useRecommended}</button>
              </div>
            ) : null}

            <SetupStep number={2} title={text.stepIdentity} detail={text.stepIdentityDetail}>
              <div className="mailbox-basic-grid">
                <div><FieldLabel help={text.emailHelp}>{text.email}</FieldLabel><input type="email" value={email} onChange={(event) => updateEmail(event.target.value)} placeholder="info@deepreststore.nl" autoComplete="email" style={inputStyle} /></div>
                <div><FieldLabel help={text.nameHelp}>{text.name}</FieldLabel><input value={fromName} onChange={(event) => { setFromName(event.target.value); markDirty(); }} placeholder="DeepRest Support" style={inputStyle} /></div>
              </div>
            </SetupStep>

            <SetupStep number={3} title={text.stepAccess} detail={text.stepAccessDetail}>
              {microsoftBlocked ? (
                <div className="mailbox-oauth-block">
                  <LockKeyhole size={20} />
                  <div><strong>{text.microsoftTitle}</strong><p>{text.microsoftDetail}</p><span>{text.microsoftSoon}</span></div>
                </div>
              ) : (
                <div className="mailbox-password-field">
                  <FieldLabel help={passwordGuidance}>{passwordLabel}</FieldLabel>
                  <input type="password" value={password} onChange={(event) => { setPassword(event.target.value); markDirty(); }} placeholder={hasPassword ? "••••••••" : passwordLabel} autoComplete="new-password" style={inputStyle} />
                  <div className="mailbox-password-help">
                    <p>{passwordGuidance}</p>
                    {provider === "google_workspace" ? <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">{text.createGooglePassword}<ExternalLink size={13} /></a> : null}
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

            {!customProvider ? (
              <button type="button" className="mailbox-disclosure" onClick={() => setAdvancedOpen((open) => !open)} aria-expanded={advancedOpen}>
                <Settings2 size={16} />{text.advanced}<ChevronDown size={16} className={advancedOpen ? "rotated" : ""} />
              </button>
            ) : (
              <div className="mailbox-custom-heading"><ServerCog size={18} /><div><strong>{text.customRequired}</strong><p>{text.customRequiredDetail}</p></div></div>
            )}

            {advancedOpen || customProvider ? (
              <div className="mailbox-advanced">
                <h3>{text.customServers}</h3>
                <div className="mailbox-server-grid">
                  <div><FieldLabel help={text.imapHostHelp}>{text.imapHost}</FieldLabel><input required value={imapHost} onChange={(event) => { setImapHost(event.target.value); markDirty(); }} style={inputStyle} /></div>
                  <div className="mailbox-port-grid"><div><FieldLabel help={text.portHelp}>{text.port}</FieldLabel><input required value={imapPort} inputMode="numeric" onChange={(event) => { setImapPort(event.target.value); markDirty(); }} style={inputStyle} /></div><div><FieldLabel>{text.security}</FieldLabel><select value={imapEncryption} onChange={(event) => { setImapEncryption(event.target.value as ImapEncryption); markDirty(); }} style={inputStyle}><option value="ssl">SSL</option><option value="starttls">STARTTLS</option><option value="none">None</option></select></div></div>
                  <div><FieldLabel help={text.usernameHelp}>{text.username}</FieldLabel><input required value={imapUsername} onChange={(event) => { setImapUsername(event.target.value); markDirty(); }} style={inputStyle} /></div>
                  <div><FieldLabel help={text.folderHelp}>{text.folder}</FieldLabel><input value={imapMailbox} onChange={(event) => { setImapMailbox(event.target.value); markDirty(); }} style={inputStyle} /></div>
                  <div><FieldLabel help={text.smtpHostHelp}>{text.smtpHost}</FieldLabel><input required value={smtpHost} onChange={(event) => { setSmtpHost(event.target.value); markDirty(); }} style={inputStyle} /></div>
                  <div className="mailbox-port-grid"><div><FieldLabel help={text.portHelp}>{text.port}</FieldLabel><input required value={smtpPort} inputMode="numeric" onChange={(event) => { setSmtpPort(event.target.value); markDirty(); }} style={inputStyle} /></div><div><FieldLabel>{text.security}</FieldLabel><select value={smtpEncryption} onChange={(event) => { setSmtpEncryption(event.target.value as SmtpEncryption); markDirty(); }} style={inputStyle}><option value="starttls">STARTTLS</option><option value="ssl">SSL</option><option value="none">None</option></select></div></div>
                  <div><FieldLabel help={text.usernameHelp}>{text.username}</FieldLabel><input required value={smtpUsername} onChange={(event) => { setSmtpUsername(event.target.value); markDirty(); }} style={inputStyle} /></div>
                  <div><FieldLabel>{text.outgoingPassword}</FieldLabel><input type="password" value={smtpPassword} onChange={(event) => { setSmtpPassword(event.target.value); markDirty(); }} placeholder="••••••••" style={inputStyle} /></div>
                </div>
                <div className="mailbox-forwarding">
                  <button type="button" onClick={() => setForwardingOpen((open) => !open)}><span><strong>{text.forwarding}</strong><small>{text.forwardingDetail}</small></span><ChevronDown size={16} className={forwardingOpen ? "rotated" : ""} /></button>
                  {forwardingOpen ? <div className="mailbox-forwarding-address"><div><FieldLabel>{text.forwardingAddress}</FieldLabel><code>{inboundEmail}</code></div><button type="button" onClick={() => { navigator.clipboard.writeText(inboundEmail); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }}><Copy size={15} />{copied ? text.copied : text.copy}</button></div> : null}
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
              {hasPassword ? <button className="mailbox-danger" type="button" onClick={disconnectMailbox} disabled={busy !== "idle"}><Unplug size={15} />{text.disconnect}</button> : null}
            </div>
            {shouldSave && !setupReady && !microsoftBlocked ? <p className="mailbox-required-hint">{text.requiredFields}</p> : null}
          </div>
        )}
      </div>
    </section>
  );
}

function StatusItem({ icon, title, status, detail, text }: { icon: React.ReactNode; title: string; status: ConnectionStatus; detail: string; text: typeof copy.nl | typeof copy.en }) {
  return <div className="mailbox-health-item">{icon}<div><span>{title}</span><strong className={status === "active" ? "ok" : ""}>{statusLabel(status, text)}</strong><small>{detail}</small></div></div>;
}

function MailboxStyles() {
  return <style>{`
    .mailbox-shell{background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden;box-shadow:0 12px 30px rgba(15,23,42,.04)}
    .mailbox-shell button:focus-visible,.mailbox-shell input:focus-visible,.mailbox-shell select:focus-visible{outline:2px solid #79a923!important;outline-offset:2px}
    .mailbox-loading{min-height:120px;display:flex;align-items:center;justify-content:center;gap:10px;color:var(--muted);font-size:13px}
    .mailbox-header{padding:18px 20px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;justify-content:space-between;gap:18px;background:var(--surface-subtle)}
    .mailbox-title-wrap{display:flex;align-items:flex-start;gap:12px;min-width:0}.mailbox-icon{width:38px;height:38px;border-radius:8px;display:grid;place-items:center;background:rgba(199,245,111,.18);color:var(--tone-success-strong);flex:none}
    .mailbox-eyebrow{margin:0 0 3px!important;font-size:10px!important;font-weight:800!important;letter-spacing:.08em;color:var(--muted)!important}.mailbox-header h2{margin:0;font-size:15px;font-weight:800;color:var(--text);letter-spacing:0}.mailbox-header p{margin:4px 0 0;font-size:13px;color:var(--muted);line-height:1.5}
    .mailbox-preservation{padding:11px 20px;display:flex;align-items:flex-start;gap:10px;border-bottom:1px solid #dcebc3;background:#f8fbea;color:#668c22}.mailbox-preservation>svg{flex:none;margin-top:1px}.mailbox-preservation strong,.mailbox-preservation span{display:block}.mailbox-preservation strong{font-size:11px;color:#456614}.mailbox-preservation span{margin-top:2px;font-size:11px;line-height:1.5;color:#617345}
    .mailbox-state{display:inline-flex;align-items:center;gap:7px;padding:6px 9px;border:1px solid var(--border);border-radius:999px;font-size:11px;font-weight:800;white-space:nowrap}.mailbox-state span{width:7px;height:7px;border-radius:50%;background:#94a3b8}.mailbox-state.is-active{color:var(--tone-success-strong);background:rgba(199,245,111,.12)}.mailbox-state.is-active span{background:#79a923}.mailbox-state.is-error{color:#b42318;background:#fff2f0}.mailbox-state.is-error span{background:#ef4444}.mailbox-state.is-pending{color:#9a6700;background:#fff8e6}.mailbox-state.is-pending span{background:#d79a00}
    .mailbox-body{padding:20px}.mailbox-notice{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:8px;margin-bottom:18px;font-size:13px}.mailbox-notice svg{flex:none;margin-top:1px}.mailbox-notice strong{display:block;color:var(--text)}.mailbox-notice p{margin:3px 0 0;color:var(--muted);line-height:1.5}.mailbox-notice.success{background:#f3fae7;border:1px solid #d4edaa;color:#5e8619}.mailbox-notice.warning{background:#fff8e6;border:1px solid #f2dda5;color:#9a6700}.mailbox-notice.error{background:#fff2f0;border:1px solid #ffd2cc;color:#b42318}
    .mailbox-summary,.mailbox-form{display:grid;gap:18px}.mailbox-account{display:grid;grid-template-columns:40px minmax(0,1fr) auto;align-items:center;gap:12px;padding-bottom:18px;border-bottom:1px solid var(--border)}.mailbox-account-icon{width:40px;height:40px;border-radius:8px;background:var(--bg);display:grid;place-items:center;color:var(--text)}.mailbox-account strong,.mailbox-account span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mailbox-account strong{font-size:14px;color:var(--text)}.mailbox-account span{font-size:12px;color:var(--muted);margin-top:3px}.mailbox-shield{color:#79a923}
    .mailbox-step{display:grid;gap:14px;padding-bottom:18px;border-bottom:1px solid var(--border)}.mailbox-step-heading{display:flex;align-items:flex-start;gap:11px}.mailbox-step-heading>span{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;flex:none;background:#eaf7d2;color:#527717;font-size:12px;font-weight:900}.mailbox-step-heading h3{margin:1px 0 0;font-size:13px;color:var(--text);letter-spacing:0}.mailbox-step-heading p{margin:3px 0 0;font-size:11px;line-height:1.5;color:var(--muted)}.mailbox-step-content{display:grid;gap:13px;margin-left:37px}
    .mailbox-field-label{display:flex;align-items:center;gap:6px;margin-bottom:7px;color:var(--muted);font-size:12px;font-weight:700}.mailbox-field-label label{min-width:0}.mailbox-help{position:relative;display:inline-flex}.mailbox-help summary{display:grid;place-items:center;color:#8791a2;cursor:pointer;list-style:none}.mailbox-help summary::-webkit-details-marker{display:none}.mailbox-help>p{position:absolute;z-index:20;left:22px;top:-10px;width:250px;margin:0;padding:10px 11px;border:1px solid var(--border);border-radius:8px;background:var(--surface);box-shadow:0 12px 28px rgba(15,23,42,.14);color:var(--text);font-size:11px;font-weight:500;line-height:1.5}.mailbox-help:not([open])>p{display:none}
    .mailbox-health{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid var(--border);border-radius:8px;overflow:hidden}.mailbox-health-item{display:flex;align-items:flex-start;gap:10px;padding:14px;min-width:0}.mailbox-health-item+ .mailbox-health-item{border-left:1px solid var(--border)}.mailbox-health-item>svg{color:var(--muted);flex:none;margin-top:1px}.mailbox-health-item span,.mailbox-health-item strong,.mailbox-health-item small{display:block}.mailbox-health-item span{font-size:11px;color:var(--muted);font-weight:700}.mailbox-health-item strong{font-size:13px;color:var(--text);margin-top:2px}.mailbox-health-item strong.ok{color:var(--tone-success-strong)}.mailbox-health-item small{font-size:11px;line-height:1.45;color:var(--muted);margin-top:3px}
    .mailbox-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.mailbox-actions button{min-height:42px;border-radius:8px;padding:0 14px;display:inline-flex;align-items:center;justify-content:center;gap:8px;font:700 13px inherit;cursor:pointer}.mailbox-actions button:disabled{cursor:not-allowed;opacity:.55}.mailbox-primary{border:0;background:#c7f56f;color:#142000}.mailbox-secondary{border:1px solid var(--border);background:var(--surface);color:var(--text)}.mailbox-danger{border:0;background:transparent;color:#c33;padding-inline:8px!important;margin-left:auto}
    .mailbox-providers{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px}.mailbox-providers button{min-height:48px;padding:7px 9px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font:700 12px inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px}.mailbox-providers button>span{display:grid;gap:2px}.mailbox-providers button small{font-size:9px;font-weight:700;color:#9a6700}.mailbox-providers button.selected{border-color:#9dca43;background:#f3fae7;color:#527717}
    .mailbox-basic-grid,.mailbox-server-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.mailbox-password-field{min-width:0}.mailbox-password-help{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-top:7px}.mailbox-password-help p{margin:0;color:var(--muted);font-size:11px;line-height:1.5}.mailbox-password-help a{display:inline-flex;align-items:center;gap:5px;flex:none;color:#527717;font-size:11px;font-weight:800;text-decoration:none}.mailbox-port-grid{display:grid;grid-template-columns:90px minmax(0,1fr);gap:9px}
    .mailbox-auto-servers{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:start;padding:11px 12px;border:1px solid #dcebc3;border-radius:8px;background:#f8fbea;color:#668c22}.mailbox-auto-servers svg{margin-top:1px}.mailbox-auto-servers strong,.mailbox-auto-servers p{display:block}.mailbox-auto-servers strong{font-size:11px;color:#456614}.mailbox-auto-servers p{margin:3px 0 0;font-size:11px;line-height:1.45;color:#617345}.mailbox-oauth-block{display:flex;align-items:flex-start;gap:11px;padding:13px;border:1px solid #e4e7ec;border-radius:8px;background:var(--bg);color:var(--muted)}.mailbox-oauth-block>svg{flex:none}.mailbox-oauth-block strong{display:block;font-size:12px;color:var(--text)}.mailbox-oauth-block p{margin:4px 0 8px;font-size:11px;line-height:1.55}.mailbox-oauth-block span{display:inline-flex;padding:4px 7px;border-radius:999px;background:#eef0f3;color:#667085;font-size:10px;font-weight:800}.mailbox-custom-heading{display:flex;align-items:flex-start;gap:10px;padding:12px 13px;border:1px solid #f2dda5;border-radius:8px;background:#fff8e6;color:#9a6700}.mailbox-custom-heading strong{display:block;font-size:12px;color:#7a5200}.mailbox-custom-heading p{margin:3px 0 0;font-size:11px;line-height:1.5}
    .mailbox-mismatch{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:start;padding:12px 13px;border:1px solid #f2dda5;border-radius:8px;background:#fff8e6;color:#9a6700}.mailbox-mismatch strong{display:block;font-size:12px;color:#7a5200}.mailbox-mismatch p{margin:3px 0 0;font-size:11px;line-height:1.5}.mailbox-mismatch button{border:1px solid #e2c879;background:#fff;border-radius:7px;padding:8px 10px;color:#6f4b00;font:700 11px inherit;cursor:pointer}
    .mailbox-disclosure{justify-self:start;display:inline-flex;align-items:center;gap:8px;border:0;background:transparent;color:var(--muted);font:700 12px inherit;padding:0;cursor:pointer}.mailbox-disclosure svg:last-child,.mailbox-forwarding svg{transition:transform .16s ease}.mailbox-disclosure .rotated,.mailbox-forwarding .rotated{transform:rotate(180deg)}.mailbox-advanced{border-top:1px solid var(--border);padding-top:18px;display:grid;gap:15px}.mailbox-advanced h3{margin:0;font-size:13px;color:var(--text)}
    .mailbox-forwarding{border-top:1px solid var(--border);padding-top:14px}.mailbox-forwarding>button{width:100%;border:0;background:transparent;padding:0;display:flex;align-items:center;justify-content:space-between;text-align:left;color:var(--text);cursor:pointer}.mailbox-forwarding strong,.mailbox-forwarding small{display:block}.mailbox-forwarding strong{font-size:12px}.mailbox-forwarding small{font-size:11px;color:var(--muted);margin-top:3px}.mailbox-forwarding-address{margin-top:12px;padding:12px;background:var(--bg);border-radius:8px;display:flex;gap:12px;align-items:end;justify-content:space-between}.mailbox-forwarding-address code{font-size:12px;color:var(--text);overflow-wrap:anywhere}.mailbox-forwarding-address button{min-height:36px;padding:0 10px;border:1px solid var(--border);border-radius:7px;background:var(--surface);display:flex;align-items:center;gap:6px;font:700 11px inherit;cursor:pointer}
    .mailbox-errors{border-left:3px solid #ef4444;padding:2px 0 2px 12px}.mailbox-errors p{margin:3px 0;font-size:12px;line-height:1.55;color:#b42318}.mailbox-form-actions{padding-top:2px}.mailbox-required-hint{margin:-10px 0 0;font-size:11px;color:var(--muted)}.mailbox-spin{animation:mailboxSpin .8s linear infinite}@keyframes mailboxSpin{to{transform:rotate(360deg)}}
    @media(max-width:720px){.mailbox-providers{grid-template-columns:repeat(2,minmax(0,1fr))}.mailbox-health{grid-template-columns:1fr}.mailbox-health-item+ .mailbox-health-item{border-left:0;border-top:1px solid var(--border)}}
    @media(max-width:560px){.mailbox-header{padding:16px;align-items:flex-start}.mailbox-preservation{padding:11px 16px}.mailbox-body{padding:16px}.mailbox-header .mailbox-state{font-size:0;padding:7px}.mailbox-header .mailbox-state span{width:8px;height:8px}.mailbox-step-content{margin-left:0}.mailbox-basic-grid,.mailbox-server-grid{grid-template-columns:1fr}.mailbox-password-help{display:grid}.mailbox-mismatch{grid-template-columns:auto 1fr}.mailbox-mismatch button{grid-column:2}.mailbox-actions button{width:100%}.mailbox-danger{margin-left:0!important}.mailbox-forwarding-address{align-items:stretch;flex-direction:column}.mailbox-forwarding-address button{align-self:flex-start}.mailbox-help>p{left:auto;right:-10px;width:min(250px,75vw)}}
  `}</style>;
}
