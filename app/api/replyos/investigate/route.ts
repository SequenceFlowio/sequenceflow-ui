import { NextResponse } from "next/server";

import { runInvestigation } from "@/lib/replyos/runInvestigation";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let tenantId: string;
  try {
    ({ tenantId } = await getTenantId(req));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Not authenticated";
    return NextResponse.json({ error: message }, { status: message === "Not authenticated" ? 401 : 403 });
  }

  let conversationId: string | null = null;
  try {
    const body = await req.json();
    conversationId = typeof body?.conversationId === "string" ? body.conversationId : null;
  } catch {
    // handled below
  }

  if (!conversationId) {
    return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
  }

  try {
    const result = await runInvestigation({ tenantId, conversationId });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Investigation failed";
    console.error("[replyos/investigate] POST failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
