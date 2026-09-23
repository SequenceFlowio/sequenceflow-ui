import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { createEmbedding } from "@/lib/embeddings";
import {
  isKnowledgeMatchRelevant,
  KNOWLEDGE_CANDIDATE_THRESHOLD,
} from "@/lib/knowledge/relevance";
import { createKnowledgeSnippet } from "@/lib/knowledge/snippet";
import { classifyAiProviderIssue, type AiProviderIssue } from "@/lib/ai/providerAvailability";

type KnowledgeRow = {
  document_id: string;
  chunk_index: number;
  content: string;
  similarity: number | null;
};

type KnowledgeDocument = {
  id: string;
  client_id: string | null;
  title: string;
  source: string | null;
  doc_type: string | null;
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

export class KnowledgeRetrievalUnavailableError extends Error {
  constructor(public readonly issue: AiProviderIssue | "database" | "unknown") {
    super("Knowledge retrieval is temporarily unavailable.");
    this.name = "KnowledgeRetrievalUnavailableError";
  }
}

async function findKnowledgeRows(
  tenantId: string,
  query: string,
  count: number,
): Promise<KnowledgeRow[]> {
  const supabase = getSupabaseAdmin();
  try {
    const embedding = await createEmbedding(query.slice(0, 4000));
    const { data, error } = await supabase.rpc("match_knowledge_chunks", {
      query_embedding: embedding,
      filter_client_id: tenantId,
      match_threshold: KNOWLEDGE_CANDIDATE_THRESHOLD,
      match_count: Math.min(Math.max(count * 4, 24), 50),
    });
    if (error) throw error;
    return (data ?? []).map((row: { document_id: string; chunk_index?: number; content: string; similarity?: number }) => ({
      document_id: row.document_id,
      chunk_index: Number(row.chunk_index ?? 0),
      content: row.content,
      similarity: typeof row.similarity === "number" ? row.similarity : null,
    })).filter((row: KnowledgeRow) => Boolean(row.content));
  } catch (error) {
    console.error("[knowledge] similarity retrieval failed", error);
    throw new KnowledgeRetrievalUnavailableError(classifyAiProviderIssue(error) ?? "unknown");
  }
}

async function findRelevantKnowledgeRows(
  tenantId: string,
  query: string,
  count: number,
) {
  const rows = await findKnowledgeRows(tenantId, query, count);
  const documentIds = [...new Set(rows.map((row) => row.document_id))];
  if (documentIds.length === 0) {
    return [] as Array<{ row: KnowledgeRow; document: KnowledgeDocument }>;
  }

  const { data: documents, error } = await getSupabaseAdmin()
    .from("knowledge_documents")
    .select("id, client_id, title, source, doc_type")
    .in("id", documentIds)
    .eq("status", "ready")
    .or(`client_id.eq.${tenantId},client_id.is.null`);
  if (error) {
    console.error("[knowledge] document metadata retrieval failed", error);
    throw new KnowledgeRetrievalUnavailableError("database");
  }

  const byId = new Map(
    ((documents ?? []) as KnowledgeDocument[]).map((document) => [document.id, document]),
  );
  return rows.flatMap((row) => {
    const document = byId.get(row.document_id);
    if (!document || !isKnowledgeMatchRelevant(query, row, document)) return [];
    return [{ row, document }];
  }).slice(0, count);
}

export async function retrieveKnowledgeContext(tenantId: string, query: string): Promise<{
  used: boolean;
  context: string;
  chunks: number;
  available: boolean;
}> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { used: false, context: "", chunks: 0, available: true };
  }
  try {
    const matches = await findRelevantKnowledgeRows(tenantId, trimmed, 8);
    return {
      used: matches.length > 0,
      context: matches.map(({ row }) => row.content).join("\n\n---\n\n"),
      chunks: matches.length,
      available: true,
    };
  } catch {
    // Draft generation may continue, but the pipeline must require review.
    return { used: false, context: "", chunks: 0, available: false };
  }
}

export async function retrieveKnowledgeMatches(tenantId: string, query: string, count = 5): Promise<KnowledgeMatch[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const matches = await findRelevantKnowledgeRows(tenantId, trimmed, count);
  return matches.map(({ row, document }) => ({
      documentId: row.document_id,
      title: document.title,
      source: document.source,
      docType: document.doc_type ?? "general",
      content: createKnowledgeSnippet(row.content, row.chunk_index > 0),
      similarity: row.similarity,
      shared: document.client_id === null,
  }));
}
