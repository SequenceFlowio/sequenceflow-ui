"use client";

import Link from "next/link";

import { trackMarketingCta } from "./MarketingAttribution";

export function MarketingCta({ href, children, variant = "primary" }: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  const label = typeof children === "string" ? children : "cta";
  return (
    <Link
      href={href}
      className={`mk-button mk-button--${variant}`}
      onClick={() => trackMarketingCta(label, href)}
    >
      {children}
    </Link>
  );
}
