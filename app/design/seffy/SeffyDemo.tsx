"use client";

import { useState } from "react";

import { SeffyOnboarding } from "@/app/(app)/inbox/SeffyOnboarding";
import { SettingsStyles } from "@/app/(app)/settings/SettingsUi";

/** Opslaan gaat hier naar een nep-API, zodat je alle stappen kunt doorlopen. */
function mockApi() {
  if (typeof window === "undefined" || (window as { __seffyMock?: boolean }).__seffyMock) return;
  (window as { __seffyMock?: boolean }).__seffyMock = true;
  const real = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith("/api/")) return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    return real(input, init);
  };
}

export function SeffyDemo() {
  useState(mockApi);
  const [key, setKey] = useState(0);
  return (
    <main className="dark" style={{ minHeight: "100vh", background: "var(--sf-bg, #0a0a0a)", padding: "32px 16px" }}>
      <SettingsStyles />
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <SeffyOnboarding key={key} nl imapActive knowledgeDocs={0} onDone={() => setKey((value) => value + 1)}
          start={{ replyTone: "friendly_informal", replyPronounPreference: "informal", languageDefault: "nl", senderName: "Customer Support", signature: "", allowDiscount: false, maxDiscountAmount: null }} />
      </div>
    </main>
  );
}
