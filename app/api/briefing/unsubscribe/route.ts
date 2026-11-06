import { NextRequest } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { validUnsubscribeSignature } from "@/lib/support/weeklyBriefing";

export const runtime = "nodejs";

function page(title: string, body: string, status = 200) {
  const html = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0c0b;color:#f1f4ec;font:15px/1.6 system-ui,sans-serif}main{max-width:440px;padding:32px;border:1px solid #23281f;border-radius:16px;background:#111410}h1{margin:0 0 8px;font-size:20px}p{margin:0;color:#bcc2b5}a{color:#c7f56f}</style></head><body><main><h1>${title}</h1><p>${body}</p></main></body></html>`;
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}

/** Afmelden (of weer aanmelden met ?on=1) voor de wekelijkse mail, via de ondertekende link in die mail. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const tenantId = url.searchParams.get("t") ?? "";
  const signature = url.searchParams.get("s") ?? "";
  const on = url.searchParams.get("on") === "1";
  const secret = process.env.WEEKLY_BRIEFING_SECRET || process.env.CRON_SECRET || "";
  if (!tenantId || !secret || !validUnsubscribeSignature(tenantId, signature, secret)) {
    return page("Deze link werkt niet", "De link is onvolledig of verlopen. Je kunt de wekelijkse mail ook laten uitzetten via hallo@sequenceflow.io.", 400);
  }
  const { error } = await getSupabaseAdmin().from("tenants").update({ weekly_briefing_enabled: on }).eq("id", tenantId);
  if (error) return page("Dat lukte niet", "Probeer het later opnieuw of mail hallo@sequenceflow.io.", 500);
  const toggle = `${url.origin}${url.pathname}?t=${encodeURIComponent(tenantId)}&s=${signature}${on ? "" : "&on=1"}`;
  return on
    ? page("Je krijgt de wekelijkse mail weer", `Elke maandag een kort overzicht van je week. <a href="${toggle}">Toch weer afmelden</a>.`)
    : page("Je bent afgemeld", `Je krijgt de wekelijkse mail van Support One niet meer. <a href="${toggle}">Toch weer aanmelden</a>.`);
}
