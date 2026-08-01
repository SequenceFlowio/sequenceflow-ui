import { redirect } from "next/navigation";

import { DEFAULT_APP_ORIGIN } from "@/lib/brand";
import { getTenantId } from "@/lib/tenant";
import IntegrationsClient from "./IntegrationsClient";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  try {
    const context = await getTenantId(new Request(`${DEFAULT_APP_ORIGIN}/integrations`));
    if (context.role !== "admin") redirect("/settings");
  } catch {
    redirect("/settings");
  }

  return <IntegrationsClient />;
}
