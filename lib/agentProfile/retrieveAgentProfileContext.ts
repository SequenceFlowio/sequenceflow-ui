import { createEmbedding } from "@/lib/embeddings";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Fase 2 of Agent DNA: assemble the per-tenant profile block for the decision
 * prompt. Only an ACTIVE profile and APPROVED items ever reach the prompt —
 * the white-glove review on /agent-profile is the gate.
 *
 * House rules are always-on constraints (all approved ones, capped). Facts and
 * exemplars are retrieved by embedding similarity against the customer's
 * question via the match_profile_facts RPC.
 */
export async function retrieveAgentProfileContext(
  tenantId: string,
  query: string,
): Promise<{ used: boolean; context: string }> {
  const supabase = getSupabaseAdmin();

  const { data: profile } = await supabase
    .from("tenant_agent_profile")
    .select("status, identity, voice_notes")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .maybeSingle();
  if (!profile) return { used: false, context: "" };

  const identity = (profile.identity ?? {}) as {
    greeting?: string;
    signoff?: string;
    pronoun?: string;
    company_descriptor?: string;
  };

  const { data: houseRules } = await supabase
    .from("tenant_profile_facts")
    .select("content")
    .eq("tenant_id", tenantId)
    .eq("kind", "house_rule")
    .eq("status", "approved")
    .order("confidence", { ascending: false, nullsFirst: false })
    .limit(25);

  let matchedFacts: Array<{ kind: string; content: string }> = [];
  try {
    const embedding = await createEmbedding(query.slice(0, 4000));
    const { data } = await supabase.rpc("match_profile_facts", {
      query_embedding: embedding,
      filter_tenant_id: tenantId,
      match_threshold: 0.2,
      match_count: 10,
    });
    matchedFacts = (data ?? []) as Array<{ kind: string; content: string }>;
  } catch (error) {
    // Retrieval is an enhancement — a failure here must never block drafting.
    console.error("[agent-profile] fact retrieval failed:", error);
  }

  const facts = matchedFacts.filter((row) => row.kind === "fact").slice(0, 6);
  const exemplars = matchedFacts.filter((row) => row.kind === "exemplar").slice(0, 2);

  const lines: string[] = [];
  lines.push("AGENT PROFILE — mined from this business's own support history and human-approved.");
  lines.push("This section overrides the generic tone settings above.");
  lines.push("");
  lines.push("IDENTITY & VOICE");
  if (identity.company_descriptor) lines.push(`- Business: ${identity.company_descriptor}`);
  if (identity.greeting) lines.push(`- Start the draft with their greeting style: "${identity.greeting}" (fill in the customer's first name when known).`);
  if (identity.pronoun) lines.push(`- Dutch form of address: ${identity.pronoun}.`);
  lines.push("- Do NOT add a sign-off; the application appends their signature automatically.");
  if (profile.voice_notes) lines.push(`- Voice: ${profile.voice_notes}`);
  lines.push("- Write at a professional standard: their historical replies may be brief or rough — keep their knowledge and warmth, improve the craft.");

  if (houseRules?.length) {
    lines.push("");
    lines.push("HOUSE RULES — hard constraints, never violate:");
    for (const rule of houseRules) lines.push(`- ${rule.content}`);
  }

  if (facts.length) {
    lines.push("");
    lines.push("BUSINESS FACTS — verified from their own replies; prefer these over guessing:");
    for (const fact of facts) lines.push(`- ${fact.content}`);
  }

  if (exemplars.length) {
    lines.push("");
    lines.push("EXAMPLE ANSWERS from their history — match the approach and content, not the flaws:");
    for (const exemplar of exemplars) lines.push(exemplar.content, "---");
  }

  return { used: true, context: lines.join("\n") };
}
