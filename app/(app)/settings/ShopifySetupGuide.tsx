"use client";

import { Check, Copy, KeyRound, LockKeyhole, Plus, ShieldCheck, Store } from "lucide-react";
import Image from "next/image";

import CommerceSetupGuide, { GuideMockWindow, type CommerceGuideSlide } from "./CommerceSetupGuide";

type ShopifySetupGuideProps = {
  language: string;
  open: boolean;
  onClose: () => void;
};

function CreateAppVisual({ nl }: { nl: boolean }) {
  return (
    <GuideMockWindow address="dev.shopify.com">
      <div className="commerce-guide-mock-heading">
        <div><strong>Apps</strong><small>{nl ? "Jouw organisatie" : "Your organization"}</small></div>
        <span><Plus size={13} />{nl ? "App maken" : "Create app"}</span>
      </div>
      <div className="commerce-guide-empty">
        <div className="commerce-guide-empty__icon"><Store size={23} /></div>
        <strong>{nl ? "Maak je SequenceFlow-app" : "Create your SequenceFlow app"}</strong>
        <small>{nl ? "Dit hoeft maar één keer voor deze webshop." : "You only do this once for this store."}</small>
      </div>
    </GuideMockWindow>
  );
}

function AccessVisual({ nl }: { nl: boolean }) {
  return (
    <GuideMockWindow address="dev.shopify.com">
      <div className="commerce-guide-mock-title"><ShieldCheck size={16} /><strong>{nl ? "API-toegang" : "API access"}</strong></div>
      <div className="commerce-guide-field"><small>{nl ? "Vereiste rechten" : "Required scopes"}</small><div><span>read_orders</span><span>write_orders</span></div></div>
      <div className="commerce-guide-setting-row"><div><small>Webhooks API</small><strong>2026-07</strong></div><Check size={15} /></div>
      <div className="commerce-guide-setting-row"><div><small>{nl ? "Beschermde gegevens" : "Protected data"}</small><strong>Orders · Email</strong></div><Check size={15} /></div>
    </GuideMockWindow>
  );
}

function InstallVisual({ nl }: { nl: boolean }) {
  return (
    <GuideMockWindow address="admin.shopify.com">
      <div className="commerce-guide-install-logo"><Image src="/integrations/shopify-logo.svg" alt="" width={92} height={27} /></div>
      <div className="commerce-guide-permission"><LockKeyhole size={20} /><div><strong>{nl ? "SequenceFlow toegang geven" : "Give SequenceFlow access"}</strong><small>{nl ? "Alleen orders lezen en gecontroleerd wijzigen" : "Only read and safely update orders"}</small></div></div>
      <div className="commerce-guide-install-button"><Check size={14} />{nl ? "App installeren" : "Install app"}</div>
    </GuideMockWindow>
  );
}

function CredentialsVisual({ nl }: { nl: boolean }) {
  return (
    <GuideMockWindow address="dev.shopify.com">
      <div className="commerce-guide-mock-title"><KeyRound size={16} /><strong>{nl ? "App-gegevens" : "App credentials"}</strong></div>
      {["store.myshopify.com", "Client ID", "Client secret"].map((label, index) => (
        <div className="commerce-guide-credential" key={label}><div><small>{index === 0 ? (nl ? "Shopdomein" : "Shop domain") : label}</small><strong>{index === 2 ? "••••••••••••" : label}</strong></div><Copy size={14} /></div>
      ))}
      <div className="commerce-guide-verified"><ShieldCheck size={15} />{nl ? "SequenceFlow controleert de rest" : "SequenceFlow verifies the rest"}</div>
    </GuideMockWindow>
  );
}

export default function ShopifySetupGuide({ language, open, onClose }: ShopifySetupGuideProps) {
  const nl = language === "nl";
  const slides: CommerceGuideSlide[] = nl ? [
    { title: "Maak één Shopify-app", description: "Open het Shopify Dev Dashboard van de webshopeigenaar, kies App maken en noem de app SequenceFlow.", note: "Dit is een eenmalige pilotstap per webshop.", visual: <CreateAppVisual nl /> },
    { title: "Geef minimale toegang", description: "Voeg alleen read_orders en write_orders toe. Kies webhookversie 2026-07 en activeer bij beschermde ordergegevens alleen Email.", note: "SequenceFlow vraagt geen klantnamen, adressen of volledige orderhistorie op.", visual: <AccessVisual nl /> },
    { title: "Installeer de app", description: "Release de appversie en installeer de app vervolgens op de webshop die je wilt koppelen.", note: "Shopify laat vóór installatie precies zien welke rechten je verleent.", visual: <InstallVisual nl /> },
    { title: "Neem drie gegevens over", description: "Kopieer het .myshopify.com-domein, de Client ID en het Client secret naar SequenceFlow. Klik daarna op Opslaan en controleren.", note: "Daarna beheert SequenceFlow tokens, controles, webhooks en synchronisatie automatisch.", visual: <CredentialsVisual nl /> },
  ] : [
    { title: "Create one Shopify app", description: "Open the store owner's Shopify Dev Dashboard, choose Create app, and name it SequenceFlow.", note: "This is a one-time pilot step for each store.", visual: <CreateAppVisual nl={false} /> },
    { title: "Grant minimal access", description: "Add only read_orders and write_orders. Select webhook version 2026-07 and enable only Email under protected order data.", note: "SequenceFlow doesn't request customer names, addresses, or full order history.", visual: <AccessVisual nl={false} /> },
    { title: "Install the app", description: "Release the app version and install the app on the store you want to connect.", note: "Shopify shows the exact permissions before installation.", visual: <InstallVisual nl={false} /> },
    { title: "Copy three credentials", description: "Copy the .myshopify.com domain, Client ID, and Client secret into SequenceFlow. Then select Save and verify.", note: "SequenceFlow then manages tokens, checks, webhooks, and synchronization automatically.", visual: <CredentialsVisual nl={false} /> },
  ];

  return <CommerceSetupGuide brandAlt="Shopify" brandHeight={25} brandSrc="/integrations/shopify-logo.svg" brandWidth={86} closeLabel={nl ? "Installatiehulp sluiten" : "Close setup guide"} eyebrow={(step, total) => nl ? `Stap ${step} van ${total}` : `Step ${step} of ${total}`} finalHref="https://dev.shopify.com/dashboard" finalLabel={nl ? "Open Shopify" : "Open Shopify"} nextLabel={nl ? "Volgende" : "Next"} onClose={onClose} open={open} previousLabel={nl ? "Vorige" : "Previous"} progressLabel={nl ? "Installatiestappen" : "Setup steps"} slides={slides} subtitle={nl ? "Eenmalige installatie · ongeveer 5 minuten" : "One-time setup · about 5 minutes"} title={nl ? "Shopify koppelen" : "Connect Shopify"} />;
}
