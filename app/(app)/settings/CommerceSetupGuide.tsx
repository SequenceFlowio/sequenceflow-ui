"use client";

import { ArrowLeft, ArrowRight, ExternalLink, ShieldCheck, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";

export type CommerceGuideSlide = {
  title: string;
  description: string;
  note: string;
  visual: ReactNode;
};

type CommerceSetupGuideProps = {
  brandAlt: string;
  brandHeight: number;
  brandSrc: string;
  brandWidth: number;
  closeLabel: string;
  eyebrow: (step: number, total: number) => string;
  finalHref?: string;
  finalLabel: string;
  nextLabel: string;
  onClose: () => void;
  open: boolean;
  previousLabel: string;
  progressLabel: string;
  slides: CommerceGuideSlide[];
  subtitle: string;
  title: string;
};

export function GuideMockWindow({ address, children }: { address: string; children: ReactNode }) {
  return (
    <div className="commerce-guide-window">
      <div className="commerce-guide-window__bar">
        <span /><span /><span />
        <div>{address}</div>
      </div>
      <div className="commerce-guide-window__body">{children}</div>
    </div>
  );
}

export default function CommerceSetupGuide({
  brandAlt,
  brandHeight,
  brandSrc,
  brandWidth,
  closeLabel,
  eyebrow,
  finalHref,
  finalLabel,
  nextLabel,
  onClose,
  open,
  previousLabel,
  progressLabel,
  slides,
  subtitle,
  title,
}: CommerceSetupGuideProps) {
  const [step, setStep] = useState(0);

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
    <div className="commerce-guide-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="commerce-guide" role="dialog" aria-modal="true" aria-labelledby="commerce-guide-title">
        <style>{`
          .commerce-guide-overlay{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,23,20,.62);backdrop-filter:blur(5px)}
          .commerce-guide{width:min(880px,100%);max-height:min(720px,calc(100vh - 40px));overflow:auto;border:1px solid #dfe5dc;border-radius:8px;background:#fff;box-shadow:0 24px 70px rgba(15,23,20,.26)}
          .commerce-guide__header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 18px;border-bottom:1px solid #e5e9e3}.commerce-guide__brand{display:flex;align-items:center;gap:12px;min-width:0}.commerce-guide__brand-logo{display:grid;place-items:center;min-width:106px;height:38px;padding:0 9px;border-radius:8px;background:#f2f8e8}.commerce-guide__brand-text{min-width:0}.commerce-guide__brand-text strong{display:block;color:#151c17;font-size:14px}.commerce-guide__brand-text span{display:block;margin-top:2px;color:#718076;font-size:11px}.commerce-guide__close{display:grid;place-items:center;width:32px;height:32px;padding:0;border:1px solid #e1e6df;border-radius:8px;background:#fff;color:#667269;cursor:pointer}.commerce-guide__close:hover{background:#f4f6f3;color:#111713}
          .commerce-guide__progress{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:14px 18px 0}.commerce-guide__progress span{height:3px;border-radius:3px;background:#e6ebe3}.commerce-guide__progress span[data-active=true]{background:#74a92d}.commerce-guide__content{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(260px,.85fr);gap:28px;align-items:center;padding:22px 24px 26px}.commerce-guide__visual{min-width:0;padding:20px;border:1px solid #e4eadf;border-radius:8px;background:#f6f9f3}.commerce-guide__copy{min-width:0}.commerce-guide__eyebrow{margin:0 0 9px;color:#6d9f28;font-size:10px;font-weight:800;text-transform:uppercase}.commerce-guide__copy h2{margin:0;color:#141b16;font-size:24px;line-height:1.18}.commerce-guide__description{margin:13px 0 0;color:#58645c;font-size:13px;line-height:1.65}.commerce-guide__note{display:flex;gap:9px;margin:18px 0 0;padding:11px 12px;border:1px solid #d9eabf;border-radius:8px;background:#f7fbea;color:#526d2d;font-size:11px;line-height:1.5}.commerce-guide__note svg{flex:none;margin-top:1px}
          .commerce-guide__footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 18px;border-top:1px solid #e5e9e3}.commerce-guide__dots{display:flex;gap:6px}.commerce-guide__dots button{width:7px;height:7px;padding:0;border:0;border-radius:50%;background:#d6ddd3;cursor:pointer}.commerce-guide__dots button[data-active=true]{width:20px;border-radius:4px;background:#75a92e}.commerce-guide__actions{display:flex;gap:8px}.commerce-guide__button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:36px;padding:0 13px;border:1px solid #dce2d9;border-radius:8px;background:#fff;color:#1c241e;font:inherit;font-size:11px;font-weight:750;text-decoration:none;cursor:pointer}.commerce-guide__button:hover{background:#f5f7f4}.commerce-guide__button--primary{border-color:#b9ec5e;background:#c7f56f;color:#172300}.commerce-guide__button--primary:hover{background:#bbeb62}
          .commerce-guide-window{overflow:hidden;border:1px solid #d8dfd5;border-radius:8px;background:#fff;box-shadow:0 10px 25px rgba(36,52,37,.08)}.commerce-guide-window__bar{display:flex;align-items:center;gap:5px;height:30px;padding:0 10px;border-bottom:1px solid #e6eae4;background:#f1f4f0}.commerce-guide-window__bar>span{width:7px;height:7px;border-radius:50%;background:#cbd3c8}.commerce-guide-window__bar>div{margin-left:7px;color:#859087;font-size:8px}.commerce-guide-window__body{min-height:250px;padding:17px}.commerce-guide-mock-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.commerce-guide-mock-heading div strong,.commerce-guide-mock-heading div small{display:block}.commerce-guide-mock-heading div strong{font-size:14px}.commerce-guide-mock-heading div small{margin-top:2px;color:#89938b;font-size:8px}.commerce-guide-mock-heading>span,.commerce-guide-install-button{display:inline-flex;align-items:center;gap:5px;padding:7px 9px;border-radius:6px;background:#1f2821;color:#fff;font-size:8px;font-weight:750}.commerce-guide-empty{display:grid;justify-items:center;margin-top:33px;padding:25px 12px;border:1px dashed #dce3d9;border-radius:8px;text-align:center}.commerce-guide-empty__icon{display:grid;place-items:center;width:43px;height:43px;margin-bottom:10px;border-radius:8px;background:#edf7dd;color:#679927}.commerce-guide-empty strong{font-size:10px}.commerce-guide-empty small{margin-top:5px;color:#7b867e;font-size:8px}.commerce-guide-mock-title{display:flex;align-items:center;gap:7px;margin-bottom:14px;color:#263129;font-size:11px}.commerce-guide-field{padding:10px;border:1px solid #dfe5dc;border-radius:7px}.commerce-guide-field small,.commerce-guide-setting-row small,.commerce-guide-credential small{display:block;color:#879188;font-size:8px}.commerce-guide-field div{display:flex;gap:5px;margin-top:7px;flex-wrap:wrap}.commerce-guide-field span{padding:4px 6px;border-radius:5px;background:#edf6df;color:#547d1f;font-size:8px;font-weight:750}.commerce-guide-setting-row,.commerce-guide-credential{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;padding:9px 10px;border:1px solid #e3e7e1;border-radius:7px;color:#609125}.commerce-guide-setting-row strong,.commerce-guide-credential strong{display:block;margin-top:3px;color:#29322b;font-size:9px}.commerce-guide-install-logo{display:flex;justify-content:center;padding:12px 0 17px}.commerce-guide-permission{display:flex;align-items:center;gap:10px;padding:13px;border:1px solid #dfe5dc;border-radius:8px;color:#699d28}.commerce-guide-permission strong,.commerce-guide-permission small{display:block}.commerce-guide-permission strong{color:#273029;font-size:10px}.commerce-guide-permission small{margin-top:3px;color:#7d897f;font-size:8px}.commerce-guide-install-button{justify-content:center;margin-top:13px;padding:10px}.commerce-guide-verified{display:flex;align-items:center;gap:7px;margin-top:11px;padding:9px 10px;border-radius:7px;background:#edf7dd;color:#547c22;font-size:8px;font-weight:750}.commerce-guide-breadcrumb{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-bottom:14px;color:#7a867d;font-size:8px}.commerce-guide-breadcrumb strong{color:#6d31c8}.commerce-guide-tabs{display:flex;gap:14px;margin-bottom:14px;border-bottom:1px solid #e4e8e2}.commerce-guide-tabs span{padding:0 0 7px;color:#7e8980;font-size:8px}.commerce-guide-tabs span[data-active=true]{border-bottom:2px solid #873eff;color:#5f22bd;font-weight:800}.commerce-guide-select{display:flex;align-items:center;justify-content:space-between;margin-top:5px;padding:8px 9px;border:1px solid #dde3da;border-radius:6px;color:#273029;font-size:9px}.commerce-guide-select[data-highlight=true]{border-color:#a56bf4;background:#faf7ff;color:#6c2fc2;font-weight:750}
          @media(max-width:700px){.commerce-guide-overlay{padding:10px}.commerce-guide{max-height:calc(100vh - 20px)}.commerce-guide__content{grid-template-columns:1fr;gap:18px;padding:18px}.commerce-guide__visual{padding:13px}.commerce-guide-window__body{min-height:220px}.commerce-guide__copy h2{font-size:20px}.commerce-guide__footer{align-items:flex-end}.commerce-guide__dots{padding-bottom:14px}.commerce-guide__actions{flex:1;justify-content:flex-end}.commerce-guide__button{padding:0 10px}}
          @media(max-width:440px){.commerce-guide__brand-logo{min-width:96px}.commerce-guide__brand-text span{display:none}.commerce-guide__content{padding:15px}.commerce-guide__visual{padding:9px}.commerce-guide__actions{width:100%}.commerce-guide__footer{flex-wrap:wrap}.commerce-guide__dots{order:2;width:100%;justify-content:center;padding:0}.commerce-guide__button--primary{flex:1}}
        `}</style>

        <header className="commerce-guide__header">
          <div className="commerce-guide__brand">
            <div className="commerce-guide__brand-logo"><Image src={brandSrc} alt={brandAlt} width={brandWidth} height={brandHeight} /></div>
            <div className="commerce-guide__brand-text"><strong id="commerce-guide-title">{title}</strong><span>{subtitle}</span></div>
          </div>
          <button className="commerce-guide__close" type="button" onClick={onClose} aria-label={closeLabel} title={closeLabel} autoFocus><X size={17} /></button>
        </header>

        <div className="commerce-guide__progress" aria-hidden="true">
          {slides.map((item, index) => <span data-active={index <= step} key={item.title} />)}
        </div>

        <div className="commerce-guide__content">
          <div className="commerce-guide__visual" aria-hidden="true">{slide.visual}</div>
          <div className="commerce-guide__copy">
            <p className="commerce-guide__eyebrow">{eyebrow(step + 1, slides.length)}</p>
            <h2>{slide.title}</h2>
            <p className="commerce-guide__description">{slide.description}</p>
            <p className="commerce-guide__note"><ShieldCheck size={16} />{slide.note}</p>
          </div>
        </div>

        <footer className="commerce-guide__footer">
          <div className="commerce-guide__dots" aria-label={progressLabel}>
            {slides.map((item, index) => <button type="button" key={item.title} data-active={index === step} onClick={() => setStep(index)} aria-label={eyebrow(index + 1, slides.length)} aria-current={index === step ? "step" : undefined} />)}
          </div>
          <div className="commerce-guide__actions">
            {step > 0 ? <button className="commerce-guide__button" type="button" onClick={() => setStep((current) => current - 1)}><ArrowLeft size={14} />{previousLabel}</button> : null}
            {finalStep ? finalHref ? (
              <a className="commerce-guide__button commerce-guide__button--primary" href={finalHref} target="_blank" rel="noreferrer">{finalLabel}<ExternalLink size={14} /></a>
            ) : (
              <button className="commerce-guide__button commerce-guide__button--primary" type="button" onClick={onClose}>{finalLabel}<ShieldCheck size={14} /></button>
            ) : (
              <button className="commerce-guide__button commerce-guide__button--primary" type="button" onClick={() => setStep((current) => current + 1)}>{nextLabel}<ArrowRight size={14} /></button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
