import { AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { Mascot } from "./Mascot";
import { Bg, Card, EndCard, Enter, Headline, Label } from "./parts";
import { series, Soundtrack } from "./Soundtrack";
import { C } from "./theme";

/** Pijnpunten: losse klantvragen worden één thema, met advies om het bij de bron op te lossen. */

const QUESTIONS = ["Er zitten maar drie wieltjes aan de racewagen", "Wieltje kwijt, kan ik er los een krijgen?", "De auto kwam binnen zonder voorwiel", "Mijn zoon is verdrietig, er mist een wiel", "Doos was dicht, maar het wieltje zit er niet in"];
const ADVICE = ["Open steekproefsgewijs een paar dozen", "Vraag je leverancier de volgende levering te controleren", "Zet in de productbeschrijving hoeveel wieltjes erbij horen"];

function Gather() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const gather = spring({ frame: frame - 110, fps, config: { damping: 20 } });
  const count = Math.round(interpolate(frame, [130, 180], [0, 14], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return (
    <Bg>
      <AbsoluteFill style={{ padding: 80, justifyContent: "center", gap: 40 }}>
        <Enter at={0}><Headline size={92}>Waar lopen je<br /><span style={{ color: C.lime }}>klanten tegenaan?</span></Headline></Enter>
        <div style={{ position: "relative", height: 820 }}>
          {QUESTIONS.map((q, i) => (
            <div key={q} style={{ position: "absolute", left: 0, right: 0, top: i * 150 * (1 - gather) + 300 * gather, opacity: frame < 18 + i * 8 ? 0 : 1 - gather, transform: `scale(${1 - gather * 0.3})` }}>
              <Enter at={18 + i * 8} y={50}>
                <div style={{ padding: "26px 30px", borderRadius: 22, border: `2px solid ${C.line}`, background: C.surface, fontSize: 36, color: C.textSoft }}>✉ {q}</div>
              </Enter>
            </div>
          ))}
          <div style={{ position: "absolute", left: 0, right: 0, top: 230, opacity: gather, transform: `scale(${0.94 + gather * 0.06})` }}>
            <Card lime style={{ display: "flex", alignItems: "center", gap: 30 }}>
              <div style={{ flex: 1 }}>
                <Label>Grootste pijnpunt</Label>
                <p style={{ margin: "14px 0 0", fontSize: 50, fontWeight: 650, lineHeight: 1.2 }}>Wieltjes ontbreken bij de speelgoedauto</p>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 120, fontWeight: 700, color: C.lime, lineHeight: 1 }}>{count}</div>
                <div style={{ fontSize: 30, color: C.textMuted }}>vragen</div>
              </div>
            </Card>
          </div>
        </div>
      </AbsoluteFill>
    </Bg>
  );
}

function Advice() {
  return (
    <Bg>
      <AbsoluteFill style={{ padding: 80, justifyContent: "center", gap: 40 }}>
        <Enter at={0}><div style={{ display: "flex", alignItems: "center", gap: 24 }}><Mascot size={140} gear="antenna" happyFrom={120} /><Label>✦ AI-advies</Label></div></Enter>
        {ADVICE.map((a, i) => (
          <Enter key={a} at={18 + i * 22}>
            <Card style={{ display: "flex", gap: 28, alignItems: "center", padding: 32 }}>
              <span style={{ width: 70, height: 70, borderRadius: 99, display: "grid", placeItems: "center", background: `${C.lime}22`, color: C.lime, fontSize: 36, fontWeight: 800, flex: "none" }}>{i + 1}</span>
              <span style={{ fontSize: 42, lineHeight: 1.35 }}>{a}</span>
            </Card>
          </Enter>
        ))}
        <Enter at={100}><p style={{ margin: 0, fontSize: 40, color: C.textSoft, textAlign: "center" }}>Los het op bij de bron. Dan komt dezelfde vraag minder vaak binnen.</p></Enter>
      </AbsoluteFill>
    </Bg>
  );
}

export function PainPoints() {
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Soundtrack total={570} cues={[[0, "whoosh"], ...series(18, 8, 5, "pop"), [110, "whoosh"], ...series(130, 4, 13, "tick"), [182, "ding", 0.35], [240, "whoosh"], ...series(258, 22, 3, "pop"), [360, "ding", 0.4], [420, "whoosh"], [446, "pop"], [482, "tick", 0.4], [494, "tick", 0.4], [506, "tick", 0.4], [515, "pop", 0.5]]} />
      <Sequence durationInFrames={240}><Gather /></Sequence>
      <Sequence from={240} durationInFrames={180}><Advice /></Sequence>
      <Sequence from={420} durationInFrames={150}><EndCard product="Pijnpunten" gear="antenna" line="Zie welk probleem het vaakst terugkomt, met advies om het op te lossen. In Support One Growth en Scale." /></Sequence>
    </AbsoluteFill>
  );
}
