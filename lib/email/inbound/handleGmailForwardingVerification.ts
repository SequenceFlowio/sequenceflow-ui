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
    const getResponse = await fetch(link, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SequenceFlow/1.0)",
      },
    });

    const html = await getResponse.text();
    if (looksConfirmed(html)) {
      console.log("[gmail-forwarding-verification] Forwarding address was already confirmed.", {
        from: email.from.email,
        subject: email.subject,
        status: getResponse.status,
        url: link,
      });
      return true;
    }

    const confirmationForm = parseConfirmationForm(html, link);
    if (!confirmationForm) {
      console.warn("[gmail-forwarding-verification] Confirmation page loaded but no POST form was found.", {
        from: email.from.email,
        subject: email.subject,
        status: getResponse.status,
        url: link,
      });
      return true;
    }

    const cookieHeader = buildCookieHeader(getResponse);
    const postResponse = await fetch(confirmationForm.action, {
      method: "POST",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SequenceFlow/1.0)",
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: link,
        Origin: new URL(link).origin,
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: confirmationForm.fields.toString(),
    });

    const postHtml = await postResponse.text();
    const confirmed = looksConfirmed(postHtml);

    console.log("[gmail-forwarding-verification] Auto-confirm attempt completed.", {
      from: email.from.email,
      subject: email.subject,
      getStatus: getResponse.status,
      postStatus: postResponse.status,
      confirmed,
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
