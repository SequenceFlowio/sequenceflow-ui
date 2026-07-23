import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";
import { getErrorMessage } from "@/lib/errors";
import { requireRole } from "@/lib/auth/authorization";
import { enqueueKnowledgeIngest } from "@/lib/knowledge/queue";

export const runtime = "nodejs";

export async function POST(req: Request) {
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
    const { documentId } = await req.json();

    if (!documentId) {
      return NextResponse.json(
        { ok: false, error: "documentId is required" },
        { status: 400 }
      );
    }

    // Verify the document belongs to this tenant before reindexing.
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

    const queued = await enqueueKnowledgeIngest(documentId);

    return NextResponse.json({ ok: true, ...queued }, { status: 202 });
  } catch (err: unknown) {
    console.error("[knowledge/reindex] Could not queue document:", getErrorMessage(err));
    return NextResponse.json(
      {
        ok: false,
        error: "Opnieuw verwerken is tijdelijk niet beschikbaar. Probeer het zo opnieuw.",
      },
      { status: 500 }
    );
  }
}
