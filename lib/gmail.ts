import { getSupabaseAdmin } from "./supabaseAdmin";

const TOKEN_URL    = "https://oauth2.googleapis.com/token";
const GMAIL_BASE   = "https://gmail.googleapis.com/gmail/v1/users/me";
const GMAIL_SEND   = `${GMAIL_BASE}/messages/send`;

// ─── Token ────────────────────────────────────────────────────────────────────

export async function getGmailToken(tenantId: string): Promise<string> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("tenant_integrations")
    .select("access_token, refresh_token, expires_at")
    .eq("tenant_id", tenantId)
    .eq("provider", "gmail")
    .single();

  if (error || !data) throw new Error("Gmail not connected for this tenant");

  const isExpired = Date.now() >= new Date(data.expires_at).getTime() - 60_000;
  if (!isExpired) return data.access_token;

  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Missing Google OAuth credentials");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      refresh_token: data.refresh_token,
      client_id:     clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);

  const tokens = await res.json();
  if (!tokens.access_token) throw new Error("No access_token in refresh response");

  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const { error: updateError } = await supabase
    .from("tenant_integrations")
    .update({ access_token: tokens.access_token, expires_at: newExpiresAt, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("provider", "gmail");

  if (updateError) console.warn("[gmail] Failed to persist refreshed token:", updateError.message);

  return tokens.access_token;
}

// ─── Build raw RFC-2822 email ─────────────────────────────────────────────────

export function buildRawEmail({
  to,
  subject,
  body,
  inReplyTo,
  references,
  threadId,
}: {
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
  threadId?: string;
}): { raw: string; threadId?: string } {
  const lines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    ...(inReplyTo  ? [`In-Reply-To: ${inReplyTo}`]  : []),
    ...(references ? [`References: ${references}`]  : []),
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
    "",
    body,
  ];

  const raw = Buffer.from(lines.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return { raw, ...(threadId ? { threadId } : {}) };
}

// ─── Send ─────────────────────────────────────────────────────────────────────

export async function sendGmailMessage(
  accessToken: string,
  raw: string,
  threadId?: string,
): Promise<void> {
  const payload: Record<string, string> = { raw };
  if (threadId) payload.threadId = threadId;

  const res = await fetch(GMAIL_SEND, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail send failed (${res.status}): ${text}`);
  }
}

// ─── Delete draft ─────────────────────────────────────────────────────────────

export async function deleteGmailDraft(
  accessToken: string,
  draftId: string,
): Promise<void> {
  const res = await fetch(`${GMAIL_BASE}/drafts/${draftId}`, {
    method:  "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  // 404 just means it was already deleted/sent — not an error
  if (!res.ok && res.status !== 404) {
    console.warn(`[gmail] Failed to delete draft ${draftId}: ${res.status}`);
  }
}
