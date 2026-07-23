import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { summarizeKnowledgeDocuments } from "../lib/knowledge/status.ts";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("knowledge health prioritizes errors, processing, ready, and empty states", () => {
  assert.equal(summarizeKnowledgeDocuments([], 10).health, "empty");
  assert.equal(
    summarizeKnowledgeDocuments([{ status: "ready", client_id: "tenant-a" }], 10).health,
    "healthy"
  );
  assert.equal(
    summarizeKnowledgeDocuments([
      { status: "ready", client_id: "tenant-a" },
      { status: "pending", client_id: "tenant-a" },
    ], 10).health,
    "processing"
  );
  const summary = summarizeKnowledgeDocuments([
    { status: "ready", client_id: "tenant-a" },
    { status: "processing", client_id: null },
    { status: "error", client_id: "tenant-a" },
  ], 1);
  assert.equal(summary.health, "attention");
  assert.equal(summary.ready, 1);
  assert.equal(summary.processing, 1);
  assert.equal(summary.attention, 1);
  assert.equal(summary.shared, 1);
  assert.equal(summary.ownUsed, 1);
  assert.equal(summary.atLimit, true);
});

test("knowledge uploads and reindexing use the durable ingest queue", () => {
  const upload = source("app/api/knowledge/upload/route.ts");
  const reindex = source("app/api/knowledge/reindex/route.ts");
  const queue = source("lib/knowledge/queue.ts");
  const worker = source("app/api/knowledge/worker/route.ts");

  assert.match(upload, /enqueueKnowledgeIngest\(inserted\.id\)/);
  assert.doesNotMatch(upload, /import \{ processDocument \}|await processDocument\(/);
  assert.match(reindex, /enqueueKnowledgeIngest\(documentId\)/);
  assert.doesNotMatch(reindex, /import \{ processDocument \}|await processDocument\(/);
  assert.match(queue, /\.in\("status", \["pending", "processing"\]\)/);
  assert.match(worker, /job\.attempts < 3/);
  assert.match(worker, /status: retryable \? "pending" : "error"/);
  assert.match(worker, /if \(retryable\)[\s\S]+knowledge_documents[\s\S]+status: "pending"/);
});

test("knowledge management checks authorization and destructive API results", () => {
  const upload = source("app/api/knowledge/upload/route.ts");
  const reindex = source("app/api/knowledge/reindex/route.ts");
  const remove = source("app/api/knowledge/document/[id]/route.ts");
  const client = source("app/(app)/knowledge/KnowledgeClient.tsx");

  assert.match(upload, /requireRole\(context, \["admin"\]\)/);
  assert.match(reindex, /requireRole\(context, \["admin"\]\)/);
  assert.match(remove, /requireRole\(context, \["admin"\]\)/);
  assert.match(remove, /if \(storageError\)/);
  assert.match(remove, /\.eq\("client_id", tenantId\)/);
  assert.match(client, /if \(!response\.ok\) throw new Error\(await readApiError\(response, t\.knowledge\.deleteError\)\)/);
  assert.match(client, /const canManage = isAdmin && !shared/);
});

test("knowledge testing is tenant-bound and returns source metadata without full documents", () => {
  const route = source("app/api/knowledge/test/route.ts");
  const retrieval = source("lib/knowledge/retrieveKnowledgeContext.ts");

  assert.match(route, /tenantId = context\.tenantId/);
  assert.match(route, /query\.length < 3 \|\| query\.length > 500/);
  assert.match(route, /content: match\.content\.slice\(0, 600\)/);
  assert.match(retrieval, /filter_client_id: tenantId/);
  assert.match(retrieval, /\.select\("id, client_id, title, source, doc_type"\)/);
  assert.match(retrieval, /\.or\(`client_id\.eq\.\$\{tenantId\},client_id\.is\.null`\)/);
});
