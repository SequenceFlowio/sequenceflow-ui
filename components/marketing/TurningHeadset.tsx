import type { Ref } from "react";
/** Front/back copies are depth-sorted by the mascot's animation loop. */
export function TurningHeadset({ layerRef,accent,back=false }:{ layerRef:Ref<SVGGElement>;accent:string;back?:boolean }) {
 return <g ref={layerRef} style={{ display:"none" }} opacity={back ? .8 : 1} aria-hidden>
  <path data-headset="band" fill="none" stroke={accent} strokeWidth="7" strokeLinecap="round" />
  <g data-headset="cup-0"><rect x="-9.5" y="-15" width="19" height="30" rx="9.5" fill={accent} /><rect x="-5" y="-8" width="10" height="16" rx="5" fill="#10160E" opacity=".8" /></g>
  <g data-headset="cup-1"><rect x="-9.5" y="-15" width="19" height="30" rx="9.5" fill={accent} /><rect x="-5" y="-8" width="10" height="16" rx="5" fill="#10160E" opacity=".8" /></g>
  <path data-headset="boom" fill="none" stroke="#10160E" strokeWidth="4" strokeLinecap="round" />
  <g data-headset="mic"><ellipse rx="6.5" ry="4.8" transform="rotate(-12)" fill="#10160E" /></g>
 </g>;
}
