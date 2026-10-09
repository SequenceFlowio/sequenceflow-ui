import type { NormalizedInboundEmail } from "@/types/aiInbox";
import { extractForwardingCode, forwardingAllowed, forwardingRequester } from "@/lib/email/google/core";
import { resolveTenantFromAddress } from "@/lib/email/inbound/resolveTenantFromAddress";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

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

function isAllowedGoogleUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && (url.hostname === "google.com" || url.hostname.endsWith(".google.com"));
  } catch {
    return false;
  }
}

type ConfirmationForm = {
  action: string;
  fields: URLSearchParams;
};

function stripCookieAttributes(cookie: string): string {
  return cookie.split(";")[0]?.trim() ?? "";
}

function buildCookieHeader(response: Response): string {
  const cookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : response.headers.get("set-cookie")
        ? [response.headers.get("set-cookie") as string]
        : [];

  return cookies.map(stripCookieAttributes).filter(Boolean).join("; ");
}

function parseConfirmationForm(html: string, fallbackUrl: string): ConfirmationForm | null {
  const formMatch = html.match(/<form\b([^>]*)>([\s\S]*?)<\/form>/i);
  if (!formMatch) return null;

  const [, formAttributes, formBody] = formMatch;
  if (!/method="post"/i.test(formAttributes)) return null;

  const actionMatch = formAttributes.match(/action="([^"]*)"/i);
  const rawAction = actionMatch?.[1] ?? "";
  const action = rawAction ? new URL(rawAction, fallbackUrl).toString() : fallbackUrl;
  if (!isAllowedGoogleUrl(action)) return null;
  const fields = new URLSearchParams();
  const inputRegex = /<input\b([^>]*)>/gi;

  let inputMatch: RegExpExecArray | null = null;
  while ((inputMatch = inputRegex.exec(formBody)) !== null) {
    const [, attributes] = inputMatch;
    const nameMatch = attributes.match(/name="([^"]+)"/i);
    if (!nameMatch?.[1]) continue;
    const valueMatch = attributes.match(/value="([^"]*)"/i);
    const name = nameMatch[1];
    const value = valueMatch?.[1] ?? "";
    if (!name) continue;
    fields.append(name, value);
  }

  return { action, fields };
}

function looksConfirmed(html: string): boolean {
  const normalized = html.toLowerCase();
  return (
    normalized.includes("bevestigd") ||
    normalized.includes("confirmed") ||
    normalized.includes("has been added") ||
    normalized.includes("heeft nu toestemming")
  );
}

type ForwardingDecision = { tenantId: string; requester: string | null; code: string | null; allowed: boolean };

/**
 * Who asked Gmail to forward here, and is that one of this workspace's own
 * mailboxes? Anyone can point Gmail forwarding at an inbound address, so we
 * only auto-confirm for addresses the workspace connected itself.
 */
async function decideForwarding(email: NormalizedInboundEmail): Promise<ForwardingDecision | null> {
  let tenantId: string;
  try {
    tenantId = await resolveTenantFromAddress(email.recipient);
  } catch {
    return null;
  }
  const plain = `${email.text}\n${(email.html ?? "").replace(/<[^>]+>/g, " ")}`;
  const requester = forwardingRequester({ subject: email.subject, text: plain, recipient: email.recipient });
  const code = extractForwardingCode(`${email.subject}\n${plain}`);
  const db = getSupabaseAdmin();
  const [{ data: channel }, { data: google }] = await Promise.all([
    db.from("tenant_email_channels").select("outbound_from_email, smtp_from_email, imap_username").eq("tenant_id", tenantId).eq("is_default", true).maybeSingle(),
    db.from("tenant_google_connections").select("google_email").eq("tenant_id", tenantId).maybeSingle(),
  ]);
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
  if (error) console.error("[gmail-forwarding-verification] Could not store status", error.message);
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
    const getResponse = await fetch(link, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SequenceFlow/1.0)",
      },
      signal: AbortSignal.timeout(15000),
    });

    const html = await getResponse.text();
    if (looksConfirmed(html)) {
      await recordForwarding(decision, "confirmed");
      return true;
    }

    const confirmationForm = parseConfirmationForm(html, link);
    if (!confirmationForm) {
      console.warn("[gmail-forwarding-verification] Confirmation page had no allowed POST form.", { status: getResponse.status });
      return true;
    }

    const cookieHeader = buildCookieHeader(getResponse);
    const postResponse = await fetch(confirmationForm.action, {
      method: "POST",
      redirect: "manual",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SequenceFlow/1.0)",
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: link,
        Origin: new URL(link).origin,
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: confirmationForm.fields.toString(),
      signal: AbortSignal.timeout(15000),
    });

    const postHtml = await postResponse.text();
    const confirmed = looksConfirmed(postHtml);
    if (confirmed) await recordForwarding(decision, "confirmed");

    console.log("[gmail-forwarding-verification] Auto-confirm attempt completed.", {
      getStatus: getResponse.status,
      postStatus: postResponse.status,
      confirmed,
    });
  } catch (err) {
    console.error("[gmail-forwarding-verification] Failed to fetch confirmation link.", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return true;
}

/** First mail through the inbound address proves forwarding works; never fails the webhook. */
export async function markForwardingWorking(tenantId: string) {
  const { error } = await getSupabaseAdmin().from("tenant_email_channels")
    .update({ forwarding_status: "confirmed", forwarding_code: null, forwarding_updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId).eq("is_default", true).neq("forwarding_status", "confirmed");
  if (error) console.error("[forwarding] could not mark as working", error.message);
}
