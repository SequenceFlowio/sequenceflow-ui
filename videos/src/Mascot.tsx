import { interpolate, useCurrentFrame } from "remotion";

import { C } from "./theme";

/**
 * De SequenceFlow-mascotte (zelfde vorm als components/marketing/SequenceMark.tsx),
 * maar per frame geanimeerd zodat de video altijd hetzelfde rendert: ademen,
 * knipperen op vaste momenten, en optioneel blij (dichtgeknepen ogen).
 */

const BODY = "M53 9 C77 7 99 21 109 43 C119 64 117 92 97 105 C77 118 46 117 29 106 C12 95 4 75 8 54 C13 30 31 11 53 9 Z";
const BAND = "M12 63 C10 27 33 6 60 6 C87 6 110 27 108 63";
const BOOM = "M12 78 C12 96 23 106 36 103";
const ANTENNA = "M54 10 C54 -9 65 -22 70 -10";
const STRAP = "M109 46 C109 64 98 80 82 91";

export type Gear = "headset" | "antenna" | "camera" | "analyst";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** 0 -> 1 -> 0 over [a, b]. */
const pulse = (f: number, a: number, b: number) => Math.sin(Math.PI * interpolate(f, [a, b], [0, 1], clamp));

export function Mascot({ size = 240, gear = "headset", happyFrom, lookX = 0, blinkAt = [40, 130, 220], signature = false }: {
  size?: number;
  gear?: Gear;
  /** Vanaf dit frame (relatief) dichtgeknepen, blije ogen. */
  happyFrom?: number;
  /** Kijkrichting -1..1. */
  lookX?: number;
  blinkAt?: number[];
  /** Eindkaart: rondkijken en dan de eigen beweging per mascotte (frames relatief aan de eindkaart). */
  signature?: boolean;
}) {
  const frame = useCurrentFrame();
  const breathe = 1 + Math.sin(frame / 18) * 0.012;
  const blink = blinkAt.some((at) => frame >= at && frame < at + 6)
    ? interpolate(frame % 1000, [0, 3, 6], [1, 0.1, 1], { extrapolateRight: "clamp" })
    : 1;
  const f = frame;
  // Rondkijken: links, rechts, terug.
  const look = signature ? interpolate(f, [20, 30, 38, 48, 54, 62], [0, -1, -1, 1, 1, 0], clamp) : lookX;
  // Beweging van het hele lijf per mascotte.
  const beat = 18.75; // 96 bpm, zelfde tempo als het deuntje
  let rot = 0, lift = 0, squash = 0;
  if (signature) {
    lift += pulse(f, 4, 16) * 10; // klein sprongetje bij binnenkomst
    if (gear === "headset" && f >= 62) { const ph = ((f - 62) % beat) / beat; rot = Math.sin(ph * Math.PI * 2) * 7; squash = Math.abs(Math.sin(ph * Math.PI)) * 0.04; lift += Math.abs(Math.sin(ph * Math.PI)) * 5; }
    if (gear === "antenna") { rot = pulse(f, 92, 104) * -6; lift += pulse(f, 92, 104) * 14; }
    if (gear === "analyst") rot = (pulse(f, 84, 94) + pulse(f, 96, 106)) * 9;
    if (gear === "camera") rot = interpolate(f, [60, 74, 118, 128], [0, -8, -8, 0], clamp);
  }
  const happyAt = signature ? (gear === "headset" ? 66 : 110) : happyFrom;
  const happy = happyAt !== undefined && frame >= happyAt;
  const wink = signature && gear !== "headset" && f >= 128 && f < 140;
  const lid = happy ? 0.42 : blink;
  const dx = look * 4;
  const antennaSwing = gear === "antenna" && signature ? Math.sin(f / 2.2) * 4 + Math.sin(f / 2.2) * 16 * pulse(f, 60, 96) : Math.sin(f / 9) * 4;
  const camLift = gear === "camera" && signature ? interpolate(f, [60, 74, 118, 128], [0, -16, -16, 0], clamp) : 0;
  const flash = gear === "camera" && signature ? Math.max(interpolate(f, [80, 92], [1, 0], clamp) * (f >= 80 ? 1 : 0), interpolate(f, [104, 116], [1, 0], clamp) * (f >= 104 ? 1 : 0)) : 0;
  const flashR = gear === "camera" && signature ? (f >= 104 ? interpolate(f, [104, 116], [6, 80], clamp) : interpolate(f, [80, 92], [6, 80], clamp)) : 0;

  return (
    <svg viewBox="-10 -26 140 150" width={size} height={size * (150 / 140)} style={{ overflow: "visible", transform: `scale(${breathe})`, transformOrigin: "50% 90%" }}>
      <defs>
        <linearGradient id="m-body" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E9F2D6" />
        </linearGradient>
        <linearGradient id="m-rim" x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="45%" stopColor={C.lime} stopOpacity="0" />
          <stop offset="100%" stopColor={C.lime} stopOpacity="0.95" />
        </linearGradient>
      </defs>
      <g transform={`translate(0 ${-lift}) rotate(${rot} 60 112) translate(60 112) scale(${1 + squash} ${1 - squash}) translate(-60 -112)`}>
      <path d={BODY} fill="url(#m-body)" />
      <path d={BODY} fill="none" stroke="url(#m-rim)" strokeWidth="4" />
      <g transform={`translate(${50 + dx} 66) scale(1 ${lid})`}><rect x={-5.5} y={-12} width={11} height={24} rx={5.5} fill={C.ink} /></g>
      <g transform={`translate(${76 + dx} 66) scale(1 ${wink ? 0.12 : lid})`}><rect x={-5.5} y={-12} width={11} height={24} rx={5.5} fill={C.ink} /></g>
      {gear === "headset" && (
        <g>
          <path d={BAND} fill="none" stroke={C.lime} strokeWidth="7" strokeLinecap="round" />
          <rect x="1.5" y="50" width="19" height="30" rx="9.5" fill={C.lime} />
          <rect x="99.5" y="50" width="19" height="30" rx="9.5" fill={C.lime} />
          <rect x="6" y="57" width="10" height="16" rx="5" fill={C.ink} opacity="0.8" />
          <rect x="104" y="57" width="10" height="16" rx="5" fill={C.ink} opacity="0.8" />
          <path d={BOOM} fill="none" stroke={C.ink} strokeWidth="4" strokeLinecap="round" />
          <ellipse cx="38" cy="102.5" rx="6.5" ry="4.8" transform="rotate(-12 38 102.5)" fill={C.ink} />
        </g>
      )}
      {gear === "antenna" && (
        <g transform={`rotate(${antennaSwing} 54 10)`}>
          <path d={ANTENNA} fill="none" stroke={C.lime} strokeWidth="3.5" strokeLinecap="round" />
          <rect x="64" y="-16" width="12" height="12" rx="3" fill={C.ink} stroke={C.lime} strokeWidth="3" />
        </g>
      )}
      {gear === "camera" && (
        <g transform={`translate(0 ${camLift})`}>
          <path d={STRAP} fill="none" stroke={C.ink} strokeWidth="3" strokeLinecap="round" />
          <rect x="50" y="82" width="11" height="7" rx="2" fill={C.lime} />
          <rect x="42" y="87" width="40" height="27" rx="7" fill={C.lime} />
          <circle cx="62" cy="100.5" r="9.5" fill={C.ink} />
          <circle cx="59.5" cy="98" r="1.6" fill="#FFFFFF" opacity="0.85" />
        </g>
      )}
      {gear === "analyst" && (
        <g fill="none" stroke={C.ink} strokeWidth="3.4" strokeLinecap="round">
          <rect x="36" y="52" width="27" height="28" rx="10" fill={C.lime} fillOpacity="0.3" />
          <rect x="66" y="52" width="27" height="28" rx="10" fill={C.lime} fillOpacity="0.3" />
          <path d="M63 62 Q64.5 59.5 66 62 M29 59 L36 62 M93 62 L99 59" />
        </g>
      )}
      {gear === "analyst" && signature && f >= 60 && f <= 80 && (
        <g clipPath="url(#m-lens)" opacity={pulse(f, 60, 80)}>
          <rect x={interpolate(f, [60, 80], [20, 100])} y="40" width="9" height="50" fill="#FFFFFF" opacity="0.85" transform="skewX(-20)" />
        </g>
      )}
      </g>
      <defs>
        <clipPath id="m-lens"><rect x="36" y="52" width="27" height="28" rx="10" /><rect x="66" y="52" width="27" height="28" rx="10" /></clipPath>
      </defs>
      {signature && gear === "headset" && [62, 81, 100, 119].map((at, i) => f >= at && f < at + 40 ? (
        <text key={at} x={i % 2 ? 112 + (f - at) * 0.4 : 0 - (f - at) * 0.4} y={50 - (f - at) * 1.6} fontSize={i % 2 ? 34 : 28} fontWeight="800" fill={C.lime} textAnchor="middle" opacity={pulse(f, at, at + 40)}>{i % 2 ? "♫" : "♪"}</text>
      ) : null)}
      {signature && gear === "antenna" && [62, 74, 86].map((at) => f >= at && f < at + 22 ? (
        <circle key={at} cx={70 + antennaSwing * 0.3} cy={-10} r={interpolate(f, [at, at + 22], [4, 34])} fill="none" stroke={C.lime} strokeWidth="2.5" opacity={interpolate(f, [at, at + 22], [0.9, 0])} />
      ) : null)}
      {signature && gear === "antenna" && f >= 95 && (
        <text x="22" y="-4" fontSize="34" fontWeight="900" fill={C.lime} textAnchor="middle" transform={`translate(22 -16) scale(${interpolate(f, [95, 101, 106], [0, 1.25, 1], clamp)}) translate(-22 16)`}>!</text>
      )}
      {signature && gear === "analyst" && f >= 100 && (
        <g transform={`translate(116 18) scale(${interpolate(f, [100, 106, 111], [0, 1.25, 1], clamp)})`}>
          <circle r="13" fill={C.lime} />
          <path d="M-6 0 L-1.5 5 L6.5 -5" fill="none" stroke={C.ink} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      {flash > 0 && (
        <g opacity={flash}>
          <circle cx="62" cy={100.5 + camLift} r={flashR} fill="#FFFFFF" opacity="0.55" />
          <circle cx="62" cy={100.5 + camLift} r={flashR * 0.35} fill="#FFFFFF" />
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <line key={a} x1={62 + Math.cos(a * Math.PI / 180) * flashR * 0.5} y1={100.5 + camLift + Math.sin(a * Math.PI / 180) * flashR * 0.5} x2={62 + Math.cos(a * Math.PI / 180) * flashR * 0.9} y2={100.5 + camLift + Math.sin(a * Math.PI / 180) * flashR * 0.9} stroke={C.lime} strokeWidth="3" strokeLinecap="round" />
          ))}
        </g>
      )}
    </svg>
  );
}
