import { redirect } from "next/navigation";

import { DEFAULT_APP_ORIGIN } from "@/lib/brand";
import { getTenantId } from "@/lib/tenant";
import CommerceDashboard from "./CommerceDashboard";

export const dynamic = "force-dynamic";

export default async function CommercePage() {
  try {
    const context = await getTenantId(new Request(`${DEFAULT_APP_ORIGIN}/commerce`));
    if (context.role !== "admin") redirect("/inbox");
  } catch {
    redirect("/inbox");
  }

  return <CommerceDashboard />;
}
