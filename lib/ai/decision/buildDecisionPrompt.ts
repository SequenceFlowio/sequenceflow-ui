import type { TenantRuntime } from "@/lib/tenants/loadTenantRuntime";

export function buildDecisionSystemPrompt(runtime: TenantRuntime, knowledgeContext: string) {
  const templateSection = runtime.templates.length
    ? runtime.templates
        .map((template) => `Intent: ${template.intent}\nTemplate:\n${template.templateText}`)
        .join("\n\n---\n\n")
    : "No tenant templates configured.";

  const escalationSection = runtime.config.escalationDepartments.length
    ? runtime.config.escalationDepartments.map((dept) => `${dept.name} <${dept.email}>`).join(", ")
    : "No departments configured.";

  return `
You are the core AI decision engine for a B2B customer support inbox.

Your job is not only to write a reply. Your primary job is to decide the correct support action.

TENANT SETTINGS
- Default reply language: ${runtime.config.languageDefault}
- Empathy enabled: ${runtime.config.empathyEnabled ? "yes" : "no"}
- Discounts allowed: ${runtime.config.allowDiscount ? `yes, up to ${runtime.config.maxDiscountAmount}` : "no"}
- Escalation departments: ${escalationSection}

DECISION VALUES
- inform_customer
- ask_question
- escalate
- ignore

RULES
- Always preserve the customer's language for the draft language when possible.
- The draft is the sendable original-language version.
- English translation is handled later by another system.
- If the message is likely spam, newsletter, or automation noise, use decision="ignore".
- If policy or knowledge is missing for a safe answer, use decision="ask_question" or "escalate".
- If the case appears risky, financial, or operationally sensitive, set requires_human=true.
- Never invent policies not supported by knowledge or templates.
- Do not include email signature text in the draft.

TENANT TEMPLATES
${templateSection}

KNOWLEDGE CONTEXT
${knowledgeContext || "No knowledge context found."}

RETURN JSON ONLY WITH THIS SHAPE:
{
  "intent": string,
  "confidence": number,
  "decision": "inform_customer" | "ask_question" | "escalate" | "ignore",
  "requires_human": boolean,
  "reasons": string[],
  "draft": {
    "subject": string,
    "body": string,
    "language": string
  },
  "actions": []
}
`;
}

export function buildDecisionUserPrompt(input: {
  subject: string;
  body: string;
  customerEmail: string;
  customerName?: string | null;
  receivedAt: string;
  previousMessages?: Array<{ role: string; text: string }>;
}) {
  const history = (input.previousMessages ?? [])
    .map((message) => `[${message.role.toUpperCase()}] ${message.text.trim()}`)
    .join("\n\n");

  return `
INBOUND EMAIL
Subject: ${input.subject}
Body:
${input.body}

CUSTOMER
Name: ${input.customerName ?? ""}
Email: ${input.customerEmail}
Received at: ${input.receivedAt}

${history ? `THREAD HISTORY\n${history}\n` : ""}
Return JSON only.
`;
}
