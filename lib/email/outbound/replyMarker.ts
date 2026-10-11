/**
 * Every reply Support One sends carries this header. When such a reply lands
 * in a mailbox that is itself connected to Support One (a customer who also
 * uses it, or a test mailbox that forwards), it may never be answered
 * automatically: otherwise two assistants answer each other in a loop.
 */
export const REPLY_MARKER_HEADER = "X-SequenceFlow-Reply";
export const REPLY_MARKER_HEADERS: Record<string, string> = { [REPLY_MARKER_HEADER]: "1" };

export function isSupportOneReply(headers: Record<string, string> | null | undefined) {
  const wanted = REPLY_MARKER_HEADER.toLowerCase();
  return Object.keys(headers ?? {}).some((key) => key.toLowerCase() === wanted);
}
