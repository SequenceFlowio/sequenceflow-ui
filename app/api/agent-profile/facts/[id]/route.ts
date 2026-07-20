import { NextResponse } from "next/server";

import { learningContentHash } from "@/lib/agentProfile/learning";
import { createEmbedding } from "@/lib/embeddings";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * White-glove review actions on a single profile fact:
 * approve / reject, or edit the content (re-embedded on change).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let tenantId: string;
  let role: string;
  try {
    ({ tenantId, role } = await getTenantId(req));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Not authenticated";
    return NextResponse.json({ error: message }, { status: message === "Not authenticated" ? 401 : 403 });
  }
  if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  let body: { status?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status && ["proposed", "approved", "rejected"].includes(body.status)) {
    patch.status = body.status;
  }
  if (typeof body.content === "string" && body.content.trim()) {
    patch.content = body.content.trim();
    patch.embedding = await createEmbedding(body.content.trim().slice(0, 2000));
    patch.content_hash = learningContentHash(body.content);
  }
  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await getSupabaseAdmin()
    .from("tenant_profile_facts")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", tenantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.status === "approved" || body.status === "rejected") {
    await getSupabaseAdmin()
      .from("profile_learning_events")
      .update({ status: body.status === "approved" ? "processed" : "ignored" })
      .eq("tenant_id", tenantId)
      .eq("proposed_fact_id", id);
  }

  return NextResponse.json({ ok: true });
}
