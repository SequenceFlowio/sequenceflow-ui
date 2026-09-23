import { NextResponse } from "next/server";

import { authorizationErrorResponse } from "@/lib/auth/authorization";
import { KnowledgeRetrievalUnavailableError, retrieveKnowledgeMatches } from "@/lib/knowledge/retrieveKnowledgeContext";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let tenantId: string;
  try {
    const context = await getTenantId(req);
    tenantId = context.tenantId;
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  try {
    const body = await req.json().catch(() => ({})) as { query?: unknown };
    const query = String(body.query ?? "").trim();
    if (query.length < 3 || query.length > 500) {
      return NextResponse.json({ ok: false, error: "Use a question between 3 and 500 characters." }, { status: 400 });
    }

    const matches = await retrieveKnowledgeMatches(tenantId, query, 12);
    const strongestByDocument = new Map<string, (typeof matches)[number]>();
    for (const match of matches) {
      if (!strongestByDocument.has(match.documentId)) strongestByDocument.set(match.documentId, match);
    }
    return NextResponse.json({
      ok: true,
      matches: [...strongestByDocument.values()].slice(0, 5),
    });
  } catch (error) {
    if (error instanceof KnowledgeRetrievalUnavailableError) {
      return NextResponse.json({ ok: false, code: error.issue, error: error.message }, { status: 503 });
    }
    console.error("[knowledge/test]", error);
    return NextResponse.json({ ok: false, error: "Knowledge test failed." }, { status: 500 });
  }
}
