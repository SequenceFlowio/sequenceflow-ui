import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Extract all RFC-822 Message-IDs referenced by one or more header strings.
 *
 * `In-Reply-To` and `References` headers use angle-bracketed IDs separated by
 * whitespace, e.g. `<abc@x> <def@y>`. We accept a few messy variants (missing
 * brackets, stray quotes) and return normalized `<...>` strings, deduplicated.
 */
export function extractMessageIds(...headers: Array<string | null | undefined>): string[] {
  const ids = new Set<string>();
  for (const raw of headers) {
    if (!raw) continue;
    const matches = raw.match(/<[^<>\s]+>/g);
    if (matches && matches.length > 0) {
      for (const m of matches) ids.add(m.trim());
      continue;
    }
    const trimmed = raw.trim();
    if (!trimmed) continue;
    ids.add(trimmed.startsWith("<") ? trimmed : `<${trimmed}>`);
  }
  return [...ids];
}

/**
 * Look up the existing `support_conversations.id` that an inbound reply belongs to.
 *
 * Matches on any `support_messages.internet_message_id` (inbound OR outbound)
 * that appears in the inbound email's `In-Reply-To` or `References` headers.
 *
 * Returns `null` if no match — caller should create a new conversation.
 */
export async function findExistingConversation(input: {
  tenantId: string;
  inReplyTo: string | null | undefined;
  references: string | null | undefined;
}): Promise<string | null> {
  const ids = extractMessageIds(input.inReplyTo, input.references);
  if (ids.length === 0) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("support_messages")
    .select("conversation_id, created_at")
    .eq("tenant_id", input.tenantId)
    .in("internet_message_id", ids)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("[findExistingConversation]", error);
    return null;
  }
  return data?.[0]?.conversation_id ?? null;
}
