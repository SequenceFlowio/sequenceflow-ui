import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveTenant } from "@/lib/tenant/resolveTenant";
import { processDocument } from "@/lib/ingest/processDocument";
import { checkDocLimit } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // 1) Authenticate via session cookie
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
          } catch {
            // Route handlers cannot always set cookies (e.g. after streaming starts).
          }
        },
      },
    }
  );

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  // 2) Resolve tenant from tenant_members
  const supabase = getSupabaseAdmin();
  let tenantId: string;
  try {
    tenantId = await resolveTenant(supabase, user.id);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 403 });
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

    // Resolve storage-scope type (platform = admin shared, policy = tenant-scoped)
    const resolvedType = type === "platform" ? "platform" : "policy";

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
    const clientId = resolvedType === "platform" ? null : tenantId;

    // 4a) Check doc limit for tenant-scoped documents
    if (resolvedType !== "platform") {
      const limitCheck = await checkDocLimit(tenantId);
      if (!limitCheck.allowed) {
        return NextResponse.json(
          { ok: false, error: `Document limit reached (${limitCheck.used}/${limitCheck.limit}). Upgrade your plan to upload more.` },
          { status: 402 }
        );
      }
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
        source:    file.name,
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
    const storagePath = `${storageDir}/${inserted.id}/${file.name}`;

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
  } catch (err: any) {
    console.error("[upload] Unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
