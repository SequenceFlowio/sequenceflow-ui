"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Mail, Sparkles } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import BolSettings from "../settings/BolSettings";
import { StatusPill } from "../settings/CommerceIntegrationUi";
import McpSettings from "../settings/McpSettings";
import SenderFiltersSettings from "../settings/SenderFiltersSettings";
import { Notice, SettingsStyles } from "../settings/SettingsUi";
import ShopifyAppLinkSettings from "../settings/ShopifyAppLinkSettings";
import SupportMailboxSettings from "../settings/SupportMailboxSettings";
import WooCommerceSettings from "../settings/WooCommerceSettings";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import type { IntegrationKey } from "./integrationKeys";


type Tone = "success" | "warning" | "error" | "neutral";
type TileStatus = { tone: Tone; label: string; detail?: string | null };
type Statuses = Partial<Record<IntegrationKey, TileStatus>> & { shopifyAppEnabled?: boolean };

async function getJson(url: string) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

function commerceStatus(connection: { status?: string; displayName?: string | null; shopDomain?: string } | null | undefined, nl: boolean): TileStatus {
  if (!connection) return { tone: "neutral", label: nl ? "Niet gekoppeld" : "Not connected" };
  const detail = connection.displayName || connection.shopDomain || null;
  if (connection.status === "active") return { tone: "success", label: nl ? "Gekoppeld" : "Connected", detail };
  if (connection.status === "paused") return { tone: "warning", label: nl ? "Gepauzeerd" : "Paused", detail };
  if (connection.status === "failed") return { tone: "error", label: nl ? "Actie nodig" : "Needs attention", detail };
  return { tone: "warning", label: nl ? "Nog testen" : "Needs a test", detail };
}

/** Status per koppeling voor het overzicht, uit dezelfde endpoints als de detailpagina's. */
function useStatuses(nl: boolean) {
  const [statuses, setStatuses] = useState<Statuses | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      getJson("/api/integrations/email/setup"),
      getJson("/api/integrations/bol"),
      getJson("/api/shopify/link-code"),
      getJson("/api/integrations/woocommerce"),
      getJson("/api/mcp/tokens"),
    ]).then(([mail, bol, shopify, woo, mcp]) => {
      if (!active) return;
      const next: Statuses = { shopifyAppEnabled: Boolean(shopify?.enabled) };

      if (mail) {
        const inbound = Boolean(mail.isForwardingActive || mail.isImapActive);
        next.mail = inbound && mail.isOutboundActive
          ? { tone: "success", label: nl ? "Gekoppeld" : "Connected", detail: mail.senderEmail ?? null }
          : inbound
            ? { tone: "warning", label: nl ? "Versturen nog instellen" : "Set up sending", detail: mail.senderEmail ?? null }
            : { tone: "error", label: nl ? "Nog niet gekoppeld" : "Not connected yet" };
      }
      next.bol = commerceStatus(bol?.connection, nl);
      next.woocommerce = commerceStatus(woo?.connection, nl);
      next.shopify = shopify?.linkedShop
        ? { tone: "success", label: nl ? "Gekoppeld" : "Connected", detail: shopify.linkedShop }
        : { tone: "neutral", label: nl ? "Niet gekoppeld" : "Not connected" };
      const connectedApps = (mcp?.apps?.length ?? 0) + (mcp?.keys?.length ?? 0);
      next.ai = connectedApps
        ? { tone: "success", label: nl ? `${connectedApps} verbonden` : `${connectedApps} connected` }
        : { tone: "neutral", label: nl ? "Niet gekoppeld" : "Not connected" };
      setStatuses(next);
    });
    return () => { active = false; };
  }, [nl]);

  return statuses;
}

function BolLogo() {
  return (
    <span className="integration-logo-crop">
      <Image src="/integrations/bol-logo.jpg" alt="bol.com" width={121} height={66} />
    </span>
  );
}

function Tile({ href, logo, title, description, status }: { href: string; logo: ReactNode; title: string; description: string; status?: TileStatus }) {
  return (
    <Link href={href} className="integration-tile">
      <div className="integration-tile-top">
        <div className="integration-tile-logo">{logo}</div>
        <ChevronRight size={16} className="integration-tile-arrow" aria-hidden />
      </div>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <div className="integration-tile-status">
        {status ? <StatusPill tone={status.tone} label={status.label} /> : <span className="integration-tile-loading" />}
        {status?.detail ? <span className="integration-tile-detail">{status.detail}</span> : null}
      </div>
    </Link>
  );
}

function Overview({ nl, statuses }: { nl: boolean; statuses: Statuses | null }) {
  const mail = statuses?.mail;
  const mailConnected = mail?.tone === "success";
  const mailPoints = nl
    ? ["Gmail, Outlook of elke andere mailbox", "Antwoorden gaan vanaf je eigen adres", "In een paar minuten ingesteld"]
    : ["Gmail, Outlook or any other mailbox", "Replies leave from your own address", "Set up in a few minutes"];

  return (
    <>
      <Link href="/integrations?koppeling=mail" className={`integration-hero${mailConnected ? "" : " needs-setup"}`}>
        <div className="integration-hero-icon"><Mail size={22} /></div>
        <div className="integration-hero-copy">
          <div className="integration-hero-title">
            <span className="integration-eyebrow">{nl ? "Begin hier" : "Start here"}</span>
            {mail ? <StatusPill tone={mail.tone} label={mail.label} /> : null}
          </div>
          <h2>{nl ? "Supportmailbox" : "Support mailbox"}</h2>
          <p>
            {nl
              ? "Het hart van Support One. Klantmails komen hier binnen, Support One schrijft het antwoord en verstuurt het vanaf je eigen adres. Zonder mailbox gebeurt er niets."
              : "The heart of Support One. Customer email comes in here, Support One writes the reply and sends it from your own address. Without a mailbox nothing happens."}
          </p>
          <ul>
            {mailPoints.map((point) => <li key={point}><Check size={14} aria-hidden />{point}</li>)}
          </ul>
        </div>
        <div className="integration-hero-action">
          {mail?.detail ? <span className="integration-tile-detail">{mail.detail}</span> : null}
          <span className="settings-btn primary">
            {mailConnected ? (nl ? "Beheren" : "Manage") : (nl ? "Mailbox koppelen" : "Connect mailbox")}
            <ArrowRight size={14} />
          </span>
        </div>
      </Link>

      <section className="integration-group">
        <h3>{nl ? "Webshops en marktplaatsen" : "Shops and marketplaces"}</h3>
        <p>{nl ? "Bestellingen, tracking en retouren als context bij elke klantvraag." : "Orders, tracking and returns as context for every customer question."}</p>
        <div className="integration-grid">
          <Tile href="/integrations?koppeling=bol" logo={<span className="integration-brand"><BolLogo /></span>} title="bol.com" description={nl ? "Bestellingen en klantvragen van bol.com." : "Orders and customer questions from bol.com."} status={statuses?.bol} />
          <Tile href="/integrations?koppeling=shopify" logo={<span className="integration-brand"><Image src="/integrations/shopify-logo.svg" alt="" width={88} height={25} /></span>} title="Shopify" description={nl ? "Bestellingen, voorraad en retouren uit je winkel." : "Orders, stock and returns from your store."} status={statuses?.shopify} />
          <Tile href="/integrations?koppeling=woocommerce" logo={<span className="integration-brand"><Image src="/integrations/woocommerce-logo.svg" alt="" width={77} height={20} /></span>} title="WooCommerce" description={nl ? "Live bestellingen uit je WordPress-webshop." : "Live orders from your WordPress store."} status={statuses?.woocommerce} />
        </div>
      </section>

      <section className="integration-group">
        <h3>{nl ? "AI-assistenten" : "AI assistants"}</h3>
        <p>{nl ? "Praat met Support One vanuit de assistent die je al gebruikt." : "Talk to Support One from the assistant you already use."}</p>
        <div className="integration-grid">
          <Tile href="/integrations?koppeling=ai" logo={<span className="integration-icon"><Sparkles size={18} /></span>} title={nl ? "Claude en ChatGPT" : "Claude and ChatGPT"} description={nl ? "Vraag naar je support, bestellingen en kennisbank." : "Ask about your support, orders and knowledge base."} status={statuses?.ai} />
        </div>
      </section>

      <Link href="/commerce" className="integrations-orders">
        {nl ? "Bekijk welke bestelgegevens Support One gebruikt" : "See which order data Support One uses"}
        <ArrowRight size={14} />
      </Link>
    </>
  );
}

function Detail({ selected, nl, statuses }: { selected: IntegrationKey; nl: boolean; statuses: Statuses | null }) {
  switch (selected) {
    case "mail":
      return <><SupportMailboxSettings /><SenderFiltersSettings /></>;
    case "bol":
      return <BolSettings />;
    case "woocommerce":
      return <WooCommerceSettings />;
    case "ai":
      return <McpSettings />;
    case "shopify":
      return (
        <>
          <Notice tone="info" title={nl ? "Shopify koppel je via de Shopify-app" : "Shopify connects through the Shopify app"}>
            {nl
              ? "Installeer de app SequenceFlow Support vanuit je Shopify-admin. Heb je hier al een werkruimte met je kennis en mailbox? Maak dan hieronder een code en vul die in de app in."
              : "Install the SequenceFlow Support app from your Shopify admin. Already have a workspace here with your knowledge and mailbox? Create a code below and enter it in the app."}
          </Notice>
          {statuses?.shopifyAppEnabled ? <ShopifyAppLinkSettings /> : null}
        </>
      );
  }
}

export default function IntegrationsClient({ selected }: { selected: IntegrationKey | null }) {
  const { language } = useTranslation();
  const nl = language === "nl";
  const statuses = useStatuses(nl);

  return (
    <div className="integrations-page">
      <SettingsStyles />
      <style>{`
        .integrations-page{width:min(100%,980px);margin:0 auto;padding:40px 24px 56px;display:grid;gap:22px}.integrations-heading h1{margin:0;color:var(--text);font-size:30px;font-weight:500;letter-spacing:-.02em}.integrations-heading p{max-width:680px;margin:8px 0 0;color:var(--muted);font-size:14px;line-height:1.65}.integrations-stack{display:grid;gap:18px}.integrations-orders{display:inline-flex;align-items:center;gap:7px;width:fit-content;color:var(--text);font-size:13px;font-weight:600;text-decoration:none;border-bottom:1px solid var(--border);padding-bottom:3px}.integrations-orders:hover{color:var(--brand);border-color:var(--brand)}
        .integrations-back{display:inline-flex;align-items:center;gap:7px;width:fit-content;color:var(--muted);font-size:13px;font-weight:600;text-decoration:none}.integrations-back:hover{color:var(--text)}
        .integration-hero{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:20px;align-items:center;padding:24px;border:1px solid rgba(199,245,111,.35);border-radius:20px;background:linear-gradient(135deg,rgba(199,245,111,.1),var(--surface) 55%);color:var(--text);text-decoration:none;transition:border-color .15s,transform .15s}.integration-hero:hover{border-color:#c7f56f;transform:translateY(-1px)}.integration-hero-icon{width:52px;height:52px;display:grid;place-items:center;align-self:start;border-radius:14px;background:#c7f56f;color:#142000}.integration-hero-title{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.integration-eyebrow{color:var(--tone-success);font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase}.integration-hero h2{margin:6px 0 0;font-size:22px;font-weight:500;letter-spacing:-.01em}.integration-hero p{max-width:560px;margin:6px 0 0;color:var(--muted);font-size:13px;line-height:1.6}.integration-hero ul{display:flex;flex-wrap:wrap;gap:6px 16px;margin:12px 0 0;padding:0;list-style:none}.integration-hero li{display:inline-flex;align-items:center;gap:6px;color:var(--text);font-size:12px}.integration-hero li svg{color:var(--tone-success)}.integration-hero-action{display:grid;justify-items:end;gap:8px}
        .integration-group{display:grid;gap:4px}.integration-group h3{margin:6px 0 0;color:var(--text);font-size:15px;font-weight:500}.integration-group>p{margin:0 0 8px;color:var(--muted);font-size:13px}
        .integration-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
        .integration-tile{display:grid;gap:12px;align-content:start;padding:16px;border:1px solid var(--border);border-radius:16px;background:var(--surface);color:var(--text);text-decoration:none;transition:border-color .15s,transform .15s}.integration-tile:hover{border-color:color-mix(in srgb,#c7f56f 55%,var(--border));transform:translateY(-1px)}.integration-tile-top{display:flex;align-items:center;justify-content:space-between;height:36px}.integration-tile-logo{display:flex;align-items:center}.integration-tile-arrow{color:var(--muted)}.integration-tile strong{display:block;font-size:14px;font-weight:600}.integration-tile p{margin:4px 0 0;color:var(--muted);font-size:12px;line-height:1.5}.integration-tile-status{display:flex;align-items:center;gap:8px;min-height:24px;min-width:0}.integration-tile-detail{min-width:0;overflow:hidden;color:var(--muted);font-size:11px;text-overflow:ellipsis;white-space:nowrap}.integration-tile-loading{width:90px;height:22px;border-radius:999px;background:var(--surface-subtle)}
        .integration-brand{height:36px;display:inline-flex;align-items:center;padding:0 10px;border-radius:10px;background:#fff}.integration-brand:has(.integration-logo-crop){padding:0 4px}.integration-logo-crop{position:relative;display:block;width:91px;height:36px;overflow:hidden;border-radius:10px}.integration-logo-crop img{position:absolute;left:-15px;top:-15px;width:121px;height:66px;max-width:none}
        .integration-icon{width:36px;height:36px;display:grid;place-items:center;border-radius:10px;background:rgba(199,245,111,.12);color:var(--tone-success)}
        @media(max-width:820px){.integration-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.integration-hero{grid-template-columns:auto minmax(0,1fr)}.integration-hero-action{grid-column:1/-1;justify-items:start}}
        @media(max-width:560px){.integrations-page{padding:28px 16px 40px}.integration-grid{grid-template-columns:1fr}.integration-hero{grid-template-columns:1fr;padding:18px}}
      `}</style>

      {selected ? (
        <>
          <Link href="/integrations" className="integrations-back"><ArrowLeft size={14} />{nl ? "Alle koppelingen" : "All connections"}</Link>
          <div className="integrations-stack"><Detail selected={selected} nl={nl} statuses={statuses} /></div>
        </>
      ) : (
        <>
          <header className="integrations-heading">
            <h1>{nl ? "Koppelingen" : "Connections"}</h1>
            <p>{nl ? "Koppel eerst je mailbox. Voeg daarna je webshop toe, zodat Support One bestellingen kent." : "Connect your mailbox first. Then add your shop, so Support One knows your orders."}</p>
          </header>
          <Overview nl={nl} statuses={statuses} />
        </>
      )}
    </div>
  );
}
