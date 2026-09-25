"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import BolSettings from "../settings/BolSettings";
import SenderFiltersSettings from "../settings/SenderFiltersSettings";
import { SettingsStyles } from "../settings/SettingsUi";
import ShopifyAppLinkSettings from "../settings/ShopifyAppLinkSettings";
import SupportMailboxSettings from "../settings/SupportMailboxSettings";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

export default function IntegrationsClient() {
  const { language } = useTranslation();
  const nl = language === "nl";

  return (
    <div className="integrations-page">
      <SettingsStyles />
      <style>{`
        .integrations-page{width:min(100%,980px);margin:0 auto;padding:40px 24px 56px;display:grid;gap:22px}.integrations-heading h1{margin:0;color:var(--text);font-size:30px;font-weight:500;letter-spacing:-.02em}.integrations-heading p{max-width:680px;margin:8px 0 0;color:var(--muted);font-size:14px;line-height:1.65}.integrations-stack{display:grid;gap:18px}.integrations-orders{display:inline-flex;align-items:center;gap:7px;width:fit-content;color:var(--text);font-size:13px;font-weight:600;text-decoration:none;border-bottom:1px solid var(--border);padding-bottom:3px}.integrations-orders:hover{color:var(--brand);border-color:var(--brand)}@media(max-width:640px){.integrations-page{padding:28px 16px 40px}}
      `}</style>

      <header className="integrations-heading">
        <h1>{nl ? "Koppelingen" : "Connections"}</h1>
        <p>{nl ? "Verbind je supportmailbox en voeg desgewenst bestelgegevens toe." : "Connect your support mailbox and optionally add order data."}</p>
      </header>

      {/* De mailbox is verplicht, de webshopkoppeling optioneel: dus in die volgorde. */}
      <div className="integrations-stack">
        <SupportMailboxSettings />
        <SenderFiltersSettings />
        <BolSettings />
        <ShopifyAppLinkSettings />
        <Link href="/commerce" className="integrations-orders">
          {nl ? "Bekijk welke bestelgegevens Support One gebruikt" : "See which order data Support One uses"}
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
