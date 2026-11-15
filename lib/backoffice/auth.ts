import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { evaluateAdminClaims, type AdminState } from "./authCore";

/**
 * Supabase-client op de cookies van dit verzoek. De sessie van het
 * beheerdashboard leeft op het domein waar je inlogt (www.sequenceflow.io) en
 * staat los van de sessie in de app op support.sequenceflow.io.
 */
export async function backofficeAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // In een servercomponent kunnen cookies niet gezet worden; de routes doen dat wel.
        }
      },
    },
  });
}

/** Voorbeeldcijfers zonder inlog, alleen lokaal: BACKOFFICE_DEMO=1 en nooit in productie. */
export function backofficeDemo() {
  return process.env.NODE_ENV !== "production" && process.env.BACKOFFICE_DEMO === "1";
}

export async function adminState(): Promise<AdminState> {
  if (backofficeDemo()) return { state: "ok", email: "demo@sequenceflow.io" };
  const supabase = await backofficeAuthClient();
  if (!supabase) return { state: "signed_out" };
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return { state: "signed_out" };
  return evaluateAdminClaims(data.claims, process.env.PLATFORM_ADMIN_EMAILS);
}
