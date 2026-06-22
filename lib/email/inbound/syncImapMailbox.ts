import { fetchImapMailboxTail, fetchNewImapEmails, type ImapChannelConfig } from "@/lib/email/inbound/imap";
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
  status?: "active" | "failed";
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

  await getSupabaseAdmin()
    .from("tenant_email_channels")
    .update(payload)
    .eq("id", input.channelId);
}

export async function syncImapChannel(row: ChannelRow, options?: { limit?: number }) {
  const channel = toImapChannel(row);
  if (!channel) {
    await markChannel({
      channelId: row.id,
      status: "failed",
      error: "IMAP settings are incomplete.",
    });
    return { channelId: row.id, tenantId: row.tenant_id, processed: 0, skipped: 0, error: "IMAP settings are incomplete." };
  }

  try {
    const fetched = await fetchNewImapEmails(channel, options?.limit ?? 20);

    if (fetched.uidValidityChanged) {
      await markChannel({
        channelId: row.id,
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

    for (const fetchedEmail of fetched.emails) {
      lastUid = Math.max(lastUid, fetchedEmail.uid);

      if (await hasAlreadyImported({ tenantId: row.tenant_id, providerMessageId: fetchedEmail.providerMessageId })) {
        skipped += 1;
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
      processed += 1;
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
    let spamProcessed = 0;
    let spamSkipped = 0;
    for (const mailboxName of SPAM_MAILBOX_CANDIDATES) {
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
      status: "active",
      uidValidity: fetched.uidValidity,
      lastUid: Math.max(lastUid, fetched.latestUid),
      error: null,
    });

    return {
      channelId: row.id,
      tenantId: row.tenant_id,
      processed: processed + spamProcessed,
      skipped: skipped + spamSkipped,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[imap-sync]", message, { channelId: row.id, tenantId: row.tenant_id });
    await markChannel({
      channelId: row.id,
      status: "failed",
      error: message.slice(0, 1000),
    });
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

export async function syncActiveImapMailboxes(input?: { tenantId?: string; limitPerMailbox?: number }) {
  const channels = await loadActiveImapChannels(input?.tenantId);
  const results = [];
  for (const channel of channels) {
    results.push(await syncImapChannel(channel, { limit: input?.limitPerMailbox ?? 20 }));
  }
  return results;
}
