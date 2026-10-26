import nodemailer from "nodemailer";

import { decryptSecret, encryptSecret } from "@/lib/security/credentials";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { OutboundAttachment } from "@/lib/email/outbound/attachments";
import { buildTenantInboundAddress } from "@/lib/email/inbound/address";
import {
  GRAPH_API,
  MICROSOFT_MAIL_SCOPES,
  MICROSOFT_STATE_TTL_MS,
  MICROSOFT_TOKEN_URL,
  MicrosoftReconnectRequired,
  buildMicrosoftAuthUrl,
  grantedMailScopes,
  hashState,
  isRevokedGrant,
  mailboxAddress,
  newOAuthState,
  newPkcePair,
} from "@/lib/email/microsoft/core";

/**
 * "Sign in with Microsoft" for Outlook.com and Microsoft 365: read the inbox
 * and send replies through Microsoft Graph. Tokens are stored encrypted and
 * only ever used server-side.
 */

export function microsoftMailConfig() {
  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET?.trim();
  const enabled = process.env.MICROSOFT_MAIL_ENABLED === "true" && Boolean(clientId && clientSecret);
  // Must match the redirect URI registered in the Azure app registration exactly.
  const origin = (process.env.MICROSOFT_OAUTH_ORIGIN?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://support.sequenceflow.io").replace(/\/$/, "");
  return { enabled, clientId: clientId ?? "", clientSecret: clientSecret ?? "", redirectUri: `${origin}/api/integrations/email/microsoft/callback` };
}

/** Until the app is published, MICROSOFT_MAIL_TENANT_IDS (comma-separated) limits who sees it. Empty = everyone. */
export function microsoftMailAvailableFor(tenantId: string) {
  if (!microsoftMailConfig().enabled) return false;
  const allowed = (process.env.MICROSOFT_MAIL_TENANT_IDS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  return allowed.length === 0 || allowed.includes(tenantId);
}

function requireConfig() {
  const config = microsoftMailConfig();
  if (!config.enabled) throw new Error("Sign in with Microsoft is not available yet.");
  return config;
}

export type MicrosoftConnection = {
  email: string;
  status: "active" | "needs_reconnect" | "revoked";
  connectedAt: string;
  lastSyncedAt: string | null;
  lastError: string | null;
};

export async function loadMicrosoftConnection(tenantId: string): Promise<MicrosoftConnection | null> {
  const { data, error } = await getSupabaseAdmin().from("tenant_microsoft_connections")
    .select("microsoft_email, status, connected_at, last_synced_at, last_error").eq("tenant_id", tenantId).maybeSingle();
  if (error) throw new Error(`Could not load Microsoft connection: ${error.message}`);
  if (!data) return null;
  return { email: data.microsoft_email, status: data.status, connectedAt: data.connected_at, lastSyncedAt: data.last_synced_at, lastError: data.last_error };
}

/** Step 1: a one-time state + PKCE pair, and the Microsoft URL to open in a new window. */
export async function startMicrosoftSignIn(input: { tenantId: string; userId: string | null; returnTo: "app" | "shopify"; loginHint?: string | null }) {
  const config = requireConfig();
  const { state, stateHash } = newOAuthState();
  const { verifier, challenge } = newPkcePair();
  const db = getSupabaseAdmin();
  await db.from("microsoft_oauth_states").delete().lt("expires_at", new Date().toISOString());
  const { error } = await db.from("microsoft_oauth_states").insert({
    state_hash: stateHash,
    tenant_id: input.tenantId,
    started_by: input.userId,
    code_verifier: encryptSecret(verifier),
    return_to: input.returnTo,
    expires_at: new Date(Date.now() + MICROSOFT_STATE_TTL_MS).toISOString(),
  });
  if (error) throw new Error(`Could not start Microsoft sign-in: ${error.message}`);
  return buildMicrosoftAuthUrl({ clientId: config.clientId, redirectUri: config.redirectUri, state, codeChallenge: challenge, loginHint: input.loginHint });
}

async function tokenRequest(params: Record<string, string>) {
  const response = await fetch(MICROSOFT_TOKEN_URL, {
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
 * Step 2: Microsoft sends the user back with a code. The state decides which
 * workspace this is for; nothing from the browser is trusted beyond it.
 */
export async function completeMicrosoftSignIn(input: { state: string; code: string }) {
  const config = requireConfig();
  const db = getSupabaseAdmin();
  const { data: rows, error: stateError } = await db.rpc("consume_microsoft_oauth_state", { p_state_hash: hashState(input.state) });
  const attempt = Array.isArray(rows) ? rows[0] : null;
  if (stateError || !attempt) throw new Error("This sign-in link has expired. Start again from Support One.");
  const returnTo = attempt.return_to === "shopify" ? "shopify" as const : "app" as const;

  const { response, body } = await tokenRequest({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code: input.code,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
    code_verifier: decryptSecret(String(attempt.code_verifier)),
    scope: MICROSOFT_MAIL_SCOPES.join(" "),
  });
  if (!response.ok || typeof body.access_token !== "string") {
    // An organisation can require admin approval for third-party apps.
    if (String(body.error_description ?? "").includes("AADSTS65001") || body.error === "consent_required") {
      throw new Error("Your organisation requires an administrator to approve Support One first. Ask your Microsoft 365 admin, or use forwarding for now.");
    }
    throw new Error("Microsoft did not accept the sign-in. Please try again.");
  }
  if (!grantedMailScopes(String(body.scope ?? ""))) {
    throw new Error("Support One needs permission to read and send email for this mailbox. Please allow both and try again.");
  }
  const refreshToken = typeof body.refresh_token === "string" ? body.refresh_token : null;
  if (!refreshToken) throw new Error("Microsoft did not grant lasting access. Please try again.");

  const meResponse = await fetch(`${GRAPH_API}/me?$select=id,mail,userPrincipalName`, {
    headers: { Authorization: `Bearer ${body.access_token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const me = await meResponse.json().catch(() => ({})) as { id?: string; mail?: string | null; userPrincipalName?: string | null };
  const email = mailboxAddress(me);
  if (!meResponse.ok || !me.id || !email) throw new Error("Microsoft did not return the mailbox address. Please try again.");

  const now = new Date().toISOString();
  const expiresIn = Number(body.expires_in ?? 0);
  // Reconnecting the same mailbox keeps the read position; a new mailbox starts now.
  const { data: existing } = await db.from("tenant_microsoft_connections").select("microsoft_user_id, inbox_cursor").eq("tenant_id", attempt.tenant_id).maybeSingle();
  const inboxCursor = existing?.microsoft_user_id === me.id && existing.inbox_cursor ? existing.inbox_cursor : now;
  const { error: saveError } = await db.from("tenant_microsoft_connections").upsert({
    tenant_id: attempt.tenant_id,
    microsoft_user_id: me.id,
    microsoft_email: email,
    refresh_token_encrypted: encryptSecret(refreshToken),
    access_token_encrypted: encryptSecret(body.access_token),
    access_expires_at: expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
    scopes: String(body.scope ?? ""),
    status: "active",
    inbox_cursor: inboxCursor,
    connected_by: attempt.started_by,
    connected_at: now,
    last_error: null,
    updated_at: now,
  }, { onConflict: "tenant_id" });
  if (saveError) throw new Error(`Could not save the Microsoft connection: ${saveError.message}`);

  const { data: channel } = await db.from("tenant_email_channels")
    .select("id").eq("tenant_id", attempt.tenant_id).eq("is_default", true).maybeSingle();
  const channelUpdate = { outbound_provider: "microsoft_graph", outbound_from_email: email, updated_at: now };
  const { error: channelError } = channel
    ? await db.from("tenant_email_channels").update(channelUpdate).eq("id", channel.id).eq("tenant_id", attempt.tenant_id)
    : await db.from("tenant_email_channels").insert({ ...channelUpdate, tenant_id: attempt.tenant_id, inbound_address: buildTenantInboundAddress(String(attempt.tenant_id)), is_default: true });
  if (channelError) throw new Error(`Could not switch sending to Microsoft: ${channelError.message}`);
  return { tenantId: String(attempt.tenant_id), email, returnTo };
}

export async function markMicrosoftConnection(tenantId: string, patch: Record<string, unknown>) {
  await getSupabaseAdmin().from("tenant_microsoft_connections").update({ ...patch, updated_at: new Date().toISOString() }).eq("tenant_id", tenantId);
}

/** A valid access token, refreshed when needed. Microsoft rotates the refresh token on every refresh. */
export async function microsoftAccessToken(tenantId: string) {
  const config = requireConfig();
  const { data, error } = await getSupabaseAdmin().from("tenant_microsoft_connections")
    .select("microsoft_email, refresh_token_encrypted, access_token_encrypted, access_expires_at, status").eq("tenant_id", tenantId).maybeSingle();
  if (error) throw new Error(`Could not load Microsoft connection: ${error.message}`);
  if (!data || data.status !== "active" || !data.refresh_token_encrypted) throw new MicrosoftReconnectRequired();
  if (data.access_token_encrypted && data.access_expires_at && Date.parse(data.access_expires_at) > Date.now() + 60_000) {
    return { token: decryptSecret(data.access_token_encrypted), email: String(data.microsoft_email) };
  }
  const { response, body } = await tokenRequest({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: decryptSecret(data.refresh_token_encrypted),
    grant_type: "refresh_token",
    scope: MICROSOFT_MAIL_SCOPES.join(" "),
  });
  if (isRevokedGrant(response.status, body)) {
    await markMicrosoftConnection(tenantId, { status: "needs_reconnect", access_token_encrypted: null, access_expires_at: null, last_error: "Microsoft access was revoked or expired." });
    throw new MicrosoftReconnectRequired();
  }
  if (!response.ok || typeof body.access_token !== "string") throw new Error("Microsoft did not refresh access. Try again in a minute.");
  const expiresIn = Number(body.expires_in ?? 3600);
  await markMicrosoftConnection(tenantId, {
    access_token_encrypted: encryptSecret(body.access_token),
    access_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    ...(typeof body.refresh_token === "string" ? { refresh_token_encrypted: encryptSecret(body.refresh_token) } : {}),
  });
  return { token: body.access_token, email: String(data.microsoft_email) };
}

/** GET on Microsoft Graph. A 401 means the grant is gone: ask for a new sign-in. */
export async function graphGet(tenantId: string, url: string, accept: "json" | "mime" = "json") {
  const { token } = await microsoftAccessToken(tenantId);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, ...(accept === "json" ? { Accept: "application/json" } : {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (response.status === 401) {
    await markMicrosoftConnection(tenantId, { status: "needs_reconnect", access_token_encrypted: null, access_expires_at: null, last_error: "Microsoft refused access to the mailbox." });
    throw new MicrosoftReconnectRequired();
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Microsoft Graph ${response.status}: ${detail.slice(0, 300)}`);
  }
  return response;
}

export type MicrosoftSendInput = {
  tenantId: string;
  to: string;
  subject: string;
  text: string;
  fromName?: string | null;
  inReplyTo?: string | null;
  references?: string | null;
  messageId?: string | null;
  attachments?: OutboundAttachment[];
  headers?: Record<string, string>;
};

/** Sends the MIME message through Graph; Outlook stores it in Sent Items itself. */
export async function sendViaMicrosoft(input: MicrosoftSendInput) {
  const { token, email } = await microsoftAccessToken(input.tenantId);
  const headers: Record<string, string> = { ...(input.headers ?? {}) };
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
  const response = await fetch(`${GRAPH_API}/me/sendMail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "text/plain" },
    body: raw.toString("base64"),
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  if (response.status === 401) {
    await markMicrosoftConnection(input.tenantId, { status: "needs_reconnect", access_token_encrypted: null, access_expires_at: null, last_error: "Microsoft refused the send." });
    throw new MicrosoftReconnectRequired();
  }
  if (response.status !== 202 && !response.ok) {
    const detail = await response.json().catch(() => ({})) as { error?: { message?: string } };
    const message = detail.error?.message ?? `Outlook send failed (${response.status})`;
    await markMicrosoftConnection(input.tenantId, { last_error: message.slice(0, 500) });
    throw new Error(message);
  }
  await markMicrosoftConnection(input.tenantId, { last_used_at: new Date().toISOString(), last_error: null });
  // Graph returns no id for sendMail; our own Message-ID identifies the reply.
  return { id: input.messageId ?? null, fromEmail: email, raw };
}

/**
 * Disconnect: forget the tokens and stop reading. Microsoft has no endpoint
 * to revoke one app's token; the merchant can remove Support One under
 * "Apps" in their Microsoft account.
 */
export async function disconnectMicrosoft(tenantId: string) {
  const db = getSupabaseAdmin();
  const { error } = await db.from("tenant_microsoft_connections").delete().eq("tenant_id", tenantId);
  if (error) throw new Error(`Could not disconnect Microsoft: ${error.message}`);
  await db.from("tenant_email_channels").update({ outbound_provider: "smtp", updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId).eq("is_default", true).eq("outbound_provider", "microsoft_graph");
}
