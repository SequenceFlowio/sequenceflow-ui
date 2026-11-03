import { NextResponse } from "next/server";

import { REPORT_VERSION } from "@/lib/inventory/reportCore";
import { inventoryContext, inventoryError } from "@/lib/inventory/routeHelpers";
import { loadCachedInventoryReport, rebuildInventoryReport } from "@/lib/inventory/sync";
import { loadWaitlist, sendWaitlist, waitlistCandidates, waitlistDraft, waitlistUnavailable } from "@/lib/inventory/waitlist";

export const runtime = "nodejs";
export const maxDuration = 60;

const NOT_READY = { error: "De wachtlijst kan nog niet: migratie 063 is nog niet gedraaid.", notReady: true };

async function report(tenantId: string) {
  const cached = await loadCachedInventoryReport(tenantId);
  return cached && cached.version === REPORT_VERSION ? cached : rebuildInventoryReport(tenantId);
}

/**
 * GET /api/inventory/waitlist: the variants with people waiting, or with
 * ?variantKey= the list for one variant plus the draft mail.
 */
export async function GET(req: Request) {
  const access = await inventoryContext(req);
  if ("response" in access) return access.response;
  const variantKey = new URL(req.url).searchParams.get("variantKey");
  try {
    const current = await report(access.context.tenantId);
    if (!variantKey) return NextResponse.json({ candidates: waitlistCandidates(current) });
    const waitlist = await loadWaitlist(access.context.tenantId, current, variantKey);
    if (!waitlist) return NextResponse.json({ error: "Onbekende variant." }, { status: 404 });
    const draft = await waitlistDraft(access.context.tenantId, waitlist.variant);
    return NextResponse.json({ waitlist, draft });
  } catch (error) {
    if (waitlistUnavailable(error as { message?: string; code?: string })) return NextResponse.json(NOT_READY, { status: 409 });
    return inventoryError(error, "waitlist");
  }
}

/** POST { variantKey, subject, text }: mail everyone on the list who was not mailed yet. Admins only; this reaches customers. */
export async function POST(req: Request) {
  const access = await inventoryContext(req, true);
  if ("response" in access) return access.response;
  const body = await req.json().catch(() => ({})) as { variantKey?: unknown; subject?: unknown; text?: unknown };
  const variantKey = typeof body.variantKey === "string" ? body.variantKey : "";
  const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 200) : "";
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 4000) : "";
  if (!variantKey || !subject || !text) return NextResponse.json({ error: "Variant, onderwerp en tekst zijn nodig." }, { status: 400 });
  try {
    const result = await sendWaitlist({ tenantId: access.context.tenantId, report: await report(access.context.tenantId), variantKey, subject, text, userId: access.context.userId });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (waitlistUnavailable(error as { message?: string; code?: string })) return NextResponse.json(NOT_READY, { status: 409 });
    return inventoryError(error, "waitlist");
  }
}
