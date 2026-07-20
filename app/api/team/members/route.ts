import { NextRequest, NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenant";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizationErrorResponse } from "@/lib/auth/authorization";

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
  } catch (err: unknown) {
    console.error("[team/members GET]", err);
    const { message, status } = authorizationErrorResponse(err);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { tenantId, role, userId } = await getTenantId(req);

    if (role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const { userId: targetUserId } = await req.json();
    if (!targetUserId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    if (targetUserId === userId) {
      return NextResponse.json({ error: "You cannot remove your own account" }, { status: 400 });
    }

    const { data: targetMember } = await supabase
      .from("tenant_members")
      .select("role")
      .eq("tenant_id", tenantId)
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (!targetMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (targetMember.role === "admin") {
      const { count } = await supabase
        .from("tenant_members")
        .select("user_id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("role", "admin");
      if ((count ?? 0) <= 1) {
        return NextResponse.json({ error: "A tenant must keep at least one admin" }, { status: 400 });
      }
    }

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
