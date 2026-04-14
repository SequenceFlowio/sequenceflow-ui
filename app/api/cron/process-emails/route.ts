/**
 * /api/cron/process-emails — DISABLED
 *
 * This cron previously polled Gmail via OAuth to fetch new emails.
 * It has been replaced by real-time inbound email via:
 *   POST /api/integrations/email/webhook
 *
 * Kept as a no-op so existing cron-job.org schedules don't 404.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function handler() {
  return NextResponse.json({
    ok: true,
    message: "Gmail polling cron is disabled. Emails are now received via inbound webhook.",
  });
}

export const GET  = handler;
export const POST = handler;
