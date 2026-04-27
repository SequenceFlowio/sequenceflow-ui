import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantPlan, type Plan } from "@/lib/billing";
import { DEFAULT_FROM_EMAIL, normalizeSenderEmail } from "@/lib/resend";
import type { AgentConfig } from "@/lib/support/configLoader";

export type TenantRuntime = {
  tenantId: string;
  plan: Plan;
  config: AgentConfig & {
    escalationDepartments: Array<{ name: string; email: string }>;
    senderEmail: string | null;
    senderName: string | null;
  };
  templates: Array<{
    id: string;
    intent: string;
    templateText: string;
    confidenceWeight: number;
  }>;
  channel: {
    inboundAddress: string;
    outboundFromEmail: string;
    outboundFromName: string | null;
  };
};

export async function loadTenantRuntime(tenantId: string): Promise<TenantRuntime> {
  const supabase = getSupabaseAdmin();

  const [planInfo, configRes, templatesRes, channelRes] = await Promise.all([
    getTenantPlan(tenantId),
    supabase
      .from("tenant_agent_config")
      .select(
        "empathy_enabled, allow_discount, max_discount_amount, signature, language_default, autosend_enabled, autosend_threshold, autosend_time_1, autosend_time_2, escalation_departments, sender_email, sender_name"
      )
      .eq("tenant_id", tenantId)
      .single(),
    supabase
      .from("tenant_templates")
      .select("id, intent, template_text, confidence_weight")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("confidence_weight", { ascending: false }),
    supabase
      .from("tenant_email_channels")
      .select("inbound_address, outbound_from_email, outbound_from_name, smtp_status, smtp_from_email, smtp_from_name")
      .eq("tenant_id", tenantId)
      .eq("is_default", true)
      .maybeSingle(),
  ]);

  const cfg = configRes.data;
  const channel = channelRes.data;
  const inboundDomain = (process.env.INBOUND_EMAIL_DOMAIN ?? "inbox.emailreply.sequenceflow.io").trim();

  const defaultInboundAddress = `t-${tenantId}@${inboundDomain}`;
  const fallbackSenderEmail = normalizeSenderEmail(cfg?.sender_email) || DEFAULT_FROM_EMAIL;
  const fallbackSenderName = cfg?.sender_name?.trim() || null;

  return {
    tenantId,
    plan: planInfo.plan,
    config: {
      empathyEnabled: cfg?.empathy_enabled ?? true,
      allowDiscount: cfg?.allow_discount ?? false,
      maxDiscountAmount: cfg?.max_discount_amount ?? 0,
      signature: cfg?.signature ?? "",
      languageDefault: cfg?.language_default ?? "nl",
      autosendEnabled: cfg?.autosend_enabled ?? false,
      autosendThreshold: cfg?.autosend_threshold ?? 0.85,
      autosendTime1: cfg?.autosend_time_1 ?? "08:00",
      autosendTime2: cfg?.autosend_time_2 ?? "16:00",
      escalationDepartments: Array.isArray(cfg?.escalation_departments) ? cfg.escalation_departments : [],
      senderEmail: cfg?.sender_email ? normalizeSenderEmail(cfg.sender_email) : null,
      senderName: cfg?.sender_name ?? null,
    },
    templates: (templatesRes.data ?? []).map((row) => ({
      id: row.id,
      intent: row.intent,
      templateText: row.template_text,
      confidenceWeight: Number(row.confidence_weight ?? 1),
    })),
    channel: {
      inboundAddress: channel?.inbound_address ?? defaultInboundAddress,
      outboundFromEmail:
        channel?.smtp_status === "active" && channel.smtp_from_email
          ? channel.smtp_from_email
          : normalizeSenderEmail(channel?.outbound_from_email) ?? fallbackSenderEmail,
      outboundFromName:
        channel?.smtp_status === "active" && channel.smtp_from_name
          ? channel.smtp_from_name
          : channel?.outbound_from_name ?? fallbackSenderName,
    },
  };
}
