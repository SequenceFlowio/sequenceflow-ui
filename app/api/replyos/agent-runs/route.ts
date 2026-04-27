import { NextResponse } from "next/server";

import { getTenantId } from "@/lib/tenant";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { ReplyOSAgentRunSummary, ReplyOSAgentStep } from "@/lib/replyos/workApps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AgentRunRow = {
  id: string;
  conversation_id: string | null;
  work_app_id: string | null;
  status: ReplyOSAgentRunSummary["status"];
  objective: string;
  risk_level: ReplyOSAgentRunSummary["riskLevel"];
  runtime_provider: ReplyOSAgentRunSummary["runtimeProvider"] | null;
  current_url: string | null;
  final_answer: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
};

type AgentStepRow = {
  id: string;
  run_id: string;
  step_index: number;
  action_type: string;
  status: ReplyOSAgentStep["status"];
  url: string | null;
  summary: string;
  model_decision: string | null;
  screenshot_ref: string | null;
  safety_flags: unknown;
  duration_ms: number | null;
  created_at: string;
};

function mapRun(row: AgentRunRow): ReplyOSAgentRunSummary {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    workAppId: row.work_app_id,
    status: row.status,
    objective: row.objective,
    riskLevel: row.risk_level,
    runtimeProvider: row.runtime_provider ?? "browserbase_openai_cua",
    currentUrl: row.current_url,
    finalAnswer: row.final_answer,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStep(row: AgentStepRow): ReplyOSAgentStep {
  return {
    id: row.id,
    stepIndex: row.step_index,
    actionType: row.action_type,
    status: row.status,
    url: row.url,
    summary: row.summary,
    modelDecision: row.model_decision,
    screenshotRef: row.screenshot_ref,
    safetyFlags: Array.isArray(row.safety_flags) ? row.safety_flags : [],
    durationMs: row.duration_ms,
    createdAt: row.created_at,
  };
}

export async function GET(req: Request) {
  let tenantId: string;
  try {
    ({ tenantId } = await getTenantId(req));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Not authenticated";
    return NextResponse.json({ error: message }, { status: message === "Not authenticated" ? 401 : 403 });
  }

  const url = new URL(req.url);
  const conversationId = url.searchParams.get("conversationId");
  const includeSteps = url.searchParams.get("includeSteps") === "1";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 12) || 12, 50);

  let query = getSupabaseAdmin()
    .from("replyos_agent_runs")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (conversationId) query = query.eq("conversation_id", conversationId);

  const { data, error } = await query;
  if (error) {
    console.error("[replyos/agent-runs] GET failed:", error.message);
    return NextResponse.json({ error: "Failed to load agent runs" }, { status: 500 });
  }

  const runs = (data ?? []).map(mapRun);
  if (!includeSteps || runs.length === 0) {
    return NextResponse.json({ runs });
  }

  const runIds = runs.map((run) => run.id);
  const { data: steps, error: stepsError } = await getSupabaseAdmin()
    .from("replyos_agent_steps")
    .select("*")
    .eq("tenant_id", tenantId)
    .in("run_id", runIds)
    .order("step_index", { ascending: true });

  if (stepsError) {
    console.error("[replyos/agent-runs] steps GET failed:", stepsError.message);
    return NextResponse.json({ error: "Failed to load agent steps" }, { status: 500 });
  }

  const stepsByRun = new Map<string, ReplyOSAgentStep[]>();
  for (const step of steps ?? []) {
    const arr = stepsByRun.get(step.run_id) ?? [];
    arr.push(mapStep(step));
    stepsByRun.set(step.run_id, arr);
  }

  return NextResponse.json({
    runs: runs.map((run) => ({ ...run, steps: stepsByRun.get(run.id) ?? [] })),
  });
}
