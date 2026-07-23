import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { chunkText } from "../lib/chunkText.ts";
import {
  isKnowledgeMatchRelevant,
  KNOWLEDGE_CANDIDATE_THRESHOLD,
  KNOWLEDGE_SEMANTIC_THRESHOLD,
} from "../lib/knowledge/relevance.ts";
import { createKnowledgeSnippet } from "../lib/knowledge/snippet.ts";
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
  const queueMigration = source("supabase/migrations/042_repair_knowledge_ingest_queue.sql");

  assert.match(upload, /enqueueKnowledgeIngest\(inserted\.id\)/);
  assert.doesNotMatch(upload, /import \{ processDocument \}|await processDocument\(/);
  assert.match(reindex, /enqueueKnowledgeIngest\(documentId\)/);
  assert.doesNotMatch(reindex, /import \{ processDocument \}|await processDocument\(/);
  assert.match(queue, /\.in\("status", \["pending", "processing"\]\)/);
  assert.match(worker, /job\.attempts < 3/);
  assert.match(worker, /status: retryable \? "pending" : "error"/);
  assert.match(worker, /if \(retryable\)[\s\S]+knowledge_documents[\s\S]+status: "pending"/);
  assert.match(queueMigration, /create table if not exists public\.knowledge_ingest_jobs/);
  assert.match(queueMigration, /idx_knowledge_ingest_jobs_one_active/);
  assert.match(queueMigration, /enable row level security/);
  assert.match(queueMigration, /revoke all on table public\.knowledge_ingest_jobs from anon, authenticated/);
  assert.match(reindex, /Opnieuw verwerken is tijdelijk niet beschikbaar/);
  assert.doesNotMatch(reindex, /error:\s*getErrorMessage\(err\)/);
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
  assert.match(route, /strongestByDocument/);
  assert.match(retrieval, /filter_client_id: tenantId/);
  assert.equal(KNOWLEDGE_CANDIDATE_THRESHOLD, 0.35);
  assert.equal(KNOWLEDGE_SEMANTIC_THRESHOLD, 0.5);
  assert.doesNotMatch(retrieval, /falling back to ready documents/);
  assert.match(retrieval, /\.select\("id, client_id, title, source, doc_type"\)/);
  assert.match(retrieval, /\.or\(`client_id\.eq\.\$\{tenantId\},client_id\.is\.null`\)/);
});

test("knowledge retrieval accepts clear semantic and lexical matches without admitting noise", () => {
  const privacyDocument = { title: "Over ons privacybeleid.pdf", source: "privacybeleid.pdf" };

  assert.equal(
    isKnowledgeMatchRelevant(
      "Hoe zit het met privacy?",
      { similarity: 0.547, content: "Bij Noctis hechten we veel waarde aan uw privacy." },
      privacyDocument,
    ),
    true,
  );
  assert.equal(
    isKnowledgeMatchRelevant(
      "Welke privacy regels gebruiken jullie?",
      { similarity: 0.42, content: "Hier staan de rechten van betrokkenen." },
      privacyDocument,
    ),
    true,
  );
  assert.equal(
    isKnowledgeMatchRelevant(
      "Wanneer wordt mijn bestelling verzonden?",
      { similarity: 0.42, content: "Hier staan de rechten van betrokkenen." },
      privacyDocument,
    ),
    false,
  );
});

test("knowledge chunks keep readable sentence boundaries and snippets drop overlap fragments", () => {
  const text = [
    "Retouren kunnen binnen veertien dagen worden aangemeld. De klant ontvangt daarna instructies.",
    "Bestellingen worden normaal binnen twee werkdagen verzonden. Bij vertraging informeren we de klant.",
    "Een terugbetaling wordt na controle binnen vijf werkdagen verwerkt.",
  ].join("\n\n");
  const chunks = chunkText(text, 120, 30);

  assert.ok(chunks.length >= 2);
  assert.ok(chunks.every((chunk) => /^[A-Z]/.test(chunk)));
  assert.ok(chunks.every((chunk) => !/^\S{1,8}\s/.test(chunk) || chunk.includes(".")));

  const snippet = createKnowledgeSnippet(
    "innen 30 dagen geleverd. Indien er sprake is van vertraging, informeren we de klant direct.",
    true,
  );
  assert.equal(snippet, "Indien er sprake is van vertraging, informeren we de klant direct.");
});
