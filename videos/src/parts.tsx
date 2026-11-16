import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { Mascot, type Gear } from "./Mascot";
import { C, FONT } from "./theme";

/** Schuift en vervaagt binnen vanaf `at` (frames, relatief aan de Sequence). */
export function Enter({ at = 0, y = 40, children, style }: { at?: number; y?: number; children: ReactNode; style?: CSSProperties }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - at, fps, config: { damping: 18, stiffness: 120 } });
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * y}px)`, ...style }}>{children}</div>;
}

export function Bg({ children, glow = true }: { children: ReactNode; glow?: boolean }) {
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT, color: C.text }}>
      {glow ? <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 18%, ${C.lime}1f, transparent 55%)` }} /> : null}
      {children}
    </AbsoluteFill>
  );
}

export function Headline({ children, size = 84, style }: { children: ReactNode; size?: number; style?: CSSProperties }) {
  return <h1 style={{ margin: 0, fontSize: size, lineHeight: 1.05, letterSpacing: "-0.03em", fontWeight: 650, ...style }}>{children}</h1>;
}

export function Card({ children, style, lime = false }: { children: ReactNode; style?: CSSProperties; lime?: boolean }) {
  return (
    <div style={{ padding: 36, borderRadius: 32, border: `2px solid ${lime ? C.lineLime : C.line}`, background: lime ? C.surface2 : C.surface, boxShadow: "0 30px 80px #0008", ...style }}>
      {children}
    </div>
  );
}

export function Label({ children, color = C.lime }: { children: ReactNode; color?: string }) {
  return <p style={{ margin: 0, color, fontSize: 30, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>{children}</p>;
}

/** Tekst die letter voor letter verschijnt, tussen frame `from` en `to`. */
export function Typed({ text, from, to }: { text: string; from: number; to: number }) {
  const frame = useCurrentFrame();
  const n = Math.round(interpolate(frame, [from, to], [0, text.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return <>{text.slice(0, n)}{n < text.length && frame >= from ? <span style={{ opacity: 0.6 }}>▍</span> : null}</>;
}

/** Eindkaart: wie, wat, en waar te beginnen. Geen beloftes die we niet kunnen meten. */
export function EndCard({ product, gear, line, cta = "14 dagen gratis · sequenceflow.io" }: { product: string; gear: Gear; line: string; cta?: string }) {
  return (
    <Bg>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 90, textAlign: "center", gap: 40 }}>
        <Enter at={0}><Mascot size={300} gear={gear} signature /></Enter>
        <Enter at={8}><Label>SequenceFlow</Label></Enter>
        <Enter at={12}><Headline size={110}>{product}</Headline></Enter>
        <Enter at={18}><p style={{ margin: 0, fontSize: 46, lineHeight: 1.35, color: C.textSoft, maxWidth: 860 }}>{line}</p></Enter>
        <Enter at={26}>
          <div style={{ marginTop: 20, padding: "26px 48px", borderRadius: 999, background: C.lime, color: "#142000", fontSize: 40, fontWeight: 750 }}>{cta}</div>
        </Enter>
      </AbsoluteFill>
    </Bg>
  );
}
