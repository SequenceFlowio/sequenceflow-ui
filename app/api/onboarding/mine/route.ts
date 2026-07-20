import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * White-glove onboarding: start (POST) or poll (GET) a mailbox-history
 * mining run for the caller's tenant. The actual work happens in the
 * mining-worker cron, batch by batch.
 */
export async function POST(req: Request) {
  let tenantId: string;
  let role: string;
  try {
    ({ tenantId, role } = await getTenantId(req));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Not authenticated";
    return NextResponse.json({ error: message }, { status: message === "Not authenticated" ? 401 : 403 });
  }
  if (role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  const { data: channel } = await supabase
    .from("tenant_email_channels")
    .select("imap_status")
    .eq("tenant_id", tenantId)
    .eq("is_default", true)
    .maybeSingle();
  if (channel?.imap_status !== "active") {
    return NextResponse.json(
      { error: "IMAP moet actief zijn voordat de mailboxhistorie gelezen kan worden." },
      { status: 400 },
    );
  }

  const { data: existing } = await supabase
    .from("mining_jobs")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .in("status", ["queued", "running", "distilling"])
    .limit(1);
  if (existing?.length) {
    return NextResponse.json({ ok: true, jobId: existing[0].id, status: existing[0].status, alreadyRunning: true });
  }

  let monthsBack = 12;
  try {
    const body = await req.json();
    const parsed = Number(body?.monthsBack);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 24) monthsBack = parsed;
  } catch {
    // empty body is fine — default applies
  }

  const { data: job, error } = await supabase
    .from("mining_jobs")
    .insert({ tenant_id: tenantId, months_back: monthsBack, phase: "In wachtrij…" })
    .select("id, status")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, jobId: job.id, status: job.status });
}

export async function GET(req: Request) {
  let tenantId: string;
  try {
    ({ tenantId } = await getTenantId(req));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Not authenticated";
    return NextResponse.json({ error: message }, { status: message === "Not authenticated" ? 401 : 403 });
  }

  const { data: job } = await getSupabaseAdmin()
    .from("mining_jobs")
    .select("id, status, phase, months_back, sent_scanned, exchanges_mined, error, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ job: job ?? null });
}
