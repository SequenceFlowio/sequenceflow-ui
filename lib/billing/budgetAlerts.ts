import { configuredAppOrigin } from "@/lib/brand";
import { sendEmail } from "@/lib/resend";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

import { formatCents } from "@/lib/planCatalog";

const BUDGET_ALERT_OUTCOME = "budget_alert";

/**
 * Een seintje als het maandbudget voor afgehandelde gesprekken op 80% of
 * 100% zit. Per niveau en periode één keer. Gooit nooit: een mislukte mail mag
 * het registreren van gebruik niet tegenhouden.
 */
export async function alertBudget(input: { tenantId: string; level: "near" | "reached"; periodStart: string; usedCents: number; budgetCents: number }) {
  try {
    const db = getSupabaseAdmin();
    const kind = `${input.level}:${input.periodStart.slice(0, 10)}`;
    const { data: recent, error: recentError } = await db.from("support_events").select("id")
      .eq("tenant_id", input.tenantId).eq("outcome", BUDGET_ALERT_OUTCOME).eq("subject", kind).limit(1);
    if (recentError) throw new Error(recentError.message);
    if (recent?.length) return;
    // Eerst vastleggen, dan mailen: twee overlappende runs sturen niet allebei.
    const { error: logError } = await db.from("support_events").insert({
      tenant_id: input.tenantId, source: "billing", subject: kind, intent: "system", confidence: 1, latency_ms: 0, outcome: BUDGET_ALERT_OUTCOME,
    });
    if (logError) throw new Error(logError.message);

    const [{ data: members }, { data: config }] = await Promise.all([
      db.from("tenant_members").select("user_id, role").eq("tenant_id", input.tenantId),
      db.from("tenant_agent_config").select("language_default").eq("tenant_id", input.tenantId).maybeSingle(),
    ]);
    const nl = config?.language_default !== "en";
    const used = formatCents(input.usedCents);
    const budget = formatCents(input.budgetCents);
    const link = `${configuredAppOrigin()}/settings?tab=billing`;
    const subject = input.level === "near"
      ? (nl ? `Je zit op 80% van je maandbudget (${used} van ${budget})` : `You're at 80% of your monthly budget (${used} of ${budget})`)
      : (nl ? `Je maandbudget is bereikt (${budget})` : `Your monthly budget is reached (${budget})`);
    const text = input.level === "near"
      ? (nl
        ? `Hoi,\n\nDeze maand is er voor ${used} aan afgehandelde gesprekken geteld. Je budget is ${budget}.\n\nBoven je budget betaal je niets en Support One blijft gewoon werken. Wil je het budget aanpassen? Dat kan hier: ${link}\n\nGroet,\nMilo van SequenceFlow`
        : `Hi,\n\nThis month ${used} in handled conversations has been counted. Your budget is ${budget}.\n\nAbove your budget you pay nothing and Support One keeps working. Want to change it? ${link}\n\nCheers,\nMilo from SequenceFlow`)
      : (nl
        ? `Hoi,\n\nJe maandbudget van ${budget} is bereikt. Support One werkt gewoon door; afgehandelde gesprekken boven je budget betaal je deze maand niet.\n\nBudget aanpassen kan hier: ${link}\n\nGroet,\nMilo van SequenceFlow`
        : `Hi,\n\nYour monthly budget of ${budget} is reached. Support One keeps working; handled conversations above your budget are free this month.\n\nChange your budget here: ${link}\n\nCheers,\nMilo from SequenceFlow`);

    for (const member of (members ?? []).filter((row) => row.role === "admin")) {
      const { data } = await db.auth.admin.getUserById(member.user_id as string);
      const email = data?.user?.email?.trim().toLowerCase();
      if (!email || email.endsWith(".local")) continue;
      await sendEmail({ to: email, subject, text }).catch((error) => console.error("[budget-alert] could not email", error instanceof Error ? error.message : error));
    }
  } catch (error) {
    console.error("[budget-alert]", error instanceof Error ? error.message : error);
  }
}
