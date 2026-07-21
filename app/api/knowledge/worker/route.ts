import { NextRequest, NextResponse } from "next/server";

import { getSupabaseClient } from "@/lib/supabase";
import { processDocument } from "@/lib/ingest/processDocument";
import { getErrorMessage } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Requires Vercel Pro. On hobby plan the function will simply time out and
// the job remains 'processing' until the stuck-job reset requeues it.
export const maxDuration = 60;

const MAX_JOBS_PER_RUN = 2;

type KnowledgeJob = {
  id: string;
  document_id: string;
  attempts: number;
};

function isMissingClaimRpc(error: { code?: string; message?: string } | null) {
  return Boolean(
    error &&
      (error.code === "PGRST202" ||
        error.code === "42883" ||
        error.message?.includes("claim_knowledge_job"))
  );
}

async function claimKnowledgeJob(supabase: ReturnType<typeof getSupabaseClient>) {
  const { data: rpcJobs, error: rpcError } = await supabase.rpc("claim_knowledge_job");
  if (!rpcError) return (rpcJobs as KnowledgeJob[] | null)?.[0] ?? null;
  if (!isMissingClaimRpc(rpcError)) throw new Error(rpcError.message);

  const now = new Date();
  const staleBefore = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  await supabase
    .from("knowledge_ingest_jobs")
    .update({ status: "pending", updated_at: now.toISOString() })
    .eq("status", "processing")
    .lt("locked_at", staleBefore);

  // The status predicate makes the update a compare-and-swap. If another
  // worker wins the same candidate, retry against the next pending row.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: candidate, error: selectError } = await supabase
      .from("knowledge_ingest_jobs")
      .select("id, document_id, attempts")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<KnowledgeJob>();

    if (selectError) throw new Error(selectError.message);
    if (!candidate) return null;

    const { data: claimed, error: updateError } = await supabase
      .from("knowledge_ingest_jobs")
      .update({
        status: "processing",
        attempts: candidate.attempts + 1,
        locked_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", candidate.id)
      .eq("status", "pending")
      .select("id, document_id, attempts")
      .maybeSingle<KnowledgeJob>();

    if (updateError) throw new Error(updateError.message);
    if (claimed) return claimed;
  }

  return null;
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;

  // No secret configured → allow in non-production only
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  // Supports Vercel Cron's Authorization: Bearer header,
  // x-cron-secret header, or ?secret query param
  const authHeader = req.headers.get("authorization");
  const bearerSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const headerSecret = bearerSecret ?? req.headers.get("x-cron-secret");
  const querySecret = new URL(req.url).searchParams.get("secret");
  return headerSecret === secret || querySecret === secret;
}

async function runWorker() {
  const supabase = getSupabaseClient();
  let processed = 0;
  let errors = 0;

  for (let i = 0; i < MAX_JOBS_PER_RUN; i++) {
    let job: KnowledgeJob | null;
    try {
      job = await claimKnowledgeJob(supabase);
    } catch (error) {
      console.error("[worker] Failed to claim knowledge job:", getErrorMessage(error));
      break;
    }
    if (!job) {
      console.log("[worker] No pending jobs.");
      break;
    }

    console.log(
      `[worker] Claimed job=${job.id} document=${job.document_id} attempt=${job.attempts}`
    );

    try {
      await processDocument(job.document_id);

      await supabase
        .from("knowledge_ingest_jobs")
        .update({ status: "done", last_error: null, updated_at: new Date().toISOString() })
        .eq("id", job.id);

      console.log(`[worker] job=${job.id} document=${job.document_id} status=done`);
      processed++;
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      console.error(`[worker] job=${job.id} document=${job.document_id} failed: ${msg}`);

      await supabase
        .from("knowledge_ingest_jobs")
        .update({
          status: "error",
          last_error: msg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      errors++;
    }
  }

  return { processed, errors };
}

// Vercel Cron sends GET; allow both so it can be triggered manually via POST too
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const result = await runWorker();
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const result = await runWorker();
  return NextResponse.json({ ok: true, ...result });
}
