import { NextResponse } from "next/server";

import { readLeadToken } from "@/lib/marketing/leadsCore";

export const runtime = "nodejs";

/** Downloadlink uit de mail (?t=…): klopt de handtekening, dan opent FreebieGate de download zonder formulier. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { t?: unknown } | null;
  const secret = process.env.LEADS_SECRET || process.env.CRON_SECRET || "";
  const ok = Boolean(secret && typeof body?.t === "string" && readLeadToken(secret, "unlock", body.t));
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
