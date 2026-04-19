import crypto from "crypto";

/**
 * Build a stable RFC-822 `Message-ID` for an outbound email.
 *
 * Setting our own Message-ID is essential for threading: when the customer
 * replies, their mail client puts this value in `In-Reply-To`, which is how
 * we match the reply back to the same conversation on inbound.
 *
 * @param fromEmail  The From address of the outbound email; the domain is
 *                   reused for the Message-ID host part so major providers
 *                   (Gmail, Outlook) don't flag it as suspicious.
 */
export function buildOutboundMessageId(fromEmail: string | null | undefined): string {
  const fallback =
    (process.env.INBOUND_EMAIL_DOMAIN?.trim() || "inbox.emailreply.sequenceflow.io").trim();
  const domain = extractDomain(fromEmail) ?? fallback;
  return `<${crypto.randomUUID()}@${domain}>`;
}

function extractDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const match = email.match(/<([^>]+)>/);
  const address = (match?.[1] ?? email).trim();
  const at = address.lastIndexOf("@");
  if (at === -1 || at === address.length - 1) return null;
  return address.slice(at + 1).trim().toLowerCase();
}
