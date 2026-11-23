import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requestAppOrigin } from "@/lib/brand";
import { postLoginPath } from "@/lib/auth/postLoginPath";
import { shouldRetryOAuth } from "@/lib/auth/oauthRetry";
import { finishSignIn } from "@/lib/auth/finishSignIn";

export const dynamic = "force-dynamic";

function loginErrorRedirect(base: string, next: string, viaEmail = false) {
  const loginUrl = new URL("/login", base);
  loginUrl.searchParams.set("error", viaEmail ? "email_link" : "oauth_callback");
  if (next !== "/dashboard") loginUrl.searchParams.set("next", next);
  return NextResponse.redirect(loginUrl);
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const base = requestAppOrigin(request.url);
  const next = postLoginPath(searchParams.get("next"));
  const code = searchParams.get("code");
  // Inloglink uit de mail (app/auth/email/start): bij een fout nooit Google herstarten.
  const viaEmail = searchParams.get("via") === "email";

  if (!code) {
    return loginErrorRedirect(base || origin, next, viaEmail);
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
    if (!viaEmail && shouldRetryOAuth(error.message, retried)) {
      // Eén keer opnieuw beginnen op dezelfde host; de gebruiker ziet hooguit kort Google.
      const restart = new URL("/auth/start", base || origin);
      restart.searchParams.set("next", next);
      restart.searchParams.set("retry", "1");
      return NextResponse.redirect(restart);
    }
    return loginErrorRedirect(base || origin, next, viaEmail);
  }

  // Werkruimte bij de eerste login, doorverwijzing, seintje en marketingbron (lib/auth/finishSignIn.ts).
  const { data: { user } } = await supabase.auth.getUser();
  await finishSignIn(supabase, cookieStore, viaEmail || user?.app_metadata?.provider === "email" ? "E-mail" : "Google");

  return NextResponse.redirect(`${base}${next}`);
}
