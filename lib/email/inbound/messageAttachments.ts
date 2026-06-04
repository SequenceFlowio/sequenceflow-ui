import type { SupabaseClient } from "@supabase/supabase-js";

import type { MessageAttachmentView, NormalizedInboundAttachment } from "@/types/aiInbox";

const BUCKET = "inbound-message-attachments";
const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

type AttachmentRow = {
  id: string;
  message_id: string;
  storage_path: string;
  filename: string;
  content_type: string | null;
  byte_size: number | null;
};

function cleanFilename(name: string) {
  const cleaned = name.trim().replace(/[\\/\0]/g, "_");
  return cleaned || "attachment";
}

async function ensureBucket(supabase: SupabaseClient) {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (data) return;
  await supabase.storage.createBucket(BUCKET, { public: false });
}

export async function saveInboundMessageAttachments(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    conversationId: string;
    messageId: string;
    attachments: NormalizedInboundAttachment[] | null | undefined;
  },
) {
  const attachments = (input.attachments ?? [])
    .filter((attachment) => attachment.content?.byteLength > 0)
    .slice(0, MAX_ATTACHMENTS);
  if (attachments.length === 0) return;

  await ensureBucket(supabase);

  const rows = [];
  for (const [index, attachment] of attachments.entries()) {
    const filename = cleanFilename(attachment.filename);
    const content = Buffer.from(attachment.content);
    if (content.byteLength > MAX_ATTACHMENT_BYTES) {
      console.warn("[inbound-attachments] skipped oversized attachment", {
        messageId: input.messageId,
        filename,
        byteSize: content.byteLength,
      });
      continue;
    }

    const storagePath = `${input.tenantId}/${input.conversationId}/${input.messageId}/${Date.now()}-${index}-${filename}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, content, {
        contentType: attachment.contentType ?? "application/octet-stream",
        upsert: false,
      });

    if (uploadError) throw new Error(uploadError.message);

    rows.push({
      tenant_id: input.tenantId,
      message_id: input.messageId,
      storage_bucket: BUCKET,
      storage_path: storagePath,
      filename,
      content_type: attachment.contentType ?? null,
      byte_size: content.byteLength,
      content_id: attachment.contentId ?? null,
    });
  }

  if (rows.length === 0) return;
  const { error } = await supabase.from("inbound_message_attachments").insert(rows);
  if (error) throw new Error(error.message);
}

export async function loadMessageAttachmentViews(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    messageIds: string[];
  },
): Promise<Map<string, MessageAttachmentView[]>> {
  const result = new Map<string, MessageAttachmentView[]>();
  if (input.messageIds.length === 0) return result;

  const { data, error } = await supabase
    .from("inbound_message_attachments")
    .select("id, message_id, storage_path, filename, content_type, byte_size")
    .eq("tenant_id", input.tenantId)
    .in("message_id", input.messageIds)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[inbound-attachments/load]", error.message);
    return result;
  }

  for (const row of (data ?? []) as AttachmentRow[]) {
    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(row.storage_path, 60 * 60);
    if (!signed?.signedUrl) continue;

    const view: MessageAttachmentView = {
      id: row.id,
      filename: row.filename,
      contentType: row.content_type,
      byteSize: row.byte_size ?? 0,
      url: signed.signedUrl,
    };

    result.set(row.message_id, [...(result.get(row.message_id) ?? []), view]);
  }

  return result;
}

export async function deleteInboundAttachmentsForConversation(
  supabase: SupabaseClient,
  conversationId: string,
) {
  const { data: messages } = await supabase
    .from("support_messages")
    .select("id")
    .eq("conversation_id", conversationId);
  const messageIds = (messages ?? []).map((message) => message.id as string);
  if (messageIds.length === 0) return;

  const { data: rows } = await supabase
    .from("inbound_message_attachments")
    .select("storage_path")
    .in("message_id", messageIds);
  const paths = (rows ?? []).map((row) => row.storage_path as string).filter(Boolean);

  if (paths.length > 0) {
    await supabase.storage.from(BUCKET).remove(paths);
  }
}
