import type { SupabaseClient } from "@supabase/supabase-js";

import { writeLeadDraft } from "./drafts.ts";
import { enrichDomain } from "./enrich.ts";
import { LEAD_STATUSES, normalizeDomain, scoreLead, type LeadSignals, type LeadStatus } from "./leadsCore.ts";

/**
 * Leads in Supabase (migratie 081). Krijgt de database-client mee, zodat zowel de
 * backoffice (service-role via de app) als het importscript (service-role via
 * .env.local) dezelfde code gebruiken. Er wordt hier niets verstuurd.
 */

export type LeadRow = {
  id: string; domain: string; name: string | null; website: string; bol_url: string | null; platform: string | null; category: string | null;
  contact_email: string | null; linkedin_url: string | null; signals: Partial<LeadSignals>; score: number; score_reasons: string[]; status: LeadStatus;
  linkedin_draft: string | null; email_subject: string | null; email_draft: string | null; drafted_at: string | null;
  next_action: string | null; next_action_at: string | null; contacted_at: string | null; notes: string | null; source: string | null;
  tenant_id: string | null; enriched_at: string | null; created_at: string; updated_at: string;
};

export type LeadInput = { url: string; name?: string | null; category?: string | null; bolUrl?: string | null; source?: string | null;
  /** De bron zegt al dat deze shop op bol verkoopt (bijv. gebruiker van een bol-koppelapp). Eigen sites noemen bol zelden. */
  bol?: boolean };
export type ImportResult = { domain: string; outcome: "added" | "refreshed" | "skipped" | "failed"; detail: string; score?: number };

async function logEvent(db: SupabaseClient, leadId: string, kind: string, detail: string | null, actor: string) {
  const { error } = await db.from("sales_lead_events").insert({ lead_id: leadId, kind, detail, actor });
  if (error) console.warn("[leads] gebeurtenis niet vastgelegd:", error.message);
}

export async function importLead(db: SupabaseClient, input: LeadInput, options: { draft?: boolean; refresh?: boolean; actor?: string } = {}): Promise<ImportResult> {
  const actor = options.actor ?? "agent";
  const domain = normalizeDomain(input.url);
  if (!domain) return { domain: input.url, outcome: "skipped", detail: "geen bruikbaar domein (of een marktplaats/social-site)" };

  const { data: existing, error: readError } = await db.from("sales_leads").select("id, status").eq("domain", domain).maybeSingle();
  if (readError) return { domain, outcome: "failed", detail: readError.message };
  if (existing?.status === "afgemeld") return { domain, outcome: "skipped", detail: "heeft zich afgemeld" };
  if (existing && !options.refresh) return { domain, outcome: "skipped", detail: "staat er al in" };

  const enriched = await enrichDomain(domain);
  if (!enriched.ok) {
    if (existing) {
      // Oude gegevens en concepten kunnen op een botcontrolepagina gebaseerd zijn: weg ermee.
      await db.from("sales_leads").update({ notes: `Niet te verrijken: ${enriched.reason}`, linkedin_draft: null, email_subject: null, email_draft: null, score: 0, score_reasons: [], updated_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await db.from("sales_leads").insert({ domain, website: `https://${domain}`, name: input.name ?? null, category: input.category ?? null, bol_url: input.bolUrl ?? null, source: input.source ?? null, status: "afgewezen", notes: `Niet te verrijken: ${enriched.reason}`, score_reasons: [] });
    }
    return { domain, outcome: "failed", detail: enriched.reason };
  }

  const signals: LeadSignals = { ...enriched.signals, bol: enriched.signals.bol || Boolean(input.bolUrl) || Boolean(input.bol), bolUrl: enriched.signals.bolUrl ?? input.bolUrl ?? null };
  const { score, reasons } = scoreLead(signals);
  const now = new Date().toISOString();
  const name = input.name?.trim() || signals.title?.split(/\s[|–-]\s/)[0]?.trim() || domain;
  const row = {
    domain, name, website: enriched.website, bol_url: signals.bolUrl, platform: signals.platform, category: input.category ?? null,
    contact_email: signals.contactEmail, linkedin_url: signals.linkedinUrl, signals, score, score_reasons: reasons,
    source: input.source ?? null, enriched_at: now, updated_at: now,
  };
  const query = existing
    ? db.from("sales_leads").update(row).eq("id", existing.id).select("id").single()
    : db.from("sales_leads").insert(row).select("id").single();
  const { data: saved, error } = await query;
  if (error || !saved) return { domain, outcome: "failed", detail: error?.message ?? "opslaan mislukt" };
  await logEvent(db, saved.id, existing ? "verrijkt" : "toegevoegd", `score ${score}`, actor);

  if (options.draft !== false) {
    const drafted = await draftLead(db, saved.id, actor);
    if (!drafted.ok) return { domain, outcome: existing ? "refreshed" : "added", detail: `concept mislukt: ${drafted.error}`, score };
  }
  return { domain, outcome: existing ? "refreshed" : "added", detail: `score ${score}`, score };
}

export async function draftLead(db: SupabaseClient, id: string, actor = "agent"): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: lead, error } = await db.from("sales_leads").select("id, name, domain, category, signals, status").eq("id", id).single();
  if (error || !lead) return { ok: false, error: error?.message ?? "lead niet gevonden" };
  if (lead.status === "afgemeld") return { ok: false, error: "lead heeft zich afgemeld" };
  try {
    const draft = await writeLeadDraft({ name: lead.name, domain: lead.domain, category: lead.category, signals: lead.signals as LeadSignals });
    const now = new Date().toISOString();
    const { error: saveError } = await db.from("sales_leads").update({ linkedin_draft: draft.linkedin, email_subject: draft.emailSubject, email_draft: draft.emailBody, drafted_at: now, updated_at: now }).eq("id", id);
    if (saveError) return { ok: false, error: saveError.message };
    await logEvent(db, id, "concept", null, actor);
    return { ok: true };
  } catch (draftError) {
    return { ok: false, error: draftError instanceof Error ? draftError.message : String(draftError) };
  }
}

export type LeadPatch = {
  status?: LeadStatus; notes?: string | null; nextAction?: string | null; nextActionAt?: string | null;
  linkedinDraft?: string | null; emailSubject?: string | null; emailDraft?: string | null; contacted?: "linkedin" | "mail" | "telefoon";
};

/** Wijziging vanuit de CRM. "contacted" zet de lead op benaderd en plant opvolging over 4 werkdagen. */
export async function updateLead(db: SupabaseClient, id: string, patch: LeadPatch, actor: string) {
  const now = new Date();
  const values: Record<string, unknown> = { updated_at: now.toISOString() };
  const events: Array<[string, string | null]> = [];
  if (patch.status) {
    if (!LEAD_STATUSES.includes(patch.status)) throw new Error("Onbekende status");
    values.status = patch.status;
    events.push(["status", patch.status]);
    if (patch.status === "afgemeld") { values.next_action = null; values.next_action_at = null; }
  }
  if (patch.contacted) {
    values.status = "benaderd";
    values.contacted_at = now.toISOString();
    values.next_action = `Opvolgen (${patch.contacted})`;
    values.next_action_at = addWorkdays(now, 4).toISOString();
    events.push(["benaderd", patch.contacted]);
  }
  if (patch.notes !== undefined) { values.notes = patch.notes; events.push(["notitie", null]); }
  if (patch.nextAction !== undefined) values.next_action = patch.nextAction;
  if (patch.nextActionAt !== undefined) values.next_action_at = patch.nextActionAt;
  if (patch.linkedinDraft !== undefined) values.linkedin_draft = patch.linkedinDraft;
  if (patch.emailSubject !== undefined) values.email_subject = patch.emailSubject;
  if (patch.emailDraft !== undefined) values.email_draft = patch.emailDraft;
  const { error } = await db.from("sales_leads").update(values).eq("id", id);
  if (error) throw new Error(error.message);
  for (const [kind, detail] of events) await logEvent(db, id, kind, detail, actor);
}

export function addWorkdays(from: Date, days: number) {
  const date = new Date(from);
  let left = days;
  while (left > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) left--;
  }
  date.setUTCHours(8, 0, 0, 0);
  return date;
}

export async function listLeads(db: SupabaseClient) {
  const { data, error } = await db.from("sales_leads").select("*").order("score", { ascending: false }).order("created_at", { ascending: false }).limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []) as LeadRow[];
}

export async function leadEvents(db: SupabaseClient, id: string) {
  const { data } = await db.from("sales_lead_events").select("kind, detail, actor, created_at").eq("lead_id", id).order("created_at", { ascending: false }).limit(50);
  return data ?? [];
}
