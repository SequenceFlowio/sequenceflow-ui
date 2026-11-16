import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";

import { Mascot } from "./Mascot";
import { Bg, Card, EndCard, Enter, Headline, Label, Typed } from "./parts";
import { series, Soundtrack } from "./Soundtrack";
import { C } from "./theme";
import { CTA, type Lang } from "./i18n";

const TEXT = {
  nl: {
    mails: ["Waar blijft mijn bestelling?", "Kan ik dit nog ruilen?", "Mijn pakket is beschadigd", "Wanneer wordt het geleverd?", "Hoe meld ik een retour aan?"],
    hook1: "Elke dag dezelfde", hook2: "klantvragen?",
    newQ: "Nieuwe klantvraag", name: "Sanne", question: "“Hoi, ik heb vorige week besteld maar nog niks ontvangen. Waar blijft mijn pakket?”",
    looking: "Seffy zoekt de bestelling op…", found: "Bestelling gevonden",
    order: "Bestelling #4521", status: "Onderweg · PostNL",
    draft: "Concept in jouw stijl",
    reply: "Hoi Sanne, je bestelling #4521 is onderweg met PostNL. Via je track & trace zie je precies waar je pakket nu is.",
    approve: "Goedkeuren & versturen", sent: "✓ Verstuurd", edit: "Aanpassen",
    control: "Jij keurt goed. Of je laat het later vanzelf versturen.",
    endLine: "Klantmail beantwoord in jouw stijl, met de bestelling erbij. Jij houdt de controle.",
  },
  en: {
    mails: ["Where is my order?", "Can I still exchange this?", "My package arrived damaged", "When will it be delivered?", "How do I start a return?"],
    hook1: "The same customer", hook2: "questions every day?",
    newQ: "New customer question", name: "Emma", question: "“Hi, I ordered last week but haven't received anything yet. Where is my package?”",
    looking: "Seffy is looking up the order…", found: "Order found",
    order: "Order #4521", status: "In transit · UPS",
    draft: "Draft in your voice",
    reply: "Hi Emma, your order #4521 is on its way with UPS. Your tracking link shows exactly where your package is right now.",
    approve: "Approve & send", sent: "✓ Sent", edit: "Edit",
    control: "You approve. Or let it send on its own later.",
    endLine: "Customer email answered in your voice, with the order details included. You stay in control.",
  },
};
type T = (typeof TEXT)["nl"];
export type SupportContent = Partial<T>;

/**
 * Support One in ~24 seconden: een klantvraag komt binnen, Seffy zoekt de
 * bestelling op en schrijft een concept, jij keurt goed, verstuurd.
 */


function Hook({ t }: { t: T }) {
  const frame = useCurrentFrame();
  return (
    <Bg>
      <AbsoluteFill style={{ padding: 90, justifyContent: "center", gap: 60 }}>
        <Enter at={0}><Headline size={104}>{t.hook1}<br /><span style={{ color: C.lime }}>{t.hook2}</span></Headline></Enter>
        <div style={{ display: "grid", gap: 22 }}>
          {t.mails.map((mail, i) => (
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

function Flow({ t }: { t: T }) {
  const frame = useCurrentFrame();
  const approved = frame >= 300;
  const press = interpolate(frame, [285, 292, 300], [1, 0.94, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Bg>
      <AbsoluteFill style={{ padding: 80, gap: 34, justifyContent: "center" }}>
        <Enter at={0}>
          <Card>
            <Label color={C.textMuted}>{t.newQ}</Label>
            <p style={{ margin: "18px 0 0", fontSize: 44, fontWeight: 650 }}>{t.name}</p>
            <p style={{ margin: "8px 0 0", fontSize: 40, color: C.textSoft, lineHeight: 1.4 }}>{t.question}</p>
          </Card>
        </Enter>

        <Enter at={45}>
          <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
            <Mascot size={150} gear="headset" lookX={0.6} happyFrom={300} blinkAt={[70, 190]} />
            <p style={{ margin: 0, fontSize: 40, color: C.textSoft }}>{frame < 110 ? t.looking : t.found}</p>
          </div>
        </Enter>

        <Enter at={95}>
          <Card style={{ padding: 30 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 36 }}>
              <strong>{t.order}</strong>
              <span style={{ padding: "8px 18px", borderRadius: 99, background: `${C.lime}22`, color: C.lime, fontSize: 30 }}>{t.status}</span>
            </div>
          </Card>
        </Enter>

        <Enter at={130}>
          <Card lime>
            <Label>{t.draft}</Label>
            <p style={{ margin: "18px 0 0", fontSize: 40, lineHeight: 1.45, color: C.text, minHeight: 230 }}>
              <Typed text={t.reply} from={140} to={260} />
            </p>
            <div style={{ display: "flex", gap: 18, marginTop: 26 }}>
              <div style={{ transform: `scale(${press})`, padding: "20px 38px", borderRadius: 16, background: approved ? "#2a3a1a" : C.lime, color: approved ? C.lime : "#142000", fontSize: 36, fontWeight: 750 }}>
                {approved ? t.sent : t.approve}
              </div>
              {!approved ? <div style={{ padding: "20px 30px", borderRadius: 16, border: `2px solid ${C.lineLime}`, fontSize: 36, color: C.textSoft }}>{t.edit}</div> : null}
            </div>
          </Card>
        </Enter>

        <Enter at={305}>
          <p style={{ margin: 0, textAlign: "center", fontSize: 40, color: C.textSoft }}>{t.control}</p>
        </Enter>
      </AbsoluteFill>
    </Bg>
  );
}

export function SupportOne({ lang = "nl", content }: { lang?: Lang; content?: SupportContent }) {
  const t: T = { ...TEXT[lang], ...content };
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Soundtrack total={640} cues={[[0, "whoosh"], ...series(10, 7, 5, "pop"), [90, "whoosh"], [92, "pop"], [137, "pop"], [185, "pop"], [222, "pop"], [230, "typing", 0.22, 120], [376, "click"], [390, "ding"], [490, "whoosh"], [516, "pop"]]} />
      <Sequence durationInFrames={90}><Hook t={t} /></Sequence>
      <Sequence from={90} durationInFrames={400}><Flow t={t} /></Sequence>
      <Sequence from={490} durationInFrames={150}>
        <EndCard product="Support One" gear="headset" line={t.endLine} cta={CTA[lang]} />
      </Sequence>
    </AbsoluteFill>
  );
}
