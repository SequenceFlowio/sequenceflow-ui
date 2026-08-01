import { NextResponse } from "next/server";

import { getTenantPlanAccess } from "@/lib/billing";
import { loadLumenSnapshot } from "@/lib/lumen/context";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const context = await getTenantId(req);
    const { plan } = await getTenantPlanAccess(context.tenantId);
    if (plan === "expired") {
      return NextResponse.json({ error: "Account verlopen.", upgrade: true }, { status: 403 });
    }
    const language = new URL(req.url).searchParams.get("language") === "en" ? "en" : "nl";
    return NextResponse.json(await loadLumenSnapshot(context.tenantId, language));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lumen-context kon niet worden geladen.";
    const status = message === "Not authenticated" ? 401 : 500;
    console.error("[lumen/context]", error);
    return NextResponse.json({ error: "Lumen-context kon niet worden geladen.", retryable: true }, { status });
  }
}
