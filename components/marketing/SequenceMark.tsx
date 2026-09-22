"use client";

import { useEffect, useRef } from "react";

import { useReducedMotion } from "./useReducedMotion";

/**
 * SequenceMark — de levende mascotte van SequenceFlow Support.
 *
 * Ontwerpprincipe: een mascotte voelt pas levend als de ogen zich gedragen
 * als echte ogen. Echte ogen bewegen niet vloeiend maar in *saccades*: ze
 * springen naar een punt, fixeren daar ~0,3-2,2s, en springen weer. Een
 * lineair heen-en-weer glijdend oog leest als een machine; saccades lezen
 * als aandacht.
 *
 * Bewust géén mond. Twee ogen plus een mondboogje is de meest gebruikte
 * mascotteformule die er is, en een mond die níét meebeweegt leest bovenop
 * bewegende ogen als een masker. Zonder mond moet alle expressie uit de ogen
 * komen — precies wat dit systeem doet. Blijdschap is hier dichtgeknepen
 * ogen, niet een glimlach.
 *
 * Het silhouet is asymmetrisch: de top ligt links van het midden en het
 * gewicht hangt rechtsonder. Symmetrie leest als logo; een vorm met een
 * zwaartepunt leest als iets dat ergens op rust.
 *
 * Eigen kenmerk: het limoen zit in het randlicht, niet in de vulling. Een
 * licht silhouet houdt zijn contrast tot op 24px; een limoen vlak met donkere
 * ogen klapt op die maat dicht tot een groen bolletje.
 */

export type MarkState = "idle" | "thinking" | "reading" | "happy";

type Props = {
  /** Rendergrootte in px. CSS width/height wint hiervan. */
  size?: number;
  /** Gedragstoestand; stuurt tempo, blikspreiding en oogopening. */
  state?: MarkState;
  /** Volgt de muis binnen deze straal in px. 0 = uit. */
  followPointer?: number;
  className?: string;
  /** Toegankelijke naam. Lege string = puur decoratief, uit de a11y-tree. */
  title?: string;
};

/** Hoe lang de blik op één punt rust, per toestand (ms). */
const FIXATION_MS: Record<MarkState, [number, number]> = {
  idle: [900, 2200],
  thinking: [420, 900],
  reading: [260, 620],
  happy: [700, 1500],
};

/** Hoe ver de blik afdwaalt van het midden (0-1 van de maximale uitslag). */
const GAZE_SPREAD: Record<MarkState, number> = {
  idle: 1,
  thinking: 0.55,
  reading: 0.85,
  happy: 0.7,
};

/** Rustopening van de ogen. Zonder mond draagt dit de uitdrukking. */
const LID_REST: Record<MarkState, number> = {
  idle: 1,
  thinking: 0.88,
  reading: 1,
  happy: 0.52,
};

/** Het asymmetrische silhouet: top links van het midden, gewicht rechtsonder. */
const BODY =
  "M53 9 C77 7 99 21 109 43 C119 64 117 92 97 105 C77 118 46 117 29 106 C12 95 4 75 8 54 C13 30 31 11 53 9 Z";

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function SequenceMark({
  size = 64,
  state = "idle",
  followPointer = 0,
  className,
  title = "Support-assistent",
}: Props) {
  const rootRef = useRef<SVGSVGElement | null>(null);
  const headRef = useRef<SVGGElement | null>(null);
  const leftEyeRef = useRef<SVGGElement | null>(null);
  const rightEyeRef = useRef<SVGGElement | null>(null);

  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;

    const root = rootRef.current;
    const head = headRef.current;
    const leftEye = leftEyeRef.current;
    const rightEye = rightEyeRef.current;
    if (!root || !head || !leftEye || !rightEye) return;

    let gazeX = 0;
    let gazeY = 0;
    let targetGazeX = 0;
    let targetGazeY = 0;

    const rest = LID_REST[state];
    let lidOpen = rest; // 1 = open, 0 = dicht
    let targetLid = rest;

    let pointerActive = false;
    let frame = 0;
    let disposed = false;
    const timers = new Set<number>();

    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        if (!disposed) fn();
      }, ms);
      timers.add(id);
      return id;
    };

    const scheduleSaccade = () => {
      const [min, max] = FIXATION_MS[state];
      later(() => {
        if (!pointerActive) {
          const spread = GAZE_SPREAD[state];
          // Kwadratische radius: de blik blijft vaker in het midden dan aan
          // de randen, wat natuurlijker leest dan een uniforme verdeling.
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.pow(Math.random(), 0.7) * spread;
          targetGazeX = Math.cos(angle) * radius;
          targetGazeY = Math.sin(angle) * radius * 0.7; // minder verticale uitslag
        }
        scheduleSaccade();
      }, randomBetween(min, max));
    };

    const scheduleBlink = () => {
      later(() => {
        targetLid = 0;
        later(() => {
          targetLid = rest;
          // ~20% kans op een dubbele knipper; dat detail leest als leven.
          if (Math.random() < 0.2) {
            later(() => { targetLid = 0; }, 120);
            later(() => { targetLid = rest; }, 210);
          }
        }, 95);
        scheduleBlink();
      }, randomBetween(2400, 6200));
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      if (Math.hypot(dx, dy) > followPointer) {
        pointerActive = false;
        return;
      }
      pointerActive = true;
      targetGazeX = Math.max(-1, Math.min(1, (dx / followPointer) * 1.4));
      targetGazeY = Math.max(-1, Math.min(1, dy / followPointer));
    };

    const start = performance.now();
    const tick = (now: number) => {
      if (disposed) return;
      const elapsed = (now - start) / 1000;

      // Hoge lerp = de sprong duurt ~40-70ms, net als een echte saccade.
      gazeX += (targetGazeX - gazeX) * 0.35;
      gazeY += (targetGazeY - gazeY) * 0.35;
      lidOpen += (targetLid - lidOpen) * 0.45;

      // Ademhaling: twee frequenties door elkaar zodat het niet als een
      // zuivere sinus leest.
      const breath = (Math.sin(elapsed * 0.9) + Math.sin(elapsed * 1.9) * 0.25) / 1.25;
      // Squash-and-stretch: indrukken maakt breder, uitzetten maakt smaller.
      // Uniform schalen zou alleen als in- en uitzoomen lezen.
      const squash = breath * 0.022;
      root.style.transform = `scale(${(1 + squash).toFixed(4)}, ${(1 - squash * 0.85).toFixed(4)})`;

      // Hoofd leunt mee met de blik: geeft de kijkrichting gewicht.
      head.setAttribute(
        "transform",
        `translate(${(gazeX * 3.2).toFixed(2)} ${(gazeY * 2.4).toFixed(2)}) rotate(${(gazeX * 1.6).toFixed(2)} 60 60)`,
      );

      // Ogen: verschuiving + pseudo-diepte. Een oog dat wegdraait van de
      // kijker wordt smaller, precies zoals perspectief dat zou doen.
      const shiftX = gazeX * 7;
      const shiftY = gazeY * 5;
      const leftDepth = 1 - Math.max(0, gazeX) * 0.22;
      const rightDepth = 1 - Math.max(0, -gazeX) * 0.22;
      const lid = Math.max(0.06, lidOpen);

      leftEye.setAttribute(
        "transform",
        `translate(${(50 + shiftX).toFixed(2)} ${(66 + shiftY).toFixed(2)}) scale(${leftDepth.toFixed(3)} ${lid.toFixed(3)})`,
      );
      rightEye.setAttribute(
        "transform",
        `translate(${(76 + shiftX).toFixed(2)} ${(66 + shiftY).toFixed(2)}) scale(${rightDepth.toFixed(3)} ${lid.toFixed(3)})`,
      );

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    scheduleSaccade();
    scheduleBlink();
    if (followPointer > 0) window.addEventListener("pointermove", onPointerMove, { passive: true });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      for (const id of timers) window.clearTimeout(id);
      timers.clear();
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, [state, followPointer, reducedMotion]);

  // Zonder animatie moet de rustpose kloppen: bij "happy" horen de ogen ook
  // dan dichtgeknepen te staan.
  const restLid = LID_REST[state];

  return (
    <svg
      ref={rootRef}
      className={className}
      data-state={state}
      viewBox="0 0 120 120"
      width={size}
      height={size}
      {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true })}
      style={{
        overflow: "visible",
        // Het zwaartepunt ligt onderin: daar drukt de ademhaling op.
        transformOrigin: "50% 88%",
        willChange: "transform",
      }}
    >
      <defs>
        <linearGradient id="sq-mark-body" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E9F2D6" />
        </linearGradient>
        {/* Randlicht: alleen langs de onderrand, waar het licht zou vallen. */}
        <linearGradient id="sq-mark-rim" x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="45%" stopColor="#C7F56F" stopOpacity="0" />
          <stop offset="100%" stopColor="#C7F56F" stopOpacity="0.95" />
        </linearGradient>
      </defs>

      <g ref={headRef}>
        <path d={BODY} fill="url(#sq-mark-body)" />
        <path d={BODY} fill="none" stroke="url(#sq-mark-rim)" strokeWidth="4" />

        {/* Losse oog-groepen: elk oog krijgt eigen diepte en ooglid. */}
        <g ref={leftEyeRef} transform={`translate(50 66) scale(1 ${restLid})`}>
          <rect x="-5.5" y="-12" width="11" height="24" rx="5.5" fill="#10160E" />
        </g>
        <g ref={rightEyeRef} transform={`translate(76 66) scale(1 ${restLid})`}>
          <rect x="-5.5" y="-12" width="11" height="24" rx="5.5" fill="#10160E" />
        </g>
      </g>
    </svg>
  );
}
