import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Supabase met de sessiecookies van dit verzoek; nieuwe cookies gaan mee in het antwoord. */
export async function serverAuthClient() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (values) => {
          try {
            values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Alleen lezen (server component): negeren.
          }
        },
      },
    },
  );
  return { supabase, cookieStore };
}
