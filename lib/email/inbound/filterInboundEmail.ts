import type { NormalizedInboundEmail } from "@/types/aiInbox";

export type FilterResult =
  | { allowed: true }
  | { allowed: false; reason: string; category: "newsletter" | "spam" | "automated" | "internal" };

function includesAny(haystack: string, needles: string[]) {
  return needles.some((needle) => haystack.includes(needle));
}

function getHeader(headers: Record<string, string> | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const lowerTarget = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerTarget) {
      return typeof value === "string" ? value : String(value ?? "");
    }
  }
  return undefined;
}

export function filterInboundEmail(email: NormalizedInboundEmail, outboundFromEmail?: string | null): FilterResult {
  const subject = email.subject.toLowerCase().trim();
  const body = email.text.toLowerCase().trim();
  const from = email.from.email.toLowerCase().trim();
  const fromName = (email.from.name ?? "").toLowerCase().trim();
  const fullText = `${subject}\n${body}\n${Object.entries(email.headers ?? {})
    .map(([key, value]) => `${key}:${value}`)
    .join("\n")}`.toLowerCase();

  // ── 1. Internal self-email guard ────────────────────────────────────────
  if (outboundFromEmail && from === outboundFromEmail.toLowerCase()) {
    return { allowed: false, reason: "Self-email from configured sender", category: "internal" };
  }

  // ── 2. Newsletter / bulk-mail headers (case-insensitive) ────────────────
  const listId = getHeader(email.headers, "list-id");
  const listUnsubscribe = getHeader(email.headers, "list-unsubscribe");
  const listUnsubscribePost = getHeader(email.headers, "list-unsubscribe-post");
  const precedence = getHeader(email.headers, "precedence")?.toLowerCase();
  const autoSubmitted = getHeader(email.headers, "auto-submitted")?.toLowerCase();
  const xAutoresponse = getHeader(email.headers, "x-autorespond");
  const feedbackId = getHeader(email.headers, "feedback-id");
  const xCampaign = getHeader(email.headers, "x-campaign") || getHeader(email.headers, "x-mailer-campaign");

  if (listId) {
    return { allowed: false, reason: "Has List-Id header", category: "newsletter" };
  }
  if (listUnsubscribe || listUnsubscribePost) {
    return { allowed: false, reason: "Has List-Unsubscribe header", category: "newsletter" };
  }
  if (precedence === "bulk" || precedence === "list" || precedence === "junk") {
    return { allowed: false, reason: `Precedence: ${precedence}`, category: "newsletter" };
  }
  if (autoSubmitted && autoSubmitted !== "no") {
    return { allowed: false, reason: `Auto-Submitted: ${autoSubmitted}`, category: "automated" };
  }
  if (xAutoresponse || feedbackId || xCampaign) {
    return { allowed: false, reason: "Campaign/autoresponse headers present", category: "newsletter" };
  }

  // ── 3. Body too short / empty ───────────────────────────────────────────
  if (body.length < 20) {
    return { allowed: false, reason: "Body too short", category: "automated" };
  }

  // ── 4. Blocked sender local-part / domain patterns ──────────────────────
  const blockedSenderPatterns = [
    "no-reply",
    "noreply",
    "donotreply",
    "do-not-reply",
    "do_not_reply",
    "mailer-daemon",
    "postmaster",
    "bounce@",
    "bounces@",
    "bounce-",
    "notifications@",
    "notification@",
    "newsletter@",
    "marketing@",
    "news@",
    "updates@",
    "digest@",
    "alerts@",
    "alert@",
    "invites@",
    "invitations@",
    // Known marketing/social domains
    "facebookmail.com",
    "mail.instagram.com",
    "linkedin.com",
    "email.linkedin.com",
    "linkedin@",
    "pinterest.com",
    "email.pinterest.com",
    "mail.pinterest.com",
    "youtube.com",
    "twitter.com",
    "x.com",
    "tiktok.com",
    "reddit.com",
    "slack.com",
    "meetup.com",
    "medium.com",
    "substack.com",
    "mailchimp.com",
    "mailchimpapp.com",
    "sendgrid.net",
    "amazonses.com",
    "mandrillapp.com",
    "mc.sendgrid.net",
    "klaviyomail.com",
    "hubspot.com",
    "customer.io",
    "intercom-mail.com",
    "intercom.io",
    "spotify.com",
    "netflix.com",
    "airbnb.com",
    "booking.com",
    "uber.com",
    "lyft.com",
    "stripe.com",
    "stripe.email",
    "paypal.com",
    "vercel.com",
    "supabase.com",
    "github.com",
    "notifications.gitlab.com",
    "atlassian.com",
    "zoom.us",
    "calendly.com",
    "shopify.com",
    "myshopify.com",
    "google.com",
    "accounts.google.com",
    "docs.google.com",
    "drive.google.com",
    "meta.com",
    "meta.mail",
    "discord.com",
    "whatsapp.com",
  ];

  if (includesAny(from, blockedSenderPatterns)) {
    return { allowed: false, reason: `Blocked sender pattern (${from})`, category: "automated" };
  }

  // Also check from-name for obvious marketing identifiers
  const blockedFromNamePatterns = [
    "linkedin",
    "pinterest",
    "instagram",
    "facebook",
    "twitter",
    "tiktok",
    "youtube",
    "spotify",
    "netflix",
    "substack",
    "medium daily digest",
    "notifications",
  ];
  if (fromName && includesAny(fromName, blockedFromNamePatterns)) {
    return { allowed: false, reason: `Blocked from-name (${fromName})`, category: "newsletter" };
  }

  // ── 5. Blocked subject patterns ─────────────────────────────────────────
  const blockedSubjectPatterns = [
    "receipt",
    "invoice",
    "password reset",
    "verify your email",
    "verify your account",
    "confirm your email",
    "confirm your account",
    "security alert",
    "welcome to",
    "thanks for signing up",
    "thank you for signing up",
    // Newsletter/digest/marketing tells
    "newsletter",
    "digest",
    "your weekly",
    "your daily",
    "this week on",
    "this week in",
    "recommended for you",
    "top picks",
    "trending",
    "you appeared in",
    "who viewed your",
    "new connection",
    "is hiring",
    "job alert",
    "deal of the day",
    "% off",
    "flash sale",
    "limited time",
    "exclusive offer",
    "don't miss",
    "last chance",
    "view your",
    // Dutch equivalents
    "verscheen in",
    "zoekopdrachten",
    "nieuwsbrief",
    "aanbieding",
    "korting",
    "laatste kans",
    "wachtwoord resetten",
    "bevestig je e-mail",
    "welkom bij",
    "bedankt voor je aanmelding",
    // Common marketing subject suffixes
    "is back in stock",
    "back in stock",
    "just for you",
    "guaranteed good taste",
    "gegarandeerd goede smaak",
    "could be your vibe",
    "kan jouw vibe zijn",
  ];

  if (includesAny(subject, blockedSubjectPatterns)) {
    return { allowed: false, reason: `Blocked subject pattern`, category: "newsletter" };
  }

  // ── 6. Blocked body / full-text patterns ────────────────────────────────
  const blockedBodyPatterns = [
    // Unsubscribe variants
    "unsubscribe",
    "opt out",
    "opt-out",
    "manage your preferences",
    "manage preferences",
    "email preferences",
    "uitschrijven",
    "afmelden",
    "voorkeuren beheren",
    "beheer je voorkeuren",
    "abmelden", // DE
    "désabonner", // FR
    "se désinscrire",
    "darse de baja", // ES
    // "View in browser" variants (EN/NL/DE/FR/ES/IT/PT)
    "view in browser",
    "view this email in your browser",
    "view this email in browser",
    "view online",
    "web version",
    "having trouble viewing",
    "in je browser",
    "in uw browser",
    "bekijk in browser",
    "in je webbrowser",
    "open de volgende url",
    "open deze e-mail in",
    "im browser ansehen",
    "im browser öffnen",
    "voir dans le navigateur",
    "ver en el navegador",
    // Campaign tracking URLs
    "/email/click",
    "/e/c/",
    "click.linkedin.com",
    "click.pinterest.com",
    "pinterest.com/email",
    "linkedin.com/comm/",
    "mandrillapp.com/track",
    "sendgrid.net/wf/click",
    "list-manage.com/track",
    "hubspotemail.net",
    "hsforms.com/click",
    "mailgun.org/c/",
    "mailgun.net/c/",
    "utm_source=",
    "utm_campaign=",
    "utm_medium=email",
    // Internal marketing jargon (unchanged from before)
    "promotion",
    "open rate",
    "deliverability",
    "warmup",
    // Common footer disclaimers of bulk mail
    "you are receiving this email because",
    "you received this email because",
    "je ontvangt deze e-mail omdat",
    "u ontvangt deze e-mail omdat",
    "this is an automated message",
    "this is a system-generated email",
    "do not reply to this email",
    "please do not reply",
    "reageer niet op deze e-mail",
  ];

  if (includesAny(fullText, blockedBodyPatterns)) {
    return { allowed: false, reason: "Marketing/newsletter markers", category: "newsletter" };
  }

  // ── 7. High-density URL / low-signal body heuristic ─────────────────────
  const urlMatches = body.match(/https?:\/\/[^\s)]+/g) ?? [];
  if (urlMatches.length >= 6) {
    return { allowed: false, reason: `Too many URLs (${urlMatches.length})`, category: "newsletter" };
  }
  // Any single very-long URL (>250 chars) is almost always tracking
  if (urlMatches.some((u) => u.length > 250)) {
    return { allowed: false, reason: "Long tracking URL present", category: "newsletter" };
  }

  return { allowed: true };
}
