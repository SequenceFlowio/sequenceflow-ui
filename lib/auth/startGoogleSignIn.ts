import { createServerClient, type CookieOptions } from "@supabase/ssr";

type AuthCookie = { name: string; value: string; options: CookieOptions };

/** Generate the PKCE challenge and the matching response cookies together. */
export async function startGoogleSignIn(input: {
  supabaseUrl: string;
  supabaseKey: string;
  callbackUrl: string;
  cookies: Array<{ name: string; value: string }>;
}) {
  const pendingCookies: AuthCookie[] = [];
  const supabase = createServerClient(input.supabaseUrl, input.supabaseKey, {
    cookies: {
      getAll: () => input.cookies,
      setAll: (values) => { pendingCookies.push(...values); },
    },
  });
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: input.callbackUrl, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw new Error("Google sign-in could not be started");
  // An OAuth redirect without this cookie can never complete the exchange.
  if (!pendingCookies.some(cookie => cookie.name.endsWith("-code-verifier") && cookie.value)) {
    throw new Error("Google sign-in did not create its verification cookie");
  }
  return { url: data.url, cookies: pendingCookies };
}
