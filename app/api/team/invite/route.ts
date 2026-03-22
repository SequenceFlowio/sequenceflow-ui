import { NextRequest, NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenant";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { tenantId, role: callerRole } = await getTenantId(req);

    if (callerRole !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const { email, role } = await req.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    const memberRole = role === "admin" ? "admin" : "agent";

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: {
        tenant_id: tenantId,
        role:      memberRole,
      },
    });

    if (error) {
      console.error("[team/invite] invite error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Pre-insert tenant_members row so the user has access on first login
    // (the auth trigger in 004_profiles_rls should handle this, but we do it explicitly)
    if (data?.user?.id) {
      await supabase
        .from("tenant_members")
        .upsert(
          { tenant_id: tenantId, user_id: data.user.id, role: memberRole },
          { onConflict: "tenant_id,user_id" }
        );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[team/invite]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
