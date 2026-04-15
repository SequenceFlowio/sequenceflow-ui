import type { NormalizedInboundEmail } from "@/types/aiInbox";

export type FilterResult =
  | { allowed: true }
  | { allowed: false; reason: string; category: "newsletter" | "spam" | "automated" | "internal" };

function includesAny(haystack: string, needles: string[]) {
  return needles.some((needle) => haystack.includes(needle));
}

export function filterInboundEmail(email: NormalizedInboundEmail, outboundFromEmail?: string | null): FilterResult {
  const subject = email.subject.toLowerCase().trim();
  const body = email.text.toLowerCase().trim();
  const from = email.from.email.toLowerCase().trim();
  const fullText = `${subject}\n${body}\n${Object.entries(email.headers).map(([key, value]) => `${key}:${value}`).join("\n")}`.toLowerCase();

  if (outboundFromEmail && from === outboundFromEmail.toLowerCase()) {
    return { allowed: false, reason: "Self-email from configured sender", category: "internal" };
  }

  if (email.headers["list-id"] || email.headers["List-Id"]) {
    return { allowed: false, reason: "Has List-Id header", category: "newsletter" };
  }

  if (body.length < 20) {
    return { allowed: false, reason: "Body too short", category: "automated" };
  }

  const blockedSenderPatterns = [
    "no-reply",
    "noreply",
    "donotreply",
    "do-not-reply",
    "mailer-daemon",
    "postmaster",
    "notifications@",
    "newsletter@",
    "facebookmail.com",
    "mail.instagram.com",
  ];

  if (includesAny(from, blockedSenderPatterns)) {
    return { allowed: false, reason: "Blocked sender pattern", category: "automated" };
  }

  const blockedSubjectPatterns = [
    "receipt",
    "invoice",
    "password reset",
    "verify your email",
    "security alert",
    "welcome to",
    "thanks for signing up",
  ];

  if (includesAny(subject, blockedSubjectPatterns)) {
    return { allowed: false, reason: "Blocked subject pattern", category: "automated" };
  }

  const blockedBodyPatterns = [
    "unsubscribe",
    "view in browser",
    "bekijk in browser",
    "promotion",
    "marketing",
    "open rate",
    "deliverability",
    "warmup",
  ];

  if (includesAny(fullText, blockedBodyPatterns)) {
    return { allowed: false, reason: "Marketing/newsletter markers", category: "newsletter" };
  }

  return { allowed: true };
}
