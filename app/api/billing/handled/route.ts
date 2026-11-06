import { NextRequest, NextResponse } from "next/server";

import { HANDLED_PRICING } from "@/lib/billing/handledConversations";
import { loadHandledSummary } from "@/lib/billing/handledLoader";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";

/** Proefmeting: afgehandelde gesprekken in de lopende periode. Rekent niets af. */
export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await getTenantId(req);
    const summary = await loadHandledSummary(tenantId);
    return NextResponse.json({ mode: HANDLED_PRICING.mode, version: HANDLED_PRICING.version, rates: HANDLED_PRICING.rateCents, ...summary });
  } catch (err) {
    if (err instanceof Error && err.message === "Not authenticated") return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    console.error("[billing/handled]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
