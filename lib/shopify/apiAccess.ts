/**
 * An embedded Shopify identity does not implicitly grant every legacy API.
 * Allowed: working the inbox (read, edit, approve, send after review), the
 * knowledge base and answer style; admins also manage the mailbox. Not
 * allowed: billing (Shopify bills), team, autosend settings and store actions.
 */
export function shopifyApiAllowed(path: string, method: string, role: string) {
  const read = method === "GET";
  const admin = role === "admin";
  if (read && ["/api/billing/usage", "/api/autosend-config", "/api/agent-config", "/api/integrations/email/setup"].includes(path)) return true;
  if (path === "/api/tickets/bulk-archive") return method === "POST";
  if (path === "/api/tickets") return read;
  if (/^\/api\/tickets\/[a-f0-9-]+$/.test(path)) {
    // PATCH saves an edited draft; deleting a conversation is for the owner only.
    return read || method === "PATCH" || (admin && method === "DELETE");
  }
  if (/^\/api\/tickets\/[a-f0-9-]+\/commerce-context$/.test(path)) return ["GET", "POST", "PATCH"].includes(method);
  if (/^\/api\/tickets\/[a-f0-9-]+\/(approve-send|send|schedule-send|regenerate|escalate|archive|spam|retention|cancel-autosend|translate|ignore)$/.test(path)) return method === "POST";
  if (read && ["/api/knowledge/documents", "/api/agent-profile", "/api/onboarding/mine"].includes(path)) return true;
  if (admin && /^\/api\/(knowledge\/(upload|reindex|test|document\/[a-f0-9-]+)|agent-profile(?:\/facts\/[a-f0-9-]+)?|onboarding\/mine)$/.test(path)) return ["POST", "PATCH", "DELETE"].includes(method);
  if (admin && /^\/api\/integrations\/email\/(mailbox|imap(?:\/(?:sync|test))?|smtp(?:\/test)?)$/.test(path)) return ["GET", "POST", "DELETE", "PATCH"].includes(method);
  return false;
}
