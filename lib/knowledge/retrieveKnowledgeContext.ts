import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { createEmbedding } from "@/lib/embeddings";

type KnowledgeRow = {
  document_id: string;
  content: string;
  similarity: number | null;
};

export type KnowledgeMatch = {
  documentId: string;
  title: string;
  source: string | null;
  docType: string;
  content: string;
  similarity: number | null;
  shared: boolean;
};

async function findKnowledgeRows(tenantId: string, query: string, count: number): Promise<KnowledgeRow[]> {
  const supabase = getSupabaseAdmin();
  try {
    const embedding = await createEmbedding(query.slice(0, 4000));
    const { data, error } = await supabase.rpc("match_knowledge_chunks", {
      query_embedding: embedding,
      filter_client_id: tenantId,
      match_threshold: 0.2,
      match_count: count,
    });
    if (error) throw error;
    return (data ?? []).map((row: { document_id: string; content: string; similarity?: number }) => ({
      document_id: row.document_id,
      content: row.content,
      similarity: typeof row.similarity === "number" ? row.similarity : null,
    })).filter((row: KnowledgeRow) => Boolean(row.content));
  } catch (error) {
    console.warn("[knowledge] similarity retrieval failed, falling back to ready documents", error);
    const { data: readyDocs } = await supabase
      .from("knowledge_documents")
      .select("id")
      .eq("status", "ready")
      .or(`client_id.eq.${tenantId},client_id.is.null`);
    const ids = (readyDocs ?? []).map((row) => row.id);
    if (ids.length === 0) return [];
    const { data: rawChunks } = await supabase
      .from("knowledge_chunks")
      .select("document_id, content")
      .in("document_id", ids)
      .limit(count);
    return (rawChunks ?? []).map((row) => ({
      document_id: row.document_id,
      content: row.content,
      similarity: null,
    })).filter((row) => Boolean(row.content));
  }
}

export async function retrieveKnowledgeContext(tenantId: string, query: string): Promise<{
  used: boolean;
  context: string;
  chunks: number;
}> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { used: false, context: "", chunks: 0 };
  }
  const rows = await findKnowledgeRows(tenantId, trimmed, 8);
  return {
    used: rows.length > 0,
    context: rows.map((row) => row.content).join("\n\n---\n\n"),
    chunks: rows.length,
  };
}

export async function retrieveKnowledgeMatches(tenantId: string, query: string, count = 5): Promise<KnowledgeMatch[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const rows = await findKnowledgeRows(tenantId, trimmed, count);
  const documentIds = [...new Set(rows.map((row) => row.document_id))];
  if (documentIds.length === 0) return [];

  const { data: documents, error } = await getSupabaseAdmin()
    .from("knowledge_documents")
    .select("id, client_id, title, source, doc_type")
    .in("id", documentIds)
    .eq("status", "ready")
    .or(`client_id.eq.${tenantId},client_id.is.null`);
  if (error) throw new Error(error.message);

  const byId = new Map((documents ?? []).map((document) => [document.id, document]));
  return rows.flatMap((row) => {
    const document = byId.get(row.document_id);
    if (!document) return [];
    return [{
      documentId: row.document_id,
      title: document.title,
      source: document.source,
      docType: document.doc_type ?? "general",
      content: row.content,
      similarity: row.similarity,
      shared: document.client_id === null,
    }];
  });
}
