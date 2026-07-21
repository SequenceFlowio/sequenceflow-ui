import type { CommerceConnection, CommerceProvider } from "@/lib/commerce/types";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type ConnectionRow = Record<string, unknown>;

export function mapCommerceConnection(row: ConnectionRow): CommerceConnection {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    provider: String(row.provider) as CommerceProvider,
    shopDomain: String(row.shop_domain),
    clientId: String(row.client_id),
    clientSecretEncrypted: String(row.client_secret_encrypted),
    accessTokenEncrypted: row.access_token_encrypted ? String(row.access_token_encrypted) : null,
    tokenExpiresAt: row.token_expires_at ? String(row.token_expires_at) : null,
    scopes: Array.isArray(row.scopes) ? row.scopes.map(String) : [],
    status: row.status as CommerceConnection["status"],
    actionMode: row.action_mode as CommerceConnection["actionMode"],
    maxCancelAmount: Number(row.max_cancel_amount ?? 250),
    shopCurrency: row.shop_currency ? String(row.shop_currency) : null,
    displayName: row.display_name ? String(row.display_name) : null,
    lastSyncedAt: row.last_synced_at ? String(row.last_synced_at) : null,
    lastError: row.last_error ? String(row.last_error) : null,
  };
}

export async function loadCommerceConnection(tenantId: string, includeInactive = false, provider?: CommerceProvider) {
  let query = getSupabaseAdmin()
    .from("commerce_connections")
    .select("*")
    .eq("tenant_id", tenantId);
  if (provider) query = query.eq("provider", provider);
  if (!includeInactive) query = query.eq("status", "active");
  const { data, error } = await query.order("created_at", { ascending: true });
  if (error) throw new Error(`Could not load commerce connection: ${error.message}`);
  const rows = data ?? [];
  const preferred = rows.find((row) => row.provider === "woocommerce" && row.status === "active")
    ?? rows.find((row) => row.status === "active")
    ?? rows.find((row) => row.provider === "woocommerce")
    ?? rows[0];
  return preferred ? mapCommerceConnection(preferred) : null;
}

export async function reloadCommerceConnection(connectionId: string) {
  const { data, error } = await getSupabaseAdmin().from("commerce_connections").select("*").eq("id", connectionId).single();
  if (error || !data) throw new Error("Commerce connection not found.");
  return mapCommerceConnection(data);
}

export async function disconnectCommerceConnection(tenantId: string, provider: CommerceProvider) {
  const { data, error } = await getSupabaseAdmin().rpc("disconnect_commerce_connection", {
    p_tenant_id: tenantId,
    p_provider: provider,
  });
  if (error) throw new Error(`Could not disconnect ${provider}: ${error.message}`);
  return data ? String(data) : null;
}
