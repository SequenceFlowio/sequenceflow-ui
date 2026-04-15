import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { createEmbedding } from "@/lib/embeddings";

export async function retrieveKnowledgeContext(tenantId: string, query: string): Promise<{
  used: boolean;
  context: string;
  chunks: number;
}> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { used: false, context: "", chunks: 0 };
  }

  const supabase = getSupabaseAdmin();

  try {
    const embedding = await createEmbedding(trimmed.slice(0, 4000));
    const { data, error } = await supabase.rpc("match_knowledge_chunks", {
      query_embedding: embedding,
      filter_client_id: tenantId,
      match_threshold: 0.2,
      match_count: 8,
    });

    if (error) {
      throw error;
    }

    const chunks = (data ?? []).map((row: { content: string }) => row.content).filter(Boolean);
    return {
      used: chunks.length > 0,
      context: chunks.join("\n\n---\n\n"),
      chunks: chunks.length,
    };
  } catch (error) {
    console.warn("[knowledge] similarity retrieval failed, falling back to ready documents", error);

    const { data: readyDocs } = await supabase
      .from("knowledge_documents")
      .select("id")
      .eq("status", "ready")
      .or(`client_id.eq.${tenantId},client_id.is.null`);

    const ids = (readyDocs ?? []).map((row) => row.id);
    if (ids.length === 0) {
      return { used: false, context: "", chunks: 0 };
    }

    const { data: rawChunks } = await supabase
      .from("knowledge_chunks")
      .select("content")
      .in("document_id", ids)
      .limit(8);

    const chunks = (rawChunks ?? []).map((row) => row.content).filter(Boolean);
    return {
      used: chunks.length > 0,
      context: chunks.join("\n\n---\n\n"),
      chunks: chunks.length,
    };
  }
}
