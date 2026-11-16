import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";

import { Mascot } from "./Mascot";
import { Bg, Card, EndCard, Enter, Headline, Label, Typed } from "./parts";
import { series, Soundtrack } from "./Soundtrack";
import { C } from "./theme";

/**
 * Support One in ~24 seconden: een klantvraag komt binnen, Seffy zoekt de
 * bestelling op en schrijft een concept, jij keurt goed, verstuurd.
 */

const MAILS = ["Waar blijft mijn bestelling?", "Kan ik dit nog ruilen?", "Mijn pakket is beschadigd", "Wanneer wordt het geleverd?", "Hoe meld ik een retour aan?"];

function Hook() {
  const frame = useCurrentFrame();
  return (
    <Bg>
      <AbsoluteFill style={{ padding: 90, justifyContent: "center", gap: 60 }}>
        <Enter at={0}><Headline size={104}>Elke dag dezelfde<br /><span style={{ color: C.lime }}>klantvragen?</span></Headline></Enter>
        <div style={{ display: "grid", gap: 22 }}>
          {MAILS.map((mail, i) => (
            <Enter key={mail} at={10 + i * 7} y={60}>
              <div style={{ display: "flex", alignItems: "center", gap: 22, padding: "26px 30px", borderRadius: 22, border: `2px solid ${C.line}`, background: C.surface, fontSize: 38, color: C.textSoft, transform: `translateX(${Math.sin((frame + i * 9) / 14) * 4}px)` }}>
                <span style={{ width: 16, height: 16, borderRadius: 99, background: C.lime, opacity: 0.8 }} /> {mail}
              </div>
            </Enter>
          ))}
        </div>
      </AbsoluteFill>
    </Bg>
  );
}

function Flow() {
  const frame = useCurrentFrame();
  const approved = frame >= 300;
  const press = interpolate(frame, [285, 292, 300], [1, 0.94, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Bg>
      <AbsoluteFill style={{ padding: 80, gap: 34, justifyContent: "center" }}>
        <Enter at={0}>
          <Card>
            <Label color={C.textMuted}>Nieuwe klantvraag</Label>
            <p style={{ margin: "18px 0 0", fontSize: 44, fontWeight: 650 }}>Sanne</p>
            <p style={{ margin: "8px 0 0", fontSize: 40, color: C.textSoft, lineHeight: 1.4 }}>“Hoi, ik heb vorige week besteld maar nog niks ontvangen. Waar blijft mijn pakket?”</p>
          </Card>
        </Enter>

        <Enter at={45}>
          <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
            <Mascot size={150} gear="headset" lookX={0.6} happyFrom={300} blinkAt={[70, 190]} />
            <p style={{ margin: 0, fontSize: 40, color: C.textSoft }}>{frame < 110 ? "Seffy zoekt de bestelling op…" : "Bestelling gevonden"}</p>
          </div>
        </Enter>

        <Enter at={95}>
          <Card style={{ padding: 30 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 36 }}>
              <strong>Bestelling #4521</strong>
              <span style={{ padding: "8px 18px", borderRadius: 99, background: `${C.lime}22`, color: C.lime, fontSize: 30 }}>Onderweg · PostNL</span>
            </div>
          </Card>
        </Enter>

        <Enter at={130}>
          <Card lime>
            <Label>Concept in jouw stijl</Label>
            <p style={{ margin: "18px 0 0", fontSize: 40, lineHeight: 1.45, color: C.text, minHeight: 230 }}>
              <Typed text="Hoi Sanne, je bestelling #4521 is onderweg met PostNL. Via je track & trace zie je precies waar je pakket nu is." from={140} to={260} />
            </p>
            <div style={{ display: "flex", gap: 18, marginTop: 26 }}>
              <div style={{ transform: `scale(${press})`, padding: "20px 38px", borderRadius: 16, background: approved ? "#2a3a1a" : C.lime, color: approved ? C.lime : "#142000", fontSize: 36, fontWeight: 750 }}>
                {approved ? "✓ Verstuurd" : "Goedkeuren & versturen"}
              </div>
              {!approved ? <div style={{ padding: "20px 30px", borderRadius: 16, border: `2px solid ${C.lineLime}`, fontSize: 36, color: C.textSoft }}>Aanpassen</div> : null}
            </div>
          </Card>
        </Enter>

        <Enter at={305}>
          <p style={{ margin: 0, textAlign: "center", fontSize: 40, color: C.textSoft }}>Jij keurt goed. Of je laat het later vanzelf versturen.</p>
        </Enter>
      </AbsoluteFill>
    </Bg>
  );
}

export function SupportOne() {
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Soundtrack total={640} cues={[[0, "whoosh"], ...series(10, 7, 5, "pop"), [90, "whoosh"], [92, "pop"], [137, "pop"], [185, "pop"], [222, "pop"], [230, "typing", 0.22, 120], [376, "click"], [390, "ding"], [490, "whoosh"], [516, "pop"]]} />
      <Sequence durationInFrames={90}><Hook /></Sequence>
      <Sequence from={90} durationInFrames={400}><Flow /></Sequence>
      <Sequence from={490} durationInFrames={150}>
        <EndCard product="Support One" gear="headset" line="Klantmail beantwoord in jouw stijl, met de bestelling erbij. Jij houdt de controle." />
      </Sequence>
    </AbsoluteFill>
  );
}
