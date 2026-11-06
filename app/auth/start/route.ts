import { NextRequest, NextResponse } from "next/server";
import { configuredAppOrigin, LEGACY_APP_ORIGIN, requestAppOrigin } from "@/lib/brand";
import { postLoginPath } from "@/lib/auth/postLoginPath";
import { startGoogleSignIn } from "@/lib/auth/startGoogleSignIn";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Het oude adres (emailreply.) staat niet altijd als terugkeeradres bij Supabase:
  // begin daar nooit, anders staat de PKCE-cookie op een andere host dan de terugkeer.
  const legacy = request.nextUrl.hostname === new URL(LEGACY_APP_ORIGIN).hostname;
  const base = legacy ? configuredAppOrigin() : requestAppOrigin(request.url);
  const next = postLoginPath(request.nextUrl.searchParams.get("next"));
  const retry = request.nextUrl.searchParams.get("retry") === "1";
  // Keep the verifier and callback on one host, including preview redirects.
  if (request.nextUrl.origin !== base) {
    const canonicalStart = new URL("/auth/start", base);
    canonicalStart.searchParams.set("next", next);
    if (retry) canonicalStart.searchParams.set("retry", "1");
    return NextResponse.redirect(canonicalStart);
  }
  try {
    const callback = new URL("/auth/callback", base);
    callback.searchParams.set("next", next);
    if (retry) callback.searchParams.set("retry", "1");
    const result = await startGoogleSignIn({
      supabaseUrl: (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!,
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      callbackUrl: callback.toString(),
      cookies: request.cookies.getAll(),
    });
    const response = NextResponse.redirect(result.url);
    response.headers.set("Cache-Control", "private, no-store");
    result.cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    return response;
  } catch {
    console.error("[auth/start] Google sign-in could not be started");
    const login = new URL("/login", base);
    login.searchParams.set("error", "oauth_start");
    login.searchParams.set("next", next);
    const response = NextResponse.redirect(login);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
