export type OutboundAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type ParsedDraftSendRequest = {
  draftBody: string;
  attachments: OutboundAttachment[];
};

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

function cleanFilename(name: string) {
  const cleaned = name.trim().replace(/[\\/\0]/g, "_");
  return cleaned || "attachment";
}

function isFileLike(value: FormDataEntryValue): value is File {
  return typeof value === "object" && "arrayBuffer" in value && "name" in value && "size" in value;
}

export async function parseDraftSendRequest(req: Request): Promise<ParsedDraftSendRequest> {
  const contentType = req.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    try {
      const body = await req.json() as { draftBody?: unknown };
      return { draftBody: String(body.draftBody ?? "").trim(), attachments: [] };
    } catch {
      return { draftBody: "", attachments: [] };
    }
  }

  const formData = await req.formData();
  const draftBody = String(formData.get("draftBody") ?? "").trim();
  const files = formData.getAll("attachments").filter(isFileLike);

  if (files.length > MAX_ATTACHMENTS) {
    throw new Error(`Attach up to ${MAX_ATTACHMENTS} files.`);
  }

  let totalBytes = 0;
  const attachments: OutboundAttachment[] = [];

  for (const file of files) {
    if (file.size === 0) continue;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new Error(`${file.name || "Attachment"} is larger than 10 MB.`);
    }
    totalBytes += file.size;
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new Error("Attachments are larger than 20 MB in total.");
    }

    attachments.push({
      filename: cleanFilename(file.name),
      content: Buffer.from(await file.arrayBuffer()),
      contentType: file.type || undefined,
    });
  }

  return { draftBody, attachments };
}
