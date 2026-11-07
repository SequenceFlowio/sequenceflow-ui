"use client";

import Link from "next/link";

import { trackMarketingCta } from "./MarketingAttribution";

/**
 * Maakt een hele tegel klikbaar: de link ligt over de tegel heen, en alleen
 * elementen met .h1-raise (zoals een formulier) liggen erboven.
 */
export function TileLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="h1-tile-link" aria-label={label} onClick={() => trackMarketingCta(label, href)} />;
}
