"use client";

import { useState } from "react";

import { OtisPanel } from "@/app/(app)/dashboard/OtisPanel";
import { shopDay } from "@/lib/inventory/core";
import { inventoryDemoView } from "@/lib/inventory/demo";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { UpgradeModalProvider } from "@/lib/upgradeModal";

/** ?scale=1 toont het blok zoals een Scale-klant het ziet; anders op slot. */
function mockApi() {
  if (typeof window === "undefined" || (window as { __overviewMock?: boolean }).__overviewMock) return;
  (window as { __overviewMock?: boolean }).__overviewMock = true;
  const scale = new URLSearchParams(window.location.search).get("scale") === "1";
  const real = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    if (url.startsWith("/api/inventory/alerts/count")) return json({ open: scale ? 4 : 0 });
    if (url.startsWith("/api/inventory")) return scale ? json(inventoryDemoView(shopDay(new Date()), "nl")) : json({ error: "Scale", upgrade: true }, 403);
    return real(input, init);
  };
}

export function OverviewDemo() {
  useState(mockApi);
  return (
    <main className="dark" style={{ minHeight: "100vh", background: "var(--sf-bg, #0a0a0a)", padding: "32px 16px" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <LanguageProvider><UpgradeModalProvider><OtisPanel nl enabled /></UpgradeModalProvider></LanguageProvider>
      </div>
    </main>
  );
}
