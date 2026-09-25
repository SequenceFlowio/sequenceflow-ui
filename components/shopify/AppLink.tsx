"use client";
import Link from "next/link";
import type { ComponentProps } from "react";
import { embeddedPath } from "@/lib/shopify/client";
export default function AppLink({ href, ...props }: ComponentProps<typeof Link>) {
  return <Link {...props} href={typeof href === "string" ? embeddedPath(href) : href} />;
}
