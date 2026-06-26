import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Toggle a ticket's retention pin. When exempt=true the cleanup cron will
// never auto-delete it. Works for both AI-first conversations and legacy
// tickets — we try the conversation table first, then fall back to tickets.
export async function POST(
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

  let exempt: boolean;
  try {
    const body = await req.json();
    exempt = Boolean(body?.exempt);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: conversation } = await supabase
    .from("support_conversations")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (conversation) {
    const { error } = await supabase
      .from("support_conversations")
      .update({ retention_exempt: exempt })
      .eq("id", id)
      .eq("tenant_id", tenantId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, retentionExempt: exempt });
  }

  const { error } = await supabase
    .from("tickets")
    .update({ retention_exempt: exempt })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return NextResponse.json({ error: "Update failed" }, { status: 500 });
  return NextResponse.json({ ok: true, retentionExempt: exempt });
}
