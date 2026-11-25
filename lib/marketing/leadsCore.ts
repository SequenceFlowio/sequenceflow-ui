import { createHmac, timingSafeEqual } from "node:crypto";

import { NURTURE_DAYS } from "../email/leadTemplates.ts";

/**
 * Pure delen van de aanmeldingen voor gratis downloads (lib/marketing/leads.ts):
 * ondertekende links (afmelden, download op een ander apparaat openen) en welke
 * mail uit de reeks aan de beurt is. Zonder imports met een alias.
 */

const sign = (secret: string, purpose: string, id: string) => createHmac("sha256", secret).update(`${purpose}:${id}`).digest("base64url").slice(0, 32);

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Token "<id>.<handtekening>" voor de afmeldlink of de downloadlink. */
export function leadToken(secret: string, purpose: "unsubscribe" | "unlock", id: string) {
  return `${id}.${sign(secret, purpose, id)}`;
}

export function readLeadToken(secret: string, purpose: "unsubscribe" | "unlock", token: string): string | null {
  const [id, signature] = String(token ?? "").split(".");
  if (!id || !signature || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  return same(signature, sign(secret, purpose, id)) ? id : null;
}

/** Welke mail uit de reeks nu verstuurd mag worden (1-based), of null. Eén per keer, nooit een inhaalslag. */
export function dueNurtureStep(lead: { nurture_step: number; created_at: string; nurture_sent_at: string | null }, now = Date.now()) {
  const next = lead.nurture_step + 1;
  if (next > NURTURE_DAYS.length) return null;
  const days = (now - new Date(lead.created_at).getTime()) / 86_400_000;
  if (days < NURTURE_DAYS[next - 1]) return null;
  // Minstens 36 uur tussen twee mails, ook als de cron een tijd heeft stilgelegen.
  if (lead.nurture_sent_at && now - new Date(lead.nurture_sent_at).getTime() < 36 * 3_600_000) return null;
  return next;
}

/* ───────────── Code per mail (OTP) voor de Academy-gate ─────────────
   Stap 1 maakt een code van 6 cijfers en een ondertekend "wacht"-token met de
   aanmelding erin (nog niets bewaard). Stap 2 controleert code + token; pas dan
   wordt de aanmelding bewaard. Zonder tabel: het token draagt alles, de code
   zelf staat er alleen als HMAC in. */

export type PendingLead = { f: string; e: string; n: string; s: string; m: boolean; l: "nl" | "en"; src: string };

export const CODE_TTL_MS = 15 * 60_000;

/** Willekeurige code van 6 cijfers (100000–999999). */
export function newLeadCode(random: () => number = () => (crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32)) {
  return String(100000 + Math.floor(random() * 900000));
}

const codeMac = (secret: string, body: string, code: string) => createHmac("sha256", secret).update(`lead-code:${body}:${code}`).digest("base64url");

export function pendingLeadToken(secret: string, lead: PendingLead, code: string, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ ...lead, x: now + CODE_TTL_MS })).toString("base64url");
  return `${body}.${codeMac(secret, body, code)}`;
}

/** De aanmelding uit het token, als de code klopt en niet verlopen is; anders de reden. */
export function readPendingLead(secret: string, token: string, code: string, now = Date.now()): { lead: PendingLead } | { error: "invalid" | "expired" | "wrong" } {
  const [body, mac] = String(token ?? "").split(".");
  if (!body || !mac) return { error: "invalid" };
  let data: PendingLead & { x: number };
  try { data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch { return { error: "invalid" }; }
  if (typeof data?.x !== "number" || typeof data.e !== "string") return { error: "invalid" };
  const clean = String(code ?? "").replace(/\D/g, "");
  if (clean.length !== 6 || !same(mac, codeMac(secret, body, clean))) return { error: "wrong" };
  if (data.x < now) return { error: "expired" };
  const { x: _expires, ...lead } = data;
  void _expires;
  return { lead };
}
