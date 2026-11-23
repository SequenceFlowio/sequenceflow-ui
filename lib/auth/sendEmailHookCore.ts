import { createHmac, timingSafeEqual } from "node:crypto";

import type { AuthMailKind } from "../email/authTemplates.ts";

/**
 * Supabase "Send Email Hook": Supabase verstuurt de auth-mails niet zelf, maar
 * roept app/api/auth/send-email aan. De aanroep is ondertekend volgens
 * Standard Webhooks (headers webhook-id, webhook-timestamp, webhook-signature;
 * geheim "v1,whsec_<base64>"). Geen imports met een alias: de tests laden dit direct.
 */

export function verifyStandardWebhook(input: { secret: string; id: string | null; timestamp: string | null; signature: string | null; body: string; now?: number }) {
  if (!input.id || !input.timestamp || !input.signature) return false;
  const ts = Number(input.timestamp);
  const now = Math.floor((input.now ?? Date.now()) / 1000);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > 5 * 60) return false;
  const raw = input.secret.replace(/^v1,/, "").replace(/^whsec_/, "");
  const key = Buffer.from(raw, "base64");
  if (!key.length) return false;
  const expected = Buffer.from(createHmac("sha256", key).update(`${input.id}.${input.timestamp}.${input.body}`).digest("base64"));
  return input.signature.split(" ").some((part) => {
    const given = Buffer.from(part.replace(/^v1,/, ""));
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/** Soort auth-mail van Supabase → onze mailsoort. */
export function authMailKind(action: string): AuthMailKind | null {
  switch (action) {
    case "magiclink":
    case "signup":
    case "email":
      return "login";
    case "invite":
      return "invite";
    case "recovery":
      return "recovery";
    case "email_change":
    case "email_change_new":
    case "email_change_current":
      return "email_change";
    case "reauthentication":
      return "reauthentication";
    default:
      return null;
  }
}

/**
 * Taal van de mail: eerst wat de inlogpagina meegaf (?lang= in de terugkeerlink),
 * dan de taal die bij de gebruiker is opgeslagen, dan die van de werkruimte.
 */
export function authMailLanguage(input: { redirectTo?: string | null; userLang?: unknown; workspaceLang?: unknown }): "nl" | "en" {
  try {
    const fromLink = input.redirectTo ? new URL(input.redirectTo).searchParams.get("lang") : null;
    if (fromLink === "en" || fromLink === "nl") return fromLink;
  } catch {
    // geen geldige link
  }
  if (input.userLang === "en" || input.userLang === "nl") return input.userLang;
  return input.workspaceLang === "en" ? "en" : "nl";
}
