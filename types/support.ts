import type { AgentConfig } from "@/lib/support/configLoader";

export type SupportGenerateRequest = {
  subject: string;
  body: string;
  channel?: "email" | "chat" | "ticket";
  customer?: {
    name?: string;
    email?: string;
    language?: string;
  };
  order?: {
    orderId?: string;
    productName?: string;
    pricePaid?: number;
    currency?: "EUR" | "USD";
  };
};

export type SupportDraft = {
  subject: string;
  body: string;
};

export type SupportAction =
  | { type: "ASK_CLARIFYING_QUESTION"; question: string }
  | { type: "REQUEST_ORDER_ID" }
  | { type: "OFFER_DISCOUNT"; amount: number; currency: "EUR" | "USD" }
  | { type: "REQUEST_RETURN" }
  | { type: "ESCALATE_TO_HUMAN"; reason: string };

export type SupportGenerateResponse = {
  status: "DRAFT_OK" | "NEEDS_HUMAN";
  confidence: number;
  draft: SupportDraft;
  actions: SupportAction[];
  reasons: string[];
  meta: { model: string; requestId: string };
};

export function maskEmail(email?: string) {
  if (!email) return undefined;
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  const safeUser = user.length <= 2 ? "***" : `${user.slice(0, 2)}***`;
  return `${safeUser}@${domain}`;
}

export function supportOutputJsonSchema(config: AgentConfig) {
  return {
    name: "support_draft_v1",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        status: { type: "string", enum: ["DRAFT_OK", "NEEDS_HUMAN"] },
        confidence: { type: "number" },
        draft: {
          type: "object",
          additionalProperties: false,
          properties: { subject: { type: "string" }, body: { type: "string" } },
          required: ["subject", "body"],
        },
        actions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              type: {
                type: "string",
                enum: [
                  "ASK_CLARIFYING_QUESTION",
                  "REQUEST_ORDER_ID",
                  "OFFER_DISCOUNT",
                  "REQUEST_RETURN",
                  "ESCALATE_TO_HUMAN"
                ]
              },
              question: { type: ["string", "null"] },
              amount: { type: ["number", "null"] },
              currency: { type: ["string", "null"] },
              reason: { type: ["string", "null"] }
            },
            required: ["type", "question", "amount", "currency", "reason"]
          }
        },
        reasons: { type: "array", items: { type: "string" } },
      },
      required: ["status", "confidence", "draft", "actions", "reasons"],
    },
    policy: {
      allowDiscount: config.allowDiscount,
      maxDiscountAmount: config.maxDiscountAmount,
    },
  };
}
