import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";
import { processDocument } from "@/lib/ingest/processDocument";
import { checkDocLimit } from "@/lib/billing";
import { requireRole } from "@/lib/auth/authorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["pdf", "txt", "md", "csv"]);
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/csv",
  "application/octet-stream",
  "",
]);

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  let tenantId: string;
  try {
    const context = await getTenantId(req);
    requireRole(context, ["admin"]);
    tenantId = context.tenantId;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Forbidden";
    return NextResponse.json({ ok: false, error: message }, { status: 403 });
  }

  try {
    // 3) Parse formData
    const formData = await req.formData();
    const file      = formData.get("file")     as File | null;
    const type      = formData.get("type")     as string | null;
    const title     = formData.get("title")    as string | null;
    const docTypeRaw = formData.get("doc_type") as string | null;
    const tagsRaw   = formData.get("tags")     as string | null;
    const langRaw   = formData.get("language") as string | null;

    // Validate file
    if (!file) {
      return NextResponse.json({ ok: false, error: "No file provided." }, { status: 400 });
    }

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTENSIONS.has(extension) || !ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { ok: false, error: "Only PDF, TXT, Markdown, and CSV files are supported." },
        { status: 415 }
      );
    }
    if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Files must be between 1 byte and 10 MB." },
        { status: 413 }
      );
    }
    const safeFileName = file.name
      .normalize("NFKC")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 160) || `document.${extension}`;

    if (type === "platform") {
      return NextResponse.json(
        { ok: false, error: "Platform-wide documents can only be managed through internal operations." },
        { status: 403 }
      );
    }
    const resolvedType = "policy";

    // Resolve semantic doc type
    const VALID_DOC_TYPES = ["return_policy", "shipping_policy", "warranty", "product_info", "general"];
    const resolvedDocType = docTypeRaw && VALID_DOC_TYPES.includes(docTypeRaw) ? docTypeRaw : "general";

    // Parse tags: split comma-separated string, trim, filter empty
    const tagsArray = tagsRaw
      ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean)
      : [];
    const resolvedTags = tagsArray.length > 0 ? tagsArray : null;

    // Resolve language
    const resolvedLanguage = langRaw?.trim() || "nl";

    // Platform uploads are shared across all tenants (client_id = null).
    const clientId = tenantId;

    // 4a) Check doc limit for tenant-scoped documents
    const limitCheck = await checkDocLimit(tenantId);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { ok: false, error: `Document limit reached (${limitCheck.used}/${limitCheck.limit}). Upgrade your plan to upload more.` },
        { status: 402 }
      );
    }

    // 4) Insert document row
    const { data: inserted, error: insertError } = await supabase
      .from("knowledge_documents")
      .insert({
        client_id: clientId,
        type:      resolvedType,
        doc_type:  resolvedDocType,
        tags:      resolvedTags,
        language:  resolvedLanguage,
        title:     title || null,
        source:    safeFileName,
        mime_type: file.type,
        status:    "pending",
        chunk_count: 0,
      })
      .select()
      .single();

    if (insertError || !inserted) {
      console.error("[upload] DB insert failed:", insertError?.message);
      return NextResponse.json(
        { ok: false, error: insertError?.message ?? "Failed to create document record." },
        { status: 500 }
      );
    }

    // 5) Upload file to storage
    // Path mirrors processDocument's download convention: {client_id ?? "platform"}/{docId}/{filename}
    const fileBuffer  = Buffer.from(await file.arrayBuffer());
    const storageDir  = clientId ?? "platform";
    const storagePath = `${storageDir}/${inserted.id}/${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("knowledge-uploads")
      .upload(storagePath, fileBuffer, { contentType: file.type });

    if (uploadError) {
      console.error("[upload] Storage upload failed:", uploadError.message);
      await supabase.from("knowledge_documents").delete().eq("id", inserted.id);
      return NextResponse.json(
        { ok: false, error: "Storage upload failed: " + uploadError.message },
        { status: 500 }
      );
    }

    // 6) Run ingest synchronously — extracts text, chunks, embeds, marks ready
    console.log(`[upload] Starting ingest for document=${inserted.id}`);
    await processDocument(inserted.id, fileBuffer);
    console.log(`[upload] Ingest complete for document=${inserted.id}`);

    // 7) Return success
    return NextResponse.json({ ok: true, documentId: inserted.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[upload] Unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
