/**
 * GET /api/integrations/email/setup
 *
 * Returns the unique inbound forwarding address for this tenant and their
 * current sender config (from name / from email for outgoing replies).
 */

import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/tenant";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { DEFAULT_FROM_EMAIL } from "@/lib/resend";

const INBOUND_DOMAIN = process.env.INBOUND_EMAIL_DOMAIN ?? "inbox.emailreply.sequenceflow.io";

function looksLikeGmailForwardingVerification(input: {
  from_email: string | null;
  subject_original: string | null;
  body_original: string | null;
}) {
  const from = (input.from_email ?? "").toLowerCase();
  const subject = (input.subject_original ?? "").toLowerCase();
  const body = (input.body_original ?? "").toLowerCase();
  const fullText = `${subject}\n${body}`;

  const fromGoogle =
    from.includes("forwarding-noreply@google.com") ||
    from.includes("forwarding-noreply@googlemail.com") ||
    (from.includes("google") && from.includes("noreply"));

  const verificationMarkers = [
    "gmail forwarding confirmation",
    "forwarding confirmation",
    "confirmation code",
    "verification code",
    "has requested to automatically forward",
    "bevestigingscode",
    "doorstuuradres",
    "automatisch doorsturen",
    "forward a copy of incoming mail",
  ];

  return fromGoogle && verificationMarkers.some((marker) => fullText.includes(marker));
}

function extractVerificationLink(body: string | null) {
  if (!body) return null;
  const matches = body.match(/https:\/\/[^\s<>"')]+/gi) ?? [];
  return matches.find((url) => url.includes("google") || url.includes("mail-settings")) ?? matches[0] ?? null;
}

function extractVerificationCode(body: string | null) {
  if (!body) return null;
  const explicitMatch = body.match(
    /(?:confirmation|verification|bevestigings)(?:\s+|\-)?code[^A-Z0-9]{0,12}([A-Z0-9-]{6,12})/i
  );
  if (explicitMatch?.[1]) return explicitMatch[1];

  const numericMatch = body.match(/\b\d{6,12}\b/);
  return numericMatch?.[0] ?? null;
}

export async function GET(req: Request) {
  let tenantId: string;
  try {
    ({ tenantId } = await getTenantId(req));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Forbidden";
    const status = message === "Not authenticated" ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }

  const inboundEmail = `t-${tenantId}@${INBOUND_DOMAIN}`;
  const supabase = getSupabaseAdmin();
  const [
    { count: legacyTicketCount },
    { count: conversationCount },
    { count: knowledgeDocCount },
    { data: config },
    { data: channel },
    { data: recentMessages },
  ] = await Promise.all([
    supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("support_conversations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("knowledge_documents")
      .select("id", { count: "exact", head: true })
      .eq("client_id", tenantId),
    supabase
      .from("tenant_agent_config")
      .select("sender_email, sender_name, signature")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabase
      .from("tenant_email_channels")
      .select("inbound_address, outbound_from_email, outbound_from_name, smtp_provider, smtp_host, smtp_port, smtp_encryption, smtp_username, smtp_password_encrypted, smtp_from_email, smtp_from_name, smtp_status, smtp_last_tested_at, smtp_last_error")
      .eq("tenant_id", tenantId)
      .eq("is_default", true)
      .maybeSingle(),
    supabase
      .from("support_messages")
      .select("from_email, subject_original, body_original, received_at")
      .eq("tenant_id", tenantId)
      .eq("direction", "inbound")
      .order("received_at", { ascending: false })
      .limit(25),
  ]);

  const latestForwardingVerification = (recentMessages ?? []).find(looksLikeGmailForwardingVerification) ?? null;
  const verificationLink = extractVerificationLink(latestForwardingVerification?.body_original ?? null);
  const verificationCode = extractVerificationCode(latestForwardingVerification?.body_original ?? null);
  const emailsReceived = (legacyTicketCount ?? 0) + (conversationCount ?? 0);
  const hasSignature = Boolean(config?.signature?.trim());
  const gmailForwardingVerificationPending = Boolean(latestForwardingVerification);

  return NextResponse.json({
    inboundEmail: channel?.inbound_address ?? inboundEmail,
    emailsReceived,
    isForwardingActive: emailsReceived > 0 && !gmailForwardingVerificationPending,
    hasSignature,
    knowledgeDocCount: knowledgeDocCount ?? 0,
    senderEmail: channel?.outbound_from_email ?? config?.sender_email ?? DEFAULT_FROM_EMAIL,
    senderName:  channel?.outbound_from_name ?? config?.sender_name  ?? "Customer Support",
    smtp: {
      provider: channel?.smtp_provider ?? "other",
      host: channel?.smtp_host ?? "",
      port: channel?.smtp_port ?? 587,
      encryption: channel?.smtp_encryption ?? "starttls",
      username: channel?.smtp_username ?? "",
      fromEmail: channel?.smtp_from_email ?? channel?.outbound_from_email ?? config?.sender_email ?? "",
      fromName: channel?.smtp_from_name ?? channel?.outbound_from_name ?? config?.sender_name ?? "Customer Support",
      status: channel?.smtp_status ?? "not_configured",
      lastTestedAt: channel?.smtp_last_tested_at ?? null,
      lastError: channel?.smtp_last_error ?? null,
      hasPassword: Boolean((channel as { smtp_password_encrypted?: string | null } | null)?.smtp_password_encrypted),
    },
    gmailForwardingVerificationPending,
    gmailForwardingVerificationReceivedAt: latestForwardingVerification?.received_at ?? null,
    gmailForwardingVerificationCode: verificationCode,
    gmailForwardingVerificationLink: verificationLink,
  });
}
