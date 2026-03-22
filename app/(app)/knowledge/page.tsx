import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { KnowledgeClient } from "./KnowledgeClient";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  let isAdmin = false;
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const admin = getSupabaseAdmin();
      const { data } = await admin
        .from("tenant_members")
        .select("role")
        .eq("user_id", user.id)
        .single();
      isAdmin = data?.role === "admin";
    }
  } catch {
    // Non-critical — default to non-admin
  }

  return <KnowledgeClient isAdmin={isAdmin} />;
}
