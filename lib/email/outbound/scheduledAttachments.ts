import type { SupabaseClient } from "@supabase/supabase-js";

import type { OutboundAttachment } from "@/lib/email/outbound/attachments";

const BUCKET = "scheduled-reply-attachments";

type ScheduledAttachmentRow = {
  storage_path: string;
  filename: string;
  content_type: string | null;
  byte_size: number;
};

type Owner = {
  tenantId: string;
  conversationId?: string | null;
  ticketId?: string | null;
};

function ownerFilter(supabase: SupabaseClient, owner: Owner) {
  let query = supabase
    .from("scheduled_reply_attachments")
    .select("storage_path")
    .eq("tenant_id", owner.tenantId);

  if (owner.conversationId) {
    query = query.eq("conversation_id", owner.conversationId);
  } else if (owner.ticketId) {
    query = query.eq("ticket_id", owner.ticketId);
  } else {
    throw new Error("Scheduled attachment owner is missing.");
  }

  return query;
}

function cleanFilename(name: string) {
  const cleaned = name.trim().replace(/[\\/\0]/g, "_");
  return cleaned || "attachment";
}

async function ensureBucket(supabase: SupabaseClient) {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (data) return;
  await supabase.storage.createBucket(BUCKET, { public: false });
}

export async function deleteScheduledAttachments(supabase: SupabaseClient, owner: Owner) {
  const { data: rows } = await ownerFilter(supabase, owner);
  const paths = (rows ?? []).map((row) => row.storage_path).filter(Boolean);

  if (paths.length > 0) {
    await supabase.storage.from(BUCKET).remove(paths);
  }

  let deleteQuery = supabase
    .from("scheduled_reply_attachments")
    .delete()
    .eq("tenant_id", owner.tenantId);

  if (owner.conversationId) {
    deleteQuery = deleteQuery.eq("conversation_id", owner.conversationId);
  } else if (owner.ticketId) {
    deleteQuery = deleteQuery.eq("ticket_id", owner.ticketId);
  }

  await deleteQuery;
}

export async function saveScheduledAttachments(
  supabase: SupabaseClient,
  owner: Owner,
  attachments: OutboundAttachment[],
) {
  await deleteScheduledAttachments(supabase, owner);
  if (attachments.length === 0) return;

  await ensureBucket(supabase);

  const ownerId = owner.conversationId ?? owner.ticketId;
  if (!ownerId) throw new Error("Scheduled attachment owner is missing.");

  const rows = [];
  for (const [index, attachment] of attachments.entries()) {
    const filename = cleanFilename(attachment.filename);
    const storagePath = `${owner.tenantId}/${ownerId}/${Date.now()}-${index}-${filename}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, attachment.content, {
        contentType: attachment.contentType ?? "application/octet-stream",
        upsert: false,
      });

    if (uploadError) throw new Error(uploadError.message);

    rows.push({
      tenant_id: owner.tenantId,
      conversation_id: owner.conversationId ?? null,
      ticket_id: owner.ticketId ?? null,
      storage_bucket: BUCKET,
      storage_path: storagePath,
      filename,
      content_type: attachment.contentType ?? null,
      byte_size: attachment.content.byteLength,
    });
  }

  const { error } = await supabase.from("scheduled_reply_attachments").insert(rows);
  if (error) throw new Error(error.message);
}

export async function loadScheduledAttachments(
  supabase: SupabaseClient,
  owner: Owner,
): Promise<OutboundAttachment[]> {
  let query = supabase
    .from("scheduled_reply_attachments")
    .select("storage_path, filename, content_type, byte_size")
    .eq("tenant_id", owner.tenantId)
    .order("created_at", { ascending: true });

  if (owner.conversationId) {
    query = query.eq("conversation_id", owner.conversationId);
  } else if (owner.ticketId) {
    query = query.eq("ticket_id", owner.ticketId);
  } else {
    throw new Error("Scheduled attachment owner is missing.");
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const attachments: OutboundAttachment[] = [];
  for (const row of (data ?? []) as ScheduledAttachmentRow[]) {
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(row.storage_path);
    if (downloadError) throw new Error(downloadError.message);

    attachments.push({
      filename: row.filename,
      content: Buffer.from(await fileData.arrayBuffer()),
      contentType: row.content_type ?? undefined,
    });
  }

  return attachments;
}
