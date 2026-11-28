import type { SupabaseClient } from "@supabase/supabase-js";

import { notifyAdmins, workspaceFacts } from "@/lib/backoffice/notify";
import { getErrorMessage } from "@/lib/errors";
import { isTeamWhitelistedEmail } from "@/lib/billingWhitelist";
import { decodeAttribution, MARKETING_COOKIE, recordMarketingEvent } from "@/lib/marketing/attribution";
import { INTERNAL_COOKIE } from "@/lib/marketing/attributionCore";
import { ensureTrialLead } from "@/lib/sales/trials";
import { REF_COOKIE } from "@/lib/referrals/program";
import { attributeNewTenant } from "@/lib/referrals/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { defaultTenantName, provisionTenant } from "@/lib/tenant/provision";

type CookieReader = {
  get: (name: string) => { value: string } | undefined;
  set?: (name: string, value: string, options?: { maxAge?: number; path?: string; sameSite?: "lax"; secure?: boolean; httpOnly?: boolean }) => unknown;
};

/**
 * Een nieuwe aanmelding: de app geeft dit één keer door aan GA4 en Meta als conversie
 * (components/marketing/AppConversions.tsx), alleen als de bezoeker op de site toestemming gaf.
 */
export const CONVERSION_COOKIE = "sf_conv";

/**
 * Wat er na elke geslaagde login gebeurt, via Google of via e-mail:
 * bij de eerste login een werkruimte aanmaken (anders geeft elke API-call
 * "Tenant not found"), de doorverwijzing onthouden, de beheerders een seintje
 * geven en de marketingbron vastleggen. Gooit nooit: een fout hier mag de
 * login zelf niet breken.
 */
export async function finishSignIn(supabase: SupabaseClient, cookieStore: CookieReader, channel: "Google" | "E-mail") {
  // Alleen de eerste login is een aanmelding. Eerder telde elke login met een herkomst-cookie
  // als signup_completed, waardoor een paar terugkerende accounts de aanmeldcijfers vulden.
  let newTenantId: string | null = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const admin = getSupabaseAdmin();

      const { data: existingMember } = await admin
        .from("tenant_members")
        .select("tenant_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existingMember) {
        console.log("[auth] Provisioning tenant for first login.");
        const { tenantId } = await provisionTenant({ userId: user.id, name: defaultTenantName(user) });
        newTenantId = tenantId;

        // Via een doorverwijs- of affiliatelink binnengekomen? Dan onthouden bij de nieuwe workspace.
        try {
          await attributeNewTenant(tenantId, user, cookieStore.get(REF_COOKIE)?.value);
        } catch (refError) {
          console.error("[auth] referral attribution failed:", getErrorMessage(refError));
        }
        try {
          cookieStore.set?.(CONVERSION_COOKIE, "sign_up", { maxAge: 600, path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production", httpOnly: false });
        } catch {
          // In sommige contexten kan geen cookie worden gezet; dan telt de conversie alleen in onze eigen meting.
        }
        // Seintje aan de beheerders; gooit nooit.
        const facts = await workspaceFacts(tenantId).catch(() => null);
        await notifyAdmins({ kind: "signup", ref: tenantId, tenantId, workspace: facts?.workspace ?? null, email: user.email ?? facts?.email ?? null, channel, source: facts?.source ?? null });
      }
    }
  } catch (provisionErr: unknown) {
    // Non-fatal — user will see "Tenant not found" but we log it
    console.error("[auth] Tenant provisioning error:", getErrorMessage(provisionErr));
  }

  if (!newTenantId) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Ook zonder herkomst-cookie vastleggen (dan als direct), zodat elke aanmelding in de funnel staat.
      const attribution = decodeAttribution(cookieStore.get(MARKETING_COOKIE)?.value) ?? { sessionId: crypto.randomUUID(), path: "/auth/callback" };
      const internal = cookieStore.get(INTERNAL_COOKIE)?.value === "1" || isTeamWhitelistedEmail(user.email);
      await recordMarketingEvent({
        ...attribution,
        event: "signup_completed",
        path: "/auth/callback",
        userId: user.id,
        tenantId: newTenantId,
        internal,
      });
      // Meteen in de CRM, met een belmoment op de tweede werkdag.
      if (!internal && user.email) {
        await ensureTrialLead(getSupabaseAdmin(), { tenantId: newTenantId, name: defaultTenantName(user), email: user.email, createdAt: new Date().toISOString(), paying: false })
          .catch((leadError) => console.error("[auth] lead aanmaken mislukt:", getErrorMessage(leadError)));
      }
    }
  } catch (trackingError) {
    console.error("[auth] signup attribution failed:", getErrorMessage(trackingError));
  }
}
