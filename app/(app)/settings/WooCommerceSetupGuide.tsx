"use client";

import { Check, ChevronRight, Copy, KeyRound, Plus, Settings, ShieldCheck, UserRound } from "lucide-react";

import CommerceSetupGuide, { GuideMockWindow, type CommerceGuideSlide } from "./CommerceSetupGuide";

type WooCommerceSetupGuideProps = {
  language: string;
  open: boolean;
  onClose: () => void;
};

function OpenSettingsVisual({ nl }: { nl: boolean }) {
  return (
    <GuideMockWindow address="shop.nl/wp-admin">
      <div className="commerce-guide-mock-title"><Settings size={16} /><strong>WordPress</strong></div>
      <div className="commerce-guide-setting-row"><div><small>{nl ? "Menu" : "Menu"}</small><strong>WooCommerce</strong></div><ChevronRight size={15} /></div>
      <div className="commerce-guide-setting-row" style={{ borderColor: "#b58aef", background: "#faf7ff", color: "#742bcf" }}><div><small>WooCommerce</small><strong>{nl ? "Instellingen" : "Settings"}</strong></div><ChevronRight size={15} /></div>
      <div className="commerce-guide-verified"><Check size={15} />{nl ? "Je blijft in je eigen WordPress-beheer" : "You stay inside your own WordPress admin"}</div>
    </GuideMockWindow>
  );
}

function RestApiVisual({ nl }: { nl: boolean }) {
  return (
    <GuideMockWindow address="shop.nl/wp-admin">
      <div className="commerce-guide-breadcrumb"><span>WooCommerce</span><ChevronRight size={10} /><span>{nl ? "Instellingen" : "Settings"}</span><ChevronRight size={10} /><strong>{nl ? "Geavanceerd" : "Advanced"}</strong></div>
      <div className="commerce-guide-tabs"><span>{nl ? "Pagina-instelling" : "Page setup"}</span><span data-active="true">REST API</span><span>Webhooks</span></div>
      <div className="commerce-guide-mock-heading"><div><strong>REST API</strong><small>{nl ? "Beheer toegang tot je webshop" : "Manage access to your store"}</small></div><span><Plus size={13} />{nl ? "Sleutel toevoegen" : "Add key"}</span></div>
      <div className="commerce-guide-empty"><div className="commerce-guide-empty__icon"><KeyRound size={22} /></div><strong>{nl ? "Maak een aparte SequenceFlow-sleutel" : "Create a separate SequenceFlow key"}</strong><small>{nl ? "Zo kun je toegang later altijd intrekken." : "You can revoke access at any time."}</small></div>
    </GuideMockWindow>
  );
}

function GenerateKeyVisual({ nl }: { nl: boolean }) {
  return (
    <GuideMockWindow address="shop.nl/wp-admin">
      <div className="commerce-guide-mock-title"><KeyRound size={16} /><strong>{nl ? "Sleutelgegevens" : "Key details"}</strong></div>
      <div className="commerce-guide-field"><small>{nl ? "Beschrijving" : "Description"}</small><div className="commerce-guide-select">SequenceFlow</div></div>
      <div className="commerce-guide-field" style={{ marginTop: 8 }}><small>{nl ? "Gebruiker" : "User"}</small><div className="commerce-guide-select"><span>{nl ? "Webshopbeheerder" : "Store administrator"}</span><UserRound size={13} /></div></div>
      <div className="commerce-guide-field" style={{ marginTop: 8 }}><small>{nl ? "Rechten" : "Permissions"}</small><div className="commerce-guide-select" data-highlight="true">Read/Write <Check size={13} /></div></div>
      <div className="commerce-guide-install-button">{nl ? "API-sleutel genereren" : "Generate API key"}</div>
    </GuideMockWindow>
  );
}

function CopyKeysVisual({ nl }: { nl: boolean }) {
  const fields = [
    { label: nl ? "Webshop URL" : "Store URL", value: "https://shop.nl" },
    { label: "Consumer key", value: "ck_••••••••••" },
    { label: "Consumer secret", value: "cs_••••••••••" },
  ];
  return (
    <GuideMockWindow address="shop.nl/wp-admin">
      <div className="commerce-guide-mock-title"><ShieldCheck size={16} /><strong>{nl ? "API-sleutel aangemaakt" : "API key generated"}</strong></div>
      {fields.map((field) => <div className="commerce-guide-credential" key={field.label}><div><small>{field.label}</small><strong>{field.value}</strong></div><Copy size={14} /></div>)}
      <div className="commerce-guide-verified"><ShieldCheck size={15} />{nl ? "SequenceFlow test toegang en webhooks" : "SequenceFlow tests access and webhooks"}</div>
    </GuideMockWindow>
  );
}

export default function WooCommerceSetupGuide({ language, open, onClose }: WooCommerceSetupGuideProps) {
  const nl = language === "nl";
  const slides: CommerceGuideSlide[] = nl ? [
    { title: "Open WooCommerce-instellingen", description: "Log in op het WordPress-beheer van je webshop en open WooCommerce → Instellingen.", note: "Je maakt de sleutel in je eigen webshop; SequenceFlow krijgt nooit je WordPress-wachtwoord.", visual: <OpenSettingsVisual nl /> },
    { title: "Ga naar de REST API", description: "Open Geavanceerd → REST API en kies Sleutel toevoegen. Maak een aparte sleutel voor SequenceFlow.", note: "Werkt de API niet, controleer dan onder Instellingen → Permalinks dat niet 'Plain' is geselecteerd.", visual: <RestApiVisual nl /> },
    { title: "Kies Read/Write", description: "Gebruik SequenceFlow als beschrijving, kies een beheerder met toegang tot orders en zet Rechten op Read/Write. Genereer daarna de sleutel.", note: "Write-toegang is nodig voor goedgekeurde annuleringen; zonder admin-goedkeuring voert SequenceFlow niets uit.", visual: <GenerateKeyVisual nl /> },
    { title: "Kopieer de sleutel direct", description: "Neem je webshop-URL, Consumer key en Consumer secret over in SequenceFlow en klik op Opslaan en controleren.", note: "WooCommerce toont het secret maar één keer. Daarna controleert SequenceFlow toegang en webhooks automatisch.", visual: <CopyKeysVisual nl /> },
  ] : [
    { title: "Open WooCommerce settings", description: "Sign in to your store's WordPress admin and open WooCommerce → Settings.", note: "You create the key inside your own store; SequenceFlow never receives your WordPress password.", visual: <OpenSettingsVisual nl={false} /> },
    { title: "Open the REST API", description: "Go to Advanced → REST API and select Add key. Create a separate key for SequenceFlow.", note: "If the API doesn't work, check Settings → Permalinks and make sure Plain isn't selected.", visual: <RestApiVisual nl={false} /> },
    { title: "Select Read/Write", description: "Use SequenceFlow as the description, select an administrator with order access, and set Permissions to Read/Write. Then generate the key.", note: "Write access is required for approved cancellations; SequenceFlow never acts without admin approval.", visual: <GenerateKeyVisual nl={false} /> },
    { title: "Copy the key immediately", description: "Copy your store URL, Consumer key, and Consumer secret into SequenceFlow and select Save and verify.", note: "WooCommerce shows the secret only once. SequenceFlow then verifies access and webhooks automatically.", visual: <CopyKeysVisual nl={false} /> },
  ];

  return <CommerceSetupGuide brandAlt="WooCommerce" brandHeight={23} brandSrc="/integrations/woocommerce-logo.svg" brandWidth={89} closeLabel={nl ? "Installatiehulp sluiten" : "Close setup guide"} eyebrow={(step, total) => nl ? `Stap ${step} van ${total}` : `Step ${step} of ${total}`} finalLabel={nl ? "Terug naar koppelen" : "Back to connection"} nextLabel={nl ? "Volgende" : "Next"} onClose={onClose} open={open} previousLabel={nl ? "Vorige" : "Previous"} progressLabel={nl ? "Installatiestappen" : "Setup steps"} slides={slides} subtitle={nl ? "Eenmalige installatie · ongeveer 3 minuten" : "One-time setup · about 3 minutes"} title={nl ? "WooCommerce koppelen" : "Connect WooCommerce"} />;
}
