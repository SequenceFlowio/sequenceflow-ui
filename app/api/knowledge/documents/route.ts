import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveTenant } from "@/lib/tenant/resolveTenant";

export const runtime = "nodejs";

export async function GET(req: Request) {
  // 1) Auth — anon client reads session cookie, no service role
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  // 2) Resolve tenant
  const supabaseAdmin = getSupabaseAdmin();
  let tenantId: string;
  try {
    tenantId = await resolveTenant(supabaseAdmin, user.id);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 403 });
  }

  if (!tenantId) {
    return NextResponse.json({ ok: false, error: "Tenant ID is required" }, { status: 403 });
  }

  // 3) Read — anon client with explicit tenant filter (RLS-compatible)
  //    Returns this tenant's docs + platform docs (client_id IS NULL)
  try {
    const { searchParams } = new URL(req.url);
    const typeParam = searchParams.get("type");

    let query = supabaseAuth
      .from("knowledge_documents")
      .select(
        "id, client_id, type, title, source, mime_type, status, chunk_count, error, created_at, updated_at"
      )
      .or(`client_id.eq.${tenantId},client_id.is.null`)
      .order("created_at", { ascending: false });

    if (typeParam) {
      query = query.eq("type", typeParam);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, documents: data ?? [] });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
