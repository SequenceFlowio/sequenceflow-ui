import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore — headers already sent in some edge cases.
          }
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://emailreply.sequenceflow.io").replace(/\/$/, "");

  if (error) {
    console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
    return NextResponse.redirect(`${base}/login`);
  }

  // ── Auto-provision tenant for first-time users ────────────────────────────
  // When a user logs in for the first time there is no tenant_members row yet,
  // so every API call would throw "Tenant not found for user".
  // We create tenant + config + membership here so the app is usable immediately.
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const admin = getSupabaseAdmin();

      const { data: existingMember } = await admin
        .from("tenant_members")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!existingMember) {
        // Derive a sensible default tenant name from email or OAuth profile
        const fullName  = user.user_metadata?.full_name as string | undefined;
        const email     = user.email ?? "";
        const domain    = email.includes("@") ? email.split("@")[1] : "";
        const tenantName = fullName ?? domain ?? "My Store";

        console.log(`[auth/callback] First login for ${email} — provisioning tenant "${tenantName}"`);

        const { data: tenant, error: tenantErr } = await admin
          .from("tenants")
          .insert({ name: tenantName })
          .select()
          .single();

        if (tenantErr || !tenant) {
          console.error("[auth/callback] Failed to create tenant:", tenantErr?.message);
        } else {
          // Create default agent config
          await admin
            .from("tenant_agent_config")
            .insert({ tenant_id: tenant.id })
            .select()
            .single();

          // Add user as admin of the new tenant
          await admin
            .from("tenant_members")
            .insert({ tenant_id: tenant.id, user_id: user.id, role: "admin" });

          console.log(`[auth/callback] Tenant ${tenant.id} provisioned for user ${user.id}`);
        }
      }
    }
  } catch (provisionErr: any) {
    // Non-fatal — user will see "Tenant not found" but we log it
    console.error("[auth/callback] Tenant provisioning error:", provisionErr?.message);
  }

  const next = searchParams.get("next");
  const redirectTo = next && next.startsWith("/") ? next : "/inbox";
  return NextResponse.redirect(`${base}${redirectTo}`);
}
