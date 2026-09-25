import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";
import { getErrorMessage } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET(req: Request) {
  let tenantId: string;
  try { ({ tenantId } = await getTenantId(req)); }
  catch (err) {
    return NextResponse.json({ ok: false, error: getErrorMessage(err, "Not authenticated") }, { status: 403 });
  }
  // Read only the verified tenant and shared platform documents.
  //    Returns this tenant's docs + platform docs (client_id IS NULL)
  try {
    const { searchParams } = new URL(req.url);
    const docTypeParam = searchParams.get("doc_type");

    let query = getSupabaseAdmin()
      .from("knowledge_documents")
      .select(
        "id, client_id, type, doc_type, title, source, mime_type, status, chunk_count, error, tags, language, created_at, updated_at"
      )
      .or(`client_id.eq.${tenantId},client_id.is.null`)
      .order("created_at", { ascending: false });

    if (docTypeParam) {
      query = query.eq("doc_type", docTypeParam);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, documents: data ?? [] });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: getErrorMessage(err) },
      { status: 500 }
    );
  }
}
