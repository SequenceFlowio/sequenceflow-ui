/**
 * The subject a reply goes out with: "Re: " plus the customer's own subject,
 * so it lands in the same thread in their mailbox. The model's subject is only
 * a fallback when the customer's mail had none.
 */
export function asReplySubject(customerSubject: string | null | undefined) {
  const subject = (customerSubject ?? "").trim();
  if (!subject) return "";
  return /^re:/i.test(subject) ? subject : `Re: ${subject}`;
}

export function replySubject(customerSubject: string | null | undefined, draftSubject: string | null | undefined) {
  return asReplySubject(customerSubject) || (draftSubject ?? "").trim() || "Re:";
}
