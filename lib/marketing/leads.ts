import { getResendClient } from "@/lib/email/outbound/resendClient";
import { leadCodeEmail, leadDownloadEmail, leadNurtureEmail, NURTURE_DAYS } from "@/lib/email/leadTemplates";
import { sendEmail } from "@/lib/resend";
import { SITE_ORIGIN } from "@/lib/site";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

import type { LeadInput } from "./freebies/catalog";
import { findFreebie } from "./freebies/catalog";
import { dueNurtureStep, leadToken, newLeadCode, pendingLeadToken, readPendingLead, type PendingLead } from "./leadsCore";

/**
 * Aanmeldingen voor de gratis downloads (migratie 079, tabel marketing_leads):
 * opslaan met taal en toestemming, de downloadmail, de mailreeks (alleen met
 * toestemming, en pas als LEAD_NURTURE_ENABLED=1) en afmelden. Elke mail gaat
 * in de taal van de pagina waarop iemand de download ophaalde.
 */

type LeadRow = { id: string; email: string; name: string | null; language: "nl" | "en"; marketing: boolean; nurture_step: number; nurture_sent_at: string | null; unsubscribed_at: string | null; created_at: string; freebies: string[] };

const LEAD_FIELDS = "id, email, name, language, marketing, nurture_step, nurture_sent_at, unsubscribed_at, created_at, freebies";

function secret() {
  const value = process.env.LEADS_SECRET || process.env.CRON_SECRET;
  if (!value) throw new Error("LEADS_SECRET or CRON_SECRET is not set");
  return value;
}

const missingTable = (error: { code?: string; message: string } | null) =>
  Boolean(error) && (error!.code === "42P01" || error!.code === "PGRST205" || /does not exist|schema cache/i.test(error!.message));

export function unsubscribeUrl(id: string, language: "nl" | "en") {
  return `${SITE_ORIGIN}/api/marketing/unsubscribe?l=${encodeURIComponent(leadToken(secret(), "unsubscribe", id))}&lang=${language}`;
}

/** Bewaart of werkt bij. Null als de tabel er nog niet is (migratie 079). */
export async function saveLead(lead: LeadInput): Promise<LeadRow | null> {
  const db = getSupabaseAdmin();
  const { data: existing, error } = await db.from("marketing_leads").select(LEAD_FIELDS).eq("email", lead.email).maybeSingle();
  if (missingTable(error)) {
    console.warn("[leads] tabel marketing_leads ontbreekt: voer migratie 079 uit");
    return null;
  }
  if (error) throw new Error(error.message);
  const now = new Date().toISOString();
  const row = existing as LeadRow | null;
  const values = {
    email: lead.email,
    name: lead.name || row?.name || null,
    store: lead.store || null,
    language: lead.lang,
    freebies: [...new Set([...(row?.freebies ?? []), lead.freebie.id])],
    source: lead.source || null,
    // Eenmaal toestemming blijft toestemming; opnieuw aanvinken na afmelden zet de reeks weer aan.
    marketing: lead.marketing || Boolean(row?.marketing && !row.unsubscribed_at),
    unsubscribed_at: lead.marketing ? null : row?.unsubscribed_at ?? null,
    updated_at: now,
  };
  const query = row
    ? db.from("marketing_leads").update(values).eq("id", row.id).select(LEAD_FIELDS).single()
    : db.from("marketing_leads").insert(values).select(LEAD_FIELDS).single();
  const { data, error: saveError } = await query;
  if (saveError) throw new Error(saveError.message);
  return data as LeadRow;
}

/** De link naar de download in de mail: opent hem direct, ook op een ander apparaat. */
export function downloadLink(lead: LeadInput, id: string | null) {
  const url = new URL(`${SITE_ORIGIN}${lead.freebie[lead.lang].path}`);
  if (id) url.searchParams.set("t", leadToken(secret(), "unlock", id));
  url.searchParams.set("utm_source", "email");
  url.searchParams.set("utm_content", lead.freebie.id);
  return url.toString();
}

export async function sendLeadDownloadMail(lead: LeadInput, row: LeadRow | null) {
  const marketing = Boolean(row?.marketing && !row.unsubscribed_at);
  const mail = leadDownloadEmail({
    language: lead.lang,
    name: lead.name || null,
    title: lead.freebie[lead.lang].title,
    link: downloadLink(lead, row?.id ?? null),
    marketing,
    unsubscribeUrl: row ? unsubscribeUrl(row.id, lead.lang) : null,
    kind: lead.freebie.kind,
  });
  const headers = row && marketing ? listUnsubscribe(row.id, lead.lang) : undefined;
  await sendEmail({ to: lead.email, subject: mail.subject, text: mail.text, html: mail.html, replyTo: "hallo@sequenceflow.io", headers });
}

function listUnsubscribe(id: string, language: "nl" | "en") {
  // Afmeldknop in Gmail en Apple Mail (RFC 8058: één klik, zonder bevestigingspagina).
  return { "List-Unsubscribe": `<${unsubscribeUrl(id, language)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
}

export async function unsubscribeLead(id: string) {
  const db = getSupabaseAdmin();
  const { data, error } = await db.from("marketing_leads").update({ marketing: false, unsubscribed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id).select("email, language").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  try {
    await getResendClient().contacts.update({ email: data.email as string, unsubscribed: true });
  } catch (resendError) {
    console.error("[leads] Resend-contact afmelden mislukt", resendError);
  }
  return data as { email: string; language: "nl" | "en" };
}

export function nurtureEnabled() {
  return process.env.LEAD_NURTURE_ENABLED === "1";
}

/** Dagelijks: de volgende mail uit de reeks aan wie aan de beurt is. */
export async function runLeadNurture(now = Date.now()) {
  if (!nurtureEnabled()) return { skipped: "LEAD_NURTURE_ENABLED staat niet op 1" };
  const db = getSupabaseAdmin();
  const since = new Date(now - 30 * 86_400_000).toISOString();
  const { data, error } = await db.from("marketing_leads").select(LEAD_FIELDS)
    .eq("marketing", true).is("unsubscribed_at", null).lt("nurture_step", NURTURE_DAYS.length).gte("created_at", since)
    .order("created_at").limit(300);
  if (missingTable(error)) return { skipped: "migratie 079 ontbreekt" };
  if (error) throw new Error(error.message);
  let sent = 0;
  const failures: string[] = [];
  for (const lead of (data ?? []) as LeadRow[]) {
    const step = dueNurtureStep(lead, now);
    if (!step) continue;
    // Eerst claimen, dan versturen: zo krijgt niemand een mail twee keer, ook niet als de cron dubbel draait.
    const { data: claimed } = await db.from("marketing_leads").update({ nurture_step: step, nurture_sent_at: new Date(now).toISOString() })
      .eq("id", lead.id).eq("nurture_step", step - 1).select("id").maybeSingle();
    if (!claimed) continue;
    try {
      const mail = leadNurtureEmail({ step, language: lead.language, name: lead.name, unsubscribeUrl: unsubscribeUrl(lead.id, lead.language) });
      await sendEmail({ to: lead.email, subject: mail.subject, text: mail.text, html: mail.html, replyTo: "hallo@sequenceflow.io", headers: listUnsubscribe(lead.id, lead.language) });
      sent++;
    } catch (sendError) {
      failures.push(`${lead.id}: ${sendError instanceof Error ? sendError.message : String(sendError)}`);
    }
  }
  return { sent, failures };
}

/* ───────────── Code per mail (stap 1 en 2 van de Academy-gate) ───────────── */

/** Stap 1: mail een code van 6 cijfers en geef het ondertekende wachttoken terug. Nog niets bewaard. */
export async function sendLeadCode(lead: LeadInput) {
  const code = newLeadCode();
  const pending: PendingLead = { f: lead.freebie.id, e: lead.email, n: lead.name, s: lead.store, m: lead.marketing, l: lead.lang, src: lead.source };
  const mail = leadCodeEmail({ language: lead.lang, name: lead.name || null, code });
  await sendEmail({ to: lead.email, subject: mail.subject, text: mail.text, html: mail.html, replyTo: "hallo@sequenceflow.io" });
  return pendingLeadToken(secret(), pending, code);
}

/** Stap 2: klopt de code bij het token? Dan de aanmelding terug (nog niet bewaard). */
export function checkLeadCode(token: unknown, code: unknown): { lead: LeadInput } | { error: "invalid" | "expired" | "wrong" } {
  const result = readPendingLead(secret(), String(token ?? ""), String(code ?? ""));
  if ("error" in result) return result;
  const freebie = findFreebie(result.lead.f);
  if (!freebie) return { error: "invalid" };
  const p = result.lead;
  return { lead: { freebie, email: p.e, name: p.n, store: p.s, marketing: p.m, lang: p.l, source: p.src } };
}

/**
 * Na een geldige code: als contact in Resend (met unsubscribed als iemand geen
 * tips wil), een melding naar hallo@, in marketing_leads en de mail met de link.
 * Fouten komen in de logs; de bezoeker krijgt toegang hoe dan ook.
 */
export async function completeLead(lead: LeadInput) {
  const resend = (() => {
    try { return getResendClient(); } catch (error) { console.error("[leads] geen Resend", error); return null; }
  })();
  if (resend) {
    const segment = process.env.RESEND_LEADS_SEGMENT_ID?.trim();
    const [contact, notice] = await Promise.allSettled([
      resend.contacts.create({ email: lead.email, firstName: lead.name || undefined, unsubscribed: !lead.marketing, ...(segment ? { segments: [{ id: segment }] } : {}) }),
      resend.emails.send({
        from: "SequenceFlow <noreply@mail.sequenceflow.io>",
        to: "hallo@sequenceflow.io",
        subject: `[Download] ${lead.freebie.keyword}: ${lead.email}`,
        text: [
          `Nieuwe aanmelding (e-mail bevestigd met code): ${lead.freebie.nl.title} (${lead.lang.toUpperCase()})`,
          "",
          `E-mail: ${lead.email}`,
          `Naam: ${lead.name || "—"}`,
          `Webshop: ${lead.store || "—"}`,
          `Wil tips ontvangen: ${lead.marketing ? "ja" : "nee"}`,
          `Bron: ${lead.source || "—"}`,
        ].join("\n"),
      }),
    ]);
    for (const [label, result] of [["contact", contact], ["melding", notice]] as const) {
      if (result.status === "rejected") console.error(`[leads] ${label}`, result.reason);
      else if (result.value.error) console.error(`[leads] ${label}`, result.value.error);
    }
  }
  try {
    const row = await saveLead(lead);
    await sendLeadDownloadMail(lead, row);
  } catch (error) {
    console.error("[leads] opslaan of toegangsmail mislukt", error instanceof Error ? error.message : error);
  }
}

export { findFreebie };
