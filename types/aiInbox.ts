export type NormalizedInboundEmail = {
  provider: "resend" | "imap";
  providerMessageId: string;
  recipient: string;
  from: {
    email: string;
    name?: string | null;
  };
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  text: string;
  html?: string | null;
  headers: Record<string, string>;
  internetMessageId?: string | null;
  inReplyTo?: string | null;
  references?: string | null;
  receivedAt: string;
  attachments?: NormalizedInboundAttachment[];
};

export type NormalizedInboundAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string | null;
  contentId?: string | null;
};

export type CommerceDecisionAction = {
  type: "cancel_order";
  payload?: { orderId?: string };
};

export type AiDecision = {
  intent: string;
  confidence: number;
  decision: "inform_customer" | "ask_question" | "escalate" | "ignore";
  requires_human: boolean;
  reasons: string[];
  draft: {
    subject: string;
    body: string;
    language: string;
  };
  actions: CommerceDecisionAction[];
};

export type TicketCommerceContext = {
  provider: import("@/lib/commerce/types").CommerceProvider;
  connectionStatus: "active" | "paused" | "failed" | "test_required";
  actionMode: "disabled" | "approval_required";
  order: import("@/lib/commerce/types").CommerceOrderContext | null;
  candidates: Array<Pick<import("@/lib/commerce/types").CommerceOrderContext, "id" | "displayName" | "totalAmount" | "currencyCode" | "fulfillmentStatus" | "orderCreatedAt">>;
};

export type TicketBlockingAction = {
  id: string;
  type: "cancel_order";
  status: "proposed" | "approved" | "rejected" | "executing" | "succeeded" | "failed" | "blocked";
  rationale: string;
  riskLevel: "low" | "medium" | "high" | "blocked";
  orderId: string;
  orderDisplayName: string;
  totalAmount: number;
  currencyCode: string;
  parameters: { refundOriginalPayment: true; restock: true; notifyCustomer: false };
  lastError: string | null;
  confirmationStatus: "pending" | "preparing" | "prepared" | "failed";
  confirmationError: string | null;
};

export type OperationalTimelineItem = {
  id: string;
  type: string;
  status?: string | null;
  label: string;
  occurredAt: string;
};

export type MessageTranslationView = {
  direction?: "inbound" | "outbound";
  fromEmail?: string;
  toEmail?: string;
  receivedAt?: string | null;
  original: {
    subject: string;
    body: string;
    language: string | null;
  };
  english: {
    subject: string | null;
    body: string | null;
  };
  attachments?: MessageAttachmentView[];
};

export type MessageAttachmentView = {
  id: string;
  filename: string;
  contentType: string | null;
  byteSize: number;
  url: string;
};

export type TicketListItem = {
  id: string;
  source: "conversation" | "legacy";
  customerEmail: string | null;
  customerName: string | null;
  subject: string;
  subjectEnglish: string | null;
  preview: string | null;
  previewEnglish: string | null;
  intent: string | null;
  confidence: number | null;
  decision: string | null;
  requiresHuman: boolean;
  status: string;
  scheduledSendAt?: string | null;
  retentionExempt?: boolean;
  updatedAt: string;
};

export type TicketDetailResponse = {
  id: string;
  viewerRole: "admin" | "agent";
  source: "conversation" | "legacy";
  status: string;
  /**
   * ISO timestamp the conversation/ticket was first created. The detail
   * page uses this to distinguish "AI is still drafting" from "AI failed
   * to draft" — a row that's only seconds old is almost certainly still
   * in the pipeline, not failed.
   */
  createdAt: string | null;
  scheduledSendAt?: string | null;
  retentionExempt?: boolean;
  customer: {
    email: string;
    name: string | null;
  };
  subject: string;
  subjectEnglish: string | null;
  intent: string | null;
  confidence: number | null;
  decision: string | null;
  requiresHuman: boolean;
  reasons: string[];
  draft: {
    original: {
      subject: string;
      body: string;
      language: string | null;
    };
    english: {
      subject: string | null;
      body: string | null;
    };
  } | null;
  messages: MessageTranslationView[];
  escalation: {
    department: string | null;
    reason: string | null;
  } | null;
  commerceContext?: TicketCommerceContext | null;
  entityLinks?: Array<{ orderId: string; status: "candidate" | "linked"; matchMethod: string; confidence: number; confirmedAt: string | null }>;
  blockingAction?: TicketBlockingAction | null;
  operationalTimeline?: OperationalTimelineItem[];
};
