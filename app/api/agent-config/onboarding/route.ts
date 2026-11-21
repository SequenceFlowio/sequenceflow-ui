import { NextResponse } from "next/server";

import { getErrorMessage } from "@/lib/errors";
import { loadSeffyOnboarding, setSeffyOnboarded } from "@/lib/seffy/onboarding";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";

async function context(req: Request) {
  try {
    const { tenantId, role } = await getTenantId(req);
    return { tenantId, canManage: role === "admin" };
  } catch (err: unknown) {
    const message = getErrorMessage(err, "Forbidden");
    return { response: NextResponse.json({ error: message }, { status: message === "Not authenticated" ? 401 : 403 }) };
  }
}

/** GET: moet de kennismaking met Seffy nog? Alleen een beheerder krijgt hem te zien. */
export async function GET(req: Request) {
  const access = await context(req);
  if ("response" in access) return access.response;
  try {
    return NextResponse.json({ ...(await loadSeffyOnboarding(access.tenantId)), canManage: access.canManage }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: unknown) {
    console.error("[seffy-onboarding] GET:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

/** PATCH: { done: true } na afronden of "Later", { reset: true } om hem opnieuw te doen. De antwoorden zelf gaan via /api/agent-config. */
export async function PATCH(req: Request) {
  const access = await context(req);
  if ("response" in access) return access.response;
  if (!access.canManage) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  const body = await req.json().catch(() => ({})) as { done?: unknown; reset?: unknown };
  if (body.done !== true && body.reset !== true) return NextResponse.json({ error: "Onbekende actie." }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...(await setSeffyOnboarded(access.tenantId, body.done === true)) });
  } catch (err: unknown) {
    console.error("[seffy-onboarding] PATCH:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
