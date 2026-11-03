import { NextRequest, NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenant";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantPlanAccess, PLAN_LIMITS } from "@/lib/billing";

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
    const { plan } = await getTenantPlanAccess(tenantId);
    const memberLimit = PLAN_LIMITS[plan].members;
    const { count: memberCount, error: countError } = await supabase
      .from("tenant_members")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);

    if (countError) throw countError;
    if (memberCount !== null && memberCount >= memberLimit) {
      return NextResponse.json(
        { error: `Team member limit reached (${memberCount}/${memberLimit}).`, upgrade: true },
        { status: 402 }
      );
    }

    // One workspace per user (migration 063). Inviting an address that already
    // has a workspace would lock that person out of both; refuse it clearly.
    const normalizedEmail = String(email).trim().toLowerCase();
    const { data: existingUserId, error: lookupError } = await supabase.rpc("find_user_id_by_email", { p_email: normalizedEmail });
    if (lookupError) throw lookupError;
    if (existingUserId) {
      const { data: existingMembership } = await supabase
        .from("tenant_members")
        .select("tenant_id")
        .eq("user_id", existingUserId as string)
        .maybeSingle();
      if (existingMembership?.tenant_id === tenantId) {
        return NextResponse.json({ error: "Dit e-mailadres zit al in je team." }, { status: 409 });
      }
      if (existingMembership) {
        return NextResponse.json(
          { error: "Dit e-mailadres heeft al een eigen Support One-workspace. Vraag de persoon die eerst op te zeggen, of nodig een ander adres uit." },
          { status: 409 },
        );
      }
    }

    const { data, error } = await supabase.auth.admin.inviteUserByEmail(normalizedEmail, {
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
