/** Missing provenance must fail closed: a previous answer is not a new draft. */
export function isCurrentSupportDraft(
  decision: { source_message_id?: string | null } | null | undefined,
  latestInboundMessageId: string | null | undefined,
) {
  return Boolean(latestInboundMessageId && decision?.source_message_id === latestInboundMessageId);
}
