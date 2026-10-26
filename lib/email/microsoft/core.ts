/**
 * Pure helpers for "Sign in with Microsoft" (Outlook.com and Microsoft 365).
 * No network or database here, so they can be tested directly.
 *
 * Unlike Gmail, Microsoft asks no paid security audit for reading mail, so
 * we read the inbox directly (Mail.Read) and the merchant needs no forwarding.
 * Read-only: never Mail.ReadWrite, so we cannot move, flag or delete mail.
 */

export { hashState, newOAuthState, newPkcePair, normalizeEmail } from "../google/core.ts";

const GRAPH = "https://graph.microsoft.com";
export const MICROSOFT_MAIL_SCOPES = [
  "offline_access",
  `${GRAPH}/User.Read`,
  `${GRAPH}/Mail.Read`,
  `${GRAPH}/Mail.Send`,
] as const;
// "common" lets both personal (outlook.com, hotmail) and work accounts sign in.
export const MICROSOFT_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
export const MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
export const GRAPH_API = `${GRAPH}/v1.0`;
export const MICROSOFT_STATE_TTL_MS = 10 * 60 * 1000;

export function buildMicrosoftAuthUrl(input: { clientId: string; redirectUri: string; state: string; codeChallenge: string; loginHint?: string | null }) {
  const url = new URL(MICROSOFT_AUTH_URL);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", MICROSOFT_MAIL_SCOPES.join(" "));
  // Let the merchant pick the right account instead of reusing a signed-in one.
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (input.loginHint) url.searchParams.set("login_hint", input.loginHint);
  return url.toString();
}

/** Microsoft lists granted scopes with or without the Graph prefix; reading and sending are both required. */
export function grantedMailScopes(scope: string | null | undefined) {
  const granted = new Set((scope ?? "").split(/\s+/).map((item) => item.replace(`${GRAPH}/`, "").toLowerCase()));
  return granted.has("mail.read") && granted.has("mail.send");
}

/**
 * The address customers write to. Work accounts have `mail`; personal
 * Outlook.com accounts sometimes only a userPrincipalName.
 */
export function mailboxAddress(me: { mail?: string | null; userPrincipalName?: string | null }) {
  for (const candidate of [me.mail, me.userPrincipalName]) {
    const email = (candidate ?? "").trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !email.includes("#ext#")) return email;
  }
  return null;
}

/**
 * Graph ids change when a message moves between folders, so the stable
 * Internet Message-ID is the key we de-duplicate on.
 */
export function microsoftProviderMessageId(message: { id: string; internetMessageId?: string | null }) {
  const key = message.internetMessageId?.trim() || message.id;
  return `microsoft:${key}`;
}

/** Newest-first is never used: we always read forward from the cursor. */
export function inboxQuery(folder: "inbox" | "junkemail", since: string, top: number) {
  const params = new URLSearchParams({
    $select: "id,receivedDateTime,internetMessageId",
    $filter: `receivedDateTime ge ${new Date(since).toISOString()}`,
    $orderby: "receivedDateTime asc",
    $top: String(top),
  });
  return `${GRAPH_API}/me/mailFolders/${folder}/messages?${params.toString()}`;
}

/** The cursor only moves forward, and only past mail that was actually handled. */
export function nextCursor(current: string, handled: Array<{ receivedDateTime: string }>) {
  const latest = handled.reduce((max, message) => Math.max(max, Date.parse(message.receivedDateTime) || 0), Date.parse(current) || 0);
  return new Date(latest).toISOString();
}

export class MicrosoftReconnectRequired extends Error {
  constructor(message = "Microsoft access was revoked or expired. Sign in with Microsoft again.") {
    super(message);
    this.name = "MicrosoftReconnectRequired";
  }
}

/** invalid_grant = refresh token revoked or expired, password changed, or consent withdrawn. */
export function isRevokedGrant(status: number, body: unknown) {
  const error = typeof body === "object" && body && "error" in body ? String((body as { error: unknown }).error) : "";
  return status === 400 && (error === "invalid_grant" || error === "interaction_required" || error === "consent_required");
}
