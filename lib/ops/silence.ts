import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

import { amsterdamDate, evaluateSilence, type SilenceSnapshot } from "./silenceCore";

const DAY = 24 * 60 * 60 * 1000;

/** Minuten sinds middernacht in Amsterdam, voor het vergelijken met een postdatum en -tijd. */
function amsterdamStamp(date: string, time: string | null) {
  return `${date}T${(time ?? "00:00").slice(0, 5)}`;
}

function amsterdamNowStamp(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  return `${amsterdamDate(now)}T${parts}`;
}

/** Leest een momentopname uit de database. Gooit bij een databasefout. */
export async function loadSilenceSnapshot(now = new Date()): Promise<SilenceSnapshot> {
  const db = getSupabaseAdmin();
  const today = amsterdamDate(now);
  const twoDaysAgo = amsterdamDate(new Date(now.getTime() - 2 * DAY));
  const fourteenDaysAgo = amsterdamDate(new Date(now.getTime() - 14 * DAY));
  const halfHourAgo = amsterdamNowStamp(new Date(now.getTime() - 30 * 60 * 1000));

  const [lastApproved, dueToday, posted, tenants, channels, google, microsoft, inbound, stuck] = await Promise.all([
    db.from("content_posts").select("date").eq("status", "approved").order("date", { ascending: false }).limit(1).maybeSingle(),
    db.from("content_posts").select("date, time").eq("status", "approved").lte("date", today),
    db.from("content_posts").select("id, metrics:data->metrics").eq("status", "posted").gte("date", fourteenDaysAgo).lte("date", twoDaysAgo),
    db.from("tenants").select("id, name, plan").neq("plan", "expired"),
    db.from("tenant_email_channels").select("tenant_id, forwarding_status, imap_status, imap_last_error"),
    db.from("tenant_google_connections").select("tenant_id, status, last_error"),
    db.from("tenant_microsoft_connections").select("tenant_id, status, last_error"),
    db.from("support_messages").select("created_at").eq("direction", "inbound").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("support_conversations").select("id", { count: "exact", head: true }).eq("status", "pending_autosend").lt("scheduled_send_at", new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()),
  ]);
  for (const result of [lastApproved, dueToday, posted, tenants, channels, google, microsoft, inbound, stuck]) {
    if (result.error) throw new Error(`[ops/silence] ${result.error.message}`);
  }

  const active = new Map((tenants.data ?? []).filter((t) => t.plan).map((t) => [t.id as string, (t.name as string | null) ?? null]));
  const failingMailboxes: SilenceSnapshot["failingMailboxes"] = [];
  const connected = new Set<string>();
  for (const row of channels.data ?? []) {
    if (!active.has(row.tenant_id)) continue;
    if (row.imap_status === "failed") failingMailboxes.push({ tenantId: row.tenant_id, workspace: active.get(row.tenant_id) ?? null, channel: "IMAP", error: row.imap_last_error });
    if (row.imap_status === "active" || row.forwarding_status === "confirmed") connected.add(row.tenant_id);
  }
  for (const [rows, channel] of [[google.data ?? [], "Google"], [microsoft.data ?? [], "Microsoft"]] as const) {
    for (const row of rows) {
      if (!active.has(row.tenant_id)) continue;
      if (row.status === "active") connected.add(row.tenant_id);
      else failingMailboxes.push({ tenantId: row.tenant_id, workspace: active.get(row.tenant_id) ?? null, channel, error: row.last_error });
    }
  }

  const postedRows = posted.data ?? [];
  return {
    lastApprovedPostDate: (lastApproved.data?.date as string | undefined) ?? null,
    overduePosts: (dueToday.data ?? []).filter((post) => amsterdamStamp(post.date as string, post.time as string | null) < halfHourAgo).length,
    postedRecent: postedRows.length,
    postedRecentWithMetrics: postedRows.filter((post) => post.metrics !== null && post.metrics !== undefined).length,
    failingMailboxes,
    connectedActiveTenants: connected.size,
    lastInboundAt: (inbound.data?.created_at as string | undefined) ?? null,
    stuckAutosend: stuck.count ?? 0,
  };
}

export async function checkSilence(now = new Date()) {
  return evaluateSilence(await loadSilenceSnapshot(now), now);
}
