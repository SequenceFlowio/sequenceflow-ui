import { getSupabaseClient } from "@/lib/supabase";
import { chunkText } from "@/lib/chunkText";
import { createEmbedding } from "@/lib/embeddings";

type PdfParse = (buffer: Buffer, options?: Record<string, unknown>) => Promise<{ text?: string | null }>;
type PdfTextItem = {
  str?: unknown;
  transform?: unknown;
};
type PdfPage = {
  getTextContent(options?: Record<string, unknown>): Promise<{ items?: PdfTextItem[] }>;
};
type PdfDocument = {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPage>;
  destroy(): void | Promise<void>;
};
type PdfJsModule = {
  getDocument(input: Record<string, unknown>): { promise: Promise<PdfDocument> };
  GlobalWorkerOptions?: { workerSrc?: string | null };
};

function normalizeExtractedText(text: string | null | undefined) {
  return String(text ?? "")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isPdfStructureError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("xref") ||
    message.includes("invalid pdf") ||
    message.includes("invalid pdf structure") ||
    message.includes("bad xref entry")
  );
}

async function loadPdfParse(): Promise<PdfParse> {
  // Import the internal implementation directly to bypass index.js which tries
  // to load a test PDF at module evaluation time (breaks Next.js build).
  const mod = await import("pdf-parse/lib/pdf-parse.js");
  const maybeParser = (mod as { default?: unknown })?.default ?? mod;
  if (typeof maybeParser !== "function") {
    throw new Error("PDF parser could not be loaded.");
  }
  return maybeParser as PdfParse;
}

async function extractPdfTextWithPdfJs(buffer: Buffer): Promise<string> {
  const mod = await import("pdf-parse/lib/pdf.js/v2.0.550/build/pdf.js");
  const pdfjs = (mod as { default?: unknown }).default ?? mod;
  const api = pdfjs as PdfJsModule;

  if (!api || typeof api.getDocument !== "function") {
    throw new Error("Fallback PDF parser could not be loaded.");
  }

  if (api.GlobalWorkerOptions) {
    api.GlobalWorkerOptions.workerSrc = null;
  }

  const loadingTask = api.getDocument({
    data: new Uint8Array(buffer),
    stopAtErrors: false,
    disableWorker: true,
    isEvalSupported: false,
  });
  const doc = await loadingTask.promise;

  try {
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const textContent = await page.getTextContent({
        normalizeWhitespace: true,
        disableCombineTextItems: false,
      });
      let lastY: number | null = null;
      let pageText = "";

      for (const item of textContent.items ?? []) {
        const str = typeof item.str === "string" ? item.str : "";
        if (!str) continue;
        const transform = Array.isArray(item.transform) ? item.transform : [];
        const y = typeof transform[5] === "number" ? transform[5] : null;

        if (lastY === null || y === null || Math.abs(y - lastY) < 0.1) {
          pageText += str;
        } else {
          pageText += `\n${str}`;
        }
        lastY = y;
      }

      pages.push(pageText);
    }

    return normalizeExtractedText(pages.join("\n\n"));
  } finally {
    await doc.destroy();
  }
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const parse = await loadPdfParse();
  const attempts: Array<{ label: string; options: Record<string, unknown> }> = [
    { label: "pdf.js v1", options: {} },
    // Some merchant/platform PDFs contain malformed XRef tables that the
    // default pdf.js 1.10 build rejects. pdf-parse bundles v2.0.550 too, which
    // is more forgiving for these files and still works in our Node runtime.
    { label: "pdf.js v2 tolerant", options: { version: "v2.0.550", ignoreErrors: true } },
    { label: "pdf.js v1.9 tolerant", options: { version: "v1.9.426", ignoreErrors: true } },
  ];

  const errors: string[] = [];

  for (const attempt of attempts) {
    try {
      const data = await parse(buffer, attempt.options);
      const text = normalizeExtractedText(data.text);
      if (text) return text;
      errors.push(`${attempt.label}: no readable text`);
    } catch (error) {
      const message = getErrorMessage(error);
      errors.push(`${attempt.label}: ${message}`);
      if (!isPdfStructureError(error)) {
        break;
      }
    }
  }

  try {
    const text = await extractPdfTextWithPdfJs(buffer);
    if (text) return text;
    errors.push("pdf.js v2 direct: no readable text");
  } catch (error) {
    errors.push(`pdf.js v2 direct: ${getErrorMessage(error)}`);
  }

  throw new Error(
    `PDF text extraction failed. Try exporting or printing the PDF to a new PDF and uploading that version. Details: ${errors.join(" | ")}`
  );
}

// ─── Text extraction ───────────────────────────────────────────────────────────
async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === "application/pdf") {
    return extractPdfText(buffer);
  }
  // TXT / MD / CSV — read as UTF-8
  return buffer.toString("utf8");
}

// ─── processDocument ──────────────────────────────────────────────────────────
// Fetches document metadata, downloads the file from storage, extracts text,
// chunks it, generates embeddings, inserts chunks, and updates document status.
// Pass `fileBuffer` for fresh uploads to skip the storage download step.
export async function processDocument(
  documentId: string,
  fileBuffer?: Buffer
): Promise<void> {
  const supabase = getSupabaseClient();

  const { data: doc, error: docError } = await supabase
    .from("knowledge_documents")
    .select("*")
    .eq("id", documentId)
    .single();

  if (docError || !doc) {
    throw new Error("Document not found: " + (docError?.message ?? documentId));
  }

  // Mark as processing
  await supabase
    .from("knowledge_documents")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", documentId);

  try {
    let buffer: Buffer;

    if (fileBuffer) {
      buffer = fileBuffer;
    } else {
      // Download from Supabase Storage
      const storagePath = `${doc.client_id ?? "platform"}/${documentId}/${doc.source}`;
      const { data: fileData, error: dlErr } = await supabase.storage
        .from("knowledge-uploads")
        .download(storagePath);

      if (dlErr || !fileData) {
        throw new Error("Failed to download file: " + (dlErr?.message ?? "unknown"));
      }

      buffer = Buffer.from(await fileData.arrayBuffer());
    }

    const text = await extractText(buffer, doc.mime_type ?? "text/plain");

    if (!text.trim()) {
      throw new Error("No text could be extracted from the document.");
    }

    // Remove old chunks before (re)indexing
    await supabase.from("knowledge_chunks").delete().eq("document_id", documentId);

    const chunks = chunkText(text, 1000, 200);

    for (let i = 0; i < chunks.length; i++) {
      const embedding = await createEmbedding(chunks[i]);

      const { error: insertErr } = await supabase.from("knowledge_chunks").insert({
        document_id: documentId,
        client_id: doc.client_id,
        type: doc.type,
        chunk_index: i,
        content: chunks[i],
        embedding: JSON.stringify(embedding),
      });

      if (insertErr) {
        throw new Error(`Failed to insert chunk ${i}: ${insertErr.message}`);
      }
    }

    await supabase
      .from("knowledge_documents")
      .update({
        status: "ready",
        chunk_count: chunks.length,
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    console.log(
      `[processDocument] document=${documentId} type=${doc.type} chunks=${chunks.length} status=ready`
    );
  } catch (err: unknown) {
    const msg = getErrorMessage(err);

    await supabase
      .from("knowledge_documents")
      .update({
        status: "error",
        error: msg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    throw err;
  }
}
