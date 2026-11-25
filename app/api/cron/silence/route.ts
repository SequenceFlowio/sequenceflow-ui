import { NextResponse } from "next/server";

import { hasValidCronSecret } from "@/lib/auth/cron";
import { notifyAdmins } from "@/lib/backoffice/notify";
import { checkSilence } from "@/lib/ops/silence";
import { amsterdamDate } from "@/lib/ops/silenceCore";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Elk uur: wat had moeten gebeuren maar bleef uit (docs/plan-werkstroomkern.md, fase 0d).
 * Elke melding gaat één keer per dag per probleem naar de beheerders, tot het is opgelost.
 */
export async function GET(req: Request) {
  if (!hasValidCronSecret(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const now = new Date();
  try {
    const alerts = await checkSilence(now);
    const day = amsterdamDate(now);
    const results = await Promise.all(alerts.map((alert) => notifyAdmins({
      kind: "silence",
      ref: `${alert.id}:${day}`,
      tenantId: alert.tenantId ?? null,
      workspace: alert.workspace ?? null,
      reason: alert.title,
      details: [{ label: "Wat", value: alert.detail }, { label: "Waarschijnlijke oorzaak", value: alert.likelyCause }],
    }, { requireLog: true })));
    return NextResponse.json({ ok: true, alerts: alerts.map((a) => a.id), mailed: results.filter((r) => r.sent).length });
  } catch (error) {
    console.error("[cron/silence]", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
