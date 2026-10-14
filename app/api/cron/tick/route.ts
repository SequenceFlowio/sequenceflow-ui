import { NextRequest, NextResponse } from "next/server";

import { GET as commerceActionWorker } from "@/app/api/cron/commerce-action-worker/route";
import { GET as commerceEventWorker } from "@/app/api/cron/commerce-event-worker/route";
import { GET as miningWorker } from "@/app/api/cron/mining-worker/route";
import { GET as shopifyWebhooks } from "@/app/api/cron/shopify-webhooks/route";
import { GET as knowledgeWorker } from "@/app/api/knowledge/worker/route";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Every minute: one invocation runs all the queue workers, instead of a
 * separate cron (and a separate function start, billed by Vercel) for each
 * of them. The workers are independent and mostly wait on Supabase, IMAP or
 * the model, so they run at the same time: the tick lasts as long as the
 * slowest worker, not the sum. Every worker keeps its own route and secret
 * check, so it can still be run by hand or on its own schedule.
 *
 * Mailbox sync (/api/cron/process-emails) stays a cron of its own: it fills
 * its whole time budget whenever mail is waiting.
 */
const WORKERS: Record<string, { path: string; run: (req: NextRequest) => Promise<Response> }> = {
  "knowledge-worker": { path: "/api/knowledge/worker", run: knowledgeWorker },
  "mining-worker": { path: "/api/cron/mining-worker", run: miningWorker },
  "commerce-action-worker": { path: "/api/cron/commerce-action-worker", run: commerceActionWorker },
  "commerce-event-worker": { path: "/api/cron/commerce-event-worker", run: commerceEventWorker },
  "shopify-webhooks": { path: "/api/cron/shopify-webhooks", run: shopifyWebhooks },
};

function authenticate(req: Request) {
  const authHeader = req.headers.get("authorization");
  const secret = (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null) ?? req.headers.get("x-cron-secret");
  return Boolean(process.env.CRON_SECRET && secret === process.env.CRON_SECRET);
}

async function handler(req: Request) {
  if (!authenticate(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const origin = new URL(req.url).origin;
  const headers = { authorization: `Bearer ${process.env.CRON_SECRET}` };
  const outcomes = await Promise.all(
    Object.entries(WORKERS).map(async ([name, worker]) => {
      try {
        const response = await worker.run(new NextRequest(new URL(worker.path, origin), { headers }));
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok) console.error(`[cron/tick] ${name} answered ${response.status}`, body);
        return [name, { status: response.status, ...(body && typeof body === "object" ? body : {}) }] as const;
      } catch (error) {
        console.error(`[cron/tick] ${name} failed`, error);
        return [name, { status: 500, error: error instanceof Error ? error.message : String(error) }] as const;
      }
    }),
  );

  return NextResponse.json({ ok: true, workers: Object.fromEntries(outcomes) });
}

export const GET = handler;
export const POST = handler;
