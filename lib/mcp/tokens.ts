import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { hashMcpToken, newMcpToken } from "@/lib/mcp/core";

/** Access keys for the MCP server. Only hashes are stored; see migration 056. */

export const MCP_MAX_ACTIVE_TOKENS = 10;

export type McpTokenView = {
  id: string;
  name: string;
  hint: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
};

type TokenRow = {
  id: string;
  name: string;
  token_hint: string;
  scopes: string[] | null;
  created_at: string;
  last_used_at: string | null;
};

function view(row: TokenRow): McpTokenView {
  return {
    id: row.id,
    name: row.name,
    hint: row.token_hint,
    scopes: row.scopes ?? ["read"],
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  };
}

export async function listMcpTokens(tenantId: string) {
  const { data, error } = await getSupabaseAdmin().from("mcp_access_tokens")
    .select("id,name,token_hint,scopes,created_at,last_used_at")
    .eq("tenant_id", tenantId)
    .is("grant_id", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as TokenRow[] ?? []).map(view);
}

export class McpTokenLimitError extends Error {}

export async function createMcpToken(input: { tenantId: string; userId: string | null; name: string }) {
  const supabase = getSupabaseAdmin();
  const { count, error: countError } = await supabase.from("mcp_access_tokens")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", input.tenantId)
    .is("grant_id", null)
    .is("revoked_at", null);
  if (countError) throw countError;
  if ((count ?? 0) >= MCP_MAX_ACTIVE_TOKENS) throw new McpTokenLimitError("Too many active keys.");

  const { token, tokenHash, tokenHint } = newMcpToken();
  const { data, error } = await supabase.from("mcp_access_tokens").insert({
    tenant_id: input.tenantId,
    name: input.name,
    token_hash: tokenHash,
    token_hint: tokenHint,
    scopes: ["read"],
    created_by: input.userId,
  }).select("id,name,token_hint,scopes,created_at,last_used_at").single();
  if (error) throw error;
  return { token, key: view(data as TokenRow) };
}

export async function revokeMcpToken(tenantId: string, id: string) {
  const { data, error } = await getSupabaseAdmin().from("mcp_access_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .is("grant_id", null)
    .is("revoked_at", null)
    .select("id");
  if (error) throw error;
  return Boolean(data?.length);
}

export type McpCaller = { tenantId: string; tokenId: string; scopes: string[] };

/** The tenant behind an access key or OAuth access token, or null when it is unknown, revoked or expired. */
export async function authenticateMcpToken(token: string): Promise<McpCaller | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("mcp_access_tokens")
    .select("id,tenant_id,scopes,last_used_at")
    .eq("token_hash", hashMcpToken(token))
    .is("revoked_at", null)
    .or(`expires_at.is.null,expires_at.gt."${new Date().toISOString()}"`)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  // At most one write per minute per key; MCP clients call in bursts.
  const lastUsed = data.last_used_at ? Date.parse(data.last_used_at) : 0;
  if (Date.now() - lastUsed > 60_000) {
    await supabase.from("mcp_access_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  }
  return { tenantId: data.tenant_id as string, tokenId: data.id as string, scopes: (data.scopes as string[] | null) ?? ["read"] };
}
