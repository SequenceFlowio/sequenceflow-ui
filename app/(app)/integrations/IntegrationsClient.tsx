"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Link2, Lock } from "lucide-react";

import ShopifySettings from "../settings/ShopifySettings";
import SupportMailboxSettings from "../settings/SupportMailboxSettings";
import WooCommerceSettings from "../settings/WooCommerceSettings";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

type IntegrationSummary = { connected: number; attention: number };

export default function IntegrationsClient() {
  const { language } = useTranslation();
  const [summary, setSummary] = useState<IntegrationSummary | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/integrations/woocommerce", { cache: "no-store" }).then((response) => response.ok ? response.json() : null),
      fetch("/api/integrations/shopify", { cache: "no-store" }).then((response) => response.ok ? response.json() : null),
      fetch("/api/integrations/email/setup", { cache: "no-store" }).then((response) => response.ok ? response.json() : null),
    ]).then(([woo, shopify, mailbox]) => {
      const commerce = [woo?.connection, shopify?.connection].filter(Boolean);
      const mailboxConnected = Boolean(mailbox?.imap?.hasPassword || mailbox?.smtp?.hasPassword);
      const attention = commerce.filter((connection) => !["active", "paused"].includes(connection.status)).length
        + (mailboxConnected && (mailbox?.imap?.status !== "active" || mailbox?.smtp?.status !== "active") ? 1 : 0);
      setSummary({ connected: commerce.length + Number(mailboxConnected), attention });
    }).catch(() => setSummary({ connected: 0, attention: 0 }));
  }, []);

  const nl = language === "nl";

  return (
    <div className="integrations-page">
      <style>{`
        .integrations-page{width:min(100%,980px);margin:0 auto;padding:40px 24px 56px;display:grid;gap:22px}.integrations-heading h1{margin:0;color:var(--text);font-size:28px;font-weight:800;letter-spacing:0}.integrations-heading p{max-width:680px;margin:8px 0 0;color:var(--muted);font-size:14px;line-height:1.65}.integrations-overview{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid var(--border);border-radius:8px;background:var(--surface);overflow:hidden}.integrations-stat{display:flex;gap:11px;align-items:flex-start;padding:14px 16px}.integrations-stat+.integrations-stat{border-left:1px solid var(--border)}.integrations-stat svg{flex:none;margin-top:1px;color:var(--muted)}.integrations-stat strong,.integrations-stat span{display:block}.integrations-stat strong{color:var(--text);font-size:16px}.integrations-stat span{margin-top:2px;color:var(--muted);font-size:11px}.integrations-stack{display:grid;gap:18px}.integrations-coming{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 18px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--muted)}.integrations-coming div{display:flex;gap:11px;align-items:center}.integrations-coming strong{display:block;color:var(--text);font-size:13px}.integrations-coming span{display:block;margin-top:2px;font-size:11px}.integrations-coming small{font-size:10px;font-weight:800;text-transform:uppercase}@media(max-width:640px){.integrations-page{padding:28px 16px 40px}.integrations-overview{grid-template-columns:1fr}.integrations-stat+.integrations-stat{border-left:0;border-top:1px solid var(--border)}}
      `}</style>

      <header className="integrations-heading">
        <h1>{nl ? "Integraties" : "Integrations"}</h1>
        <p>{nl ? "Beheer de systemen die e-mail, orders en operationele acties met SequenceFlow verbinden." : "Manage the systems that connect email, orders, and operational actions to SequenceFlow."}</p>
      </header>

      <section className="integrations-overview" aria-label={nl ? "Integratieoverzicht" : "Integration overview"}>
        <div className="integrations-stat"><Link2 size={18} /><div><strong>{summary?.connected ?? "–"}</strong><span>{nl ? "gekoppeld" : "connected"}</span></div></div>
        <div className="integrations-stat"><AlertCircle size={18} /><div><strong>{summary?.attention ?? "–"}</strong><span>{nl ? "vereisen aandacht" : "need attention"}</span></div></div>
        <div className="integrations-stat"><CheckCircle2 size={18} /><div><strong>3</strong><span>{nl ? "beschikbare koppelingen" : "available connectors"}</span></div></div>
      </section>

      <div className="integrations-stack">
        <WooCommerceSettings />
        <ShopifySettings />
        <SupportMailboxSettings />
        <section className="integrations-coming">
          <div><Lock size={18} /><div><strong>Bol.com</strong><span>{nl ? "Verkopersberichten en besteltickets." : "Seller messages and order tickets."}</span></div></div>
          <small>{nl ? "Binnenkort" : "Coming soon"}</small>
        </section>
      </div>
    </div>
  );
}
