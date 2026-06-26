import { buildFromAddress, DEFAULT_FROM_EMAIL, sendEmail as sendResendEmail } from "@/lib/resend";
import { sendSmtpEmail, type SmtpChannelConfig } from "@/lib/email/outbound/smtp";
import { appendToSentFolder, type SentAppendImapConfig } from "@/lib/email/outbound/appendToSent";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { OutboundAttachment } from "@/lib/email/outbound/attachments";

export type OutboundProvider = "smtp" | "resend";

export type TenantEmailSendInput = {
  tenantId: string;
  to: string;
  subject: string;
  text: string;
  fromName?: string | null;
  fromEmail?: string | null;
  inReplyTo?: string | null;
  references?: string | null;
  replyTo?: string | null;
  messageId?: string | null;
  attachments?: OutboundAttachment[];
};

export type TenantEmailSendResult = {
  id: string | null;
  provider: OutboundProvider;
  fromEmail: string;
  fromName: string | null;
  fallbackUsed: boolean;
};

type ChannelRow = {
  outbound_from_email: string | null;
  outbound_from_name: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_encryption: "starttls" | "ssl" | "none" | null;
  smtp_username: string | null;
  smtp_password_encrypted: string | null;
  smtp_from_email: string | null;
  smtp_from_name: string | null;
  smtp_status: string | null;
  imap_host: string | null;
  imap_port: number | null;
  imap_encryption: "starttls" | "ssl" | "none" | null;
  imap_username: string | null;
  imap_password_encrypted: string | null;
  imap_status: string | null;
};

function buildSentAppendConfig(row: ChannelRow | null): SentAppendImapConfig | null {
  // We can only drop a copy into the Sent folder if IMAP is wired up. Reuse
  // the same mailbox credentials used for inbound polling.
  if (!row || row.imap_status !== "active") return null;
  if (!row.imap_host || !row.imap_port || !row.imap_username || !row.imap_password_encrypted) {
    return null;
  }
  return {
    host: row.imap_host,
    port: Number(row.imap_port),
    encryption: row.imap_encryption ?? "ssl",
    username: row.imap_username,
    passwordEncrypted: row.imap_password_encrypted,
  };
}

function buildSmtpChannel(row: ChannelRow | null): SmtpChannelConfig | null {
  if (!row || row.smtp_status !== "active") return null;
  if (!row.smtp_host || !row.smtp_port || !row.smtp_username || !row.smtp_password_encrypted || !row.smtp_from_email) {
    return null;
  }

  return {
    host: row.smtp_host,
    port: Number(row.smtp_port),
    encryption: row.smtp_encryption ?? "starttls",
    username: row.smtp_username,
    passwordEncrypted: row.smtp_password_encrypted,
    fromEmail: row.smtp_from_email,
    fromName: row.smtp_from_name ?? row.outbound_from_name ?? null,
  };
}

async function loadDefaultChannel(tenantId: string) {
  const { data } = await getSupabaseAdmin()
    .from("tenant_email_channels")
    .select("outbound_from_email, outbound_from_name, smtp_host, smtp_port, smtp_encryption, smtp_username, smtp_password_encrypted, smtp_from_email, smtp_from_name, smtp_status, imap_host, imap_port, imap_encryption, imap_username, imap_password_encrypted, imap_status")
    .eq("tenant_id", tenantId)
    .eq("is_default", true)
    .maybeSingle<ChannelRow>();

  return data ?? null;
}

export async function sendTenantEmail(input: TenantEmailSendInput): Promise<TenantEmailSendResult> {
  const channelRow = await loadDefaultChannel(input.tenantId);
  const smtpChannel = buildSmtpChannel(channelRow);

  if (smtpChannel) {
    try {
      const result = await sendSmtpEmail({
        channel: smtpChannel,
        to: input.to,
        subject: input.subject,
        text: input.text,
        inReplyTo: input.inReplyTo,
        references: input.references,
        // Deliberately do NOT pass replyTo for SMTP sends. The customer's mail
        // client uses the From address (their own mailbox) for replies, which
        // arrives back at their Hostinger/IMAP inbox and the cron picks it up
        // within 60s. Setting Reply-To to the SequenceFlow forwarding address
        // (which the callers still pass) would force replies into the Resend
        // Inbound webhook path and show an ugly long string in the customer's
        // mail client. Resend fallback below still uses it because Resend
        // can't send from the customer's domain.
        replyTo: null,
        messageId: input.messageId,
        attachments: input.attachments,
      });

      // Drop a copy into the mailbox's Sent folder via IMAP so the reply shows
      // up in the customer's own webmail "Verzonden", just like a manual send.
      // Best-effort and non-blocking: a failure here never affects the send
      // that already succeeded above.
      const sentAppendConfig = buildSentAppendConfig(channelRow);
      if (sentAppendConfig && result.raw) {
        await appendToSentFolder(sentAppendConfig, result.raw);
      }

      return {
        id: result.id,
        provider: "smtp",
        fromEmail: smtpChannel.fromEmail,
        fromName: smtpChannel.fromName,
        fallbackUsed: false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[mailer] SMTP send failed for tenant ${input.tenantId}; falling back to Resend:`, message);
      await getSupabaseAdmin()
        .from("tenant_email_channels")
        .update({
          smtp_status: "failed",
          smtp_last_error: message.slice(0, 1000),
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", input.tenantId)
        .eq("is_default", true);
    }
  }

  const fallbackFromEmail = input.fromEmail ?? channelRow?.outbound_from_email ?? null;
  const fallbackFromName = input.fromName ?? channelRow?.outbound_from_name ?? null;
  const fallback = await sendResendEmail({
    to: input.to,
    from: buildFromAddress(fallbackFromName, fallbackFromEmail),
    subject: input.subject,
    text: input.text,
    inReplyTo: input.inReplyTo ?? undefined,
    references: input.references ?? undefined,
    replyTo: input.replyTo ?? undefined,
    messageId: input.messageId ?? undefined,
    attachments: input.attachments,
  });

  return {
    id: fallback.id ?? null,
    provider: "resend",
    fromEmail: fallbackFromEmail ?? DEFAULT_FROM_EMAIL,
    fromName: fallbackFromName ?? null,
    fallbackUsed: Boolean(smtpChannel),
  };
}
