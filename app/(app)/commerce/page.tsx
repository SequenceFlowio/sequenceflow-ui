import { redirect } from "next/navigation";

import { getTenantId } from "@/lib/tenant";
import CommerceDashboard from "./CommerceDashboard";

export const dynamic = "force-dynamic";

export default async function CommercePage() {
  try {
    const context = await getTenantId(new Request("https://emailreply.sequenceflow.io/commerce"));
    if (context.role !== "admin") redirect("/inbox");
  } catch {
    redirect("/inbox");
  }

  return <CommerceDashboard />;
}
