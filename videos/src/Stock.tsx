import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";

import { Mascot } from "./Mascot";
import { Bg, Card, EndCard, Enter, Headline, Label } from "./parts";
import { series, Soundtrack } from "./Soundtrack";
import { C } from "./theme";

/** Voorraad met Otis: zien wat opraakt, en een concept-inkooporder die jij goedkeurt. */

const ITEMS = [
  { name: "Linnen overhemd · M · wit", days: 6, stock: 12 },
  { name: "Linnen overhemd · L · wit", days: 9, stock: 18 },
  { name: "Zomerjurk · S · groen", days: 4, stock: 5 },
];

function Alerts() {
  const frame = useCurrentFrame();
  return (
    <Bg>
      <AbsoluteFill style={{ padding: 80, justifyContent: "center", gap: 36 }}>
        <Enter at={0}><div style={{ display: "flex", alignItems: "center", gap: 26 }}><Mascot size={170} gear="analyst" lookX={0.5} /><Headline size={80}>Otis houdt je<br /><span style={{ color: C.lime }}>voorraad</span> in de gaten</Headline></div></Enter>
        {ITEMS.map((item, i) => {
          const width = interpolate(frame, [30 + i * 15, 70 + i * 15], [100, Math.min(100, item.days * 8)], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <Enter key={item.name} at={24 + i * 15}>
              <Card style={{ padding: 32 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 38 }}><strong>{item.name}</strong><span style={{ color: item.days <= 5 ? C.warning : C.textSoft }}>over {item.days} dagen op</span></div>
                <div style={{ height: 14, marginTop: 20, borderRadius: 99, background: C.line, overflow: "hidden" }}><div style={{ width: `${width}%`, height: "100%", background: item.days <= 5 ? C.warning : C.lime }} /></div>
                <p style={{ margin: "14px 0 0", fontSize: 30, color: C.textMuted }}>Nog {item.stock} op voorraad</p>
              </Card>
            </Enter>
          );
        })}
        <Enter at={95}><p style={{ margin: 0, fontSize: 38, color: C.textSoft, textAlign: "center" }}>Op basis van hoe snel het verkoopt, niet een vaste drempel.</p></Enter>
      </AbsoluteFill>
    </Bg>
  );
}

function Order() {
  const frame = useCurrentFrame();
  const approved = frame >= 120;
  return (
    <Bg>
      <AbsoluteFill style={{ padding: 80, justifyContent: "center", gap: 36 }}>
        <Enter at={0}><Label>Concept-inkooporder</Label></Enter>
        <Enter at={8}>
          <Card lime>
            <p style={{ margin: 0, fontSize: 36, color: C.textMuted }}>Leverancier: Linen & Co</p>
            {[["Linnen overhemd · M · wit", 40], ["Linnen overhemd · L · wit", 30], ["Zomerjurk · S · groen", 20]].map(([name, qty]) => (
              <div key={name as string} style={{ display: "flex", justifyContent: "space-between", fontSize: 40, padding: "20px 0", borderBottom: `2px solid ${C.lineLime}` }}><span>{name}</span><strong style={{ color: C.lime }}>{qty} st.</strong></div>
            ))}
            <div style={{ marginTop: 28, display: "inline-block", padding: "20px 38px", borderRadius: 16, background: approved ? "#2a3a1a" : C.lime, color: approved ? C.lime : "#142000", fontSize: 36, fontWeight: 750 }}>{approved ? "✓ Goedgekeurd" : "Goedkeuren"}</div>
          </Card>
        </Enter>
        <Enter at={130}><p style={{ margin: 0, fontSize: 40, color: C.textSoft, textAlign: "center" }}>Otis stelt voor. Jij beslist wat er besteld wordt.</p></Enter>
      </AbsoluteFill>
    </Bg>
  );
}

export function Stock() {
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Soundtrack total={570} cues={[[0, "whoosh"], ...series(24, 15, 3, "pop"), [210, "whoosh"], [218, "pop"], [327, "click"], [330, "ding"], [420, "whoosh"], [446, "pop"]]} />
      <Sequence durationInFrames={210}><Alerts /></Sequence>
      <Sequence from={210} durationInFrames={210}><Order /></Sequence>
      <Sequence from={420} durationInFrames={150}><EndCard product="Voorraad met Otis" gear="analyst" line="Zie wat opraakt voordat je misgrijpt, met een inkooporder die jij goedkeurt. In Support One Scale." /></Sequence>
    </AbsoluteFill>
  );
}
