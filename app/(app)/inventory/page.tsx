import { notFound } from "next/navigation";

import InventoryClient from "./InventoryClient";

export const dynamic = "force-dynamic";

/** Inkoopadvies: stock and buying advice per variant. Hidden until the feature flag is on. */
export default function InventoryPage() {
  if (process.env.NEXT_PUBLIC_INVENTORY_ADVICE_ENABLED !== "true") notFound();
  return <InventoryClient />;
}
