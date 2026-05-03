import { fetchNewImapEmails, type ImapChannelConfig } from "@/lib/email/inbound/imap";
import { findExistingConversation } from "@/lib/email/inbound/findExistingConversation";
import { runInboundEmailPipeline } from "@/lib/pipeline/runInboundEmailPipeline";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

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

    await markChannel({
      channelId: row.id,
      status: "active",
      uidValidity: fetched.uidValidity,
      lastUid: Math.max(lastUid, fetched.latestUid),
      error: null,
    });

    return { channelId: row.id, tenantId: row.tenant_id, processed, skipped };
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

export async function loadActiveImapChannels(tenantId?: string) {
  let query = getSupabaseAdmin()
    .from("tenant_email_channels")
    .select("id, tenant_id, outbound_from_email, smtp_from_email, imap_host, imap_port, imap_encryption, imap_username, imap_password_encrypted, imap_mailbox, imap_uid_validity, imap_last_uid")
    .eq("is_default", true)
    .eq("imap_status", "active");

  if (tenantId) query = query.eq("tenant_id", tenantId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ChannelRow[];
}

export async function syncActiveImapMailboxes(input?: { tenantId?: string; limitPerMailbox?: number }) {
  const channels = await loadActiveImapChannels(input?.tenantId);
  const results = [];
  for (const channel of channels) {
    results.push(await syncImapChannel(channel, { limit: input?.limitPerMailbox ?? 20 }));
  }
  return results;
}
