"use client";

import { useTranslation } from "@/lib/i18n/LanguageProvider";

export default function ShopifySettings() {
  const { language } = useTranslation(); const nl = language === "nl";
  return (
    <section data-locked="true" style={{ border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, opacity: 0.72 }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase" }}>Commerce</p>
        <p style={{ margin: "5px 0 0", fontSize: 15, fontWeight: 800, color: "var(--text)" }}>Shopify</p>
        <p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>{nl ? "Shopify wordt na de WooCommerce-pilot geactiveerd." : "Shopify will be enabled after the WooCommerce pilot."}</p>
      </div>
      <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 9px", borderRadius: 6, background: "var(--bg)", border: "1px solid var(--border)", color: "var(--muted)", fontSize: 10, fontWeight: 800 }}>
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
        {nl ? "Binnenkort" : "Coming soon"}
      </span>
    </section>
  );
}
