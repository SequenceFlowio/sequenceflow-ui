import { NextResponse } from "next/server";

import { fetchMailboxHistory } from "@/lib/email/inbound/fetchMailboxHistory";
import type { ImapChannelConfig } from "@/lib/email/inbound/imap";
import { extractExchange } from "@/lib/mining/mineExchanges";
import { distillProfile } from "@/lib/mining/distillProfile";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Sent messages processed per tick — keeps ~12 LLM calls well inside 60s. */
const BATCH_SIZE = 12;

type MiningJob = {
  id: string;
  tenant_id: string;
  status: string;
  months_back: number;
  sent_scanned: number;
  exchanges_mined: number;
  cursor_state: { afterUid?: number } | null;
};

function authenticate(req: Request) {
  const authHeader = req.headers.get("authorization");
  const secret =
    (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null) ??
    req.headers.get("x-cron-secret") ??
    new URL(req.url).searchParams.get("secret");
  return Boolean(process.env.CRON_SECRET && secret === process.env.CRON_SECRET);
}

async function loadImapChannel(tenantId: string): Promise<ImapChannelConfig | null> {
  const { data } = await getSupabaseAdmin()
    .from("tenant_email_channels")
    .select("id, tenant_id, imap_host, imap_port, imap_encryption, imap_username, imap_password_encrypted, imap_status")
    .eq("tenant_id", tenantId)
    .eq("is_default", true)
    .maybeSingle();

  if (!data || data.imap_status !== "active") return null;
  if (!data.imap_host || !data.imap_port || !data.imap_username || !data.imap_password_encrypted) return null;

  return {
    id: data.id,
    tenantId: data.tenant_id,
    host: data.imap_host,
    port: Number(data.imap_port),
    encryption: data.imap_encryption ?? "ssl",
    username: data.imap_username,
    passwordEncrypted: data.imap_password_encrypted,
    mailbox: "INBOX",
    recipientEmail: data.imap_username,
    uidValidity: null,
    lastUid: 0,
  };
}

async function updateJob(jobId: string, patch: Record<string, unknown>) {
  await getSupabaseAdmin()
    .from("mining_jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", jobId);
}

async function processMiningBatch(job: MiningJob) {
  const supabase = getSupabaseAdmin();
  const channel = await loadImapChannel(job.tenant_id);
  if (!channel) {
    await updateJob(job.id, { status: "failed", error: "IMAP channel is not active for this tenant." });
    return { jobId: job.id, status: "failed" };
  }

  const sinceDate = new Date(Date.now() - job.months_back * 30 * 24 * 60 * 60 * 1000);
  const afterUid = job.cursor_state?.afterUid ?? 0;

  const page = await fetchMailboxHistory(channel, {
    folder: "sent",
    sinceDate,
    afterUid,
    limit: BATCH_SIZE,
  });

  if (!page.folderPath) {
    await updateJob(job.id, { status: "failed", error: "No Sent folder found on the IMAP server." });
    return { jobId: job.id, status: "failed" };
  }

  let mined = 0;
  for (const message of page.messages) {
    // Self-addressed mail (e.g. our own Sent-append copies of test mails) has
    // no mining value; neither do empty bodies.
    if (!message.text || message.toEmail === channel.username.toLowerCase()) continue;

    const exchange = await extractExchange(message);
    if (!exchange?.isSupportReply || !exchange.replyText) continue;

    const replyMessageId = message.messageId ?? `hist:${page.folderPath}:${message.uid}`;
    const { error } = await supabase.from("mined_exchanges").upsert(
      {
        tenant_id: job.tenant_id,
        job_id: job.id,
        inbound_message_id: message.inReplyTo,
        reply_message_id: replyMessageId,
        subject: message.subject.slice(0, 300),
        customer_text: exchange.customerText,
        reply_text: exchange.replyText,
        intent: exchange.intent,
        quality: exchange.quality,
        facts: exchange.facts,
        tone_notes: exchange.toneNotes,
        replied_at: message.date,
      },
      { onConflict: "tenant_id,reply_message_id" },
    );
    if (!error) mined += 1;
    else console.error("[mining-worker] exchange upsert failed:", error.message);
  }

  const sentScanned = job.sent_scanned + page.messages.length;
  const exchangesMined = job.exchanges_mined + mined;

  if (page.done) {
    // Distillation runs in its own tick so it gets a fresh time budget.
    await updateJob(job.id, {
      status: "distilling",
      phase: `Historie gelezen: ${sentScanned} verzonden mails, ${exchangesMined} bruikbare gesprekken. Profiel wordt samengesteld…`,
      sent_scanned: sentScanned,
      exchanges_mined: exchangesMined,
      cursor_state: { afterUid: page.nextUid },
    });
    return { jobId: job.id, status: "distilling", scanned: sentScanned, mined: exchangesMined };
  }

  await updateJob(job.id, {
    status: "running",
    phase: `${sentScanned} verzonden mails geanalyseerd, ${exchangesMined} bruikbare gesprekken gevonden…`,
    sent_scanned: sentScanned,
    exchanges_mined: exchangesMined,
    cursor_state: { afterUid: page.nextUid },
  });
  return { jobId: job.id, status: "running", scanned: sentScanned, mined: exchangesMined };
}

async function handler(req: Request) {
  if (!authenticate(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data: jobs, error } = await supabase
    .from("mining_jobs")
    .select("id, tenant_id, status, months_back, sent_scanned, exchanges_mined, cursor_state")
    .in("status", ["queued", "running", "distilling"])
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const job = (jobs as MiningJob[] | null)?.[0];
  if (!job) return NextResponse.json({ ok: true, idle: true });

  try {
    if (job.status === "distilling") {
      const result = await distillProfile({ tenantId: job.tenant_id, jobId: job.id });
      await updateJob(job.id, {
        status: "done",
        phase: `Klaar: ${result.exchanges} gesprekken → ${result.factsInserted} voorgestelde feiten/regels.`,
        error: null,
      });
      return NextResponse.json({ ok: true, jobId: job.id, status: "done", ...result });
    }

    if (job.status === "queued") {
      await updateJob(job.id, { status: "running", phase: "Mailboxhistorie openen…" });
    }

    const result = await processMiningBatch({ ...job, status: "running" });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[mining-worker]", message, { jobId: job.id });
    await updateJob(job.id, { status: "failed", error: message.slice(0, 1000) });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = handler;
export const POST = handler;
