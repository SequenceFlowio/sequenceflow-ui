import { estimateValue } from "@/lib/analytics/value";
import { PAIN_POINT_PLANS, getTenantPlanAccess } from "@/lib/billing";
import { configuredAppOrigin } from "@/lib/brand";
import { DEFAULT_FROM_EMAIL, sendEmail } from "@/lib/resend";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

import { shouldSendBriefing, unsubscribeSignature, weeklyBriefingEmail } from "./weeklyBriefing";

const OUTCOME = "weekly_briefing";
const WEEK = 7 * 24 * 60 * 60 * 1000;

function secret() {
  const value = process.env.WEEKLY_BRIEFING_SECRET || process.env.CRON_SECRET;
  if (!value) throw new Error("WEEKLY_BRIEFING_SECRET or CRON_SECRET is not set");
  return value;
}

export function unsubscribeUrl(tenantId: string) {
  return `${configuredAppOrigin()}/api/briefing/unsubscribe?t=${encodeURIComponent(tenantId)}&s=${unsubscribeSignature(tenantId, secret())}`;
}

function seffyFrom() {
  const address = DEFAULT_FROM_EMAIL.match(/<([^>]+)>/)?.[1] ?? DEFAULT_FROM_EMAIL;
  return `Seffy van Support One <${address.trim()}>`;
}

/** Stuurt de wekelijkse mail naar de admins van één werkruimte. Per week één keer. */
export async function sendWeeklyBriefing(tenantId: string, week: string, now = new Date()) {
  const db = getSupabaseAdmin();
  const { data: sent, error: sentError } = await db.from("support_events").select("id").eq("tenant_id", tenantId).eq("outcome", OUTCOME).eq("subject", week).limit(1);
  if (sentError) throw new Error(sentError.message);
  if (sent?.length) return { status: "already_sent" as const };

  const since = new Date(now.getTime() - WEEK).toISOString();
  const [questions, replies, autonomous, waiting, config, connection] = await Promise.all([
    db.from("support_messages").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("direction", "inbound").gte("received_at", since),
    db.from("support_messages").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("direction", "outbound").gte("sent_at", since),
    db.from("support_messages").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("direction", "outbound").gte("sent_at", since).eq("metadata->>reply_kind", "ai_autonomous"),
    db.from("support_conversations").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).in("status", ["open", "review"]).is("spammed_at", null),
    db.from("tenant_agent_config").select("language_default").eq("tenant_id", tenantId).maybeSingle(),
    db.from("commerce_connections").select("display_name").eq("tenant_id", tenantId).eq("status", "active").order("created_at").limit(1).maybeSingle(),
  ]);
  for (const result of [questions, replies, autonomous, waiting]) if (result.error) throw new Error(result.error.message);
  const value = estimateValue(replies.count ?? 0);
  const stats = { questions: questions.count ?? 0, replies: replies.count ?? 0, autonomous: autonomous.count ?? 0, waiting: waiting.count ?? 0, ...value };
  if (!shouldSendBriefing(stats)) return { status: "quiet" as const };

  // Pijnpunten (Growth en hoger) en bol.com-signalen alleen als ze er al liggen: geen extra AI-kosten.
  const { plan } = await getTenantPlanAccess(tenantId);
  const fresh = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString();
  const [pain, commerce] = await Promise.all([
    PAIN_POINT_PLANS.includes(plan)
      ? db.from("pain_point_analyses").select("pain_points").eq("tenant_id", tenantId).in("period", ["weekly", "monthly"]).gte("generated_at", fresh).order("generated_at", { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    db.from("commerce_intelligence_briefings").select("briefing").eq("tenant_id", tenantId).eq("period_days", 7).gte("generated_at", fresh).maybeSingle(),
  ]);
  const painPoints = Array.isArray(pain.data?.pain_points) ? (pain.data!.pain_points as Array<{ category: string; count: number; recommended_action: string }>) : [];
  const priorities = (commerce.data?.briefing as { priorities?: Array<{ headline: string; recommendedAction: string }> } | null)?.priorities ?? [];

  // Eerst vastleggen, dan mailen: twee overlappende runs sturen niet allebei.
  const { error: logError } = await db.from("support_events").insert({ tenant_id: tenantId, source: "briefing", subject: week, intent: "system", confidence: 1, latency_ms: 0, outcome: OUTCOME });
  if (logError) throw new Error(logError.message);

  const message = weeklyBriefingEmail({
    nl: config.data?.language_default !== "en",
    shopName: connection.data?.display_name ?? null,
    stats,
    painPoints: [...painPoints].sort((a, b) => b.count - a.count),
    commerce: priorities,
    appUrl: `${configuredAppOrigin()}/dashboard`,
    unsubscribeUrl: unsubscribeUrl(tenantId),
  });
  const { data: members, error: membersError } = await db.from("tenant_members").select("user_id, role").eq("tenant_id", tenantId);
  if (membersError) throw new Error(membersError.message);
  let recipients = 0;
  for (const member of (members ?? []).filter((row) => row.role === "admin")) {
    const { data } = await db.auth.admin.getUserById(member.user_id as string);
    const email = data?.user?.email?.trim().toLowerCase();
    if (!email || email.endsWith(".local")) continue;
    await sendEmail({ to: email, from: seffyFrom(), subject: message.subject, text: message.text });
    recipients += 1;
  }
  return { status: "sent" as const, recipients };
}
