import { NextResponse } from "next/server";

import { normalizeIntent } from "@/lib/ai/decision/intents";
import { hasValidCronSecret } from "@/lib/auth/cron";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { applyApproval, classifyApproval, INITIAL_STATE, type TrustLevel, type TrustState } from "@/lib/trust/ladderCore";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Elk uur: telt elke goedkeuring door een mens (reply_kind ai_assisted) mee op de
 * vertrouwensladder (docs/plan-werkstroomkern.md, fase 3). Wacht 30 minuten, zodat
 * learn-from-edits een aanpassing eerst kan classificeren. Elk bericht telt een keer.
 * Een voorstel voor een hogere trede wacht op de winkelier; deze cron zet niemand hoger.
 */
export async function GET(req: Request) {
  if (!hasValidCronSecret(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getSupabaseAdmin();
  const before = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data: messages, error } = await db.from("support_messages")
    .select("id, tenant_id, body_original, metadata, created_at")
    .eq("direction", "outbound")
    .eq("metadata->>reply_kind", "ai_assisted")
    .lt("created_at", before)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!messages?.length) return NextResponse.json({ ok: true, counted: 0 });

  const { data: done, error: doneError } = await db.from("trust_ladder_events").select("message_id").in("message_id", messages.map((m) => m.id));
  if (doneError) return NextResponse.json({ ok: false, error: doneError.message }, { status: 500 });
  const counted = new Set((done ?? []).map((row) => row.message_id as string));
  const todo = messages.filter((m) => !counted.has(m.id) && (m.metadata as { decision_id?: string } | null)?.decision_id);
  if (!todo.length) return NextResponse.json({ ok: true, counted: 0 });

  const decisionIds = todo.map((m) => (m.metadata as { decision_id: string }).decision_id);
  const [decisions, learning] = await Promise.all([
    db.from("support_decisions").select("id, intent, draft_body_ai").in("id", decisionIds),
    db.from("profile_learning_events").select("decision_id, classification").in("decision_id", decisionIds),
  ]);
  if (decisions.error || learning.error) return NextResponse.json({ ok: false, error: (decisions.error ?? learning.error)!.message }, { status: 500 });
  const decisionById = new Map((decisions.data ?? []).map((d) => [d.id as string, d]));
  const classificationByDecision = new Map((learning.data ?? []).map((l) => [l.decision_id as string, l.classification as string]));

  const states = new Map<string, TrustState>();
  let processed = 0;
  for (const message of todo) {
    const decisionId = (message.metadata as { decision_id: string }).decision_id;
    const decision = decisionById.get(decisionId);
    if (!decision?.draft_body_ai) continue;
    const intent = normalizeIntent(decision.intent as string);
    const key = `${message.tenant_id}:${intent}`;
    let state = states.get(key);
    if (!state) {
      const { data: row } = await db.from("trust_levels").select("level, streak, proposed_level").eq("tenant_id", message.tenant_id).eq("intent", intent).maybeSingle();
      state = row ? { level: row.level as TrustLevel, streak: row.streak as number, proposedLevel: (row.proposed_level as TrustLevel | null) ?? null } : INITIAL_STATE;
    }
    const outcome = classifyApproval(decision.draft_body_ai as string, (message.body_original as string | null) ?? "", classificationByDecision.get(decisionId));
    const { state: next, change } = applyApproval(state, outcome, intent);
    const now = new Date().toISOString();
    const { error: upsertError } = await db.from("trust_levels").upsert({
      tenant_id: message.tenant_id, intent, level: next.level, streak: next.streak, proposed_level: next.proposedLevel,
      ...(change === "promotion_proposed" ? { proposed_at: now } : {}),
      reason: `${outcome} → ${change}`, updated_at: now,
    }, { onConflict: "tenant_id,intent" });
    if (upsertError) return NextResponse.json({ ok: false, error: upsertError.message, processed }, { status: 500 });
    const { error: eventError } = await db.from("trust_ladder_events").insert({
      message_id: message.id, tenant_id: message.tenant_id, decision_id: decisionId, intent, outcome, change, level_after: next.level, streak_after: next.streak,
    });
    if (eventError && eventError.code !== "23505") return NextResponse.json({ ok: false, error: eventError.message, processed }, { status: 500 });
    states.set(key, next);
    processed += 1;
  }
  return NextResponse.json({ ok: true, counted: processed });
}
