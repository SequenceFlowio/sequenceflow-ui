/**
 * /api/cron/autosend
 *
 * Batch-sends all tickets in `pending_autosend` status for every tenant
 * that has autosend enabled.
 *
 * Called by Vercel Cron twice per day (08:00 and 16:00 UTC).
 * Secured by the same CRON_SECRET as the process-emails cron.
 */

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getGmailToken, buildRawEmail, sendGmailMessage } from "@/lib/gmail";
import { AUTO_SEND_PLANS } from "@/lib/billing";

export const runtime    = "nodejs";
export const maxDuration = 60;

async function handler(req: Request) {
  // Verify cron secret (Vercel Cron sends Authorization: Bearer <secret>)
  const authHeader = req.headers.get("authorization");
  const secret =
    (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null) ??
    req.headers.get("x-cron-secret") ??
    new URL(req.url).searchParams.get("secret");

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // 1. Find all tenants with autosend enabled on an eligible plan
  const { data: configs, error: cfgErr } = await supabase
    .from("tenant_agent_config")
    .select("tenant_id, autosend_threshold")
    .eq("autosend_enabled", true);

  if (cfgErr) {
    console.error("[autosend-cron] Failed to fetch configs:", cfgErr.message);
    return NextResponse.json({ error: cfgErr.message }, { status: 500 });
  }

  if (!configs?.length) {
    return NextResponse.json({ ok: true, message: "No tenants with autosend enabled", sent: 0 });
  }

  // Filter to eligible plans only
  const eligibleTenantIds: string[] = [];
  for (const cfg of configs) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("plan")
      .eq("id", cfg.tenant_id)
      .single();
    if (tenant && AUTO_SEND_PLANS.includes(tenant.plan as any)) {
      eligibleTenantIds.push(cfg.tenant_id);
    }
  }

  if (!eligibleTenantIds.length) {
    return NextResponse.json({ ok: true, message: "No eligible tenants", sent: 0 });
  }

  // 2. Fetch all pending_autosend tickets for eligible tenants
  const { data: tickets, error: ticketErr } = await supabase
    .from("tickets")
    .select("id, tenant_id, from_email, subject, gmail_thread_id, gmail_message_id, ai_draft")
    .eq("status", "pending_autosend")
    .in("tenant_id", eligibleTenantIds);

  if (ticketErr) {
    console.error("[autosend-cron] Failed to fetch tickets:", ticketErr.message);
    return NextResponse.json({ error: ticketErr.message }, { status: 500 });
  }

  if (!tickets?.length) {
    return NextResponse.json({ ok: true, message: "No pending tickets", sent: 0 });
  }

  let sent    = 0;
  let failed  = 0;
  const errors: string[] = [];

  for (const ticket of tickets) {
    try {
      const draftBody: string = (ticket.ai_draft as any)?.body ?? "";
      if (!draftBody) {
        // No draft body — fall back to draft status so user can review
        await supabase
          .from("tickets")
          .update({ status: "draft", updated_at: new Date().toISOString() })
          .eq("id", ticket.id);
        errors.push(`${ticket.id}: no draft body, moved to draft`);
        failed++;
        continue;
      }

      const accessToken = await getGmailToken(ticket.tenant_id);
      const subject = ticket.subject?.startsWith("Re:") ? ticket.subject : `Re: ${ticket.subject}`;

      const { raw, threadId } = buildRawEmail({
        to:        ticket.from_email,
        subject,
        body:      draftBody,
        inReplyTo:  ticket.gmail_message_id || undefined,
        references: ticket.gmail_message_id || undefined,
        threadId:   ticket.gmail_thread_id  || undefined,
      });

      await sendGmailMessage(accessToken, raw, threadId);

      await supabase
        .from("tickets")
        .update({
          status:     "sent",
          updated_at: new Date().toISOString(),
        })
        .eq("id", ticket.id);

      console.log(`[autosend-cron] Sent ticket ${ticket.id} for tenant ${ticket.tenant_id}`);
      sent++;
    } catch (e: any) {
      console.error(`[autosend-cron] Failed to send ticket ${ticket.id}:`, e.message);
      errors.push(`${ticket.id}: ${e.message}`);
      failed++;
    }
  }

  console.log(`[autosend-cron] Done — ${sent} sent, ${failed} failed`);
  return NextResponse.json({ ok: true, sent, failed, errors });
}

export const GET  = handler;
export const POST = handler;
