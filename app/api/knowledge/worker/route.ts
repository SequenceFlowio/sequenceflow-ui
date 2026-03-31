import { NextRequest, NextResponse } from "next/server";

import { getSupabaseClient } from "@/lib/supabase";
import { processDocument } from "@/lib/ingest/processDocument";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Requires Vercel Pro. On hobby plan the function will simply time out and
// the job remains 'processing' until the stuck-job reset requeues it.
export const maxDuration = 60;

const MAX_JOBS_PER_RUN = 2;

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
    // Atomically claim one pending job (also resets stuck jobs)
    const { data: jobs, error: claimErr } = await supabase.rpc("claim_knowledge_job");

    if (claimErr) {
      console.error("[worker] claim_knowledge_job RPC failed:", claimErr.message);
      break;
    }

    const job = (jobs as any[])?.[0];
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
    } catch (err: any) {
      const msg = String(err?.message ?? err);
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
