import crypto from "node:crypto";

import { MCP_TOKEN_PREFIX, mcpTokenHint } from "./core.ts";

/**
 * Pure helpers for signing in to the MCP server with OAuth 2.1 (authorization
 * code + PKCE, dynamic client registration), which is what claude.ai and
 * ChatGPT connectors use. No network or database here.
 */

export const MCP_PATH = "/api/mcp";
export const OAUTH_PATHS = {
  authorize: "/oauth/authorize",
  approve: "/api/mcp/oauth/authorize",
  token: "/api/mcp/oauth/token",
  register: "/api/mcp/oauth/register",
} as const;
export const OAUTH_SCOPE = "read";
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const REFRESH_TOKEN_TTL_MS = 60 * 24 * 60 * 60 * 1000;
export const AUTH_CODE_TTL_MS = 5 * 60 * 1000;

const REFRESH_PREFIX = "sfmcr_";
const CODE_PREFIX = "sfmcc_";
const CLIENT_PREFIX = "sfmcp-client-";
const MAX_REDIRECT_URIS = 10;
const MAX_URI_LENGTH = 2_000;

function secret(prefix: string) {
  return `${prefix}${crypto.randomBytes(32).toString("base64url")}`;
}

/** Metadata, registration, token and MCP calls carry no cookies, so any origin may make them. */
export const PUBLIC_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id",
  "Access-Control-Expose-Headers": "WWW-Authenticate",
  "Access-Control-Max-Age": "86400",
};

export function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function newAccessToken() {
  const token = secret(MCP_TOKEN_PREFIX);
  return { token, tokenHash: sha256(token), tokenHint: mcpTokenHint(token) };
}

export function newRefreshToken() {
  const token = secret(REFRESH_PREFIX);
  return { token, tokenHash: sha256(token) };
}

export function newAuthorizationCode() {
  const code = secret(CODE_PREFIX);
  return { code, codeHash: sha256(code) };
}

export function newClientId() {
  return `${CLIENT_PREFIX}${crypto.randomBytes(16).toString("hex")}`;
}

export function isClientIdShape(value: string) {
  return /^sfmcp-client-[0-9a-f]{32}$/.test(value);
}

// ── Metadata (RFC 9728, RFC 8414) ───────────────────────────────────────────

export function mcpResource(origin: string) {
  return `${origin}${MCP_PATH}`;
}

export function protectedResourceMetadataUrl(origin: string) {
  return `${origin}/.well-known/oauth-protected-resource${MCP_PATH}`;
}

export function protectedResourceMetadata(origin: string) {
  return {
    resource: mcpResource(origin),
    authorization_servers: [origin],
    scopes_supported: [OAUTH_SCOPE],
    bearer_methods_supported: ["header"],
    resource_name: "SequenceFlow Support One",
  };
}

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}${OAUTH_PATHS.authorize}`,
    token_endpoint: `${origin}${OAUTH_PATHS.token}`,
    registration_endpoint: `${origin}${OAUTH_PATHS.register}`,
    scopes_supported: [OAUTH_SCOPE],
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
  };
}

// ── Client registration (RFC 7591) ──────────────────────────────────────────

/**
 * Redirect URIs must be https, or http on the user's own machine (Claude
 * Code, Claude Desktop, MCP Inspector). No fragments, no credentials.
 */
export function isAllowedRedirectUri(value: string) {
  if (value.length > MAX_URI_LENGTH) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.hash || url.username || url.password) return false;
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}

/**
 * CSP for the consent page. Browsers apply `form-action` to the redirect that
 * follows the form post too, so the app's return address must be allowed or
 * Allow/Deny silently does nothing. The approve route still checks that
 * address against the registered client.
 */
export function consentPageCsp(redirectUri: string | null, devScript = "") {
  const returnOrigin = redirectUri && isAllowedRedirectUri(redirectUri) ? ` ${new URL(redirectUri).origin}` : "";
  return [
    "default-src 'self'", "base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'",
    `script-src 'self' 'unsafe-inline'${devScript}`, "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:", "font-src 'self' data:", "connect-src 'self'",
    `form-action 'self'${returnOrigin}`, "upgrade-insecure-requests",
  ].join("; ");
}

export type ClientRegistration = { clientName: string; redirectUris: string[] };

export function parseClientRegistration(body: unknown): ClientRegistration | { error: string; description: string } {
  const input = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  const uris = Array.isArray(input.redirect_uris) ? input.redirect_uris : [];
  if (!uris.length || uris.length > MAX_REDIRECT_URIS || !uris.every((uri) => typeof uri === "string" && isAllowedRedirectUri(uri))) {
    return { error: "invalid_redirect_uri", description: "Provide 1 to 10 redirect URIs using https, or http on localhost." };
  }
  const method = input.token_endpoint_auth_method;
  if (method !== undefined && method !== "none") {
    return { error: "invalid_client_metadata", description: "Only public clients (token_endpoint_auth_method \"none\") are supported." };
  }
  const grantTypes = Array.isArray(input.grant_types) ? input.grant_types : ["authorization_code"];
  if (!grantTypes.every((type) => type === "authorization_code" || type === "refresh_token")) {
    return { error: "invalid_client_metadata", description: "Supported grant types: authorization_code, refresh_token." };
  }
  const rawName = typeof input.client_name === "string" ? input.client_name.replace(/\s+/g, " ").trim() : "";
  return { clientName: rawName.slice(0, 120) || "MCP client", redirectUris: [...new Set(uris as string[])] };
}

// ── Authorization request ───────────────────────────────────────────────────

export type AuthorizationRequest = {
  clientId: string;
  redirectUri: string;
  state: string | null;
  codeChallenge: string;
};

export type AuthorizationRequestError = {
  /** Safe to send back to redirect_uri; otherwise show it on our own page. */
  redirectable: boolean;
  error: string;
  description: string;
};

/**
 * Checks an authorization request against the registered client. Until the
 * client and redirect_uri are known to match, errors are never redirected.
 */
export function validateAuthorizationRequest(
  params: Record<string, string | undefined>,
  client: { client_id: string; redirect_uris: string[] } | null,
  origin: string,
): AuthorizationRequest | AuthorizationRequestError {
  const clientId = params.client_id ?? "";
  const redirectUri = params.redirect_uri ?? "";
  if (!client || client.client_id !== clientId) {
    return { redirectable: false, error: "invalid_client", description: "Unknown app. Add the connector again." };
  }
  if (!redirectUri || !client.redirect_uris.includes(redirectUri)) {
    return { redirectable: false, error: "invalid_request", description: "The return address does not match the registered app." };
  }
  if (params.response_type !== "code") {
    return { redirectable: true, error: "unsupported_response_type", description: "Only response_type=code is supported." };
  }
  if (!params.code_challenge || params.code_challenge_method !== "S256" || !/^[A-Za-z0-9_-]{43,128}$/.test(params.code_challenge)) {
    return { redirectable: true, error: "invalid_request", description: "PKCE with S256 is required." };
  }
  if (params.resource && params.resource.replace(/\/$/, "") !== mcpResource(origin)) {
    return { redirectable: true, error: "invalid_target", description: "Unknown resource." };
  }
  if (params.scope && !params.scope.split(" ").filter(Boolean).every((scope) => scope === OAUTH_SCOPE)) {
    return { redirectable: true, error: "invalid_scope", description: "Only the read scope is available." };
  }
  return {
    clientId,
    redirectUri,
    state: params.state ? params.state.slice(0, 1_000) : null,
    codeChallenge: params.code_challenge,
  };
}

export function redirectWithParams(redirectUri: string, params: Record<string, string | null>) {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== null) url.searchParams.set(key, value);
  }
  return url.toString();
}

export function verifyPkce(verifier: string, challenge: string) {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  const computed = Buffer.from(crypto.createHash("sha256").update(verifier).digest("base64url"));
  const expected = Buffer.from(challenge);
  return computed.length === expected.length && crypto.timingSafeEqual(computed, expected);
}
