import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

const MAX_BULK_TICKETS = 100;

export async function POST(req: Request) {
  try {
    const context = await getTenantId(req);
    const body = await req.json().catch(() => ({})) as { ids?: unknown; archived?: unknown };
    if (!Array.isArray(body.ids) || body.ids.length === 0 || body.ids.length > MAX_BULK_TICKETS) {
      return NextResponse.json({ error: `ids must contain 1-${MAX_BULK_TICKETS} tickets` }, { status: 400 });
    }
    if (typeof body.archived !== "boolean") {
      return NextResponse.json({ error: "archived must be a boolean" }, { status: 400 });
    }

    const ids = [...new Set(body.ids.filter((id): id is string => typeof id === "string" && id.length > 0))];
    if (ids.length === 0) {
      return NextResponse.json({ error: "ids must contain valid ticket ids" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const results = await Promise.all(ids.map(async (id) => {
      const { error } = await supabase.rpc("set_ticket_archived", {
        p_tenant_id: context.tenantId,
        p_ticket_id: id,
        p_actor_user_id: context.userId,
        p_archived: body.archived,
      });
      return error ? { id, error: error.message } : { id, error: null };
    }));
    const failures = results.filter((result) => result.error);
    if (failures.length > 0) {
      return NextResponse.json({ error: failures[0].error, updated: ids.length - failures.length, failures }, { status: 409 });
    }

    return NextResponse.json({ ok: true, updated: ids.length, archived: body.archived });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Not authenticated";
    return NextResponse.json({ error: message }, { status: message === "Not authenticated" ? 401 : 403 });
  }
}
