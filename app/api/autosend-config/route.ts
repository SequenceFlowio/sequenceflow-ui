import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenant";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { tenantId } = await getTenantId(req);
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("tenant_agent_config")
      .select("autosend_enabled, autosend_time_1, autosend_time_2")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    return NextResponse.json({
      autosendEnabled: data?.autosend_enabled ?? false,
      autosendTime1: data?.autosend_time_1 ?? null,
      autosendTime2: data?.autosend_time_2 ?? null,
    });
  } catch {
    return NextResponse.json({ autosendEnabled: false, autosendTime1: null, autosendTime2: null });
  }
}
