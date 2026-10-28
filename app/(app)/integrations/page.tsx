import { redirect } from "next/navigation";

import { DEFAULT_APP_ORIGIN } from "@/lib/brand";
import { getTenantId } from "@/lib/tenant";
import IntegrationsClient from "./IntegrationsClient";
import { isIntegrationKey } from "./integrationKeys";

export const dynamic = "force-dynamic";

type IntegrationsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function IntegrationsPage({ searchParams }: IntegrationsPageProps) {
  try {
    const context = await getTenantId(new Request(`${DEFAULT_APP_ORIGIN}/integrations`));
    if (context.role !== "admin") redirect("/settings");
  } catch {
    redirect("/settings");
  }

  // ?koppeling=bol opent de instellingen van één koppeling; zonder parameter het overzicht.
  const { koppeling } = await searchParams;
  const selected = typeof koppeling === "string" && isIntegrationKey(koppeling) ? koppeling : null;
  return <IntegrationsClient selected={selected} />;
}
