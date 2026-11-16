import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";

import { Mascot } from "./Mascot";
import { Bg, Card, EndCard, Enter, Headline, Label } from "./parts";
import { series, Soundtrack } from "./Soundtrack";
import { C } from "./theme";
import { CTA, type Lang } from "./i18n";

const TEXT = {
  nl: {
    items: ["Linnen overhemd · M · wit", "Linnen overhemd · L · wit", "Zomerjurk · S · groen"],
    hook1: "Otis houdt je", hook2: "voorraad", hook3: " in de gaten",
    runsOut: (d: number) => `over ${d} dagen op`, left: (n: number) => `Nog ${n} op voorraad`,
    basis: "{t.basis}",
    po: "Concept-inkooporder", supplier: "Leverancier: Linen & Co", pcs: "st.",
    approve: "Goedkeuren", approved: "✓ Goedgekeurd", decide: "{t.decide}",
    product: "Voorraad met Otis", endLine: "Zie wat opraakt voordat je misgrijpt, met een inkooporder die jij goedkeurt. In Support One Scale.",
  },
  en: {
    items: ["Linen shirt · M · white", "Linen shirt · L · white", "Summer dress · S · green"],
    hook1: "Otis keeps an eye", hook2: "on your stock", hook3: "",
    runsOut: (d: number) => `out in ${d} days`, left: (n: number) => `${n} left in stock`,
    basis: "Based on how fast it sells, not a fixed threshold.",
    po: "Draft purchase order", supplier: "Supplier: Linen & Co", pcs: "pcs",
    approve: "Approve", approved: "✓ Approved", decide: "Otis suggests. You decide what gets ordered.",
    product: "Stock with Otis", endLine: "See what's running low before you sell out, with a purchase order you approve. In Support One Scale.",
  },
};
type T = (typeof TEXT)["nl"];

/** Voorraad met Otis: zien wat opraakt, en een concept-inkooporder die jij goedkeurt. */

const ITEMS = [
  { days: 6, stock: 12, qty: 40 },
  { days: 9, stock: 18, qty: 30 },
  { days: 4, stock: 5, qty: 20 },
];

function Alerts({ t }: { t: T }) {
  const frame = useCurrentFrame();
  return (
    <Bg>
      <AbsoluteFill style={{ padding: 80, justifyContent: "center", gap: 36 }}>
        <Enter at={0}><div style={{ display: "flex", alignItems: "center", gap: 26 }}><Mascot size={170} gear="analyst" lookX={0.5} /><Headline size={80}>{t.hook1}<br /><span style={{ color: C.lime }}>{t.hook2}</span>{t.hook3}</Headline></div></Enter>
        {ITEMS.map((item, i) => {
          const width = interpolate(frame, [30 + i * 15, 70 + i * 15], [100, Math.min(100, item.days * 8)], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <Enter key={i} at={24 + i * 15}>
              <Card style={{ padding: 32 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 38 }}><strong>{t.items[i]}</strong><span style={{ color: item.days <= 5 ? C.warning : C.textSoft }}>{t.runsOut(item.days)}</span></div>
                <div style={{ height: 14, marginTop: 20, borderRadius: 99, background: C.line, overflow: "hidden" }}><div style={{ width: `${width}%`, height: "100%", background: item.days <= 5 ? C.warning : C.lime }} /></div>
                <p style={{ margin: "14px 0 0", fontSize: 30, color: C.textMuted }}>{t.left(item.stock)}</p>
              </Card>
            </Enter>
          );
        })}
        <Enter at={95}><p style={{ margin: 0, fontSize: 38, color: C.textSoft, textAlign: "center" }}>{t.basis}</p></Enter>
      </AbsoluteFill>
    </Bg>
  );
}

function Order({ t }: { t: T }) {
  const frame = useCurrentFrame();
  const approved = frame >= 120;
  return (
    <Bg>
      <AbsoluteFill style={{ padding: 80, justifyContent: "center", gap: 36 }}>
        <Enter at={0}><Label>{t.po}</Label></Enter>
        <Enter at={8}>
          <Card lime>
            <p style={{ margin: 0, fontSize: 36, color: C.textMuted }}>{t.supplier}</p>
            {ITEMS.map((item, i) => [t.items[i], item.qty] as const).map(([name, qty]) => (
              <div key={name} style={{ display: "flex", justifyContent: "space-between", fontSize: 40, padding: "20px 0", borderBottom: `2px solid ${C.lineLime}` }}><span>{name}</span><strong style={{ color: C.lime }}>{qty} {t.pcs}</strong></div>
            ))}
            <div style={{ marginTop: 28, display: "inline-block", padding: "20px 38px", borderRadius: 16, background: approved ? "#2a3a1a" : C.lime, color: approved ? C.lime : "#142000", fontSize: 36, fontWeight: 750 }}>{approved ? t.approved : t.approve}</div>
          </Card>
        </Enter>
        <Enter at={130}><p style={{ margin: 0, fontSize: 40, color: C.textSoft, textAlign: "center" }}>{t.decide}</p></Enter>
      </AbsoluteFill>
    </Bg>
  );
}

export function Stock({ lang = "nl" }: { lang?: Lang }) {
  const t = TEXT[lang];
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Soundtrack total={570} cues={[[0, "whoosh"], ...series(24, 15, 3, "pop"), [210, "whoosh"], [218, "pop"], [327, "click"], [330, "ding"], [420, "whoosh"], [446, "pop"], [480, "whoosh", 0.15], [520, "ding", 0.35]]} />
      <Sequence durationInFrames={210}><Alerts t={t} /></Sequence>
      <Sequence from={210} durationInFrames={210}><Order t={t} /></Sequence>
      <Sequence from={420} durationInFrames={150}><EndCard product={t.product} gear="analyst" line={t.endLine} cta={CTA[lang]} /></Sequence>
    </AbsoluteFill>
  );
}
