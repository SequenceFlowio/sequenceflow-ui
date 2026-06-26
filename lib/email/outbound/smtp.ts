import nodemailer from "nodemailer";

import { decryptSmtpPassword } from "@/lib/email/outbound/smtpCredentials";
import type { SmtpEncryption } from "@/lib/email/outbound/smtpPresets";
import type { OutboundAttachment } from "@/lib/email/outbound/attachments";

export type SmtpChannelConfig = {
  host: string;
  port: number;
  encryption: SmtpEncryption;
  username: string;
  passwordEncrypted: string;
  fromEmail: string;
  fromName: string | null;
};

export type SmtpSendInput = {
  channel: SmtpChannelConfig;
  to: string;
  subject: string;
  text: string;
  inReplyTo?: string | null;
  references?: string | null;
  replyTo?: string | null;
  messageId?: string | null;
  attachments?: OutboundAttachment[];
};

export function formatMailbox(name: string | null | undefined, email: string) {
  const trimmedName = name?.trim();
  return trimmedName ? `${trimmedName} <${email}>` : email;
}

function smtpTransportOptions(channel: SmtpChannelConfig) {
  const secure = channel.encryption === "ssl";
  return {
    host: channel.host,
    port: channel.port,
    secure,
    requireTLS: channel.encryption === "starttls",
    auth: {
      user: channel.username,
      pass: decryptSmtpPassword(channel.passwordEncrypted),
    },
  };
}

export async function sendSmtpEmail(input: SmtpSendInput): Promise<{ id: string | null; raw: Buffer | null }> {
  const transporter = nodemailer.createTransport(smtpTransportOptions(input.channel));
  const headers: Record<string, string> = {};

  if (input.inReplyTo) headers["In-Reply-To"] = input.inReplyTo;
  if (input.references) headers.References = input.references;
  if (input.messageId) headers["Message-ID"] = input.messageId;

  const mailOptions = {
    from: formatMailbox(input.channel.fromName, input.channel.fromEmail),
    to: input.to,
    subject: input.subject,
    text: input.text,
    replyTo: input.replyTo ?? undefined,
    headers,
    attachments: input.attachments?.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
      contentType: attachment.contentType,
    })),
  };

  const info = await transporter.sendMail(mailOptions);

  // Re-compose the exact same message into a raw RFC-822 buffer (without
  // sending) so the caller can append it to the mailbox's Sent folder via
  // IMAP. streamTransport just builds the MIME bytes; it does not deliver.
  let raw: Buffer | null = null;
  try {
    const composer = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "\r\n" });
    const built = await composer.sendMail({
      ...mailOptions,
      // Pin the same Message-ID so the Sent copy matches what the customer
      // received (nodemailer would otherwise generate a fresh one here).
      messageId: input.messageId ?? (info.messageId ?? undefined),
    });
    raw = built.message as Buffer;
  } catch {
    raw = null;
  }

  return { id: info.messageId ?? null, raw };
}

export async function verifySmtpChannel(channel: SmtpChannelConfig) {
  const transporter = nodemailer.createTransport(smtpTransportOptions(channel));
  await transporter.verify();
}
