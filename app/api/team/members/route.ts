import { NextRequest, NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenant";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await getTenantId(req);
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("tenant_members")
      .select("user_id, role")
      .eq("tenant_id", tenantId);

    if (error) throw error;

    // Fetch user details for each member
    const members = await Promise.all(
      (data ?? []).map(async (member) => {
        const { data: user } = await supabase.auth.admin.getUserById(member.user_id);
        return {
          user_id: member.user_id,
          role:    member.role,
          email:   user?.user?.email ?? null,
          name:    (user?.user?.user_metadata?.full_name as string | undefined) ?? null,
        };
      })
    );

    return NextResponse.json({ members });
  } catch (err) {
    console.error("[team/members GET]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { tenantId, role } = await getTenantId(req);

    if (role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const { userId: targetUserId } = await req.json();
    if (!targetUserId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("tenant_members")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("user_id", targetUserId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[team/members DELETE]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
