"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, Menu, X } from "lucide-react";
import { DEFAULT_APP_ORIGIN } from "@/lib/brand";
import { PRODUCTS } from "@/lib/marketing/products";
import { SequenceMark } from "./SequenceMark";

type Section = "products" | "solutions" | "company";
type Product = "support" | "content";
const SECTIONS: Array<[Section, string]> = [["products", "Producten"], ["solutions", "Toepassingen"], ["company", "Bedrijf"]];
const LINKS = {
  solutions: [
    { href: `${DEFAULT_APP_ORIGIN}/#voorbeelden`, title: "Klantvragen afhandelen", description: "Van inkomende mail naar een gecontroleerd antwoord." },
    { href: "/#voorraad", title: "Voorraad & inkoop", description: "Weet wat opraakt en wat je moet bijbestellen." },
    { href: "/content", title: "Social content maken", description: "Van product naar post en planning. Early access." },
  ],
  company: [
    { href: "/contact", title: "Kennismaken", description: "Bespreek wat jouw webshop nodig heeft." },
    { href: "/affiliate", title: "Partners & affiliates", description: "Groei met ons mee." },
    { href: "/blog", title: "Verhalen & inzichten", description: "Praktische kennis voor je webshop." },
    { href: "/privacyverklaring", title: "Privacy & vertrouwen", description: "Hoe we omgaan met jouw gegevens." },
  ],
};

function ProductPreview({ product }: { product: Product }) {
  return <div className={`sn-preview sn-preview--${product}`} aria-hidden="true" key={product}>
    {product === "support" ? <>
      <div className="sn-preview-header"><SequenceMark size={30} state="reading" gear="headset" title="" /><span>Support One</span><small>Voorbeeld</small></div>
      <div className="sn-conversation"><div className="sn-question"><small>SANNE · KLANTVRAAG</small><strong>Waar blijft mijn pakket?</strong></div><div className="sn-source"><Check size={13} /> Bestelling gevonden · onderweg</div><div className="sn-answer"><small>ANTWOORDCONCEPT</small><p>Hoi Sanne, je bestelling is onderweg. Via je track & trace vind je de laatste verzendstatus.</p><span className="sn-ready"><Check size={12} /> Klaar voor jouw controle</span></div></div>
      <span className="sn-preview-caption">Vraag → context → antwoordconcept</span>
    </> : <>
      <div className="sn-content-grid"><div><Image src="/media/site/content-post.jpg" alt="" fill sizes="340px" /><span>Van je product…</span></div><div><Image src="/media/site/content-example-carousel.jpg" alt="" fill sizes="170px" /></div><div><Image src="/media/site/content-example-ugc.jpg" alt="" fill sizes="170px" /></div></div>
      <div className="sn-content-caption"><SequenceMark size={30} state="happy" gear="camera" title="" /><span>…naar je volgende campagne.<small>Productconcept · early access</small></span></div>
    </>}
  </div>;
}

export function SiteNavigation() {
  const [open, setOpen] = useState<Section | null>(null);
  const [product, setProduct] = useState<Product>("support");
  const [mobile, setMobile] = useState(false);
  const root = useRef<HTMLElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const triggers = useRef<Partial<Record<Section, HTMLButtonElement | null>>>({});
  const id = useId();
  const pathname = usePathname();

  useEffect(() => {
    if (!open && !mobile) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) { setOpen(null); setMobile(false); }
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open, mobile]);

  function close() { setOpen(null); setMobile(false); }

  return <header className="sn-header" ref={root} onMouseLeave={() => { if (!mobile) setOpen(null); }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close(); }} onKeyDown={event => {
    if (event.key === "Escape") {
      event.preventDefault();
      const active = open;
      setOpen(null);
      if (mobile) { setMobile(false); root.current?.querySelector<HTMLButtonElement>(".sn-mobile-toggle")?.focus(); }
      else if (active) triggers.current[active]?.focus();
    }
  }}>
    <a className="so-skip" href="#main-content">Naar de inhoud</a>
    <Link href="/" className="sn-logo" aria-label="SequenceFlow home"><Image src="/logo-white.png" alt="SequenceFlow" width={188} height={46} priority /></Link>
    <nav id={`${id}-navigation`} className={`sn-nav${mobile ? " is-open" : ""}`} aria-label="Hoofdnavigatie">
      {SECTIONS.map(([section, label]) => <button type="button" key={section} ref={node => { triggers.current[section] = node; }} aria-expanded={open === section} aria-controls={`${id}-panel`} onMouseEnter={() => { if (!mobile) setOpen(section); }} onClick={() => setOpen(mobile && open === section ? null : section)} onKeyDown={event => {
        if (event.key === "ArrowDown") {
          event.preventDefault(); setOpen(section);
          requestAnimationFrame(() => panel.current?.querySelector<HTMLAnchorElement>("a")?.focus());
        }
      }}>{label}<ChevronDown size={12} /></button>)}
      <Link href="/pricing" onMouseEnter={() => { if (!mobile) setOpen(null); }} onClick={close}>Prijzen</Link>
      <Link href="/blog" onMouseEnter={() => { if (!mobile) setOpen(null); }} onClick={close}>Blog</Link>
      <Link href={`${DEFAULT_APP_ORIGIN}/login`} className="sn-mobile-login" onClick={close}>Inloggen</Link>
    </nav>
    <div className="sn-actions"><Link href="/en" hrefLang="en" lang="en" aria-label="English">EN</Link><Link href={`${DEFAULT_APP_ORIGIN}/login`}>Inloggen</Link><Link href="/contact" className="sn-contact">Kennismaken <ArrowRight size={14} /></Link></div>
    <button className="sn-mobile-toggle" type="button" aria-expanded={mobile} aria-controls={`${id}-navigation`} aria-label={mobile ? "Menu sluiten" : "Menu openen"} onClick={() => { setMobile(!mobile); setOpen(null); }}>{mobile ? <X size={20} /> : <Menu size={20} />}</button>
    {open && <div ref={panel} id={`${id}-panel`} className={`sn-panel sn-panel--${open}`}>
      {open === "products" ? <><div className="sn-product-links"><span className="sn-kicker">GEEF WERK UIT HANDEN</span>{(["support", "content"] as const).map(value => <Link key={value} href={PRODUCTS[value].href} onMouseEnter={() => setProduct(value)} onFocus={() => setProduct(value)} onClick={close} className={product === value ? "is-active" : ""}><span className="sn-product-title">{PRODUCTS[value].name}<span className={`sn-state${value === "support" ? " sn-state--live" : ""}`}>{value === "support" ? "Live" : "Early access"}</span></span><p>{value === "support" ? "Klantvragen, antwoorden en webshopinzicht." : "Je producten. Jouw merk. Je volgende post."}</p><span className="sn-product-explore">Ontdek {PRODUCTS[value].name}<ArrowRight size={13} /></span></Link>)}<span className="sn-menu-note">Jij houdt de controle.</span></div><ProductPreview product={product} /></> : <div className="sn-simple-links">{LINKS[open].map(item => <Link href={item.href.startsWith("/#") && pathname === "/home" ? `/home${item.href.slice(1)}` : item.href} key={item.title} onClick={close}><strong>{item.title}<ArrowRight size={14} /></strong><small>{item.description}</small></Link>)}</div>}
    </div>}
  </header>;
}
