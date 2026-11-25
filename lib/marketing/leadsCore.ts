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
