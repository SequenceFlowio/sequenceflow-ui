import type { SupabaseClient } from "@supabase/supabase-js";

export type SessionClaims = { userId: string; email: string | null };

/**
 * Who is signed in, read from the access token itself. `getClaims` checks the
 * token's signature against the project's public keys (fetched once, then
 * cached), where `getUser` asks the Auth server on every call. The app asks
 * this on every page view and API request, so that is one network round-trip
 * fewer each time. A project still on a shared JWT secret cannot verify
 * locally; the client then asks the Auth server, exactly as before.
 *
 * A token stays valid until it expires (an hour at most), so a user who is
 * removed keeps access for that long.
 */
export async function readSessionClaims(supabase: Pick<SupabaseClient, "auth">, jwt?: string): Promise<SessionClaims | null> {
  const { data, error } = await supabase.auth.getClaims(jwt);
  const userId = data?.claims.sub;
  if (error || !userId) return null;
  const email = data.claims.email;
  return { userId, email: typeof email === "string" ? email : null };
}
