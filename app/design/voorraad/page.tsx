import { InventoryDemo } from "./InventoryDemo";

export const metadata = { title: "Voorraad — demo", robots: { index: false, follow: false } };

/** De voorraadpagina met demogegevens, zonder login te bekijken. */
export default function InventoryDemoPage() {
  return <InventoryDemo />;
}
