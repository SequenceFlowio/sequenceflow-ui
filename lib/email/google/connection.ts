import nodemailer from "nodemailer";

import { decryptSecret, encryptSecret } from "@/lib/security/credentials";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { OutboundAttachment } from "@/lib/email/outbound/attachments";
import { buildTenantInboundAddress, getInboundEmailDomain } from "@/lib/email/inbound/address";
import {
  GOOGLE_REVOKE_URL,
  GOOGLE_STATE_TTL_MS,
  GOOGLE_TOKEN_URL,
  GoogleReconnectRequired,
  buildGoogleAuthUrl,
  gmailRawMessage,
  grantedSendScope,
  hashState,
  isRevokedGrant,
  newOAuthState,
  newPkcePair,
  readIdToken,
  sameMailbox,
} from "@/lib/email/google/core";

/**
 * "Sign in with Google" for sending only. Tokens are stored encrypted and
 * only ever used server-side. See docs/plan-gmail-koppelen.md.
 */

export function googleSendConfig() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const enabled = process.env.GOOGLE_SEND_ENABLED === "true" && Boolean(clientId && clientSecret);
  // The site domain (support.sequenceflow.io) also serves the Shopify app; the
  // redirect URI must match the one registered in Google Cloud exactly.
  const origin = (process.env.GOOGLE_OAUTH_ORIGIN?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://support.sequenceflow.io").replace(/\/$/, "");
  return { enabled, clientId: clientId ?? "", clientSecret: clientSecret ?? "", redirectUri: `${origin}/api/integrations/email/google/callback` };
}

/** Our own sending/inbound domains are never "the merchant's" address. */
function isOurAddress(email: string) {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return domain === getInboundEmailDomain().toLowerCase() || domain.endsWith("sequenceflow.io");
}

/**
 * Until Google has verified the app only listed test users can sign in, so
 * GOOGLE_SEND_TENANT_IDS (comma-separated) limits who sees it. Empty = everyone.
 */
export function googleSendAvailableFor(tenantId: string) {
  if (!googleSendConfig().enabled) return false;
  const allowed = (process.env.GOOGLE_SEND_TENANT_IDS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  return allowed.length === 0 || allowed.includes(tenantId);
}

function requireConfig() {
  const config = googleSendConfig();
  if (!config.enabled) throw new Error("Sign in with Google is not available yet.");
  return config;
}

export type GoogleConnection = {
  googleEmail: string;
  status: "active" | "needs_reconnect" | "revoked";
  connectedAt: string;
  lastError: string | null;
};

export async function loadGoogleConnection(tenantId: string): Promise<GoogleConnection | null> {
  const { data, error } = await getSupabaseAdmin().from("tenant_google_connections")
    .select("google_email, status, connected_at, last_error").eq("tenant_id", tenantId).maybeSingle();
  if (error) throw new Error(`Could not load Google connection: ${error.message}`);
  if (!data) return null;
  return { googleEmail: data.google_email, status: data.status, connectedAt: data.connected_at, lastError: data.last_error };
}

/** Step 1: a one-time state + PKCE pair, and the Google URL to open in a new window. */
export async function startGoogleSignIn(input: { tenantId: string; userId: string | null; returnTo: "app" | "shopify"; loginHint?: string | null }) {
  const config = requireConfig();
  const { state, stateHash } = newOAuthState();
  const { verifier, challenge } = newPkcePair();
  const db = getSupabaseAdmin();
  // Housekeeping: expired attempts are useless.
  await db.from("google_oauth_states").delete().lt("expires_at", new Date().toISOString());
  const { error } = await db.from("google_oauth_states").insert({
    state_hash: stateHash,
    tenant_id: input.tenantId,
    started_by: input.userId,
    code_verifier: encryptSecret(verifier),
    return_to: input.returnTo,
    expires_at: new Date(Date.now() + GOOGLE_STATE_TTL_MS).toISOString(),
  });
  if (error) throw new Error(`Could not start Google sign-in: ${error.message}`);
  return buildGoogleAuthUrl({ clientId: config.clientId, redirectUri: config.redirectUri, state, codeChallenge: challenge, loginHint: input.loginHint });
}

async function tokenRequest(params: Record<string, string>) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json().catch(() => ({}));
  return { response, body: body as Record<string, unknown> };
}

/**
 * Step 2: Google sends the user back with a code. The state decides which
 * workspace this is for; nothing from the browser is trusted beyond it.
 */
export async function completeGoogleSignIn(input: { state: string; code: string }) {
  const config = requireConfig();
  const db = getSupabaseAdmin();
  const { data: rows, error: stateError } = await db.rpc("consume_google_oauth_state", { p_state_hash: hashState(input.state) });
  const attempt = Array.isArray(rows) ? rows[0] : null;
  if (stateError || !attempt) throw new Error("This sign-in link has expired. Start again from Support One.");
  const returnTo = attempt.return_to === "shopify" ? "shopify" as const : "app" as const;

  const { response, body } = await tokenRequest({
    code: input.code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
    code_verifier: decryptSecret(String(attempt.code_verifier)),
  });
  if (!response.ok) throw new Error("Google did not accept the sign-in. Please try again.");
  if (!grantedSendScope(String(body.scope ?? ""))) {
    throw new Error("Support One needs permission to send email on your behalf. Please allow it and try again.");
  }
  const refreshToken = typeof body.refresh_token === "string" ? body.refresh_token : null;
  if (!refreshToken) throw new Error("Google did not grant lasting access. Please try again.");
  const identity = readIdToken(String(body.id_token ?? ""), config.clientId);

  // The Google account becomes the sending address. If it differs from the
  // mailbox set up before, we say so in the result rather than block it.
  const { data: channel } = await db.from("tenant_email_channels")
    .select("id, outbound_from_email").eq("tenant_id", attempt.tenant_id).eq("is_default", true).maybeSingle();
  const previous = channel?.outbound_from_email && !isOurAddress(channel.outbound_from_email) ? channel.outbound_from_email : null;
  const switchedFrom = previous && !sameMailbox(previous, identity.email) ? previous : null;

  const now = new Date().toISOString();
  const expiresIn = Number(body.expires_in ?? 0);
  const { error: saveError } = await db.from("tenant_google_connections").upsert({
    tenant_id: attempt.tenant_id,
    google_sub: identity.sub,
    google_email: identity.email,
    refresh_token_encrypted: encryptSecret(refreshToken),
    access_token_encrypted: typeof body.access_token === "string" ? encryptSecret(body.access_token) : null,
    access_expires_at: expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
    scopes: String(body.scope ?? ""),
    status: "active",
    connected_by: attempt.started_by,
    connected_at: now,
    last_error: null,
    updated_at: now,
  }, { onConflict: "tenant_id" });
  if (saveError) throw new Error(`Could not save the Google connection: ${saveError.message}`);

  const channelUpdate = { outbound_provider: "gmail_api", outbound_from_email: identity.email, updated_at: now };
  const { error: channelError } = channel
    ? await db.from("tenant_email_channels").update(channelUpdate).eq("id", channel.id).eq("tenant_id", attempt.tenant_id)
    : await db.from("tenant_email_channels").insert({ ...channelUpdate, tenant_id: attempt.tenant_id, inbound_address: buildTenantInboundAddress(String(attempt.tenant_id)), is_default: true });
  if (channelError) throw new Error(`Could not switch sending to Google: ${channelError.message}`);
  return { tenantId: String(attempt.tenant_id), email: identity.email, returnTo, switchedFrom };
}

async function markConnection(tenantId: string, patch: Record<string, unknown>) {
  await getSupabaseAdmin().from("tenant_google_connections").update({ ...patch, updated_at: new Date().toISOString() }).eq("tenant_id", tenantId);
}

/** A valid access token, refreshed when needed. Revoked access asks for a new sign-in instead of failing silently. */
async function accessTokenFor(tenantId: string) {
  const config = requireConfig();
  const { data, error } = await getSupabaseAdmin().from("tenant_google_connections")
    .select("google_email, refresh_token_encrypted, access_token_encrypted, access_expires_at, status").eq("tenant_id", tenantId).maybeSingle();
  if (error) throw new Error(`Could not load Google connection: ${error.message}`);
  if (!data || data.status !== "active" || !data.refresh_token_encrypted) throw new GoogleReconnectRequired();
  if (data.access_token_encrypted && data.access_expires_at && Date.parse(data.access_expires_at) > Date.now() + 60_000) {
    return { token: decryptSecret(data.access_token_encrypted), email: String(data.google_email) };
  }
  const { response, body } = await tokenRequest({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: decryptSecret(data.refresh_token_encrypted),
    grant_type: "refresh_token",
  });
  if (isRevokedGrant(response.status, body)) {
    await markConnection(tenantId, { status: "needs_reconnect", access_token_encrypted: null, access_expires_at: null, last_error: "Google access was revoked or expired." });
    throw new GoogleReconnectRequired();
  }
  if (!response.ok || typeof body.access_token !== "string") throw new Error("Google did not refresh access. Try again in a minute.");
  const expiresIn = Number(body.expires_in ?? 3600);
  await markConnection(tenantId, {
    access_token_encrypted: encryptSecret(body.access_token),
    access_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
  });
  return { token: body.access_token, email: String(data.google_email) };
}

export type GmailSendInput = {
  tenantId: string;
  to: string;
  subject: string;
  text: string;
  fromName?: string | null;
  inReplyTo?: string | null;
  references?: string | null;
  messageId?: string | null;
  attachments?: OutboundAttachment[];
};

/** Sends through the Gmail API. Gmail stores it in the user's Sent folder itself. */
export async function sendViaGmail(input: GmailSendInput) {
  const { token, email } = await accessTokenFor(input.tenantId);
  const headers: Record<string, string> = {};
  if (input.inReplyTo) headers["In-Reply-To"] = input.inReplyTo;
  if (input.references) headers.References = input.references;
  if (input.messageId) headers["Message-ID"] = input.messageId;
  const composer = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "\r\n" });
  const built = await composer.sendMail({
    from: input.fromName?.trim() ? { name: input.fromName.trim(), address: email } : email,
    to: input.to,
    subject: input.subject,
    text: input.text,
    headers,
    attachments: input.attachments?.map((attachment) => ({ filename: attachment.filename, content: attachment.content, contentType: attachment.contentType })),
  });
  const raw = built.message as Buffer;
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: gmailRawMessage(raw) }),
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json().catch(() => ({})) as { id?: string; error?: { message?: string; status?: string } };
  if (response.status === 401 || (response.status === 403 && body.error?.status === "PERMISSION_DENIED")) {
    await markConnection(input.tenantId, { status: "needs_reconnect", access_token_encrypted: null, access_expires_at: null, last_error: body.error?.message?.slice(0, 500) ?? "Google refused the send." });
    throw new GoogleReconnectRequired();
  }
  if (!response.ok || !body.id) {
    const message = body.error?.message ?? `Gmail send failed (${response.status})`;
    await markConnection(input.tenantId, { last_error: message.slice(0, 500) });
    throw new Error(message);
  }
  await markConnection(input.tenantId, { last_used_at: new Date().toISOString(), last_error: null });
  return { id: body.id, fromEmail: email, raw };
}

async function revokeToken(token: string) {
  await fetch(GOOGLE_REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }).toString(),
    signal: AbortSignal.timeout(10000),
  }).catch(() => undefined);
}

/** Disconnect: revoke at Google, forget the tokens, send through SMTP again. */
export async function disconnectGoogle(tenantId: string) {
  const db = getSupabaseAdmin();
  const { data } = await db.from("tenant_google_connections").select("refresh_token_encrypted").eq("tenant_id", tenantId).maybeSingle();
  if (data?.refresh_token_encrypted) await revokeToken(decryptSecret(data.refresh_token_encrypted));
  const { error } = await db.from("tenant_google_connections").delete().eq("tenant_id", tenantId);
  if (error) throw new Error(`Could not disconnect Google: ${error.message}`);
  await db.from("tenant_email_channels").update({ outbound_provider: "smtp", updated_at: new Date().toISOString() }).eq("tenant_id", tenantId).eq("is_default", true);
}
