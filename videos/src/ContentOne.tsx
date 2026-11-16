import { AbsoluteFill, Sequence } from "remotion";

import { Mascot } from "./Mascot";
import { Bg, Card, EndCard, Enter, Headline, Label } from "./parts";
import { C } from "./theme";

/** Content One met Juno: één productfoto wordt een week aan posts. Nog in ontwikkeling: we zeggen early access. */

function Bottle({ size = 200 }: { size?: number }) {
  return (
    <svg viewBox="0 0 120 200" width={size} height={size * 1.66}>
      <rect x="44" y="6" width="32" height="34" rx="6" fill="#1b1d19" />
      <rect x="50" y="40" width="20" height="14" fill="#2a2d27" />
      <rect x="22" y="54" width="76" height="134" rx="18" fill="#f3c9a8" />
      <rect x="34" y="96" width="52" height="50" rx="6" fill="#fffaf4" />
      <text x="60" y="116" textAnchor="middle" fontSize="9" fontWeight="700" fill="#5a3b28">STUDIO LUNE</text>
      <text x="60" y="132" textAnchor="middle" fontSize="11" fontWeight="700" fill="#1b1d19">Glow</text>
    </svg>
  );
}

const WEEK = [["Ma", "Post"], ["Di", "Tip"], ["Wo", "Carrousel"], ["Do", "Reel"], ["Vr", "Actie"], ["Za", "Review"]];

function FromPhoto() {
  return (
    <Bg>
      <AbsoluteFill style={{ padding: 80, justifyContent: "center", gap: 40 }}>
        <Enter at={0}><Headline size={92}>Eén productfoto erin.<br /><span style={{ color: C.lime }}>Een week aan content eruit.</span></Headline></Enter>
        <div style={{ display: "flex", gap: 30, alignItems: "center" }}>
          <Enter at={14}><div style={{ padding: 30, borderRadius: 32, background: C.warm }}><Bottle size={190} /></div></Enter>
          <Enter at={30}><Mascot size={170} gear="camera" lookX={0.8} happyFrom={140} /></Enter>
        </div>
        <Enter at={50}>
          <Card>
            <Label color={C.textMuted}>Instagram-post</Label>
            <p style={{ margin: "14px 0 0", fontSize: 38, lineHeight: 1.45 }}>Winterhuid die er dof uitziet? 2 druppels Glow serum in de ochtend en je huid krijgt z'n frisheid terug ✨</p>
          </Card>
        </Enter>
        <Enter at={75}>
          <Card lime>
            <Label>TikTok-hook</Label>
            <p style={{ margin: "14px 0 0", fontSize: 40, fontWeight: 650, lineHeight: 1.35 }}>“Stop met dure crèmes kopen als je huid dof is. Doe dít eerst…”</p>
          </Card>
        </Enter>
      </AbsoluteFill>
    </Bg>
  );
}

function Week() {
  return (
    <Bg>
      <AbsoluteFill style={{ padding: 80, justifyContent: "center", gap: 36 }}>
        <Enter at={0}><Label>Je week staat klaar</Label></Enter>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
          {WEEK.map(([day, type], i) => (
            <Enter key={day} at={10 + i * 8}>
              <div style={{ padding: 30, borderRadius: 24, border: `2px solid ${C.line}`, background: C.surface }}>
                <div style={{ fontSize: 30, color: C.textMuted, fontWeight: 700 }}>{day}</div>
                <div style={{ display: "inline-block", marginTop: 12, padding: "8px 18px", borderRadius: 99, background: `${C.lime}22`, color: C.lime, fontSize: 30, fontWeight: 800 }}>{type}</div>
                <div style={{ marginTop: 14, fontSize: 28, color: C.textMuted }}>✓ Klaar voor controle</div>
              </div>
            </Enter>
          ))}
        </div>
        <Enter at={70}><p style={{ margin: 0, fontSize: 40, color: C.textSoft, textAlign: "center" }}>Niets gaat online zonder jouw akkoord.</p></Enter>
      </AbsoluteFill>
    </Bg>
  );
}

export function ContentOne() {
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Sequence durationInFrames={210}><FromPhoto /></Sequence>
      <Sequence from={210} durationInFrames={180}><Week /></Sequence>
      <Sequence from={390} durationInFrames={150}><EndCard product="Content One" gear="camera" line="Juno maakt posts, carrousels en video-hooks in de stijl van je merk." cta="Vraag early access · sequenceflow.io" /></Sequence>
    </AbsoluteFill>
  );
}
