import { NextResponse } from "next/server";

import { getTenantId } from "@/lib/tenant";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  isWorkAppPermissionLevel,
  isWorkAppRuntimeProvider,
  isWorkAppType,
  normalizeAllowedDomains,
  parseHttpUrl,
  type ReplyOSWorkApp,
} from "@/lib/replyos/workApps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WorkAppRow = {
  id: string;
  app_type: ReplyOSWorkApp["appType"];
  provider: string;
  display_name: string;
  base_url: string | null;
  status: ReplyOSWorkApp["status"];
  permission_level: ReplyOSWorkApp["permissionLevel"];
  runtime_provider: ReplyOSWorkApp["runtimeProvider"] | null;
  credential_status: ReplyOSWorkApp["credentialStatus"];
  allowed_domains: unknown;
  notes: string | null;
  last_checked_at: string | null;
  created_at: string;
};

type WorkAppBody = {
  appType?: unknown;
  permissionLevel?: unknown;
  runtimeProvider?: unknown;
  provider?: unknown;
  displayName?: unknown;
  baseUrl?: unknown;
  allowedDomains?: unknown;
  notes?: unknown;
};

function mapWorkApp(row: WorkAppRow): ReplyOSWorkApp {
  return {
    id: row.id,
    appType: row.app_type,
    provider: row.provider,
    displayName: row.display_name,
    baseUrl: row.base_url,
    status: row.status,
    permissionLevel: row.permission_level,
    runtimeProvider: row.runtime_provider ?? "browserbase_openai_cua",
    credentialStatus: row.credential_status,
    allowedDomains: Array.isArray(row.allowed_domains) ? row.allowed_domains : [],
    notes: row.notes,
    lastCheckedAt: row.last_checked_at,
    createdAt: row.created_at,
  };
}

export async function GET(req: Request) {
  let tenantId: string;
  try {
    ({ tenantId } = await getTenantId(req));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Not authenticated";
    return NextResponse.json({ error: message }, { status: message === "Not authenticated" ? 401 : 403 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("replyos_work_apps")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[replyos/work-apps] GET failed:", error.message);
    return NextResponse.json({ error: "Failed to load work apps" }, { status: 500 });
  }

  return NextResponse.json({ workApps: (data ?? []).map(mapWorkApp) });
}

export async function POST(req: Request) {
  let tenantId: string;
  try {
    ({ tenantId } = await getTenantId(req));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Not authenticated";
    return NextResponse.json({ error: message }, { status: message === "Not authenticated" ? 401 : 403 });
  }

  let body: WorkAppBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const appType = isWorkAppType(body.appType) ? body.appType : "other";
  const permissionLevel = isWorkAppPermissionLevel(body.permissionLevel) ? body.permissionLevel : "read_only";
  const runtimeProvider = isWorkAppRuntimeProvider(body.runtimeProvider)
    ? body.runtimeProvider
    : "browserbase_openai_cua";
  const provider = typeof body.provider === "string" && body.provider.trim() ? body.provider.trim() : null;
  const displayName = typeof body.displayName === "string" && body.displayName.trim() ? body.displayName.trim() : provider;

  if (!provider || !displayName) {
    return NextResponse.json({ error: "Provider and display name are required" }, { status: 400 });
  }

  let baseUrl: string | null = null;
  try {
    baseUrl = parseHttpUrl(body.baseUrl);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid URL" }, { status: 400 });
  }

  const allowedDomains = normalizeAllowedDomains(baseUrl, body.allowedDomains);
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;

  const { data, error } = await getSupabaseAdmin()
    .from("replyos_work_apps")
    .upsert({
      tenant_id: tenantId,
      app_type: appType,
      provider,
      display_name: displayName,
      base_url: baseUrl,
      permission_level: permissionLevel,
      runtime_provider: runtimeProvider,
      allowed_domains: allowedDomains,
      notes,
    }, { onConflict: "tenant_id,provider,display_name" })
    .select("*")
    .single();

  if (error) {
    console.error("[replyos/work-apps] POST failed:", error.message);
    return NextResponse.json({ error: "Failed to save work app" }, { status: 500 });
  }

  return NextResponse.json({ workApp: mapWorkApp(data) });
}
