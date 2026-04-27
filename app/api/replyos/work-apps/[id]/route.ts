import { NextResponse } from "next/server";

import { getTenantId } from "@/lib/tenant";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let tenantId: string;
  try {
    ({ tenantId } = await getTenantId(req));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Not authenticated";
    return NextResponse.json({ error: message }, { status: message === "Not authenticated" ? 401 : 403 });
  }

  const { error } = await getSupabaseAdmin()
    .from("replyos_work_apps")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("[replyos/work-apps] DELETE failed:", error.message);
    return NextResponse.json({ error: "Failed to delete work app" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
