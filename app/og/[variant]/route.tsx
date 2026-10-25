import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { PRODUCTS } from "@/lib/marketing/products";
import type { OgVariant } from "@/lib/marketing/seo";

/**
 * Deelafbeeldingen (1200×630) voor links op WhatsApp, LinkedIn, Slack enz.
 * Ze worden bij de build gemaakt; de beelden komen uit public/, dus een
 * nieuwe foto of naam verschijnt na de volgende deploy vanzelf.
 */

export const dynamic = "force-static";

const VARIANTS = ["hub", "support", "content"] as const satisfies readonly OgVariant[];

export function generateStaticParams() {
  return VARIANTS.map((variant) => ({ variant }));
}

const LIME = "#c7f56f";
const MUTED = "#8b9096";

async function dataUrl(file: string, type: string) {
  const bytes = await readFile(join(process.cwd(), "public", file));
  return `data:${type};base64,${bytes.toString("base64")}`;
}

function Card({ children, width, accent = false }: { children: React.ReactNode; width: number; accent?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width, padding: 26, borderRadius: 24, border: `1px solid ${accent ? "#3b4530" : "#262a22"}`, background: accent ? "#161a12" : "#151614", boxShadow: "0 24px 60px rgba(0,0,0,.5)" }}>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", color: LIME, fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>{children}</div>;
}

export async function GET(_request: Request, { params }: { params: Promise<{ variant: string }> }) {
  const { variant: requested } = await params;
  const variant: OgVariant = (VARIANTS as readonly string[]).includes(requested) ? (requested as OgVariant) : "hub";
  const logo = await dataUrl("logo-white.png", "image/png");

  const copy = {
    hub: { tag: "AI-agents voor e-commerce", title: "Twee AI-collega's", accent: "voor je webshop.", sub: `${PRODUCTS.support.name} voor je klantenservice, ${PRODUCTS.content.name} voor je social content.` },
    support: { tag: PRODUCTS.support.name, title: "Je AI-collega", accent: "voor de supportinbox.", sub: "Antwoordconcepten vanuit je eigen beleid. Jij beslist wat er verstuurd wordt." },
    content: { tag: PRODUCTS.content.name, title: "Je AI-collega", accent: "voor social content.", sub: "Van productfoto naar posts, carrousels en Reels in jouw merkstem." },
  }[variant];

  let visual: React.ReactNode;
  if (variant === "content") {
    const [product, post] = await Promise.all([dataUrl("media/site/content-product.jpg", "image/jpeg"), dataUrl("media/site/content-post.jpg", "image/jpeg")]);
    visual = (
      <div style={{ display: "flex", position: "relative", width: 430, height: 470 }}>
        <div style={{ display: "flex", position: "absolute", left: 0, top: 70, padding: 12, borderRadius: 22, background: "#151614", border: "1px solid #262a22", transform: "rotate(-5deg)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={product} width={200} height={200} style={{ borderRadius: 14, objectFit: "cover" }} alt="" />
        </div>
        <div style={{ display: "flex", position: "absolute", right: 0, top: 0, padding: 12, borderRadius: 22, background: "#151614", border: "1px solid #3b4530", transform: "rotate(3deg)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post} width={250} height={312} style={{ borderRadius: 14, objectFit: "cover" }} alt="" />
        </div>
        <div style={{ display: "flex", position: "absolute", left: 150, top: 330, padding: "12px 20px", borderRadius: 999, background: LIME, color: "#152000", fontSize: 20, fontWeight: 800 }}>5 posts ingepland</div>
      </div>
    );
  } else if (variant === "support") {
    visual = (
      <div style={{ display: "flex", flexDirection: "column", gap: 18, width: 400 }}>
        <Card width={370}>
          <div style={{ display: "flex", color: MUTED, fontSize: 16, fontWeight: 700, letterSpacing: 1 }}>KLANTVRAAG</div>
          <div style={{ display: "flex", color: "white", fontSize: 28, fontWeight: 600, marginTop: 12 }}>Waar blijft mijn bestelling?</div>
        </Card>
        <div style={{ display: "flex", marginLeft: 30 }}>
          <Card width={370} accent>
            <Label>ANTWOORDCONCEPT</Label>
            <div style={{ display: "flex", color: "#e4e6e9", fontSize: 21, lineHeight: 1.45, marginTop: 12 }}>Hoi Sanne, je bestelling #4521 is onderweg met PostNL en wordt morgen bezorgd.</div>
            <div style={{ display: "flex", alignSelf: "flex-start", marginTop: 18, padding: "10px 16px", borderRadius: 999, background: LIME, color: "#152000", fontSize: 17, fontWeight: 800, alignItems: "center", gap: 10 }}>
              {/* Het standaardlettertype van next/og heeft geen ✓; daarom een getekend vinkje. */}
              <div style={{ display: "flex", width: 14, height: 8, marginTop: -4, borderLeft: "3px solid #152000", borderBottom: "3px solid #152000", transform: "rotate(-45deg)" }} />
              Klaar om te checken
            </div>
          </Card>
        </div>
      </div>
    );
  } else {
    visual = (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, width: 400 }}>
        <Card width={380} accent>
          <Label>{PRODUCTS.support.name.toUpperCase()}</Label>
          <div style={{ display: "flex", color: "white", fontSize: 56, fontWeight: 500, marginTop: 10 }}>12</div>
          <div style={{ display: "flex", color: MUTED, fontSize: 20 }}>klantvragen voorbereid</div>
        </Card>
        <div style={{ display: "flex", marginLeft: 20 }}>
          <Card width={380}>
            <Label>{PRODUCTS.content.name.toUpperCase()}</Label>
            <div style={{ display: "flex", color: "white", fontSize: 56, fontWeight: 500, marginTop: 10 }}>5</div>
            <div style={{ display: "flex", color: MUTED, fontSize: 20 }}>posts ingepland deze week</div>
          </Card>
        </div>
      </div>
    );
  }

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", padding: "64px 72px", justifyContent: "space-between", alignItems: "center", color: "white", background: "radial-gradient(circle at 30% -10%, #1f2a14 0%, #0d0e0c 45%, #0a0a0a 100%)" }}>
        <div style={{ display: "flex", flexDirection: "column", width: 640 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} width={260} height={62} alt="" />
          <div style={{ display: "flex", alignItems: "center", alignSelf: "flex-start", gap: 10, marginTop: 56, padding: "9px 16px", borderRadius: 999, border: "1px solid #353a2e", color: LIME, fontSize: 19, fontWeight: 700 }}>
            <div style={{ display: "flex", width: 10, height: 10, borderRadius: 999, background: LIME }} />
            {copy.tag}
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 26, fontSize: 58, fontWeight: 600, lineHeight: 1.04, letterSpacing: -2 }}>
            <span>{copy.title}</span>
            <span style={{ color: LIME }}>{copy.accent}</span>
          </div>
          <div style={{ display: "flex", marginTop: 24, color: MUTED, fontSize: 25, lineHeight: 1.4 }}>{copy.sub}</div>
        </div>
        {visual}
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
