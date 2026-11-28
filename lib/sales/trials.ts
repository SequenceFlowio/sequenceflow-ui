import type { SupabaseClient } from "@supabase/supabase-js";

import { adminEmails } from "@/lib/backoffice/authCore";
import { isTeamWhitelistedEmail } from "@/lib/billingWhitelist";
import { sendEmail } from "@/lib/resend";
import { appUrl } from "@/lib/site";

import { addWorkdays } from "./store";
import { dueFollowups, leadKeyForEmail, type FollowupLinks, type TrialState } from "./trialCore";

/**
 * Proefaccounts opvolgen: concepten voor dag 2/7/12 klaarzetten, ze na een klik
 * versturen, en elke aanmelding als lead in de CRM zetten (met een belmoment).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
export const FOLLOWUP_FROM = process.env.TRIAL_FOLLOWUP_FROM?.trim() || "Navaron van SequenceFlow <hallo@mail.sequenceflow.io>";
export const FOLLOWUP_REPLY_TO = process.env.TRIAL_FOLLOWUP_REPLY_TO?.trim() || "hallo@sequenceflow.io";

export function followupLinks(): FollowupLinks {
  return { upgradeUrl: appUrl("/upgrade"), demoUrl: process.env.DEMO_BOOKING_URL?.trim() || null, knowledgeUrl: appUrl("/knowledge") };
}

export type TrialRow = {
  tenantId: string; name: string; email: string | null; createdAt: string; plan: string; trialEndsAt: string | null;
  connectedAt: string | null; firstDraftAt: string | null; firstSentAt: string | null; internal: boolean; paying: boolean;
};

export type FollowupRow = {
  id: string; tenant_id: string; step: number; variant: string; due_at: string; status: "concept" | "verstuurd" | "overgeslagen";
  to_email: string | null; subject: string; body: string; sent_at: string | null; sent_by: string | null;
};

async function ownerEmails(db: SupabaseClient, tenantIds: string[]) {
  const emails = new Map<string, string>();
  if (!tenantIds.length) return emails;
  const { data: members } = await db.from("tenant_members").select("tenant_id, user_id, role").in("tenant_id", tenantIds);
  const pick = new Map<string, string>();
  for (const member of members ?? []) if (!pick.has(member.tenant_id) || member.role === "admin") pick.set(member.tenant_id, member.user_id);
  await Promise.all([...pick.entries()].map(async ([tenantId, userId]) => {
    const { data } = await db.auth.admin.getUserById(userId);
    if (data?.user?.email) emails.set(tenantId, data.user.email);
  }));
  return emails;
}

/** Proefaccounts van de laatste 30 dagen met wat ze al deden. */
export async function loadTrials(db: SupabaseClient, now = new Date()): Promise<TrialRow[]> {
  const since = new Date(now.getTime() - 30 * DAY_MS).toISOString();
  const { data: tenants, error } = await db.from("tenants").select("id, name, plan, created_at, trial_ends_at").gte("created_at", since).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const ids = (tenants ?? []).map((tenant) => tenant.id as string);
  const [emails, milestones] = await Promise.all([
    ownerEmails(db, ids),
    db.rpc("marketing_funnel_milestones").then(({ data }) => new Map(((data ?? []) as Array<{ tenant_id: string; connected_at: string | null; first_draft_at: string | null; first_sent_at: string | null }>).map((row) => [row.tenant_id, row]))),
  ]);
  const team = new Set(adminEmails(process.env.PLATFORM_ADMIN_EMAILS));
  return (tenants ?? []).map((tenant) => {
    const email = emails.get(tenant.id) ?? null;
    const reached = milestones.get(tenant.id);
    return {
      tenantId: tenant.id, name: (tenant.name as string | null)?.trim() || "Werkruimte", email, createdAt: tenant.created_at, plan: tenant.plan, trialEndsAt: tenant.trial_ends_at,
      connectedAt: reached?.connected_at ?? null, firstDraftAt: reached?.first_draft_at ?? null, firstSentAt: reached?.first_sent_at ?? null,
      internal: Boolean(email && (isTeamWhitelistedEmail(email) || team.has(email.toLowerCase()))),
      paying: tenant.plan !== "trial" && tenant.plan !== "expired",
    };
  });
}

/**
 * Zet de concepten klaar die vandaag nodig zijn, slaat te laat geworden stappen over,
 * en houdt de CRM bij: elke aanmelding een lead (status proef, belmoment over 2
 * werkdagen), betalers op klant. Verstuurt niets.
 */
export async function syncTrialFollowups(db: SupabaseClient, now = new Date()) {
  const trials = await loadTrials(db, now);
  const { data: existing } = await db.from("trial_followups").select("tenant_id, step").in("tenant_id", trials.map((t) => t.tenantId));
  const stepsByTenant = new Map<string, number[]>();
  for (const row of existing ?? []) stepsByTenant.set(row.tenant_id, [...(stepsByTenant.get(row.tenant_id) ?? []), row.step]);
  const links = followupLinks();
  let created = 0;

  for (const trial of trials) {
    if (!trial.internal && trial.email) await ensureTrialLead(db, trial);
    const state: TrialState = { ...trial };
    const { create, skip } = dueFollowups(state, stepsByTenant.get(trial.tenantId) ?? [], now.toISOString(), links);
    const rows = [
      ...create.map((draft) => ({ tenant_id: trial.tenantId, step: draft.step, variant: draft.variant, due_at: draft.dueAt, status: "concept", to_email: trial.email, subject: draft.subject, body: draft.body })),
      ...skip.map((step) => ({ tenant_id: trial.tenantId, step, variant: "te-laat", due_at: new Date(Date.parse(trial.createdAt) + step * DAY_MS).toISOString(), status: "overgeslagen", to_email: trial.email, subject: "(overgeslagen)", body: "" })),
    ];
    if (!rows.length || !trial.email) continue;
    const { error } = await db.from("trial_followups").upsert(rows, { onConflict: "tenant_id,step", ignoreDuplicates: true });
    if (error) console.warn("[trials] opvolging niet klaargezet:", error.message);
    else created += create.length;
  }
  return { trials, created };
}

/** Elke aanmelding staat als lead in de CRM, zodat bellen en opvolgen op één plek zitten. */
export async function ensureTrialLead(db: SupabaseClient, trial: Pick<TrialRow, "tenantId" | "name" | "email" | "createdAt" | "paying">) {
  if (!trial.email) return;
  const { data: linked } = await db.from("sales_leads").select("id, status").eq("tenant_id", trial.tenantId).maybeSingle();
  if (linked) {
    if (trial.paying && linked.status !== "klant") await db.from("sales_leads").update({ status: "klant", next_action: null, next_action_at: null, updated_at: new Date().toISOString() }).eq("id", linked.id);
    return;
  }
  const key = leadKeyForEmail(trial.email);
  if (!key) return;
  const callAt = addWorkdays(new Date(trial.createdAt), 2).toISOString();
  const values = { tenant_id: trial.tenantId, status: trial.paying ? "klant" : "trial", next_action: trial.paying ? null : "Bellen: hoe gaat de proef?", next_action_at: trial.paying ? null : callAt, updated_at: new Date().toISOString() };
  const { data: byDomain } = await db.from("sales_leads").select("id, status").eq("domain", key.domain).maybeSingle();
  if (byDomain) {
    // Een lead die we benaderden en die zich nu aanmeldde: koppelen.
    if (byDomain.status !== "afgemeld") await db.from("sales_leads").update(values).eq("id", byDomain.id);
    await db.from("sales_lead_events").insert({ lead_id: byDomain.id, kind: "aangemeld", detail: trial.name, actor: "systeem" });
    return;
  }
  const { data: inserted } = await db.from("sales_leads").insert({
    domain: key.domain, name: trial.name, website: key.business ? `https://${key.domain}` : "", contact_email: trial.email, source: "aanmelding", score: 0, score_reasons: [], ...values,
  }).select("id").single();
  if (inserted) await db.from("sales_lead_events").insert({ lead_id: inserted.id, kind: "aangemeld", detail: trial.name, actor: "systeem" });
}

export async function listFollowups(db: SupabaseClient) {
  const { data, error } = await db.from("trial_followups").select("id, tenant_id, step, variant, due_at, status, to_email, subject, body, sent_at, sent_by").order("due_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as FollowupRow[];
}

/** Verstuurt één concept na een klik van een beheerder. Alleen vanuit status concept. */
export async function sendFollowup(db: SupabaseClient, id: string, edit: { subject?: string; body?: string }, actor: string) {
  const { data: row, error } = await db.from("trial_followups").select("id, status, to_email, subject, body").eq("id", id).single();
  if (error || !row) throw new Error("Concept niet gevonden");
  if (row.status !== "concept") throw new Error("Dit concept is al verstuurd of overgeslagen");
  if (!row.to_email) throw new Error("Geen e-mailadres bekend");
  const subject = (edit.subject ?? row.subject).trim();
  const body = (edit.body ?? row.body).trim();
  if (!subject || !body) throw new Error("Onderwerp en tekst mogen niet leeg zijn");
  // Eerst claimen, zodat een dubbele klik niet twee mails verstuurt.
  const { data: claimed } = await db.from("trial_followups").update({ status: "verstuurd", subject, body, sent_at: new Date().toISOString(), sent_by: actor, updated_at: new Date().toISOString() }).eq("id", id).eq("status", "concept").select("id");
  if (!claimed?.length) throw new Error("Dit concept is net al verstuurd");
  try {
    const result = await sendEmail({ to: row.to_email, from: FOLLOWUP_FROM, replyTo: FOLLOWUP_REPLY_TO, subject, text: body });
    await db.from("trial_followups").update({ resend_id: result.id ?? null }).eq("id", id);
  } catch (sendError) {
    await db.from("trial_followups").update({ status: "concept", sent_at: null, sent_by: null }).eq("id", id);
    throw sendError;
  }
}

export async function skipFollowup(db: SupabaseClient, id: string, actor: string) {
  const { error } = await db.from("trial_followups").update({ status: "overgeslagen", sent_by: actor, updated_at: new Date().toISOString() }).eq("id", id).eq("status", "concept");
  if (error) throw new Error(error.message);
}
