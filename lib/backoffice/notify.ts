import { planDisplayName } from "@/lib/planCatalog";
import { sendEmail } from "@/lib/resend";
import { SITE_ORIGIN } from "@/lib/site";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

import { noticeEmail, noticeRecipients, type Notice } from "./notifyCore";

/**
 * Stuurt een melding naar de beheerders. Gooit nooit: een mislukte melding mag een
 * aanmelding, betaling of webhook niet tegenhouden.
 *
 * Eerst vastleggen (backoffice_notifications, migratie 076), dan mailen: zo gaat dezelfde
 * gebeurtenis nooit twee keer. Bestaat de tabel nog niet, dan gaat de mail toch, behalve
 * als `requireLog` aan staat (de dagelijkse controle, die anders elke dag opnieuw mailt).
 */
export async function notifyAdmins(notice: Notice, options: { requireLog?: boolean } = {}) {
  try {
    const recipients = noticeRecipients(process.env);
    if (!recipients.length) return { sent: false, reason: "no_recipients" as const };
    const db = getSupabaseAdmin();
    const { data, error } = await db.from("backoffice_notifications")
      .upsert({ kind: notice.kind, ref: notice.ref.slice(0, 300), tenant_id: notice.tenantId ?? null }, { onConflict: "kind,ref", ignoreDuplicates: true })
      .select("id");
    if (error) {
      const missing = error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message);
      if (!missing || options.requireLog) {
        if (!missing) console.error("[backoffice/notify] vastleggen mislukt", error.message);
        return { sent: false, reason: "log_failed" as const };
      }
    } else if (!data?.length) {
      return { sent: false, reason: "already_sent" as const };
    }
    const mail = noticeEmail({ ...notice, plan: notice.plan ? planDisplayName(notice.plan) : notice.plan }, `${SITE_ORIGIN}/backoffice`);
    await Promise.all(recipients.map((to) => sendEmail({ to, subject: mail.subject, text: mail.text, html: mail.html })));
    return { sent: true as const };
  } catch (cause) {
    console.error("[backoffice/notify]", cause instanceof Error ? cause.message : cause);
    return { sent: false, reason: "error" as const };
  }
}

/** Naam, e-mail van de beheerder en herkomst van een werkruimte, voor in de melding. */
export async function workspaceFacts(tenantId: string) {
  const db = getSupabaseAdmin();
  const [{ data: tenant }, { data: member }] = await Promise.all([
    db.from("tenants").select("name, plan, affiliate_id, referred_by_tenant_id").eq("id", tenantId).maybeSingle(),
    db.from("tenant_members").select("user_id").eq("tenant_id", tenantId).eq("role", "admin").order("created_at").limit(1).maybeSingle(),
  ]);
  let email: string | null = null;
  if (member?.user_id) email = (await db.auth.admin.getUserById(member.user_id as string)).data.user?.email ?? null;
  let source: string | null = null;
  if (tenant?.affiliate_id) {
    const { data: affiliate } = await db.from("affiliates").select("username").eq("id", tenant.affiliate_id).maybeSingle();
    source = `Affiliate ${affiliate?.username ?? ""}`.trim();
  } else if (tenant?.referred_by_tenant_id) {
    const { data: referrer } = await db.from("tenants").select("name").eq("id", tenant.referred_by_tenant_id).maybeSingle();
    source = `Doorverwezen door ${referrer?.name ?? "een klant"}`;
  }
  return { workspace: (tenant?.name as string | null) ?? null, email, plan: (tenant?.plan as string | null) ?? null, source };
}

export const nlDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam" }) : null);
