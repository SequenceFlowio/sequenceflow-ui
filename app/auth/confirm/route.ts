import type { EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { finishSignIn } from "@/lib/auth/finishSignIn";
import { postLoginPath } from "@/lib/auth/postLoginPath";
import { serverAuthClient } from "@/lib/auth/serverAuthClient";
import { requestAppOrigin } from "@/lib/brand";

export const dynamic = "force-dynamic";

const TYPES = new Set<EmailOtpType>(["email", "magiclink", "signup"]);

/**
 * Inloglink uit de mail, in de vorm die Supabase aanraadt voor apps met een
 * server: /auth/confirm?token_hash=…&type=email&next=… Anders dan de
 * standaardlink werkt deze ook als je de mail in een andere browser opent.
 * Zet daarvoor in Supabase (Auth → Email templates → Magic link) de link op:
 * {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
 */
export async function GET(request: NextRequest) {
  const base = requestAppOrigin(request.url);
  const params = request.nextUrl.searchParams;
  const next = postLoginPath(params.get("next"));
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  if (tokenHash && type && TYPES.has(type)) {
    const { supabase, cookieStore } = await serverAuthClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      await finishSignIn(supabase, cookieStore, "E-mail");
      return NextResponse.redirect(`${base}${next}`);
    }
    console.warn("[auth/confirm]", error.status, error.message);
  }
  const login = new URL("/login", base);
  login.searchParams.set("error", "email_link");
  if (next !== "/dashboard") login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}
