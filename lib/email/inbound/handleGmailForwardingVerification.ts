import type { NormalizedInboundEmail } from "@/types/aiInbox";

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
  return (
    urls.find((url) => url.includes("mail-settings.google.com") || url.includes("google.com/mail")) ??
    urls.find((url) => url.includes("google.com")) ??
    null
  );
}

/**
 * Detects a Gmail forwarding verification email and auto-confirms it by
 * fetching the confirmation link. Returns true if the email was handled
 * (and the caller should skip normal pipeline processing).
 */
export async function handleGmailForwardingVerification(
  email: NormalizedInboundEmail
): Promise<boolean> {
  if (!isGmailForwardingVerification(email)) return false;

  const link = extractConfirmationLink(email.text) ?? extractConfirmationLink(email.html ?? "");

  if (!link) {
    console.warn("[gmail-forwarding-verification] Verification email detected but no confirmation link found.", {
      from: email.from.email,
      subject: email.subject,
    });
    return true;
  }

  try {
    const response = await fetch(link, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SequenceFlow/1.0)",
      },
    });

    console.log("[gmail-forwarding-verification] Auto-confirmed forwarding address.", {
      from: email.from.email,
      subject: email.subject,
      status: response.status,
      url: link,
    });
  } catch (err) {
    console.error("[gmail-forwarding-verification] Failed to fetch confirmation link.", {
      from: email.from.email,
      subject: email.subject,
      link,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return true;
}
