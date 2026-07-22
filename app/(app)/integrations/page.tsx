import { redirect } from "next/navigation";

import { getTenantId } from "@/lib/tenant";
import IntegrationsClient from "./IntegrationsClient";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  try {
    const context = await getTenantId(new Request("https://emailreply.sequenceflow.io/integrations"));
    if (context.role !== "admin") redirect("/settings");
  } catch {
    redirect("/settings");
  }

  return <IntegrationsClient />;
}
