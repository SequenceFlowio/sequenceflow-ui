import type { NormalizedInboundEmail } from "@/types/aiInbox";
import { extractForwardingCode, forwardingAllowed, forwardingRequester } from "@/lib/email/google/core";
import { findTenantForAddress } from "@/lib/email/inbound/resolveTenantFromAddress";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchGooglePage, isAllowedGoogleUrl, looksConfirmed, parseConfirmationForm } from "@/lib/email/inbound/gmailConfirmationPage";

function isGmailForwardingVerification(email: NormalizedInboundEmail): boolean {
  const from = email.from.email.toLowerCase();
  const subject = email.subject.toLowerCase();
  const body = email.text.toLowerCase();
  const htmlText = (email.html ?? "").toLowerCase();
  const fullText = `${subject}\n${body}\n${htmlText}`;

  const fromGoogle =
    from.includes("forwarding-noreply@google.com") ||
    from.includes("forwarding-noreply@googlemail.com") ||
    (from.includes("google") && from.includes("noreply"));

  if (!fromGoogle) return false;

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

  return verificationMarkers.some((marker) => fullText.includes(marker));
}

function extractConfirmationLink(text: string): string | null {
  const urls = text.match(/https:\/\/[^\s<>"')]+/gi) ?? [];
  const candidate = (
    urls.find((url) => url.includes("mail-settings.google.com") || url.includes("google.com/mail")) ??
    urls.find((url) => url.includes("google.com")) ??
    null
  );
  return candidate && isAllowedGoogleUrl(candidate) ? candidate : null;
}

type ForwardingDecision = { tenantId: string; requester: string | null; code: string | null; allowed: boolean };

/**
 * Who asked Gmail to forward here, and is that one of this workspace's own
 * mailboxes? Anyone can point Gmail forwarding at an inbound address, so we
 * only auto-confirm for addresses the workspace connected itself.
 */
async function decideForwarding(email: NormalizedInboundEmail): Promise<ForwardingDecision | null> {
  // Lookup errors throw so the webhook answers 500 and Resend retries; only an unknown address is null.
  const tenantId = await findTenantForAddress(email.recipient);
  if (!tenantId) return null;
  const plain = `${email.text}\n${(email.html ?? "").replace(/<[^>]+>/g, " ")}`;
  const requester = forwardingRequester({ subject: email.subject, text: plain, recipient: email.recipient });
  const code = extractForwardingCode(`${email.subject}\n${plain}`);
  const db = getSupabaseAdmin();
  const [{ data: channel, error: channelError }, { data: google, error: googleError }] = await Promise.all([
    db.from("tenant_email_channels").select("outbound_from_email, smtp_from_email, imap_username").eq("tenant_id", tenantId).eq("is_default", true).maybeSingle(),
    db.from("tenant_google_connections").select("google_email").eq("tenant_id", tenantId).maybeSingle(),
  ]);
  // A failed read must not turn the workspace's own request into "rejected".
  if (channelError || googleError) throw new Error(`Forwarding lookup failed: ${(channelError ?? googleError)?.message}`);
  const allowed = forwardingAllowed(requester, [google?.google_email, channel?.outbound_from_email, channel?.smtp_from_email, channel?.imap_username]);
  return { tenantId, requester, code, allowed };
}

async function recordForwarding(decision: ForwardingDecision, status: "pending" | "confirmed" | "rejected") {
  const { error } = await getSupabaseAdmin().from("tenant_email_channels").update({
    forwarding_status: status,
    forwarding_requested_by: decision.requester,
    // The code only helps whoever owns the requesting Gmail account, so showing
    // it in this workspace is harmless and lets the merchant confirm by hand.
    forwarding_code: status === "confirmed" ? null : decision.code,
    forwarding_updated_at: new Date().toISOString(),
  }).eq("tenant_id", decision.tenantId).eq("is_default", true);
  // Throw so the webhook answers 500 and Resend retries; processing again is safe.
  if (error) throw new Error(`Could not store forwarding status: ${error.message}`);
}

/**
 * Detects a Gmail forwarding verification email. For the workspace's own
 * mailbox it confirms automatically; for an unknown address it only stores
 * the code. Returns true when handled (skip the normal pipeline).
 */
export async function handleGmailForwardingVerification(
  email: NormalizedInboundEmail
): Promise<boolean> {
  if (!isGmailForwardingVerification(email)) return false;

  const decision = await decideForwarding(email);
  if (!decision) {
    console.warn("[gmail-forwarding-verification] No workspace for this forwarding address.");
    return true;
  }
  if (!decision.allowed) {
    console.warn("[gmail-forwarding-verification] Forwarding requested by an address this workspace did not connect; not auto-confirming.");
    await recordForwarding(decision, "rejected");
    return true;
  }
  await recordForwarding(decision, "pending");

  const link = extractConfirmationLink(email.text) ?? extractConfirmationLink(email.html ?? "");

  if (!link) {
    console.warn("[gmail-forwarding-verification] Verification email had no allowed Google confirmation link.");
    return true;
  }

  try {
    // Google first redirects mail-settings.google.com to mail.google.com; the
    // confirm form lives on the final page and posts back to it.
    const page = await fetchGooglePage(link);
    if (looksConfirmed(page.html)) {
      await recordForwarding(decision, "confirmed");
      return true;
    }

    const confirmationForm = parseConfirmationForm(page.html, page.url);
    if (!confirmationForm) {
      console.warn("[gmail-forwarding-verification] Confirmation page had no allowed POST form.", { status: page.status });
      return true;
    }

    const result = await fetchGooglePage(confirmationForm.action, {
      method: "POST",
      body: confirmationForm.fields.toString(),
      referer: page.url,
      cookies: page.cookies,
    });
    const confirmed = looksConfirmed(result.html);
    if (confirmed) await recordForwarding(decision, "confirmed");

    console.log("[gmail-forwarding-verification] Auto-confirm attempt completed.", {
      getStatus: page.status,
      postStatus: result.status,
      confirmed,
    });
  } catch (err) {
    // A failed status write must reach the webhook (500, retry); a failed fetch is only logged.
    if (err instanceof Error && err.message.startsWith("Could not store forwarding status")) throw err;
    console.error("[gmail-forwarding-verification] Failed to fetch confirmation link.", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return true;
}
