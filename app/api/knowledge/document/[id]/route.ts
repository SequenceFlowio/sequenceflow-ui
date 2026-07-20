import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";
import { getErrorMessage } from "@/lib/errors";
import { requireRole } from "@/lib/auth/authorization";

export const runtime = "nodejs";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabaseAdmin = getSupabaseAdmin();
  let tenantId: string;
  try {
    const context = await getTenantId(req);
    requireRole(context, ["admin"]);
    tenantId = context.tenantId;
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: getErrorMessage(err, "Forbidden") }, { status: 403 });
  }

  try {
    const { id } = await params;

    // Fetch doc and verify ownership: admins may only delete their own docs.
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

    // Remove file from storage.
    const storagePath = `${doc.client_id ?? "platform"}/${id}/${doc.source}`;
    await supabaseAdmin.storage.from("knowledge-uploads").remove([storagePath]);

    // Delete document row (knowledge_chunks cascade via FK).
    const { error } = await supabaseAdmin
      .from("knowledge_documents")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: getErrorMessage(err) },
      { status: 500 }
    );
  }
}
