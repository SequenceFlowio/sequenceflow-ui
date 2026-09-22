"use client";

import { useEffect, useRef } from "react";

import { useReducedMotion } from "./useReducedMotion";

/**
 * SequenceMark — de levende mascotte van SequenceFlow Support.
 *
 * Ontwerpprincipe: een mascotte voelt pas levend als de ogen zich gedragen
 * als echte ogen. Echte ogen bewegen niet vloeiend maar in *saccades*: ze
 * springen naar een punt, fixeren daar ~0,8-2,2s, en springen weer. Een
 * lineair heen-en-weer glijdend oog leest als een machine; saccades lezen
 * als aandacht.
 *
 * Daarbovenop: ademhaling (trage, asymmetrische scale-oscillatie), knipperen
 * met natuurlijke spreiding (soms dubbel), en een lichte lean van het hoofd
 * richting de blik zodat de kijkrichting gewicht krijgt.
 *
 * De vorm is bewust eigen: een afgeronde ruit — de "flow"-diamant — in plaats
 * van een cirkel. Geen afgeleide van bestaande mascottes.
 */

export type MarkState = "idle" | "thinking" | "reading" | "happy";

type Props = {
  /** Rendergrootte in px. */
  size?: number;
  /** Gedragstoestand; stuurt tempo, blikspreiding en mondvorm. */
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

    let lidOpen = 1; // 1 = open, 0 = dicht
    let targetLid = 1;

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
          targetLid = 1;
          // ~20% kans op een dubbele knipper; dat detail leest als leven.
          if (Math.random() < 0.2) {
            later(() => { targetLid = 0; }, 120);
            later(() => { targetLid = 1; }, 210);
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
      root.style.transform = `scale(${(1 + breath * 0.018).toFixed(4)})`;

      // Hoofd leunt mee met de blik: geeft de kijkrichting gewicht.
      head.setAttribute(
        "transform",
        `translate(${(gazeX * 3.2).toFixed(2)} ${(gazeY * 2.4).toFixed(2)}) rotate(${(gazeX * 1.6).toFixed(2)} 60 60)`,
      );

      // Ogen: verschuiving + pseudo-diepte. Een oog dat wegdraait van de
      // kijker wordt smaller, precies zoals perspectief dat zou doen.
      const shiftX = gazeX * 7.5;
      const shiftY = gazeY * 5.5;
      const leftDepth = 1 - Math.max(0, gazeX) * 0.22;
      const rightDepth = 1 - Math.max(0, -gazeX) * 0.22;
      const lid = Math.max(0.06, lidOpen);

      leftEye.setAttribute(
        "transform",
        `translate(${(42 + shiftX).toFixed(2)} ${(56 + shiftY).toFixed(2)}) scale(${leftDepth.toFixed(3)} ${lid.toFixed(3)})`,
      );
      rightEye.setAttribute(
        "transform",
        `translate(${(78 + shiftX).toFixed(2)} ${(56 + shiftY).toFixed(2)}) scale(${rightDepth.toFixed(3)} ${lid.toFixed(3)})`,
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

  // Mondvorm per toestand. Bewust minimaal: een subtiele curve draagt meer
  // persoonlijkheid dan een expliciete glimlach.
  const mouth =
    state === "happy"
      ? "M48 82 Q60 92 72 82"
      : state === "thinking"
        ? "M50 84 Q60 84 70 84"
        : state === "reading"
          ? "M50 84 Q60 88 70 84"
          : "M50 84 Q60 87 70 84";

  return (
    <svg
      ref={rootRef}
      className={className}
      data-state={state}
      viewBox="0 0 120 120"
      width={size}
      height={size}
      {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true })}
      style={{ overflow: "visible", transformOrigin: "50% 50%", willChange: "transform" }}
    >
      <defs>
        <linearGradient id="sq-mark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D8FA8C" />
          <stop offset="100%" stopColor="#C7F56F" />
        </linearGradient>
      </defs>

      <g ref={headRef}>
        {/* De flow-diamant: afgeronde ruit, eigen silhouet. */}
        <path
          d="M60 6 C74 6 84 12 98 26 C112 40 114 46 114 60 C114 74 112 80 98 94 C84 108 74 114 60 114 C46 114 36 108 22 94 C8 80 6 74 6 60 C6 46 8 40 22 26 C36 12 46 6 60 6 Z"
          fill="url(#sq-mark-fill)"
          style={{ transition: "fill 0.6s" }}
        />

        {/* Losse oog-groepen: elk oog krijgt eigen diepte en ooglid. */}
        <g ref={leftEyeRef} transform="translate(42 56)">
          <rect x="-5" y="-11" width="10" height="22" rx="5" fill="#16220A" />
        </g>
        <g ref={rightEyeRef} transform="translate(78 56)">
          <rect x="-5" y="-11" width="10" height="22" rx="5" fill="#16220A" />
        </g>

        <path
          d={mouth}
          fill="none"
          stroke="#16220A"
          strokeWidth="4"
          strokeLinecap="round"
          style={{ transition: "d 0.35s cubic-bezier(0.4, 0, 0.2, 1)" }}
        />
      </g>
    </svg>
  );
}
