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

export function Mascot({ size = 240, gear = "headset", happyFrom, lookX = 0, blinkAt = [40, 130, 220] }: {
  size?: number;
  gear?: Gear;
  /** Vanaf dit frame (relatief) dichtgeknepen, blije ogen. */
  happyFrom?: number;
  /** Kijkrichting -1..1. */
  lookX?: number;
  blinkAt?: number[];
}) {
  const frame = useCurrentFrame();
  const breathe = 1 + Math.sin(frame / 18) * 0.012;
  const blink = blinkAt.some((at) => frame >= at && frame < at + 6)
    ? interpolate(frame % 1000, [0, 3, 6], [1, 0.1, 1], { extrapolateRight: "clamp" })
    : 1;
  const happy = happyFrom !== undefined && frame >= happyFrom;
  const lid = happy ? 0.42 : blink;
  const dx = lookX * 4;

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
      <path d={BODY} fill="url(#m-body)" />
      <path d={BODY} fill="none" stroke="url(#m-rim)" strokeWidth="4" />
      <g transform={`translate(${50 + dx} 66) scale(1 ${lid})`}><rect x={-5.5} y={-12} width={11} height={24} rx={5.5} fill={C.ink} /></g>
      <g transform={`translate(${76 + dx} 66) scale(1 ${lid})`}><rect x={-5.5} y={-12} width={11} height={24} rx={5.5} fill={C.ink} /></g>
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
        <g transform={`rotate(${Math.sin(frame / 9) * 4} 54 10)`}>
          <path d={ANTENNA} fill="none" stroke={C.lime} strokeWidth="3.5" strokeLinecap="round" />
          <rect x="64" y="-16" width="12" height="12" rx="3" fill={C.ink} stroke={C.lime} strokeWidth="3" />
        </g>
      )}
      {gear === "camera" && (
        <g>
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
    </svg>
  );
}
