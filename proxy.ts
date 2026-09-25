import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

import { isAgencyWhitelistedEmail } from "@/lib/billingWhitelist";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/shopify",
  "/auth",
  "/privacy",
  "/terms",
  "/upgrade",
  "/pricing",
  "/for",
  "/opengraph-image",
  "/robots.txt",
  "/sitemap.xml",
];

const PROTECTED_APP_PATHS = [
  "/inbox",
  "/sefi",
  "/lumen",
  "/analytics",
  "/knowledge",
  "/integrations",
  "/commerce",
  "/settings",
  "/agent-profile",
  "/dashboard",
];

function matchesPath(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Shopify requires the embedded app to be frameable only by the shop that
  // opens it, so the CSP for /shopify is built here per request.
  if (matchesPath(pathname, "/shopify")) {
    const response = NextResponse.next();
    const shop = request.nextUrl.searchParams.get("shop") ?? "";
    const frameAncestors = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)
      ? `https://${shop} https://admin.shopify.com`
      : "https://admin.shopify.com";
    const devScript = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
    response.headers.set("Content-Security-Policy", [
      "default-src 'self'", "base-uri 'self'", "object-src 'none'",
      `frame-ancestors ${frameAncestors}`,
      `script-src 'self' 'unsafe-inline' https://cdn.shopify.com${devScript}`,
      "style-src 'self' 'unsafe-inline'", "img-src 'self' data: https:", "font-src 'self' data:",
      "connect-src 'self' https://*.shopify.com https://*.myshopify.com", "form-action 'self'",
    ].join("; "));
    return response;
  }

  if (PUBLIC_PATHS.some((path) => matchesPath(pathname, path))) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.redirect(new URL("/login?error=configuration", request.url));
  }

  const response = NextResponse.next();
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (isAgencyWhitelistedEmail(user.email)) return response;

  if (PROTECTED_APP_PATHS.some((path) => matchesPath(pathname, path))) {
    try {
      const { data: member } = await supabase
        .from("tenant_members")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!member?.tenant_id) {
        return NextResponse.redirect(new URL("/login?error=tenant", request.url));
      }

      const { data: tenant } = await supabase
        .from("tenants")
        .select("plan, trial_ends_at")
        .eq("id", member.tenant_id)
        .single();

      if (!tenant) {
        return NextResponse.redirect(new URL("/login?error=tenant", request.url));
      }

      const trialExpired = tenant.plan === "trial"
        && tenant.trial_ends_at
        && new Date(tenant.trial_ends_at) < new Date();

      if (tenant.plan === "expired" || trialExpired) {
        return NextResponse.redirect(new URL("/upgrade", request.url));
      }
    } catch {
      return NextResponse.redirect(new URL("/login?error=access", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|public|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|otf|css|js)).*)"],
};
