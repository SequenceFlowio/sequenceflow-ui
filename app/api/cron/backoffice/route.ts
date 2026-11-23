import { NextResponse } from "next/server";

import { hasValidCronSecret, unauthorizedCron } from "@/lib/auth/cron";
import { notifyAdmins, nlDate, workspaceFacts } from "@/lib/backoffice/notify";
import { latestSnapshotId, loadCredit } from "@/lib/backoffice/openaiCredit";
import { usd } from "@/lib/backoffice/openaiCreditCore";
import { loadResendUsage } from "@/lib/backoffice/resendUsage";
import { judgeUsage } from "@/lib/backoffice/resendUsageCore";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

const DAY = 24 * 60 * 60 * 1000;
/** Alleen proeven die de laatste dagen afliepen: de eerste keer niet de hele geschiedenis mailen. */
const TRIAL_WINDOW_DAYS = 3;

/**
 * Dagelijks (vercel.json): seintje aan de beheerders over proeven die zonder betaling
 * afliepen, en als het OpenAI-tegoed opraakt. Elke melding gaat één keer
 * (backoffice_notifications, migratie 076); zonder die tabel slaat dit alles over.
 */
export async function GET(req: Request) {
  if (!hasValidCronSecret(req)) return unauthorizedCron();
  const db = getSupabaseAdmin();
  const now = Date.now();
  const result = { trialsEnded: 0, openai: "skipped" as string };

  const { data: trials, error } = await db.from("tenants").select("id, plan, trial_ends_at, stripe_subscription_id")
    .in("plan", ["trial", "expired"]).is("stripe_subscription_id", null)
    .gte("trial_ends_at", new Date(now - TRIAL_WINDOW_DAYS * DAY).toISOString()).lte("trial_ends_at", new Date(now).toISOString());
  if (error) console.error("[cron/backoffice] proeven ophalen mislukt", error.message);
  for (const tenant of trials ?? []) {
    // Een werkruimte die via Shopify betaalt, is niet afgehaakt.
    const { data: shop } = await db.from("shopify_installations").select("status, billing_plan").eq("tenant_id", tenant.id).maybeSingle();
    if (shop?.status === "active" && ["starter", "pro", "agency"].includes(String(shop.billing_plan))) continue;
    const [facts, { count: drafts }, { count: mailboxes }] = await Promise.all([
      workspaceFacts(tenant.id as string).catch(() => null),
      db.from("support_decisions").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
      db.from("tenant_email_channels").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
    ]);
    const sent = await notifyAdmins({
      kind: "trial_ended", ref: tenant.id as string, tenantId: tenant.id as string,
      workspace: facts?.workspace ?? null, email: facts?.email ?? null, when: nlDate(tenant.trial_ends_at as string), source: facts?.source ?? null,
      details: [
        { label: "Antwoordconcepten in de proef", value: String(drafts ?? 0) },
        { label: "Mailbox gekoppeld", value: (mailboxes ?? 0) > 0 ? "ja" : "nee" },
      ],
    }, { requireLog: true });
    if (sent.sent) result.trialsEnded += 1;
  }

  try {
    const credit = await loadCredit();
    if (credit.ready && credit.estimate && credit.estimate.level !== "ok") {
      const snapshot = await latestSnapshotId();
      const estimate = credit.estimate;
      const sent = await notifyAdmins({
        kind: "openai_low", ref: `${snapshot ?? "none"}:${estimate.level}`,
        amount: usd(Math.max(0, estimate.remainingUsd)),
        details: [
          { label: "Laatste stand", value: `${usd(estimate.balanceUsd)} op ${nlDate(estimate.notedAt)}` },
          ...(estimate.perDayUsd ? [{ label: "Verbruik per dag", value: `ongeveer ${usd(estimate.perDayUsd)}` }] : []),
          ...(estimate.daysLeft !== null ? [{ label: "Nog genoeg voor", value: `zo'n ${estimate.daysLeft} ${estimate.daysLeft === 1 ? "dag" : "dagen"}` }] : []),
        ],
      }, { requireLog: true });
      result.openai = sent.sent ? "warned" : sent.reason;
    } else {
      result.openai = credit.ready ? (credit.estimate ? "ok" : "no_snapshot") : "not_ready";
    }
  } catch (cause) {
    console.error("[cron/backoffice] tegoed controleren mislukt", cause instanceof Error ? cause.message : cause);
    result.openai = "error";
  }
  // Resend: waarschuwen zodra upgraden nodig is, één keer per maand per niveau. Vroeg genoeg,
  // want boven de limiet kan ook deze mail niet meer via Resend de deur uit.
  let resend = "skipped";
  try {
    const usage = await loadResendUsage({ fresh: true });
    if (usage.ok) {
      const verdict = judgeUsage(usage.usage);
      const month = new Date().toISOString().slice(0, 7);
      if (verdict.level === "upgrade" || verdict.level === "blocked") {
        const monthly = usage.usage.monthly;
        const daily = usage.usage.daily;
        const sent = await notifyAdmins({
          kind: "resend_quota", ref: `${month}:${verdict.level}`,
          amount: monthly.limit ? `${monthly.used.toLocaleString("nl-NL")} van ${monthly.limit.toLocaleString("nl-NL")} deze maand` : `${monthly.used.toLocaleString("nl-NL")} deze maand`,
          reason: verdict.reasons.join(" "),
          details: [
            ...(daily.limit ? [{ label: "Laatste 24 uur", value: `${daily.used.toLocaleString("nl-NL")} van ${daily.limit.toLocaleString("nl-NL")}` }] : []),
            { label: "Verwacht deze maand", value: `zo'n ${verdict.projectedMonth.toLocaleString("nl-NL")}` },
            { label: "Verstuurd / ontvangen", value: `${monthly.sent.toLocaleString("nl-NL")} / ${monthly.received.toLocaleString("nl-NL")}` },
          ],
        }, { requireLog: true });
        resend = sent.sent ? "warned" : sent.reason;
      } else resend = verdict.level;
    } else resend = usage.reason;
  } catch (cause) {
    console.error("[cron/backoffice] Resend-verbruik controleren mislukt", cause instanceof Error ? cause.message : cause);
    resend = "error";
  }
  return NextResponse.json({ ok: true, ...result, resend });
}
