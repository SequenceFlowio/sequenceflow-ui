export const SMTP_PRESETS = {
  hostinger: {
    label: "Hostinger",
    host: "smtp.hostinger.com",
    port: 465,
    encryption: "ssl",
  },
  mijndomein: {
    label: "MijnDomein",
    host: "smtp.mijndomein.nl",
    port: 587,
    encryption: "starttls",
  },
  google_workspace: {
    label: "Google Workspace",
    host: "smtp.gmail.com",
    port: 587,
    encryption: "starttls",
  },
  microsoft_365: {
    label: "Microsoft 365 / Outlook",
    host: "smtp.office365.com",
    port: 587,
    encryption: "starttls",
  },
  other: {
    label: "Other",
    host: "",
    port: 587,
    encryption: "starttls",
  },
} as const;

export const IMAP_PRESETS = {
  hostinger: {
    label: "Hostinger",
    host: "imap.hostinger.com",
    port: 993,
    encryption: "ssl",
  },
  mijndomein: {
    label: "MijnDomein",
    host: "imap.mijndomein.nl",
    port: 993,
    encryption: "ssl",
  },
  google_workspace: {
    label: "Google Workspace",
    host: "imap.gmail.com",
    port: 993,
    encryption: "ssl",
  },
  microsoft_365: {
    label: "Microsoft 365 / Outlook",
    host: "outlook.office365.com",
    port: 993,
    encryption: "ssl",
  },
  other: {
    label: "Other",
    host: "",
    port: 993,
    encryption: "ssl",
  },
} as const;

export type SmtpPresetKey = keyof typeof SMTP_PRESETS;
export type SmtpEncryption = "starttls" | "ssl" | "none";
export type ImapPresetKey = keyof typeof IMAP_PRESETS;
export type ImapEncryption = "starttls" | "ssl" | "none";

export function isSmtpPresetKey(value: unknown): value is SmtpPresetKey {
  return typeof value === "string" && value in SMTP_PRESETS;
}

export function isSmtpEncryption(value: unknown): value is SmtpEncryption {
  return value === "starttls" || value === "ssl" || value === "none";
}

export function isImapPresetKey(value: unknown): value is ImapPresetKey {
  return typeof value === "string" && value in IMAP_PRESETS;
}

export function isImapEncryption(value: unknown): value is ImapEncryption {
  return value === "starttls" || value === "ssl" || value === "none";
}
