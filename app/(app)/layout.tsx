import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { AppShell } from "@/components/AppShell";
import { TrialBanner } from "@/components/TrialBanner";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAgencyWhitelistedEmail } from "@/lib/billingWhitelist";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getTenantPlanInfo(): Promise<{
  plan: string;
  trialEndsAt: string | null;
  daysLeft: number | null;
} | null> {
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    if (isAgencyWhitelistedEmail(user.email)) {
      return { plan: "agency", trialEndsAt: null, daysLeft: null };
    }

    const admin = getSupabaseAdmin();
    const { data: member } = await admin
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!member?.tenant_id) return null;

    const { data: tenant } = await admin
      .from("tenants")
      .select("plan, trial_ends_at")
      .eq("id", member.tenant_id)
      .single();

    if (!tenant) return null;

    let daysLeft: number | null = null;
    if (tenant.trial_ends_at) {
      const diff = new Date(tenant.trial_ends_at).getTime() - Date.now();
      daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    return { plan: tenant.plan ?? "trial", trialEndsAt: tenant.trial_ends_at, daysLeft };
  } catch {
    return null;
  }
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const planInfo = await getTenantPlanInfo();

  return (
    <ThemeProvider>
      <LanguageProvider>
        <AppShell>
          {planInfo && (
            <TrialBanner plan={planInfo.plan} daysLeft={planInfo.daysLeft} />
          )}
          {children}
        </AppShell>
      </LanguageProvider>
    </ThemeProvider>
  );
}
