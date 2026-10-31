import { ImageResponse } from "next/og";
import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import { hasContentAccess, verifyRenderToken } from "@/lib/contentCalendar/access";
import { compressPhoto, getPost, readMedia } from "@/lib/contentCalendar/db";
import { PILLARS, BRAND } from "@/lib/contentCalendar/brand";
import type { Post } from "@/lib/contentCalendar/types";

export const runtime = "nodejs";

const W = 1080;
const H = 1350;
const INK = "#111711";
const CANVAS = "#F7F7F2";
const LIME = "#C7F56F";
const MUTED = "#667064";

let fontsCache: Array<{ name: string; data: Buffer; weight: 400 | 600 | 700 | 800; style: "normal" }> | null = null;
async function fonts() {
  if (fontsCache) return fontsCache;
  const dir = path.join(process.cwd(), "lib", "contentCalendar", "fonts");
  fontsCache = await Promise.all(([400, 600, 700, 800] as const).map(async (weight) => ({
    name: "Inter", weight, style: "normal" as const, data: await fs.readFile(path.join(dir, `inter-${weight}.woff`)),
  })));
  return fontsCache;
}

const logoCache: Record<string, string> = {};
async function logo(variant: "white" | "black") {
  if (!logoCache[variant]) {
    const data = await fs.readFile(path.join(process.cwd(), "public", `logo-${variant}.png`));
    logoCache[variant] = `data:image/png;base64,${data.toString("base64")}`;
  }
  return logoCache[variant];
}

async function photo(post: Post) {
  const file = post.image.files[post.image.selected] ?? post.image.files[0];
  if (!file) return null;
  try {
    let data: Buffer = await readMedia(file);
    // oudere uploads zijn nog groot; verkleinen scheelt rekenwerk en geheugen
    if (data.length > 1_000_000) data = await compressPhoto(data);
    return `data:image/jpeg;base64,${data.toString("base64")}`;
  } catch {
    return null;
  }
}

function PhotoOrPlaceholder({ src, width, height, radius = 0 }: { src: string | null; width: number; height: number; radius?: number }) {
  if (src) return <img alt="" src={src} width={width} height={height} style={{ width, height, objectFit: "cover", borderRadius: radius }} />;
  return <div style={{ width, height, borderRadius: radius, display: "flex", background: `radial-gradient(circle at 70% 30%, #3a4a1e 0%, ${INK} 60%)` }} />;
}

function Footer({ dark, index, total, logoSrc }: { dark: boolean; index: number; total: number; logoSrc: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
      <img alt="" src={logoSrc} width={250} height={59} style={{ width: 250, height: 59 }} />
      <div style={{ display: "flex", gap: 10 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{ width: i === index ? 34 : 12, height: 12, borderRadius: 6, background: i === index ? LIME : dark ? "rgba(255,255,255,0.25)" : "rgba(17,23,17,0.15)" }} />
        ))}
      </div>
    </div>
  );
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string; slide: string }> }) {
  const { id, slide } = await params;
  const url = new URL(request.url);
  // Ingelogd, of een getekende link (Meta haalt de slides op zonder sessie)
  if (!(await hasContentAccess()) && !(await verifyRenderToken(id, url.searchParams.get("t")))) {
    return new Response("Niet geautoriseerd", { status: 401 });
  }
  const post = await getPost(id);
  if (!post) return new Response("Niet gevonden", { status: 404 });

  const index = Number.parseInt(slide, 10) || 0;
  const total = post.slides.length + 2; // cover + tips + afsluiter
  const pillar = PILLARS.find((p) => p.id === post.pillar)?.name ?? post.pillar;
  const download = url.searchParams.has("download");
  const asJpeg = url.searchParams.get("format") === "jpg";
  let node: React.ReactElement;

  if (index === 0 && post.template === "photo") {
    node = (
      <div style={{ width: W, height: H, display: "flex", position: "relative", fontFamily: "Inter", background: INK }}>
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, display: "flex" }}><PhotoOrPlaceholder src={await photo(post)} width={W} height={H} /></div>
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, display: "flex", background: "linear-gradient(180deg, rgba(17,23,17,0.55) 0%, rgba(17,23,17,0) 28%, rgba(17,23,17,0) 45%, rgba(17,23,17,0.92) 100%)" }} />
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 80 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <img alt="" src={await logo("white")} width={250} height={59} style={{ width: 250, height: 59 }} />
            <div style={{ display: "flex", background: LIME, color: INK, fontSize: 26, fontWeight: 700, padding: "12px 24px", borderRadius: 999 }}>{pillar}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <div style={{ display: "flex", width: 90, height: 10, background: LIME, borderRadius: 5 }} />
            <div style={{ display: "flex", color: "white", fontSize: 86, fontWeight: 800, lineHeight: 1.04, letterSpacing: -2.5 }}>{post.headline}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 40 }}>
              <div style={{ display: "flex", flex: 1, color: "rgba(255,255,255,0.82)", fontSize: 36, fontWeight: 400, lineHeight: 1.35 }}>{post.subline}</div>
              <div style={{ display: "flex", flexShrink: 0, color: LIME, fontSize: 32, fontWeight: 700 }}>Swipe →</div>
            </div>
          </div>
        </div>
      </div>
    );
  } else if (index === 0) {
    node = (
      <div style={{ width: W, height: H, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 80, fontFamily: "Inter", background: CANVAS }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <img alt="" src={await logo("black")} width={250} height={59} style={{ width: 250, height: 59 }} />
          <div style={{ display: "flex", background: INK, color: LIME, fontSize: 26, fontWeight: 700, padding: "12px 24px", borderRadius: 999 }}>{pillar}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", color: INK, fontSize: 80, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2.5 }}>{post.headline}</div>
          <div style={{ display: "flex", color: MUTED, fontSize: 36 }}>{post.subline}</div>
        </div>
        <div style={{ display: "flex", position: "relative" }}>
          <PhotoOrPlaceholder src={await photo(post)} width={W - 160} height={600} radius={36} />
          <div style={{ position: "absolute", right: 28, bottom: 28, display: "flex", background: LIME, color: INK, fontSize: 30, fontWeight: 700, padding: "16px 28px", borderRadius: 999 }}>Swipe →</div>
        </div>
      </div>
    );
  } else if (index <= post.slides.length) {
    const tip = post.slides[index - 1];
    node = (
      <div style={{ width: W, height: H, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 80, fontFamily: "Inter", background: CANVAS }}>
        <div style={{ display: "flex", color: MUTED, fontSize: 28, fontWeight: 600 }}>{post.headline}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 150, height: 150, borderRadius: 75, background: LIME, color: INK, fontSize: 64, fontWeight: 800 }}>
            {String(index).padStart(2, "0")}
          </div>
          <div style={{ display: "flex", color: INK, fontSize: 78, fontWeight: 800, lineHeight: 1.06, letterSpacing: -2 }}>{tip.title}</div>
          <div style={{ display: "flex", color: "#3b4239", fontSize: 44, lineHeight: 1.4 }}>{tip.body}</div>
        </div>
        <Footer dark={false} index={index} total={total} logoSrc={await logo("black")} />
      </div>
    );
  } else {
    node = (
      <div style={{ width: W, height: H, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 80, fontFamily: "Inter", background: INK }}>
        <div style={{ display: "flex", width: 90, height: 10, background: LIME, borderRadius: 5 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
          <div style={{ display: "flex", color: "white", fontSize: 84, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2.5 }}>Iets aan gehad?</div>
          <div style={{ display: "flex", color: "rgba(255,255,255,0.75)", fontSize: 44, lineHeight: 1.4 }}>Bewaar deze post en stuur hem door naar een ondernemer die het druk heeft.</div>
          <div style={{ display: "flex", alignSelf: "flex-start", background: LIME, color: INK, fontSize: 40, fontWeight: 700, padding: "22px 36px", borderRadius: 999, marginTop: 20 }}>Volg {BRAND.handle}</div>
        </div>
        <Footer dark index={index} total={total} logoSrc={await logo("white")} />
      </div>
    );
  }

  const image = new ImageResponse(node, { width: W, height: H, fonts: await fonts() });
  const ext = asJpeg ? "jpg" : "png";
  // Instagram accepteert alleen JPEG
  const body = asJpeg ? new Uint8Array(await sharp(Buffer.from(await image.arrayBuffer())).jpeg({ quality: 92 }).toBuffer()) : image.body;
  // De URL bevat ?v=<updatedAt>: een gewijzigde post krijgt vanzelf een nieuwe URL, dus de browser mag cachen
  const headers = new Headers({ "Content-Type": asJpeg ? "image/jpeg" : "image/png", "Cache-Control": "private, max-age=604800" });
  if (download) headers.set("Content-Disposition", `attachment; filename="sequenceflow-${post.date}-${index + 1}.${ext}"`);
  return new Response(body, { headers });
}
