export const SMTP_PRESETS = {
  hostinger: {
    label: "Hostinger",
    host: "smtp.hostinger.com",
    port: 587,
    encryption: "starttls",
  },
  mijndomein: {
    label: "MijnDomein",
    host: "mail.mijndomein.nl",
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

export type SmtpPresetKey = keyof typeof SMTP_PRESETS;
export type SmtpEncryption = "starttls" | "ssl" | "none";

export function isSmtpPresetKey(value: unknown): value is SmtpPresetKey {
  return typeof value === "string" && value in SMTP_PRESETS;
}

export function isSmtpEncryption(value: unknown): value is SmtpEncryption {
  return value === "starttls" || value === "ssl" || value === "none";
}
