import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

import { readSessionClaims } from "@/lib/auth/sessionClaims";
import { DEFAULT_APP_ORIGIN } from "@/lib/brand";
import { APP_ONLY_PATHS, isSiteHost, LEGAL_PAGES } from "@/lib/site";

const PUBLIC_PATHS = [
  "/",
  "/home",
  "/content",
  "/login",
  "/shopify",
  "/auth",
  "/privacy",
  "/terms",
  "/upgrade",
  "/pricing",
  "/for",
  "/blog",
  "/contact",
  ...LEGAL_PAGES.map((page) => page.path),
  "/opengraph-image",
  "/robots.txt",
  "/sitemap.xml",
];

function matchesPath(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // sequenceflow.io shows the website; the app itself lives on its own domain.
  const host = (request.headers.get("host") ?? request.nextUrl.hostname).split(":")[0];
  if (isSiteHost(host) && APP_ONLY_PATHS.some((path) => matchesPath(pathname, path))) {
    return NextResponse.redirect(new URL(`${pathname}${request.nextUrl.search}`, DEFAULT_APP_ORIGIN), 308);
  }

  // sequenceflow.io opens on the company page with both products; the Support
  // One landing stays at / on the app domain.
  if (isSiteHost(host) && pathname === "/") {
    return NextResponse.rewrite(new URL(`/home${request.nextUrl.search}`, request.url));
  }

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

  // Only "is someone signed in" is decided here, from the token itself. The
  // workspace and plan checks live in app/(app)/layout.tsx, which needs that
  // data anyway; doing them here as well cost two database queries on every
  // page view.
  const session = await readSessionClaims(supabase);
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|public|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|otf|css|js|mp4)).*)"],
};
