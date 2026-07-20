import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read the tenant's agent profile + all facts for the review UI. */
export async function GET(req: Request) {
  let tenantId: string;
  try {
    ({ tenantId } = await getTenantId(req));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Not authenticated";
    return NextResponse.json({ error: message }, { status: message === "Not authenticated" ? 401 : 403 });
  }

  const supabase = getSupabaseAdmin();
  const [{ data: profile }, { data: facts }] = await Promise.all([
    supabase
      .from("tenant_agent_profile")
      .select("version, status, identity, voice_notes, stats, updated_at")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabase
      .from("tenant_profile_facts")
      .select("id, kind, intent, content, source_refs, confidence, status, origin, created_at")
      .eq("tenant_id", tenantId)
      .neq("status", "rejected")
      .order("kind", { ascending: true })
      .order("confidence", { ascending: false, nullsFirst: false }),
  ]);

  return NextResponse.json({ profile: profile ?? null, facts: facts ?? [] });
}

/** Activate the profile (or update identity/voice after white-glove edits). */
export async function PATCH(req: Request) {
  let tenantId: string;
  let role: string;
  try {
    ({ tenantId, role } = await getTenantId(req));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Not authenticated";
    return NextResponse.json({ error: message }, { status: message === "Not authenticated" ? 401 : 403 });
  }
  if (role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  let body: { status?: string; identity?: Record<string, unknown>; voiceNotes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status === "active" || body.status === "draft") patch.status = body.status;
  if (body.identity && typeof body.identity === "object") patch.identity = body.identity;
  if (typeof body.voiceNotes === "string") patch.voice_notes = body.voiceNotes;

  const { error } = await getSupabaseAdmin()
    .from("tenant_agent_profile")
    .update(patch)
    .eq("tenant_id", tenantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
