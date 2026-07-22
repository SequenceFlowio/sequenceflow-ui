"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Store,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

type ShopifySetupGuideProps = {
  language: string;
  open: boolean;
  onClose: () => void;
};

const SHOPIFY_DASHBOARD_URL = "https://dev.shopify.com/dashboard";

function MockWindow({ children }: { children: React.ReactNode }) {
  return (
    <div className="shopify-guide-window">
      <div className="shopify-guide-window__bar">
        <span /><span /><span />
        <div>dev.shopify.com</div>
      </div>
      <div className="shopify-guide-window__body">{children}</div>
    </div>
  );
}

function CreateAppVisual({ nl }: { nl: boolean }) {
  return (
    <MockWindow>
      <div className="shopify-guide-mock-heading">
        <div><strong>Apps</strong><small>{nl ? "Jouw organisatie" : "Your organization"}</small></div>
        <span><Plus size={13} />{nl ? "App maken" : "Create app"}</span>
      </div>
      <div className="shopify-guide-empty">
        <div className="shopify-guide-empty__icon"><Store size={23} /></div>
        <strong>{nl ? "Maak je SequenceFlow-app" : "Create your SequenceFlow app"}</strong>
        <small>{nl ? "Dit hoeft maar één keer voor deze webshop." : "You only do this once for this store."}</small>
      </div>
    </MockWindow>
  );
}

function AccessVisual({ nl }: { nl: boolean }) {
  return (
    <MockWindow>
      <div className="shopify-guide-mock-title"><ShieldCheck size={16} /><strong>{nl ? "API-toegang" : "API access"}</strong></div>
      <div className="shopify-guide-field">
        <small>{nl ? "Vereiste rechten" : "Required scopes"}</small>
        <div><span>read_orders</span><span>write_orders</span></div>
      </div>
      <div className="shopify-guide-setting-row">
        <div><small>Webhooks API</small><strong>2026-07</strong></div><Check size={15} />
      </div>
      <div className="shopify-guide-setting-row">
        <div><small>{nl ? "Beschermde gegevens" : "Protected data"}</small><strong>Orders · Email</strong></div><Check size={15} />
      </div>
    </MockWindow>
  );
}

function InstallVisual({ nl }: { nl: boolean }) {
  return (
    <MockWindow>
      <div className="shopify-guide-install-logo"><Image src="/integrations/shopify-logo.svg" alt="" width={92} height={27} /></div>
      <div className="shopify-guide-permission">
        <LockKeyhole size={20} />
        <div><strong>{nl ? "SequenceFlow toegang geven" : "Give SequenceFlow access"}</strong><small>{nl ? "Alleen orders lezen en gecontroleerd wijzigen" : "Only read and safely update orders"}</small></div>
      </div>
      <div className="shopify-guide-install-button"><Check size={14} />{nl ? "App installeren" : "Install app"}</div>
    </MockWindow>
  );
}

function CredentialsVisual({ nl }: { nl: boolean }) {
  return (
    <MockWindow>
      <div className="shopify-guide-mock-title"><KeyRound size={16} /><strong>{nl ? "App-gegevens" : "App credentials"}</strong></div>
      {["store.myshopify.com", "Client ID", "Client secret"].map((label, index) => (
        <div className="shopify-guide-credential" key={label}>
          <div><small>{index === 0 ? (nl ? "Shopdomein" : "Shop domain") : label}</small><strong>{index === 2 ? "••••••••••••" : label}</strong></div>
          <Copy size={14} />
        </div>
      ))}
      <div className="shopify-guide-verified"><ShieldCheck size={15} />{nl ? "SequenceFlow controleert de rest" : "SequenceFlow verifies the rest"}</div>
    </MockWindow>
  );
}

export default function ShopifySetupGuide({ language, open, onClose }: ShopifySetupGuideProps) {
  const nl = language === "nl";
  const [step, setStep] = useState(0);

  const slides = nl ? [
    {
      title: "Maak één Shopify-app",
      description: "Open het Shopify Dev Dashboard van de webshopeigenaar, kies App maken en noem de app SequenceFlow.",
      note: "Dit is een eenmalige pilotstap per webshop.",
      visual: <CreateAppVisual nl />,
    },
    {
      title: "Geef minimale toegang",
      description: "Voeg alleen read_orders en write_orders toe. Kies webhookversie 2026-07 en activeer bij beschermde ordergegevens alleen Email.",
      note: "SequenceFlow vraagt geen klantnamen, adressen of volledige orderhistorie op.",
      visual: <AccessVisual nl />,
    },
    {
      title: "Installeer de app",
      description: "Release de appversie en installeer de app vervolgens op de webshop die je wilt koppelen.",
      note: "Shopify laat vóór installatie precies zien welke rechten je verleent.",
      visual: <InstallVisual nl />,
    },
    {
      title: "Neem drie gegevens over",
      description: "Kopieer het .myshopify.com-domein, de Client ID en het Client secret naar SequenceFlow. Klik daarna op Opslaan en controleren.",
      note: "Daarna beheert SequenceFlow tokens, controles, webhooks en synchronisatie automatisch.",
      visual: <CredentialsVisual nl />,
    },
  ] : [
    {
      title: "Create one Shopify app",
      description: "Open the store owner's Shopify Dev Dashboard, choose Create app, and name it SequenceFlow.",
      note: "This is a one-time pilot step for each store.",
      visual: <CreateAppVisual nl={false} />,
    },
    {
      title: "Grant minimal access",
      description: "Add only read_orders and write_orders. Select webhook version 2026-07 and enable only Email under protected order data.",
      note: "SequenceFlow doesn't request customer names, addresses, or full order history.",
      visual: <AccessVisual nl={false} />,
    },
    {
      title: "Install the app",
      description: "Release the app version and install the app on the store you want to connect.",
      note: "Shopify shows the exact permissions before installation.",
      visual: <InstallVisual nl={false} />,
    },
    {
      title: "Copy three credentials",
      description: "Copy the .myshopify.com domain, Client ID, and Client secret into SequenceFlow. Then select Save and verify.",
      note: "SequenceFlow then manages tokens, checks, webhooks, and synchronization automatically.",
      visual: <CredentialsVisual nl={false} />,
    },
  ];

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  const slide = slides[step];
  const finalStep = step === slides.length - 1;

  return (
    <div className="shopify-guide-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="shopify-guide" role="dialog" aria-modal="true" aria-labelledby="shopify-guide-title">
        <style>{`
          .shopify-guide-overlay{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,23,20,.62);backdrop-filter:blur(5px)}
          .shopify-guide{width:min(880px,100%);max-height:min(720px,calc(100vh - 40px));overflow:auto;border:1px solid #dfe5dc;border-radius:8px;background:#fff;box-shadow:0 24px 70px rgba(15,23,20,.26)}
          .shopify-guide__header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 18px;border-bottom:1px solid #e5e9e3}
          .shopify-guide__brand{display:flex;align-items:center;gap:12px;min-width:0}.shopify-guide__brand-logo{display:grid;place-items:center;width:106px;height:38px;border-radius:8px;background:#f2f8e8}.shopify-guide__brand-text{min-width:0}.shopify-guide__brand-text strong{display:block;color:#151c17;font-size:14px}.shopify-guide__brand-text span{display:block;margin-top:2px;color:#718076;font-size:11px}
          .shopify-guide__close{display:grid;place-items:center;width:32px;height:32px;padding:0;border:1px solid #e1e6df;border-radius:8px;background:#fff;color:#667269;cursor:pointer}.shopify-guide__close:hover{background:#f4f6f3;color:#111713}
          .shopify-guide__progress{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:14px 18px 0}.shopify-guide__progress span{height:3px;border-radius:3px;background:#e6ebe3}.shopify-guide__progress span[data-active=true]{background:#74a92d}
          .shopify-guide__content{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(260px,.85fr);gap:28px;align-items:center;padding:22px 24px 26px}
          .shopify-guide__visual{min-width:0;padding:20px;border:1px solid #e4eadf;border-radius:8px;background:#f6f9f3}.shopify-guide__copy{min-width:0}.shopify-guide__eyebrow{margin:0 0 9px;color:#6d9f28;font-size:10px;font-weight:800;text-transform:uppercase}.shopify-guide__copy h2{margin:0;color:#141b16;font-size:24px;line-height:1.18}.shopify-guide__description{margin:13px 0 0;color:#58645c;font-size:13px;line-height:1.65}.shopify-guide__note{display:flex;gap:9px;margin:18px 0 0;padding:11px 12px;border:1px solid #d9eabf;border-radius:8px;background:#f7fbea;color:#526d2d;font-size:11px;line-height:1.5}.shopify-guide__note svg{flex:none;margin-top:1px}
          .shopify-guide__footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 18px;border-top:1px solid #e5e9e3}.shopify-guide__dots{display:flex;gap:6px}.shopify-guide__dots button{width:7px;height:7px;padding:0;border:0;border-radius:50%;background:#d6ddd3;cursor:pointer}.shopify-guide__dots button[data-active=true]{width:20px;border-radius:4px;background:#75a92e}.shopify-guide__actions{display:flex;gap:8px}.shopify-guide__button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:36px;padding:0 13px;border:1px solid #dce2d9;border-radius:8px;background:#fff;color:#1c241e;font:inherit;font-size:11px;font-weight:750;text-decoration:none;cursor:pointer}.shopify-guide__button:hover{background:#f5f7f4}.shopify-guide__button--primary{border-color:#b9ec5e;background:#c7f56f;color:#172300}.shopify-guide__button--primary:hover{background:#bbeb62}
          .shopify-guide-window{overflow:hidden;border:1px solid #d8dfd5;border-radius:8px;background:#fff;box-shadow:0 10px 25px rgba(36,52,37,.08)}.shopify-guide-window__bar{display:flex;align-items:center;gap:5px;height:30px;padding:0 10px;border-bottom:1px solid #e6eae4;background:#f1f4f0}.shopify-guide-window__bar>span{width:7px;height:7px;border-radius:50%;background:#cbd3c8}.shopify-guide-window__bar>div{margin-left:7px;color:#859087;font-size:8px}.shopify-guide-window__body{min-height:250px;padding:17px}.shopify-guide-mock-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.shopify-guide-mock-heading div strong,.shopify-guide-mock-heading div small{display:block}.shopify-guide-mock-heading div strong{font-size:14px}.shopify-guide-mock-heading div small{margin-top:2px;color:#89938b;font-size:8px}.shopify-guide-mock-heading>span,.shopify-guide-install-button{display:inline-flex;align-items:center;gap:5px;padding:7px 9px;border-radius:6px;background:#1f2821;color:#fff;font-size:8px;font-weight:750}.shopify-guide-empty{display:grid;justify-items:center;margin-top:33px;padding:25px 12px;border:1px dashed #dce3d9;border-radius:8px;text-align:center}.shopify-guide-empty__icon{display:grid;place-items:center;width:43px;height:43px;margin-bottom:10px;border-radius:8px;background:#edf7dd;color:#679927}.shopify-guide-empty strong{font-size:10px}.shopify-guide-empty small{margin-top:5px;color:#7b867e;font-size:8px}.shopify-guide-mock-title{display:flex;align-items:center;gap:7px;margin-bottom:14px;color:#263129;font-size:11px}.shopify-guide-field{padding:10px;border:1px solid #dfe5dc;border-radius:7px}.shopify-guide-field small,.shopify-guide-setting-row small,.shopify-guide-credential small{display:block;color:#879188;font-size:8px}.shopify-guide-field div{display:flex;gap:5px;margin-top:7px;flex-wrap:wrap}.shopify-guide-field span{padding:4px 6px;border-radius:5px;background:#edf6df;color:#547d1f;font-size:8px;font-weight:750}.shopify-guide-setting-row,.shopify-guide-credential{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;padding:9px 10px;border:1px solid #e3e7e1;border-radius:7px;color:#609125}.shopify-guide-setting-row strong,.shopify-guide-credential strong{display:block;margin-top:3px;color:#29322b;font-size:9px}.shopify-guide-install-logo{display:flex;justify-content:center;padding:12px 0 17px}.shopify-guide-permission{display:flex;align-items:center;gap:10px;padding:13px;border:1px solid #dfe5dc;border-radius:8px;color:#699d28}.shopify-guide-permission strong,.shopify-guide-permission small{display:block}.shopify-guide-permission strong{color:#273029;font-size:10px}.shopify-guide-permission small{margin-top:3px;color:#7d897f;font-size:8px}.shopify-guide-install-button{justify-content:center;margin-top:13px;padding:10px}.shopify-guide-verified{display:flex;align-items:center;gap:7px;margin-top:11px;padding:9px 10px;border-radius:7px;background:#edf7dd;color:#547c22;font-size:8px;font-weight:750}
          @media(max-width:700px){.shopify-guide-overlay{padding:10px}.shopify-guide{max-height:calc(100vh - 20px)}.shopify-guide__content{grid-template-columns:1fr;gap:18px;padding:18px}.shopify-guide__visual{padding:13px}.shopify-guide-window__body{min-height:220px}.shopify-guide__copy h2{font-size:20px}.shopify-guide__footer{align-items:flex-end}.shopify-guide__dots{padding-bottom:14px}.shopify-guide__actions{flex:1;justify-content:flex-end}.shopify-guide__button{padding:0 10px}}
          @media(max-width:440px){.shopify-guide__brand-text span{display:none}.shopify-guide__content{padding:15px}.shopify-guide__visual{padding:9px}.shopify-guide__actions{width:100%}.shopify-guide__footer{flex-wrap:wrap}.shopify-guide__dots{order:2;width:100%;justify-content:center;padding:0}.shopify-guide__button--primary{flex:1}}
        `}</style>

        <header className="shopify-guide__header">
          <div className="shopify-guide__brand">
            <div className="shopify-guide__brand-logo"><Image src="/integrations/shopify-logo.svg" alt="Shopify" width={86} height={25} /></div>
            <div className="shopify-guide__brand-text"><strong id="shopify-guide-title">{nl ? "Shopify koppelen" : "Connect Shopify"}</strong><span>{nl ? "Eenmalige installatie · ongeveer 5 minuten" : "One-time setup · about 5 minutes"}</span></div>
          </div>
          <button className="shopify-guide__close" type="button" onClick={onClose} aria-label={nl ? "Installatiehulp sluiten" : "Close setup guide"} title={nl ? "Sluiten" : "Close"} autoFocus><X size={17} /></button>
        </header>

        <div className="shopify-guide__progress" aria-hidden="true">
          {slides.map((item, index) => <span data-active={index <= step} key={item.title} />)}
        </div>

        <div className="shopify-guide__content">
          <div className="shopify-guide__visual" aria-hidden="true">{slide.visual}</div>
          <div className="shopify-guide__copy">
            <p className="shopify-guide__eyebrow">{nl ? `Stap ${step + 1} van ${slides.length}` : `Step ${step + 1} of ${slides.length}`}</p>
            <h2>{slide.title}</h2>
            <p className="shopify-guide__description">{slide.description}</p>
            <p className="shopify-guide__note"><ShieldCheck size={16} />{slide.note}</p>
          </div>
        </div>

        <footer className="shopify-guide__footer">
          <div className="shopify-guide__dots" aria-label={nl ? "Installatiestappen" : "Setup steps"}>
            {slides.map((item, index) => <button type="button" key={item.title} data-active={index === step} onClick={() => setStep(index)} aria-label={nl ? `Ga naar stap ${index + 1}` : `Go to step ${index + 1}`} aria-current={index === step ? "step" : undefined} />)}
          </div>
          <div className="shopify-guide__actions">
            {step > 0 ? <button className="shopify-guide__button" type="button" onClick={() => setStep((current) => current - 1)}><ArrowLeft size={14} />{nl ? "Vorige" : "Previous"}</button> : null}
            {finalStep ? (
              <a className="shopify-guide__button shopify-guide__button--primary" href={SHOPIFY_DASHBOARD_URL} target="_blank" rel="noreferrer">{nl ? "Open Shopify" : "Open Shopify"}<ExternalLink size={14} /></a>
            ) : (
              <button className="shopify-guide__button shopify-guide__button--primary" type="button" onClick={() => setStep((current) => current + 1)}>{nl ? "Volgende" : "Next"}<ArrowRight size={14} /></button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
