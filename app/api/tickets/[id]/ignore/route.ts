import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getTenantId(req);
    const { id } = await params;
    const body = await req.json().catch(() => ({})) as { blockFuture?: unknown };
    const blockFuture = body.blockFuture === true;
    if (blockFuture && context.role !== "admin") {
      return NextResponse.json({ error: "Only an admin can block future mail from a sender." }, { status: 403 });
    }
    const { data, error } = await getSupabaseAdmin().rpc("ignore_support_ticket", {
      p_tenant_id: context.tenantId,
      p_ticket_id: id,
      p_actor_user_id: context.userId,
      p_block_future: blockFuture,
    });
    if (error) {
      const status = /not found/i.test(error.message) ? 404 : /commerce action/i.test(error.message) ? 409 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json({ ok: true, source: data, blockedFuture: blockFuture });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Not authenticated";
    return NextResponse.json({ error: message }, { status: message === "Not authenticated" ? 401 : 403 });
  }
}
