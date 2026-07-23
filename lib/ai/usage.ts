import crypto from "crypto";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { aiCreditUsage, type CompletionUsage } from "@/lib/ai/usageMath";

export { aiCreditUsage } from "@/lib/ai/usageMath";

export type AiUsageOperation =
  | "decision"
  | "translation_customer"
  | "translation_subject"
  | "translation_draft";

export async function recordAiUsage(input: {
  tenantId: string;
  conversationId?: string | null;
  legacyTicketId?: string | null;
  decisionId?: string | null;
  operation: AiUsageOperation;
  model: string;
  usage: CompletionUsage;
  idempotencyKey: string;
  billable?: boolean;
  reason?: string | null;
}) {
  const measured = aiCreditUsage(input.usage);
  const billable = input.billable !== false;
  const { error } = await getSupabaseAdmin().from("ai_usage_events").upsert({
    tenant_id: input.tenantId,
    conversation_id: input.conversationId ?? null,
    legacy_ticket_id: input.legacyTicketId ?? null,
    decision_id: input.decisionId ?? null,
    operation: input.operation,
    model: input.model,
    prompt_tokens: measured.promptTokens,
    cached_input_tokens: measured.cachedInputTokens,
    completion_tokens: measured.completionTokens,
    weighted_tokens: measured.weightedTokens,
    credit_delta: billable ? measured.credits : 0,
    billing_status: billable ? "charged" : "waived",
    reason: input.reason ?? null,
    idempotency_key: input.idempotencyKey,
  }, {
    onConflict: "tenant_id,idempotency_key",
    ignoreDuplicates: true,
  });

  if (error) {
    console.warn("[ai-usage] Could not record usage:", error.message);
  }

  return measured;
}

export async function refundConversationAiUsage(input: {
  tenantId: string;
  conversationId: string;
  reason: string;
}) {
  const { error } = await getSupabaseAdmin().rpc("refund_conversation_ai_usage", {
    p_tenant_id: input.tenantId,
    p_conversation_id: input.conversationId,
    p_reason: input.reason,
  });
  if (error) {
    console.warn("[ai-usage] Could not refund conversation usage:", error.message);
  }
}

export function spamSenderKey(tenantId: string, email: string) {
  const secret =
    process.env.SPAM_IDENTITY_HMAC_KEY?.trim() ??
    process.env.COMMERCE_IDENTITY_HMAC_KEY?.trim();
  if (!secret) return null;
  return crypto
    .createHmac("sha256", secret)
    .update(`${tenantId}:${email.trim().toLowerCase()}`)
    .digest("hex");
}
