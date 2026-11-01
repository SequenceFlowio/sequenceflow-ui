import { NextRequest, NextResponse } from "next/server";

import { referralOverview } from "@/lib/referrals/server";
import { SITE_ORIGIN } from "@/lib/site";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";

/** Doorverwijslink en stand van de eigen workspace. */
export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await getTenantId(req);
    const overview = await referralOverview(tenantId);
    return NextResponse.json({ ...overview, link: `${SITE_ORIGIN}/r/${overview.code}` });
  } catch (error) {
    console.error("[referrals] laden mislukt", error);
    return NextResponse.json({ error: "Doorverwijzen kon niet laden" }, { status: 500 });
  }
}
