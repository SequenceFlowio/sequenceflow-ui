import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveTenant } from "@/lib/tenant/resolveTenant";

export const runtime = "nodejs";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params;

    // 3) Fetch doc and verify ownership — tenant may only delete their own docs
    const { data: doc, error: fetchError } = await supabaseAdmin
      .from("knowledge_documents")
      .select("client_id, source, type")
      .eq("id", id)
      .single();

    if (fetchError || !doc) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    if (doc.client_id !== tenantId) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    // 4) Remove file from storage
    const storagePath = `${doc.client_id ?? "platform"}/${id}/${doc.source}`;
    await supabaseAdmin.storage.from("knowledge-uploads").remove([storagePath]);

    // 5) Delete document row (knowledge_chunks cascade via FK)
    const { error } = await supabaseAdmin
      .from("knowledge_documents")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
