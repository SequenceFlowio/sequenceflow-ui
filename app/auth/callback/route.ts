import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getErrorMessage } from "@/lib/errors";
import {
  decodeAttribution,
  MARKETING_COOKIE,
  recordMarketingEvent,
} from "@/lib/marketing/attribution";
import { requestAppOrigin } from "@/lib/brand";
import { postLoginPath } from "@/lib/auth/postLoginPath";
import { shouldRetryOAuth } from "@/lib/auth/oauthRetry";
import { defaultTenantName, provisionTenant } from "@/lib/tenant/provision";
import { REF_COOKIE } from "@/lib/referrals/program";
import { attributeNewTenant } from "@/lib/referrals/server";

export const dynamic = "force-dynamic";

function loginErrorRedirect(base: string, next: string) {
  const loginUrl = new URL("/login", base);
  loginUrl.searchParams.set("error", "oauth_callback");
  if (next !== "/dashboard") loginUrl.searchParams.set("next", next);
  return NextResponse.redirect(loginUrl);
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const base = requestAppOrigin(request.url);
  const next = postLoginPath(searchParams.get("next"));
  const code = searchParams.get("code");

  if (!code) {
    return loginErrorRedirect(base || origin, next);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!,
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

  if (error) {
    const retried = searchParams.get("retry") === "1";
    console.error(`[auth/callback] exchangeCodeForSession failed${retried ? " (after retry)" : ""}:`, error.message);
    if (shouldRetryOAuth(error.message, retried)) {
      // Eén keer opnieuw beginnen op dezelfde host; de gebruiker ziet hooguit kort Google.
      const restart = new URL("/auth/start", base || origin);
      restart.searchParams.set("next", next);
      restart.searchParams.set("retry", "1");
      return NextResponse.redirect(restart);
    }
    return loginErrorRedirect(base || origin, next);
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
        .maybeSingle();

      if (!existingMember) {
        console.log("[auth/callback] Provisioning tenant for first login.");
        const { tenantId } = await provisionTenant({ userId: user.id, name: defaultTenantName(user) });

        // Via een doorverwijs- of affiliatelink binnengekomen? Dan onthouden bij de nieuwe workspace.
        try {
          await attributeNewTenant(tenantId, user, cookieStore.get(REF_COOKIE)?.value);
        } catch (refError) {
          console.error("[auth/callback] referral attribution failed:", getErrorMessage(refError));
        }
      }
    }
  } catch (provisionErr: unknown) {
    // Non-fatal — user will see "Tenant not found" but we log it
    console.error("[auth/callback] Tenant provisioning error:", getErrorMessage(provisionErr));
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const attribution = decodeAttribution(cookieStore.get(MARKETING_COOKIE)?.value);
    if (user && attribution) {
      const { data: membership } = await getSupabaseAdmin()
        .from("tenant_members")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();
      await recordMarketingEvent({
        ...attribution,
        event: "signup_completed",
        path: "/auth/callback",
        userId: user.id,
        tenantId: membership?.tenant_id ?? null,
      });
    }
  } catch (trackingError) {
    console.error("[auth/callback] signup attribution failed:", getErrorMessage(trackingError));
  }

  return NextResponse.redirect(`${base}${next}`);
}
