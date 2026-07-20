import { containsCancellationConfirmation } from "@/lib/commerce/claims";
import { extractVisibleReplyText } from "@/lib/email/inbound/replyText";
import { rerunConversationDecision } from "@/lib/pipeline/runInboundEmailPipeline";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { NormalizedInboundEmail } from "@/types/aiInbox";

export async function prepareCancellationConfirmation(input: {
  tenantId: string;
  actionId: string;
  conversationId: string;
}) {
  const supabase = getSupabaseAdmin();
  const { data: action, error: actionError } = await supabase
    .from("commerce_action_proposals")
    .select("id,status,confirmation_status,conversation_id")
    .eq("id", input.actionId)
    .eq("tenant_id", input.tenantId)
    .eq("conversation_id", input.conversationId)
    .maybeSingle();
  if (actionError || !action) throw new Error(actionError?.message ?? "Cancellation action not found.");
  if (action.status !== "succeeded" || action.confirmation_status !== "preparing") {
    throw new Error("Cancellation confirmation is not ready to be prepared.");
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("support_conversations")
    .select("id,status,latest_inbound_message_id")
    .eq("id", input.conversationId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (conversationError || !conversation) throw new Error(conversationError?.message ?? "Conversation not found.");
  if (["sent", "closed", "ignored", "escalated", "archived"].includes(conversation.status)) {
    throw new Error("The conversation is already final; no confirmation draft was generated.");
  }
  if (!conversation.latest_inbound_message_id) throw new Error("Conversation has no inbound message for confirmation.");

  const { data: message, error: messageError } = await supabase
    .from("support_messages")
    .select("*")
    .eq("id", conversation.latest_inbound_message_id)
    .eq("tenant_id", input.tenantId)
    .eq("conversation_id", input.conversationId)
    .eq("direction", "inbound")
    .maybeSingle();
  if (messageError || !message) throw new Error(messageError?.message ?? "Inbound message not found.");

  const normalized: NormalizedInboundEmail = {
    provider: message.provider === "imap" ? "imap" : "resend",
    providerMessageId: message.provider_message_id || message.id,
    recipient: message.to_email,
    from: { email: message.from_email, name: message.from_name },
    to: [message.to_email],
    cc: Array.isArray(message.cc_emails) ? message.cc_emails : [],
    bcc: Array.isArray(message.bcc_emails) ? message.bcc_emails : [],
    subject: message.subject_original,
    text: extractVisibleReplyText(message.body_original),
    html: null,
    headers: typeof message.metadata === "object" && message.metadata !== null
      && "headers" in message.metadata && typeof message.metadata.headers === "object" && message.metadata.headers !== null
      ? message.metadata.headers as Record<string, string>
      : {},
    internetMessageId: message.internet_message_id,
    inReplyTo: message.in_reply_to,
    references: message.message_references,
    receivedAt: message.received_at ?? message.created_at,
  };

  const regenerated = await rerunConversationDecision({
    tenantId: input.tenantId,
    conversationId: input.conversationId,
    sourceMessageId: message.id,
    email: normalized,
    forceHumanReview: true,
    linkedSucceededActionId: input.actionId,
    regenerationInstructions:
      "The linked cancellation has now succeeded at the commerce provider. Write a concise customer-facing confirmation in the customer's language. Confirm only live cancellation and refund facts present in COMMERCE CONTEXT. Do not propose another action.",
  });
  if (!regenerated.decisionId) throw new Error("Confirmation decision was not created.");

  const { data: decision, error: decisionError } = await supabase
    .from("support_decisions")
    .select("draft_body_original,blocking_action_id,requires_human,review_status")
    .eq("id", regenerated.decisionId)
    .eq("tenant_id", input.tenantId)
    .eq("conversation_id", input.conversationId)
    .maybeSingle();
  if (decisionError || !decision) throw new Error(decisionError?.message ?? "Confirmation decision could not be verified.");
  if (decision.blocking_action_id !== input.actionId || !decision.requires_human || decision.review_status !== "pending_review") {
    throw new Error("Confirmation decision did not preserve its human-review gate.");
  }
  if (!containsCancellationConfirmation(String(decision.draft_body_original ?? ""))) {
    throw new Error("Generated draft did not clearly confirm the verified cancellation.");
  }

  const { data: prepared, error: preparedError } = await supabase
    .from("commerce_action_proposals")
    .update({
      confirmation_status: "prepared",
      confirmation_decision_id: regenerated.decisionId,
      confirmation_error: null,
      confirmation_processing_started_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.actionId)
    .eq("tenant_id", input.tenantId)
    .eq("status", "succeeded")
    .eq("confirmation_status", "preparing")
    .select("id")
    .maybeSingle();
  if (preparedError || !prepared) throw new Error(preparedError?.message ?? "Confirmation state could not be finalized.");

  return { decisionId: String(regenerated.decisionId) };
}
