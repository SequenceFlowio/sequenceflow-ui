import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveTenant } from "@/lib/tenant/resolveTenant";
import { ingestDocument } from "@/lib/knowledge/ingest";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // 1) Auth
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

  try {
    const { documentId } = await req.json();

    if (!documentId) {
      return NextResponse.json(
        { ok: false, error: "documentId is required" },
        { status: 400 }
      );
    }

    // 3) Verify the document belongs to this tenant before reindexing
    const { data: doc, error: fetchError } = await supabaseAdmin
      .from("knowledge_documents")
      .select("client_id")
      .eq("id", documentId)
      .single();

    if (fetchError || !doc) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    if (doc.client_id !== tenantId) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    await ingestDocument(documentId);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
