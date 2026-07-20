import { NextResponse } from "next/server";

import { AuthorizationError, requireRole } from "@/lib/auth/authorization";
import { normalizeSenderFilterEmail } from "@/lib/email/inbound/senderFilterIdentity";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

function senderFilterError(error: unknown) {
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Could not update sender filters.";
  if (message === "Not authenticated") return NextResponse.json({ error: message }, { status: 401 });
  if (message === "Tenant not found for user") return NextResponse.json({ error: message }, { status: 403 });
  console.error("[sender-filters]", message);
  return NextResponse.json({ error: "Could not update sender filters." }, { status: 500 });
}

export async function GET(req: Request) {
  try {
    const context = requireRole(await getTenantId(req), ["admin"]);
    const { data, error } = await getSupabaseAdmin().from("tenant_sender_filters")
      .select("id,email,created_at").eq("tenant_id", context.tenantId).order("email");
    if (error) throw error;
    return NextResponse.json({ filters: (data ?? []).map((filter) => ({
      id: filter.id,
      email: filter.email,
      createdAt: filter.created_at,
    })) });
  } catch (error) {
    return senderFilterError(error);
  }
}

export async function POST(req: Request) {
  try {
    const context = requireRole(await getTenantId(req), ["admin"]);
    const body = await req.json().catch(() => ({})) as { email?: unknown };
    const email = normalizeSenderFilterEmail(body.email);
    if (!email) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    const { data, error } = await getSupabaseAdmin().from("tenant_sender_filters").upsert({
      tenant_id: context.tenantId,
      email,
      created_by: context.userId,
    }, { onConflict: "tenant_id,email", ignoreDuplicates: true }).select("id,email,created_at").maybeSingle();
    if (error) throw error;
    if (data) return NextResponse.json({ filter: { id: data.id, email: data.email, createdAt: data.created_at } });
    const existing = await getSupabaseAdmin().from("tenant_sender_filters").select("id,email,created_at")
      .eq("tenant_id", context.tenantId).eq("email", email).single();
    if (existing.error) throw existing.error;
    return NextResponse.json({ filter: { id: existing.data.id, email: existing.data.email, createdAt: existing.data.created_at } });
  } catch (error) {
    return senderFilterError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const context = requireRole(await getTenantId(req), ["admin"]);
    const id = new URL(req.url).searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ error: "Filter id is required." }, { status: 400 });
    const { data, error } = await getSupabaseAdmin().from("tenant_sender_filters").delete()
      .eq("tenant_id", context.tenantId).eq("id", id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Sender filter not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return senderFilterError(error);
  }
}
