import { mailboxAlertText, type MailboxAlertLanguage } from "@/lib/email/mailboxAlertText";
import { sendEmail } from "@/lib/resend";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/** At most one alert per workspace per day, so a broken mailbox never floods anyone. */
const ALERT_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const MAILBOX_ALERT_OUTCOME = "mailbox_alert";

function opsAddress() {
  return process.env.SEQUENCEFLOW_OPS_EMAIL?.trim() || "hallo@sequenceflow.io";
}

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://support.sequenceflow.io").replace(/\/$/, "");
}

/**
 * Tells the workspace (and the SequenceFlow team) that fetching mail stopped,
 * so nobody silently misses customer email for days. Never throws: an alert
 * problem must not break the mail sync itself.
 */
export async function alertMailboxProblem(input: {
  tenantId: string;
  address: string | null;
  error: string;
  /** "workspace": the merchant and our team; "team": only our team (an internal problem). */
  audience: "workspace" | "team";
  direction?: "fetch" | "send";
}) {
  try {
    const db = getSupabaseAdmin();
    const sinceCutoff = new Date(Date.now() - ALERT_INTERVAL_MS).toISOString();
    const kind = input.audience === "team" ? "mailbox_processing_failed" : input.direction === "send" ? "mailbox_send_failed" : "mailbox_unreachable";
    const { data: recent, error: recentError } = await db.from("support_events").select("id")
      .eq("tenant_id", input.tenantId).eq("outcome", MAILBOX_ALERT_OUTCOME).eq("subject", kind).gte("created_at", sinceCutoff).limit(1);
    if (recentError) throw new Error(recentError.message);
    if (recent?.length) return { sent: false, reason: "recently_alerted" as const };

    // Record first, then send: two overlapping runs cannot both alert.
    const { error: logError } = await db.from("support_events").insert({
      tenant_id: input.tenantId,
      source: "imap",
      subject: kind,
      intent: "system",
      confidence: 1,
      latency_ms: 0,
      outcome: MAILBOX_ALERT_OUTCOME,
      draft_text: input.error.slice(0, 500),
    });
    if (logError) throw new Error(logError.message);

    const [{ data: members }, { data: config }, { data: install }, { data: lastInbound }] = await Promise.all([
      db.from("tenant_members").select("user_id").eq("tenant_id", input.tenantId),
      db.from("tenant_agent_config").select("language_default").eq("tenant_id", input.tenantId).maybeSingle(),
      db.from("shopify_installations").select("shop_domain").eq("tenant_id", input.tenantId).maybeSingle(),
      db.from("support_conversations").select("created_at").eq("tenant_id", input.tenantId)
        .not("customer_email", "ilike", "%.invalid").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const since = (lastInbound?.created_at as string | undefined) ?? null;
    const emails = new Set<string>();
    for (const member of input.audience === "workspace" ? members ?? [] : []) {
      const { data } = await db.auth.admin.getUserById(member.user_id as string);
      const email = data?.user?.email?.trim().toLowerCase();
      if (email && !email.endsWith(".local")) emails.add(email);
    }
    // A workspace without logins (Shopify-only) still gets the alert in its own mailbox.
    if (input.audience === "workspace" && input.address) emails.add(input.address.trim().toLowerCase());

    const language: MailboxAlertLanguage = config?.language_default === "en" ? "en" : "nl";
    const message = mailboxAlertText({
      language,
      address: input.address,
      error: input.error,
      since,
      reconnectUrl: `${siteUrl()}/integrations`,
      shopify: Boolean(install?.shop_domain),
      direction: input.direction ?? "fetch",
    });
    for (const to of emails) {
      await sendEmail({ to, subject: message.subject, text: message.text, replyTo: opsAddress() })
        .catch((error) => console.error("[mailbox-alert] could not email the workspace", error instanceof Error ? error.message : error));
    }
    await sendEmail({
      to: opsAddress(),
      subject: input.audience === "team"
        ? `[Support One] Could not process an email for workspace ${input.tenantId}`
        : input.direction === "send"
          ? `[Support One] Sending through the mailbox failed for workspace ${input.tenantId}`
          : `[Support One] Mailbox unreachable for workspace ${input.tenantId}`,
      text: [
        `Workspace: ${input.tenantId}${install?.shop_domain ? ` (Shopify: ${install.shop_domain})` : ""}`,
        `Mailbox: ${input.address ?? "unknown"}`,
        `Last customer email: ${since ?? "unknown"}`,
        `Error: ${input.error.slice(0, 300)}`,
        `Alert sent to: ${[...emails].length} address(es)`,
      ].join("\n"),
    }).catch((error) => console.error("[mailbox-alert] could not email the team", error instanceof Error ? error.message : error));
    return { sent: true as const, recipients: emails.size };
  } catch (error) {
    console.error("[mailbox-alert]", error instanceof Error ? error.message : error);
    return { sent: false, reason: "error" as const };
  }
}
