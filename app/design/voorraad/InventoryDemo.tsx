"use client";

import { useState } from "react";

import InventoryClient from "@/app/(app)/inventory/InventoryClient";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { UpgradeModalProvider } from "@/lib/upgradeModal";

/** Zonder login vraagt de pagina om een upgrade en toont hij de demo: precies wat we hier willen zien. */
function mockInventoryApi() {
  if (typeof window === "undefined" || (window as { __invMock?: boolean }).__invMock) return;
  (window as { __invMock?: boolean }).__invMock = true;
  const real = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith("/api/inventory")) return new Response(JSON.stringify({ error: "Scale", upgrade: true }), { status: 403, headers: { "Content-Type": "application/json" } });
    return real(input, init);
  };
}

export function InventoryDemo() {
  useState(mockInventoryApi);
  return <main className="dark" style={{ minHeight: "100vh", background: "var(--sf-bg, #0a0a0a)", padding: "24px 0" }}><LanguageProvider><UpgradeModalProvider><InventoryClient /></UpgradeModalProvider></LanguageProvider></main>;
}
