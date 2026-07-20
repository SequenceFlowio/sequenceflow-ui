/**
 * One-off white-glove helper: regenerate the fallback-drafted conversations
 * from today's OpenAI outage through the (new) profile-aware pipeline.
 * Mirrors the reconstruction in app/api/tickets/[id]/regenerate/route.ts.
 * Run: npx tsx scripts/rerun-fallback.ts <conversationId> [...]
 */
import { getSupabaseAdmin } from "../lib/supabaseAdmin";
import { rerunConversationDecision } from "../lib/pipeline/runInboundEmailPipeline";
import { extractVisibleReplyText } from "../lib/email/inbound/replyText";
import type { NormalizedInboundEmail } from "../types/aiInbox";

async function main() {
  const ids = process.argv.slice(2);
  if (ids.length === 0) throw new Error("usage: tsx scripts/rerun-fallback.ts <conversationId> [...]");
  const supabase = getSupabaseAdmin();

  for (const conversationId of ids) {
    const { data: conversation } = await supabase
      .from("support_conversations")
      .select("id, tenant_id, latest_inbound_message_id")
      .eq("id", conversationId)
      .single();
    if (!conversation) throw new Error(`conversation ${conversationId} not found`);

    const messageId =
      conversation.latest_inbound_message_id ??
      (
        await supabase
          .from("support_messages")
          .select("id")
          .eq("conversation_id", conversationId)
          .eq("direction", "inbound")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data?.id;
    if (!messageId) throw new Error(`no inbound message for ${conversationId}`);

    const { data: message } = await supabase.from("support_messages").select("*").eq("id", messageId).single();
    if (!message) throw new Error(`message ${messageId} not found`);

    const normalized: NormalizedInboundEmail = {
      provider: "resend",
      providerMessageId: message.provider_message_id || message.id,
      recipient: message.to_email,
      from: { email: message.from_email, name: message.from_name },
      to: [message.to_email],
      cc: [],
      bcc: [],
      subject: message.subject_original,
      text: extractVisibleReplyText(message.body_original),
      html: null,
      headers: {},
      internetMessageId: message.internet_message_id,
      inReplyTo: message.in_reply_to,
      references: message.message_references,
      receivedAt: message.received_at ?? message.created_at,
    };

    console.log(`\n=== rerun ${conversationId} (${message.subject_original}) ===`);
    const result = await rerunConversationDecision({
      tenantId: conversation.tenant_id,
      conversationId,
      sourceMessageId: messageId,
      email: normalized,
    });
    console.log("result:", JSON.stringify(result));
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
