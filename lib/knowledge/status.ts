export type KnowledgeDocumentState = "pending" | "processing" | "ready" | "error";

export type KnowledgeHealth = "empty" | "healthy" | "processing" | "attention";

export type KnowledgeDocumentSummary = {
  health: KnowledgeHealth;
  ready: number;
  processing: number;
  attention: number;
  ownUsed: number;
  shared: number;
  total: number;
  limit: number | null;
  atLimit: boolean;
};

export function summarizeKnowledgeDocuments(
  documents: Array<{ status: KnowledgeDocumentState; client_id: string | null }>,
  limit: number | null
): KnowledgeDocumentSummary {
  const ready = documents.filter((document) => document.status === "ready").length;
  const processing = documents.filter(
    (document) => document.status === "pending" || document.status === "processing"
  ).length;
  const attention = documents.filter((document) => document.status === "error").length;
  const ownUsed = documents.filter(
    (document) => document.client_id !== null && document.status !== "error"
  ).length;
  const shared = documents.filter((document) => document.client_id === null).length;

  let health: KnowledgeHealth = "empty";
  if (attention > 0) health = "attention";
  else if (processing > 0) health = "processing";
  else if (ready > 0) health = "healthy";

  return {
    health,
    ready,
    processing,
    attention,
    ownUsed,
    shared,
    total: documents.length,
    limit,
    atLimit: limit !== null && ownUsed >= limit,
  };
}
