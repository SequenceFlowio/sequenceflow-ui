import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";

import { CTA, type Lang } from "./i18n";
import { Mascot, type Gear } from "./Mascot";
import { Bg, Card, EndCard, Enter, Headline, Label } from "./parts";
import { series, Soundtrack } from "./Soundtrack";
import { C } from "./theme";

/**
 * Tip-reel: een haak, drie korte tips één voor één, en de eindkaart.
 * Alle tekst komt uit props, zodat de reelgenerator er varianten van maakt.
 */

export type TipContent = {
  hook1: string;
  hook2: string;
  label: string; // bijvoorbeeld "3 tips voor minder retouren"
  tips: Array<{ title: string; body: string }>;
  gear?: Gear;
  product?: string;
  endLine?: string;
};

const HOOK = 80;
const PER_TIP = 105;
const END = 150;
export const TIP_DURATION = HOOK + PER_TIP * 3 + END;

function Hook({ c }: { c: TipContent }) {
  return (
    <Bg>
      <AbsoluteFill style={{ padding: 90, justifyContent: "center", gap: 50 }}>
        <Enter at={0}><Mascot size={200} gear={c.gear ?? "antenna"} lookX={0.5} /></Enter>
        <Enter at={6}><Headline size={104}>{c.hook1}<br /><span style={{ color: C.lime }}>{c.hook2}</span></Headline></Enter>
        <Enter at={18}><Label>{c.label}</Label></Enter>
      </AbsoluteFill>
    </Bg>
  );
}

function Tip({ tip, index }: { tip: { title: string; body: string }; index: number }) {
  const frame = useCurrentFrame();
  return (
    <Bg>
      <AbsoluteFill style={{ padding: 90, justifyContent: "center", gap: 40 }}>
        <Enter at={0}>
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <span style={{ width: 110, height: 110, borderRadius: 99, display: "grid", placeItems: "center", background: C.lime, color: "#142000", fontSize: 60, fontWeight: 800, transform: `scale(${1 + Math.sin(frame / 8) * 0.02})` }}>{index + 1}</span>
            <Label>Tip {index + 1} van 3</Label>
          </div>
        </Enter>
        <Enter at={6}><Headline size={86}>{tip.title}</Headline></Enter>
        <Enter at={16}><Card><p style={{ margin: 0, fontSize: 44, lineHeight: 1.45, color: C.textSoft }}>{tip.body}</p></Card></Enter>
      </AbsoluteFill>
    </Bg>
  );
}

export function TipReel({ lang = "nl", content }: { lang?: Lang; content: TipContent }) {
  const c = content;
  const tipsStart = HOOK;
  const end = HOOK + PER_TIP * 3;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Soundtrack total={TIP_DURATION} cues={[[0, "whoosh"], [6, "pop"], ...series(tipsStart, PER_TIP, 3, "whoosh"), ...series(tipsStart + 6, PER_TIP, 3, "pop"), [end, "whoosh"], [end + 26, "pop"]]} />
      <Sequence durationInFrames={HOOK}><Hook c={c} /></Sequence>
      {c.tips.slice(0, 3).map((tip, i) => (
        <Sequence key={i} from={tipsStart + i * PER_TIP} durationInFrames={PER_TIP}><Tip tip={tip} index={i} /></Sequence>
      ))}
      <Sequence from={end} durationInFrames={END}>
        <EndCard product={c.product ?? "Support One"} gear={c.gear ?? "headset"} line={c.endLine ?? (lang === "nl" ? "Klantmail beantwoord in jouw stijl, met de bestelling erbij. Jij houdt de controle." : "Customer email answered in your voice, with the order details included.")} cta={CTA[lang]} />
      </Sequence>
    </AbsoluteFill>
  );
}
