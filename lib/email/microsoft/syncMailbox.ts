import { alertMailboxProblem } from "@/lib/email/mailboxAlerts";
import { findExistingConversation } from "@/lib/email/inbound/findExistingConversation";
import { parseRawEmail } from "@/lib/email/inbound/imap";
import { graphGet, markMicrosoftConnection, microsoftMailConfig } from "@/lib/email/microsoft/connection";
import { MicrosoftReconnectRequired, GRAPH_API, inboxQuery, microsoftProviderMessageId, nextCursor } from "@/lib/email/microsoft/core";
import { runInboundEmailPipeline } from "@/lib/pipeline/runInboundEmailPipeline";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type GraphMessage = { id: string; receivedDateTime: string; internetMessageId?: string | null };
type ConnectionRow = { tenant_id: string; microsoft_email: string; inbox_cursor: string; status: string };

/** Junk mail is only looked at for this long back, and only for replies in a known conversation. */
const JUNK_LOOKBACK_MS = 2 * 60 * 60 * 1000;

async function alreadyImported(tenantId: string, providerMessageId: string) {
  const { data, error } = await getSupabaseAdmin().from("support_messages").select("id")
    .eq("tenant_id", tenantId).eq("provider", "microsoft").eq("provider_message_id", providerMessageId).limit(1);
  if (error) {
    console.error("[microsoft-sync] duplicate check failed:", error.message);
    return true;
  }
  return Boolean(data?.length);
}

async function listMessages(tenantId: string, url: string) {
  const response = await graphGet(tenantId, url);
  const body = await response.json() as { value?: GraphMessage[] };
  return body.value ?? [];
}

async function readMessage(row: ConnectionRow, message: GraphMessage) {
  const response = await graphGet(row.tenant_id, `${GRAPH_API}/me/messages/${encodeURIComponent(message.id)}/$value`, "mime");
  const source = Buffer.from(await response.arrayBuffer());
  return parseRawEmail({
    provider: "microsoft",
    providerMessageId: microsoftProviderMessageId(message),
    recipient: row.microsoft_email,
    source,
    fallbackDate: message.receivedDateTime,
  });
}

export async function syncMicrosoftMailbox(row: ConnectionRow, options?: { limit?: number; deadline?: number; junkSweep?: boolean }) {
  const deadline = options?.deadline ?? Number.POSITIVE_INFINITY;
  let processed = 0;
  let skipped = 0;
  const handled: GraphMessage[] = [];
  try {
    const messages = await listMessages(row.tenant_id, inboxQuery("inbox", row.inbox_cursor, options?.limit ?? 20));
    for (const message of messages) {
      if (Date.now() > deadline) break;
      const providerMessageId = microsoftProviderMessageId(message);
      if (await alreadyImported(row.tenant_id, providerMessageId)) {
        skipped += 1;
        handled.push(message);
        continue;
      }
      try {
        const email = await readMessage(row, message);
        const conversationId = await findExistingConversation({ tenantId: row.tenant_id, inReplyTo: email.inReplyTo, references: email.references });
        await runInboundEmailPipeline({ tenantId: row.tenant_id, email, conversationId: conversationId ?? undefined });
      } catch (processError) {
        if (processError instanceof MicrosoftReconnectRequired) throw processError;
        // One email failing is not a broken mailbox: keep the cursor before it
        // and retry next minute. Only our team is alerted.
        const text = processError instanceof Error ? processError.message : String(processError);
        console.error("[microsoft-sync] could not process an email", text, { tenantId: row.tenant_id });
        await markMicrosoftConnection(row.tenant_id, { inbox_cursor: nextCursor(row.inbox_cursor, handled), last_synced_at: new Date().toISOString(), last_error: `Processing failed: ${text}`.slice(0, 1000) });
        await alertMailboxProblem({ tenantId: row.tenant_id, address: row.microsoft_email, error: text, audience: "team" });
        return { tenantId: row.tenant_id, processed, skipped, error: text };
      }
      processed += 1;
      handled.push(message);
    }

    // Customer replies Outlook put in Junk: imported only when they belong to
    // a conversation we already have, so real spam never gets in.
    if (options?.junkSweep && Date.now() <= deadline) {
      const since = new Date(Date.now() - JUNK_LOOKBACK_MS).toISOString();
      const junk = await listMessages(row.tenant_id, inboxQuery("junkemail", since, 10)).catch((error) => {
        console.warn("[microsoft-sync] junk folder skipped:", error instanceof Error ? error.message : error);
        return [] as GraphMessage[];
      });
      for (const message of junk) {
        if (Date.now() > deadline) break;
        if (await alreadyImported(row.tenant_id, microsoftProviderMessageId(message))) continue;
        const email = await readMessage(row, message);
        const conversationId = await findExistingConversation({ tenantId: row.tenant_id, inReplyTo: email.inReplyTo, references: email.references });
        if (!conversationId) continue;
        await runInboundEmailPipeline({ tenantId: row.tenant_id, email, conversationId });
        processed += 1;
      }
    }

    await markMicrosoftConnection(row.tenant_id, { inbox_cursor: nextCursor(row.inbox_cursor, handled), last_synced_at: new Date().toISOString(), last_error: null });
    return { tenantId: row.tenant_id, processed, skipped };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[microsoft-sync]", message, { tenantId: row.tenant_id });
    // Keep the progress made before the failure.
    await markMicrosoftConnection(row.tenant_id, { inbox_cursor: nextCursor(row.inbox_cursor, handled), last_synced_at: new Date().toISOString(), last_error: message.slice(0, 1000) });
    // A revoked grant needs the merchant; a passing Graph hiccup does not.
    if (error instanceof MicrosoftReconnectRequired) {
      await alertMailboxProblem({ tenantId: row.tenant_id, address: row.microsoft_email, error: message, audience: "workspace" });
    }
    return { tenantId: row.tenant_id, processed, skipped, error: message };
  }
}

export async function syncActiveMicrosoftMailboxes(input?: { tenantId?: string; limitPerMailbox?: number; budgetMs?: number; junkSweep?: boolean }) {
  if (!microsoftMailConfig().enabled) return [];
  let query = getSupabaseAdmin().from("tenant_microsoft_connections")
    .select("tenant_id, microsoft_email, inbox_cursor, status").eq("status", "active");
  if (input?.tenantId) query = query.eq("tenant_id", input.tenantId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as ConnectionRow[];
  const results = [];
  const end = Date.now() + (input?.budgetMs ?? 40_000);
  for (let index = 0; index < rows.length; index++) {
    // Share the time fairly: one busy mailbox must not starve the others.
    const remaining = Math.max(0, end - Date.now());
    const share = Math.max(10_000, remaining / (rows.length - index));
    results.push(await syncMicrosoftMailbox(rows[index], { limit: input?.limitPerMailbox ?? 20, deadline: Math.min(end, Date.now() + share), junkSweep: input?.junkSweep }));
  }
  return results;
}
