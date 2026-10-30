import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { AppShell } from "@/components/AppShell";
import { TrialBanner } from "@/components/TrialBanner";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { readSessionClaims } from "@/lib/auth/sessionClaims";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isTeamWhitelistedEmail, whitelistedPlan } from "@/lib/billingWhitelist";
import { FULL_PRODUCT_NAME } from "@/lib/brand";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: `Support One | SequenceFlow`,
  description: "Je werkplek voor klantvragen met Support One.",
  applicationName: FULL_PRODUCT_NAME,
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PlanInfo = {
  plan: string;
  trialEndsAt: string | null;
  daysLeft: number | null;
  isAdmin: boolean;
};

/**
 * The one place that decides whether the signed-in user may see the app:
 * no workspace or an expired plan sends them away, otherwise the plan feeds
 * the trial banner. proxy.ts only checks that someone is signed in.
 */
async function loadWorkspace(): Promise<{ redirectTo: string } | { planInfo: PlanInfo }> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );

    const session = await readSessionClaims(supabase);
    if (!session) return { redirectTo: "/login" };
    const admin = getSupabaseAdmin();
    const { data: member } = await admin
      .from("tenant_members")
      .select("tenant_id, role")
      .eq("user_id", session.userId)
      .single();

    // Our own team may open the app without a workspace of its own.
    if (isTeamWhitelistedEmail(session.email)) {
      return { planInfo: { plan: "agency", trialEndsAt: null, daysLeft: null, isAdmin: member?.role === "admin" } };
    }
    if (!member?.tenant_id) return { redirectTo: "/login?error=tenant" };
    const isAdmin = member.role === "admin";

    const { data: tenant } = await admin
      .from("tenants")
      .select("plan, trial_ends_at")
      .eq("id", member.tenant_id)
      .single();

    if (!tenant) return { redirectTo: "/login?error=tenant" };

    // A whitelisted account keeps its plan, whatever the workspace says.
    const whitelisted = whitelistedPlan(session.email);
    if (whitelisted) return { planInfo: { plan: whitelisted, trialEndsAt: null, daysLeft: null, isAdmin } };

    const trialExpired = tenant.plan === "trial"
      && tenant.trial_ends_at
      && new Date(tenant.trial_ends_at) < new Date();
    if (tenant.plan === "expired" || trialExpired) return { redirectTo: "/upgrade" };

    let daysLeft: number | null = null;
    if (tenant.trial_ends_at) {
      const diff = new Date(tenant.trial_ends_at).getTime() - Date.now();
      daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    return { planInfo: { plan: tenant.plan ?? "trial", trialEndsAt: tenant.trial_ends_at, daysLeft, isAdmin } };
  } catch {
    return { redirectTo: "/login?error=access" };
  }
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const workspace = await loadWorkspace();
  if ("redirectTo" in workspace) redirect(workspace.redirectTo);
  const { planInfo } = workspace;

  return (

      <LanguageProvider>
        <AppShell isAdmin={planInfo.isAdmin}>
          <TrialBanner plan={planInfo.plan} daysLeft={planInfo.daysLeft} />
          {children}
        </AppShell>
      </LanguageProvider>

  );
}
