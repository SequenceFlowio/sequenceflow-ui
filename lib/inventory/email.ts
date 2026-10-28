import { recordAiUsage } from "@/lib/ai/usage";
import { buildActions } from "@/lib/inventory/core";
import { introFacts, introIsGrounded, weeklyInventoryEmail } from "@/lib/inventory/emailCore";
import type { InventoryReport } from "@/lib/inventory/reportCore";
import { getOpenAIClient } from "@/lib/openaiClient";
import { sendEmail } from "@/lib/resend";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const MODEL = "gpt-4.1-mini";

function appUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://support.sequenceflow.io").replace(/\/$/, "");
}

/** Two or three sentences that put the week in words. Null when the AI is unavailable or invents numbers. */
async function writeIntro(tenantId: string, facts: ReturnType<typeof introFacts>, language: "nl" | "en", weekKey: string) {
  try {
    const completion = await getOpenAIClient().chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You write the opening of a weekly stock and buying email for a webshop owner. Write ${language === "nl" ? "Dutch" : "English"}, 2 or 3 short plain sentences, no greeting, no lists. Say what matters most this week. Use only the facts given; never add, round or calculate numbers yourself.`,
        },
        { role: "user", content: JSON.stringify(facts) },
      ],
      max_completion_tokens: 200,
    });
    if (completion.usage) {
      await recordAiUsage({ tenantId, operation: "inventory_briefing", model: MODEL, usage: completion.usage, idempotencyKey: `inventory-briefing:${weekKey}`, billable: false });
    }
    const intro = completion.choices[0]?.message?.content?.trim() ?? "";
    return intro && intro.length <= 600 && introIsGrounded(intro, facts) ? intro : null;
  } catch (error) {
    console.warn("[inventory/email] intro unavailable:", error instanceof Error ? error.message : error);
    return null;
  }
}

async function adminEmails(tenantId: string) {
  const db = getSupabaseAdmin();
  const { data: members, error } = await db.from("tenant_members").select("user_id,role").eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
  const emails = new Set<string>();
  for (const member of members ?? []) {
    if (member.role !== "admin") continue;
    const { data } = await db.auth.admin.getUserById(member.user_id as string);
    const email = data?.user?.email?.trim().toLowerCase();
    if (email && !email.endsWith(".local")) emails.add(email);
  }
  return [...emails];
}

/** Sends this week's advice to the workspace admins and records when. */
export async function sendWeeklyInventoryEmail(tenantId: string, report: InventoryReport, weekKey: string) {
  const db = getSupabaseAdmin();
  const [{ data: config }, { data: connection }] = await Promise.all([
    db.from("tenant_agent_config").select("language_default").eq("tenant_id", tenantId).maybeSingle(),
    db.from("commerce_connections").select("display_name,shop_domain").eq("tenant_id", tenantId).eq("status", "active").order("created_at").limit(1).maybeSingle(),
  ]);
  const language = config?.language_default === "en" ? "en" : "nl";
  const actions = buildActions(report.metrics, report.settings, language, 8);
  const intro = await writeIntro(tenantId, introFacts(report.summary, actions), language, weekKey);
  const message = weeklyInventoryEmail({ summary: report.summary, actions, language, appUrl: appUrl(), shopName: connection?.display_name ?? null, intro });
  const recipients = await adminEmails(tenantId);
  for (const to of recipients) await sendEmail({ to, subject: message.subject, text: message.text });
  const { error } = await db.from("inventory_settings").update({ last_email_sent_at: new Date().toISOString() }).eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
  return { recipients: recipients.length, aiIntro: Boolean(intro) };
}
