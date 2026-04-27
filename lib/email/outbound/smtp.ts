import nodemailer from "nodemailer";

import { decryptSmtpPassword } from "@/lib/email/outbound/smtpCredentials";
import type { SmtpEncryption } from "@/lib/email/outbound/smtpPresets";

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

export async function sendSmtpEmail(input: SmtpSendInput): Promise<{ id: string | null }> {
  const transporter = nodemailer.createTransport(smtpTransportOptions(input.channel));
  const headers: Record<string, string> = {};

  if (input.inReplyTo) headers["In-Reply-To"] = input.inReplyTo;
  if (input.references) headers.References = input.references;
  if (input.messageId) headers["Message-ID"] = input.messageId;

  const info = await transporter.sendMail({
    from: formatMailbox(input.channel.fromName, input.channel.fromEmail),
    to: input.to,
    subject: input.subject,
    text: input.text,
    replyTo: input.replyTo ?? undefined,
    headers,
  });

  return { id: info.messageId ?? null };
}

export async function verifySmtpChannel(channel: SmtpChannelConfig) {
  const transporter = nodemailer.createTransport(smtpTransportOptions(channel));
  await transporter.verify();
}
