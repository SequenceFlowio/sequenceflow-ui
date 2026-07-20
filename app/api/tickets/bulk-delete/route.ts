import { NextResponse } from "next/server";

import { deleteInboundAttachmentsForConversation } from "@/lib/email/inbound/messageAttachments";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let tenantId: string;
  try {
    ({ tenantId } = await getTenantId(req));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: message === "Not authenticated" ? 401 : 403 });
  }

  const { ids } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: conversations, error: conversationLookupError } = await supabase
    .from("support_conversations")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("status", "archived")
    .in("id", ids);

  if (conversationLookupError) {
    console.error("[bulk-delete] conversation lookup", conversationLookupError);
    return NextResponse.json({ error: conversationLookupError.message }, { status: 500 });
  }

  const conversationIds = (conversations ?? []).map((row) => row.id);

  if (conversationIds.length > 0) {
    for (const conversationId of conversationIds) {
      await deleteInboundAttachmentsForConversation(supabase, conversationId);
    }

    const [{ error: decisionsError }, { error: messagesError }] = await Promise.all([
      supabase.from("support_decisions").delete().in("conversation_id", conversationIds),
      supabase.from("support_messages").delete().in("conversation_id", conversationIds),
    ]);

    if (decisionsError || messagesError) {
      const error = decisionsError ?? messagesError;
      console.error("[bulk-delete] conversation children", error);
      return NextResponse.json({ error: error?.message ?? "Delete failed" }, { status: 500 });
    }
  }

  const { error: conversationsError, count: conversationsCount } = conversationIds.length
    ? await supabase
        .from("support_conversations")
        .delete({ count: "exact" })
        .eq("tenant_id", tenantId)
        .in("id", conversationIds)
    : { error: null, count: 0 };

  if (conversationsError) {
    console.error("[bulk-delete] conversations", conversationsError);
    return NextResponse.json({ error: conversationsError.message }, { status: 500 });
  }

  const { error, count } = await supabase
    .from("tickets")
    .delete({ count: "exact" })
    .eq("tenant_id", tenantId)
    .eq("status", "archived")
    .in("id", ids);

  if (error) {
    console.error("[bulk-delete]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: (count ?? 0) + (conversationsCount ?? 0) });
}
