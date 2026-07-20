import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getTenantId(req);
    const { id } = await params;
    const body = await req.json().catch(() => ({})) as { archived?: unknown };
    if (typeof body.archived !== "boolean") {
      return NextResponse.json({ error: "archived must be a boolean" }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin().rpc("set_ticket_archived", {
      p_tenant_id: context.tenantId,
      p_ticket_id: id,
      p_actor_user_id: context.userId,
      p_archived: body.archived,
    });
    if (error) {
      const status = /not found/i.test(error.message) ? 404 : /commerce action/i.test(error.message) ? 409 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json({ ok: true, source: data, archived: body.archived });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Not authenticated";
    return NextResponse.json({ error: message }, { status: message === "Not authenticated" ? 401 : 403 });
  }
}
