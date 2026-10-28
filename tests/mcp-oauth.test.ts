import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { isMcpTokenShape } from "../lib/mcp/core.ts";
import {
  authorizationServerMetadata,
  consentPageCsp,
  isAllowedRedirectUri,
  isClientIdShape,
  newAccessToken,
  newAuthorizationCode,
  newClientId,
  newRefreshToken,
  parseClientRegistration,
  protectedResourceMetadata,
  protectedResourceMetadataUrl,
  redirectWithParams,
  sha256,
  validateAuthorizationRequest,
  verifyPkce,
} from "../lib/mcp/oauthCore.ts";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const origin = "https://support.sequenceflow.io";
const client = { client_id: newClientId(), redirect_uris: ["https://claude.ai/api/mcp/auth_callback"] };
const verifier = crypto.randomBytes(32).toString("base64url");
const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
const validParams = {
  client_id: client.client_id,
  redirect_uri: "https://claude.ai/api/mcp/auth_callback",
  response_type: "code",
  code_challenge: challenge,
  code_challenge_method: "S256",
  state: "xyz",
  resource: `${origin}/api/mcp`,
  scope: "read",
};

test("metadata points connectors from the MCP endpoint to our sign-in", () => {
  const resource = protectedResourceMetadata(origin);
  assert.equal(resource.resource, `${origin}/api/mcp`);
  assert.deepEqual(resource.authorization_servers, [origin]);
  assert.equal(protectedResourceMetadataUrl(origin), `${origin}/.well-known/oauth-protected-resource/api/mcp`);

  const server = authorizationServerMetadata(origin);
  assert.equal(server.issuer, origin);
  assert.equal(server.authorization_endpoint, `${origin}/oauth/authorize`);
  assert.equal(server.token_endpoint, `${origin}/api/mcp/oauth/token`);
  assert.equal(server.registration_endpoint, `${origin}/api/mcp/oauth/register`);
  assert.deepEqual(server.code_challenge_methods_supported, ["S256"]);
  assert.deepEqual(server.token_endpoint_auth_methods_supported, ["none"]);
});

test("secrets are random, prefixed and only usable as a hash", () => {
  const access = newAccessToken();
  assert.ok(isMcpTokenShape(access.token), "OAuth access tokens use the same bearer shape as keys");
  assert.equal(access.tokenHash, sha256(access.token));
  assert.match(newRefreshToken().token, /^sfmcr_/);
  assert.match(newAuthorizationCode().code, /^sfmcc_/);
  assert.notEqual(newRefreshToken().token, newRefreshToken().token);
  assert.ok(isClientIdShape(newClientId()));
  assert.ok(!isClientIdShape("sfmcp-client-' OR 1=1"));
});

test("redirect URIs must be https or this machine", () => {
  assert.ok(isAllowedRedirectUri("https://claude.ai/api/mcp/auth_callback"));
  assert.ok(isAllowedRedirectUri("https://chatgpt.com/connector_platform_oauth_redirect"));
  assert.ok(isAllowedRedirectUri("http://localhost:6274/oauth/callback"));
  assert.ok(isAllowedRedirectUri("http://127.0.0.1:33418/callback"));
  assert.ok(!isAllowedRedirectUri("http://evil.example/callback"));
  assert.ok(!isAllowedRedirectUri("javascript:alert(1)"));
  assert.ok(!isAllowedRedirectUri("https://claude.ai/cb#fragment"));
  assert.ok(!isAllowedRedirectUri("https://user:pass@claude.ai/cb"));
});

test("client registration accepts public clients only", () => {
  const ok = parseClientRegistration({ client_name: "  Claude  ", redirect_uris: ["https://claude.ai/api/mcp/auth_callback"], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"] });
  assert.deepEqual(ok, { clientName: "Claude", redirectUris: ["https://claude.ai/api/mcp/auth_callback"] });
  assert.deepEqual(parseClientRegistration({ redirect_uris: ["https://a.example/cb"] }), { clientName: "MCP client", redirectUris: ["https://a.example/cb"] });
  assert.ok("error" in parseClientRegistration({ redirect_uris: [] }));
  assert.ok("error" in parseClientRegistration({ redirect_uris: ["http://evil.example/cb"] }));
  assert.ok("error" in parseClientRegistration({ redirect_uris: ["https://a.example/cb"], token_endpoint_auth_method: "client_secret_basic" }));
  assert.ok("error" in parseClientRegistration({ redirect_uris: ["https://a.example/cb"], grant_types: ["client_credentials"] }));
  assert.ok("error" in parseClientRegistration(null));
});

test("a valid authorization request passes", () => {
  const request = validateAuthorizationRequest(validParams, client, origin);
  assert.ok(!("error" in request));
  assert.equal(request.redirectUri, validParams.redirect_uri);
  assert.equal(request.state, "xyz");
  assert.equal(request.codeChallenge, challenge);
});

test("unknown apps and foreign return addresses are never redirected to", () => {
  const unknownClient = validateAuthorizationRequest(validParams, null, origin);
  assert.ok("error" in unknownClient && !unknownClient.redirectable);
  const otherClient = validateAuthorizationRequest({ ...validParams, client_id: newClientId() }, client, origin);
  assert.ok("error" in otherClient && !otherClient.redirectable);
  const foreignRedirect = validateAuthorizationRequest({ ...validParams, redirect_uri: "https://evil.example/cb" }, client, origin);
  assert.ok("error" in foreignRedirect && !foreignRedirect.redirectable);
});

test("missing PKCE, other resources and scopes are refused", () => {
  for (const params of [
    { ...validParams, code_challenge: undefined },
    { ...validParams, code_challenge_method: "plain" },
    { ...validParams, response_type: "token" },
    { ...validParams, resource: "https://other.example/mcp" },
    { ...validParams, scope: "read write" },
  ]) {
    const result = validateAuthorizationRequest(params, client, origin);
    assert.ok("error" in result && result.redirectable, JSON.stringify(params));
  }
  assert.ok(!("error" in validateAuthorizationRequest({ ...validParams, resource: undefined, scope: undefined }, client, origin)));
});

test("PKCE verification only accepts the original verifier", () => {
  assert.ok(verifyPkce(verifier, challenge));
  assert.ok(!verifyPkce(crypto.randomBytes(32).toString("base64url"), challenge));
  assert.ok(!verifyPkce("short", challenge));
});

test("redirects keep the client's own query and skip empty values", () => {
  const url = new URL(redirectWithParams("https://claude.ai/cb?x=1", { code: "abc", state: null }));
  assert.equal(url.searchParams.get("x"), "1");
  assert.equal(url.searchParams.get("code"), "abc");
  assert.equal(url.searchParams.has("state"), false);
});

test("approval requires our own origin and an admin; codes and refresh tokens are single use", () => {
  const approve = source("app/api/mcp/oauth/authorize/route.ts");
  assert.match(approve, /sentFrom !== new URL\(req\.url\)\.origin/);
  assert.match(approve, /context\.role !== "admin"/);

  const oauth = source("lib/mcp/oauth.ts");
  assert.match(oauth, /from\("mcp_oauth_codes"\)\s*\.update\(\{ used_at[\s\S]+?\.is\("used_at", null\)/);
  assert.match(oauth, /from\("mcp_oauth_grants"\)\s*\.update\(\{\s*refresh_token_hash: next\.tokenHash[\s\S]+?\.eq\("refresh_token_hash", sha256\(input\.refreshToken\)\)/);

  const migration = source("supabase/migrations/056_mcp_access_tokens.sql");
  for (const table of ["mcp_oauth_clients", "mcp_oauth_codes", "mcp_oauth_grants", "mcp_access_tokens"]) {
    assert.match(migration, new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`));
    assert.match(migration, new RegExp(`REVOKE ALL ON ${table} FROM anon, authenticated`));
  }
  assert.match(source("proxy.ts"), /"\/\.well-known"/);
});

test("the consent page may only post onward to the app's own return address", () => {
  assert.match(consentPageCsp("https://claude.ai/api/mcp/auth_callback"), /form-action 'self' https:\/\/claude\.ai;/);
  assert.match(consentPageCsp("http://localhost:6274/oauth/callback"), /form-action 'self' http:\/\/localhost:6274;/);
  for (const bad of [null, "http://evil.example/cb", "javascript:alert(1)", "https://claude.ai/cb#x"]) {
    assert.match(consentPageCsp(bad), /form-action 'self';/);
  }
  assert.match(consentPageCsp(null), /frame-ancestors 'none'/);
  assert.match(source("proxy.ts"), /matchesPath\(pathname, "\/oauth"\)[\s\S]+?consentPageCsp/);
  assert.match(source("next.config.ts"), /oauth\(\?:\/\|\$\)/);
});
