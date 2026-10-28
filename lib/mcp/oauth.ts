import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  AUTH_CODE_TTL_MS,
  OAUTH_SCOPE,
  REFRESH_TOKEN_TTL_MS,
  isClientIdShape,
  newAccessToken,
  newAuthorizationCode,
  newClientId,
  newRefreshToken,
  sha256,
  verifyPkce,
  type ClientRegistration,
} from "@/lib/mcp/oauthCore";

/** OAuth storage for the MCP server; see migration 056 and lib/mcp/oauthCore.ts. */

export type OAuthClient = { client_id: string; client_name: string; redirect_uris: string[] };

export async function registerOAuthClient(registration: ClientRegistration) {
  const { data, error } = await getSupabaseAdmin().from("mcp_oauth_clients").insert({
    client_id: newClientId(),
    client_name: registration.clientName,
    redirect_uris: registration.redirectUris,
  }).select("client_id,client_name,redirect_uris,created_at").single();
  if (error) throw error;
  return data as OAuthClient & { created_at: string };
}

export async function loadOAuthClient(clientId: string): Promise<OAuthClient | null> {
  if (!isClientIdShape(clientId)) return null;
  const { data, error } = await getSupabaseAdmin().from("mcp_oauth_clients")
    .select("client_id,client_name,redirect_uris")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw error;
  return data as OAuthClient | null;
}

export async function createAuthorizationCode(input: {
  clientId: string;
  tenantId: string;
  userId: string | null;
  redirectUri: string;
  codeChallenge: string;
}) {
  const { code, codeHash } = newAuthorizationCode();
  const { error } = await getSupabaseAdmin().from("mcp_oauth_codes").insert({
    code_hash: codeHash,
    client_id: input.clientId,
    tenant_id: input.tenantId,
    user_id: input.userId,
    redirect_uri: input.redirectUri,
    code_challenge: input.codeChallenge,
    expires_at: new Date(Date.now() + AUTH_CODE_TTL_MS).toISOString(),
  });
  if (error) throw error;
  return code;
}

export type TokenResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
};

/** RFC 6749 error for the token endpoint. */
export class OAuthTokenError extends Error {
  constructor(readonly error: "invalid_request" | "invalid_grant" | "invalid_client" | "unsupported_grant_type", description: string) {
    super(description);
  }
}

async function issueAccessToken(grant: { id: string; tenant_id: string; client_id: string; user_id: string | null }, clientName: string) {
  const { token, tokenHash, tokenHint } = newAccessToken();
  const { error } = await getSupabaseAdmin().from("mcp_access_tokens").insert({
    tenant_id: grant.tenant_id,
    grant_id: grant.id,
    name: clientName,
    token_hash: tokenHash,
    token_hint: tokenHint,
    scopes: [OAUTH_SCOPE],
    created_by: grant.user_id,
    expires_at: new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString(),
  });
  if (error) throw error;
  return token;
}

export async function exchangeAuthorizationCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<TokenResponse> {
  const supabase = getSupabaseAdmin();
  // Single use, atomically: a replayed or late code gets nothing back.
  const { data: rows, error } = await supabase.from("mcp_oauth_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code_hash", sha256(input.code))
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("client_id,tenant_id,user_id,redirect_uri,code_challenge");
  if (error) throw error;
  const code = rows?.[0];
  if (!code || code.client_id !== input.clientId || code.redirect_uri !== input.redirectUri) {
    throw new OAuthTokenError("invalid_grant", "The authorization code is invalid, expired or already used.");
  }
  if (!verifyPkce(input.codeVerifier, code.code_challenge)) {
    throw new OAuthTokenError("invalid_grant", "PKCE verification failed.");
  }

  const client = await loadOAuthClient(code.client_id);
  if (!client) throw new OAuthTokenError("invalid_client", "Unknown client.");
  const refresh = newRefreshToken();
  const { data: grant, error: grantError } = await supabase.from("mcp_oauth_grants").insert({
    tenant_id: code.tenant_id,
    client_id: code.client_id,
    user_id: code.user_id,
    refresh_token_hash: refresh.tokenHash,
    refresh_expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString(),
    last_used_at: new Date().toISOString(),
  }).select("id,tenant_id,client_id,user_id").single();
  if (grantError) throw grantError;

  return {
    access_token: await issueAccessToken(grant, client.client_name),
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refresh.token,
    scope: OAUTH_SCOPE,
  };
}

export async function refreshAccessToken(input: { refreshToken: string; clientId: string }): Promise<TokenResponse> {
  const supabase = getSupabaseAdmin();
  const next = newRefreshToken();
  // Rotate in one statement: only the first caller with this refresh token wins.
  const { data: rows, error } = await supabase.from("mcp_oauth_grants")
    .update({
      refresh_token_hash: next.tokenHash,
      refresh_expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString(),
      last_used_at: new Date().toISOString(),
    })
    .eq("refresh_token_hash", sha256(input.refreshToken))
    .eq("client_id", input.clientId)
    .is("revoked_at", null)
    .gt("refresh_expires_at", new Date().toISOString())
    .select("id,tenant_id,client_id,user_id");
  if (error) throw error;
  const grant = rows?.[0];
  if (!grant) throw new OAuthTokenError("invalid_grant", "The refresh token is invalid, expired or revoked.");

  const client = await loadOAuthClient(grant.client_id);
  if (!client) throw new OAuthTokenError("invalid_client", "Unknown client.");
  return {
    access_token: await issueAccessToken(grant, client.client_name),
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: next.token,
    scope: OAUTH_SCOPE,
  };
}

export type McpGrantView = { id: string; appName: string; createdAt: string; lastUsedAt: string | null };

export async function listMcpGrants(tenantId: string): Promise<McpGrantView[]> {
  const { data, error } = await getSupabaseAdmin().from("mcp_oauth_grants")
    .select("id,created_at,last_used_at,mcp_oauth_clients(client_name)")
    .eq("tenant_id", tenantId)
    .is("revoked_at", null)
    .gt("refresh_expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const client = row.mcp_oauth_clients as { client_name?: string } | { client_name?: string }[] | null;
    const name = Array.isArray(client) ? client[0]?.client_name : client?.client_name;
    return { id: row.id, appName: name ?? "MCP client", createdAt: row.created_at, lastUsedAt: row.last_used_at };
  });
}

/** Ends an app's access at once: the grant and every access token it issued. */
export async function revokeMcpGrant(tenantId: string, grantId: string) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("mcp_oauth_grants")
    .update({ revoked_at: now })
    .eq("tenant_id", tenantId)
    .eq("id", grantId)
    .is("revoked_at", null)
    .select("id");
  if (error) throw error;
  if (!data?.length) return false;
  const { error: tokenError } = await supabase.from("mcp_access_tokens")
    .update({ revoked_at: now })
    .eq("tenant_id", tenantId)
    .eq("grant_id", grantId)
    .is("revoked_at", null);
  if (tokenError) throw tokenError;
  return true;
}
