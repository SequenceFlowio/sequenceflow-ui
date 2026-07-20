import { NextResponse } from "next/server";

import { syncActiveImapMailboxes } from "@/lib/email/inbound/syncImapMailbox";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  let tenantId: string;
  try {
    const context = await getTenantId(req);
    if (context.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
    tenantId = context.tenantId;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Not authenticated";
    return NextResponse.json({ error: message }, { status: message === "Not authenticated" ? 401 : 403 });
  }

  const results = await syncActiveImapMailboxes({ tenantId, limitPerMailbox: 10 });
  return NextResponse.json({
    ok: true,
    results,
    processed: results.reduce((sum, item) => sum + item.processed, 0),
    skipped: results.reduce((sum, item) => sum + item.skipped, 0),
  });
}
