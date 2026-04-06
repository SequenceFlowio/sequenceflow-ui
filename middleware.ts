import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { isAgencyWhitelistedEmail } from "@/lib/billingWhitelist";

const PUBLIC_PATHS = ["/login", "/auth", "/privacy", "/upgrade"];

// App routes that require an active plan (expired → /upgrade)
const PROTECTED_APP_PATHS = ["/inbox", "/analytics", "/knowledge", "/settings", "/agent-console", "/dashboard"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths through immediately
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Whitelisted emails always bypass plan gating.
  if (isAgencyWhitelistedEmail(user.email)) {
    return response;
  }

  // Check plan for protected app routes
  if (PROTECTED_APP_PATHS.some((p) => pathname.startsWith(p))) {
    try {
      const { data: member } = await supabase
        .from("tenant_members")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (member?.tenant_id) {
        const { data: tenant } = await supabase
          .from("tenants")
          .select("plan, trial_ends_at")
          .eq("id", member.tenant_id)
          .single();

        if (tenant) {
          let plan = tenant.plan ?? "trial";

          // Check if trial has expired
          if (plan === "trial" && tenant.trial_ends_at) {
            const trialEnd = new Date(tenant.trial_ends_at);
            if (trialEnd < new Date()) plan = "expired";
          }

          if (plan === "expired") {
            return NextResponse.redirect(new URL("/upgrade", request.url));
          }
        }
      }
    } catch {
      // If plan check fails, let them through — don't block on infra errors
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|public).*)"],
};
