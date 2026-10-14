import { fetchImapMailboxTail, fetchNewImapEmails, type ImapChannelConfig } from "@/lib/email/inbound/imap";
import { alertMailboxProblem } from "@/lib/email/mailboxAlerts";
import { findExistingConversation } from "@/lib/email/inbound/findExistingConversation";
import { runInboundEmailPipeline } from "@/lib/pipeline/runInboundEmailPipeline";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Folder names commonly used for spam/junk across IMAP providers.
 * Each one is tried in turn; missing folders are skipped silently.
 * The tail-fetch path doesn't track UIDs — dedup happens via the
 * `support_messages.provider_message_id` unique index.
 */
const SPAM_MAILBOX_CANDIDATES = [
  "Spam",
  "Junk",
  "Junk Email",
  "[Gmail]/Spam",
  "INBOX.Junk",
  "INBOX.Spam",
] as const;

type ChannelRow = {
  id: string;
  tenant_id: string;
  outbound_from_email: string | null;
  smtp_from_email: string | null;
  imap_host: string | null;
  imap_port: number | null;
  imap_encryption: "starttls" | "ssl" | "none" | null;
  imap_username: string | null;
  imap_password_encrypted: string | null;
  imap_mailbox: string | null;
  imap_uid_validity: string | null;
  imap_last_uid: number | null;
  imap_status?: "active" | "failed" | "test_required" | "not_configured" | null;
  imap_last_synced_at?: string | null;
};

function toImapChannel(row: ChannelRow): ImapChannelConfig | null {
  if (!row.imap_host || !row.imap_port || !row.imap_username || !row.imap_password_encrypted) {
    return null;
  }

  return {
    id: row.id,
    tenantId: row.tenant_id,
    host: row.imap_host,
    port: Number(row.imap_port),
    encryption: row.imap_encryption ?? "ssl",
    username: row.imap_username,
    passwordEncrypted: row.imap_password_encrypted,
    mailbox: row.imap_mailbox || "INBOX",
    recipientEmail: row.smtp_from_email ?? row.outbound_from_email ?? row.imap_username,
    uidValidity: row.imap_uid_validity,
    lastUid: row.imap_last_uid ?? 0,
  };
}

async function hasAlreadyImported(input: { tenantId: string; providerMessageId: string }) {
  const { data, error } = await getSupabaseAdmin()
    .from("support_messages")
    .select("id")
    .eq("tenant_id", input.tenantId)
    .eq("provider", "imap")
    .eq("provider_message_id", input.providerMessageId)
    .limit(1);

  if (error) {
    console.error("[imap-sync] duplicate check failed:", error.message);
    return true;
  }

  return Boolean(data?.length);
}

async function markChannel(input: {
  channelId: string;
  /** The mailbox this sync ran for; a disconnect meanwhile must not be overwritten. */
  username: string | null;
  status?: "active" | "failed" | "not_configured";
  uidValidity?: string | null;
  lastUid?: number | null;
  error?: string | null;
}) {
  const payload: Record<string, unknown> = {
    imap_last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (input.status) payload.imap_status = input.status;
  if (input.uidValidity !== undefined) payload.imap_uid_validity = input.uidValidity;
  if (input.lastUid !== undefined && input.lastUid !== null) payload.imap_last_uid = input.lastUid;
  if (input.error !== undefined) payload.imap_last_error = input.error;

  const query = getSupabaseAdmin()
    .from("tenant_email_channels")
    .update(payload)
    .eq("id", input.channelId);
  // Only touch the row if the same mailbox is still connected: a sync that was
  // running while the merchant disconnected must not flip it back to "active".
  await (input.username ? query.eq("imap_username", input.username) : query.is("imap_username", null));
}

/** ImapFlow puts the server's own answer in responseText; "Command failed" alone says little. */
function describeError(error: unknown) {
  const details = error as { responseText?: string; serverResponseCode?: string; authenticationFailed?: boolean; code?: string };
  const base = error instanceof Error ? error.message : String(error);
  const extra = [details.serverResponseCode, details.responseText, details.authenticationFailed ? "authentication failed" : null, details.code]
    .filter(Boolean).join(" · ");
  return extra ? `${base} (${extra})` : base;
}

function mailboxAddress(row: ChannelRow) {
  return row.smtp_from_email ?? row.outbound_from_email ?? row.imap_username ?? null;
}

/** Saves how far this mailbox has been processed, so a timeout never redoes or skips mail. */
async function saveProgress(row: ChannelRow, uid: number) {
  const query = getSupabaseAdmin().from("tenant_email_channels")
    .update({ imap_last_uid: uid, updated_at: new Date().toISOString() })
    .eq("id", row.id).lt("imap_last_uid", uid);
  const { error } = await (row.imap_username ? query.eq("imap_username", row.imap_username) : query.is("imap_username", null));
  if (error) console.error("[imap-sync] could not save progress", error.message, { channelId: row.id });
}

export async function syncImapChannel(row: ChannelRow, options?: { limit?: number; deadline?: number; spamSweep?: boolean }) {
  // Stop starting new emails after the deadline: the cron runs every minute
  // and must finish before the next run starts on the same mailbox.
  const deadline = options?.deadline ?? Number.POSITIVE_INFINITY;
  const channel = toImapChannel(row);
  if (!channel) {
    // No mailbox details (for example after a disconnect): not configured, not an error.
    await markChannel({
      channelId: row.id,
      username: row.imap_username ?? null,
      status: row.imap_username ? "failed" : "not_configured",
      error: row.imap_username ? "IMAP settings are incomplete." : null,
    });
    return { channelId: row.id, tenantId: row.tenant_id, processed: 0, skipped: 0, error: "IMAP settings are incomplete." };
  }

  try {
    const fetched = await fetchNewImapEmails(channel, options?.limit ?? 20);

    if (fetched.uidValidityChanged) {
      await markChannel({
        channelId: row.id,
        username: row.imap_username ?? null,
        status: "active",
        uidValidity: fetched.uidValidity,
        lastUid: fetched.latestUid,
        error: null,
      });
      return { channelId: row.id, tenantId: row.tenant_id, processed: 0, skipped: 0, uidValidityChanged: true };
    }

    let processed = 0;
    let skipped = 0;
    let lastUid = row.imap_last_uid ?? 0;
    let stoppedEarly = false;

    for (const fetchedEmail of [...fetched.emails].sort((a, b) => a.uid - b.uid)) {
      if (Date.now() > deadline) { stoppedEarly = true; break; }

      try {
        if (await hasAlreadyImported({ tenantId: row.tenant_id, providerMessageId: fetchedEmail.providerMessageId })) {
          skipped += 1;
          lastUid = Math.max(lastUid, fetchedEmail.uid);
          continue;
        }

        const conversationId = await findExistingConversation({
          tenantId: row.tenant_id,
          inReplyTo: fetchedEmail.email.inReplyTo,
          references: fetchedEmail.email.references,
        });

        await runInboundEmailPipeline({
          tenantId: row.tenant_id,
          email: fetchedEmail.email,
          conversationId: conversationId ?? undefined,
        });
      } catch (processError) {
        // One email failing is not a broken mailbox: keep it active, stop here
        // and retry this email next minute. Only our team is alerted.
        const text = describeError(processError);
        console.error("[imap-sync] could not process an email", text, { channelId: row.id, tenantId: row.tenant_id, uid: fetchedEmail.uid });
        await markChannel({ channelId: row.id, username: row.imap_username ?? null, status: "active", error: `Processing failed: ${text}`.slice(0, 1000) });
        await alertMailboxProblem({ tenantId: row.tenant_id, address: mailboxAddress(row), error: text, audience: "team" });
        return { channelId: row.id, tenantId: row.tenant_id, processed, skipped, error: text };
      }
      processed += 1;
      lastUid = Math.max(lastUid, fetchedEmail.uid);
      await saveProgress(row, lastUid);
    }

    // After INBOX, sweep common spam/junk folders for misrouted customer
    // replies. We stop at the first folder that yields results, since some
    // providers expose multiple aliases for the same folder.
    //
    // CRITICAL: from spam folders we ONLY import mails that thread to an
    // already-existing conversation (`findExistingConversation` returns a
    // match on the customer's In-Reply-To / References headers). This
    // rescues real customer replies that got mis-flagged as spam, while
    // blocking phishing, cold outreach, and other genuine spam that lives
    // in those folders.
    //
    // Probing up to six folders costs more IMAP round-trips than the INBOX
    // sync itself, so the caller may skip the sweep on most runs.
    let spamProcessed = 0;
    let spamSkipped = 0;
    const sweepSpam = options?.spamSweep !== false && !stoppedEarly && Date.now() <= deadline;
    for (const mailboxName of sweepSpam ? SPAM_MAILBOX_CANDIDATES : []) {
      try {
        const result = await fetchImapMailboxTail(channel, mailboxName, 10);
        if (!result.found) continue;
        for (const fetchedEmail of result.emails) {
          if (await hasAlreadyImported({ tenantId: row.tenant_id, providerMessageId: fetchedEmail.providerMessageId })) {
            spamSkipped += 1;
            continue;
          }
          const conversationId = await findExistingConversation({
            tenantId: row.tenant_id,
            inReplyTo: fetchedEmail.email.inReplyTo,
            references: fetchedEmail.email.references,
          });
          if (!conversationId) {
            // No thread match → treat as genuine spam, don't import.
            spamSkipped += 1;
            continue;
          }
          await runInboundEmailPipeline({
            tenantId: row.tenant_id,
            email: fetchedEmail.email,
            conversationId,
          });
          spamProcessed += 1;
        }
        // First matching spam folder wins — stop probing the rest of the list.
        break;
      } catch (spamErr) {
        const msg = spamErr instanceof Error ? spamErr.message : String(spamErr);
        console.warn(`[imap-sync] spam folder ${mailboxName} failed:`, msg, { channelId: row.id });
        continue;
      }
    }

    await markChannel({
      channelId: row.id,
      username: row.imap_username ?? null,
      status: "active",
      uidValidity: fetched.uidValidity,
      // Stopped early: only what was handled counts; the rest comes next run.
      lastUid: stoppedEarly ? lastUid : Math.max(lastUid, fetched.latestUid),
      error: null,
    });

    return {
      channelId: row.id,
      tenantId: row.tenant_id,
      processed: processed + spamProcessed,
      skipped: skipped + spamSkipped,
    };
  } catch (error) {
    // Login, connection or mailbox problem: the mailbox cannot be read.
    const message = describeError(error);
    console.error("[imap-sync]", message, { channelId: row.id, tenantId: row.tenant_id });
    await markChannel({
      channelId: row.id,
      username: row.imap_username ?? null,
      status: "failed",
      error: message.slice(0, 1000),
    });
    // Second failure in a row (retries are ~30 minutes apart): tell the
    // workspace and our team (at most once a day), so a broken mailbox never
    // goes unnoticed for days. A single hiccup does not alert anyone.
    if (row.imap_status === "failed") {
      await alertMailboxProblem({ tenantId: row.tenant_id, address: mailboxAddress(row), error: message, audience: "workspace" });
    }
    return { channelId: row.id, tenantId: row.tenant_id, processed: 0, skipped: 0, error: message };
  }
}

/** How long to wait before re-attempting a failed IMAP channel. */
const FAILED_CHANNEL_RETRY_AFTER_MS = 30 * 60 * 1000;

export async function loadActiveImapChannels(tenantId?: string) {
  // Pull both `active` and `failed` channels in one round-trip. We filter the
  // failed ones in JS so each tenant is retried on a backoff (every 30 min)
  // rather than hammered every minute. This auto-recovers from transient
  // Hostinger / Microsoft 365 rate-limit lockouts without manual intervention.
  let query = getSupabaseAdmin()
    .from("tenant_email_channels")
    .select("id, tenant_id, outbound_from_email, smtp_from_email, imap_host, imap_port, imap_encryption, imap_username, imap_password_encrypted, imap_mailbox, imap_uid_validity, imap_last_uid, imap_status, imap_last_synced_at")
    .eq("is_default", true)
    .in("imap_status", ["active", "failed"]);

  if (tenantId) query = query.eq("tenant_id", tenantId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const now = Date.now();
  const eligible = (data ?? []).filter((row) => {
    if (row.imap_status === "active") return true;
    // Failed channel — retry once per FAILED_CHANNEL_RETRY_AFTER_MS window.
    // Never retried? Eligible.
    if (!row.imap_last_synced_at) return true;
    const last = new Date(row.imap_last_synced_at).getTime();
    if (Number.isNaN(last)) return true;
    return now - last >= FAILED_CHANNEL_RETRY_AFTER_MS;
  });

  return eligible as ChannelRow[];
}

/** The cron runs every minute; leave room so a run ends before the next begins. */
export const SYNC_BUDGET_MS = 40_000;

export async function syncActiveImapMailboxes(input?: { tenantId?: string; limitPerMailbox?: number; budgetMs?: number; spamSweep?: boolean }) {
  const channels = await loadActiveImapChannels(input?.tenantId);
  const results = [];
  const end = Date.now() + (input?.budgetMs ?? SYNC_BUDGET_MS);
  for (let index = 0; index < channels.length; index++) {
    // Share the time fairly: one busy mailbox must not starve the others.
    const remaining = Math.max(0, end - Date.now());
    const share = Math.max(10_000, remaining / (channels.length - index));
    const deadline = Math.min(end, Date.now() + share);
    results.push(await syncImapChannel(channels[index], { limit: input?.limitPerMailbox ?? 20, deadline, spamSweep: input?.spamSweep }));
  }
  return results;
}
