"use client";

import { useEffect, useId, useRef } from "react";

import { headsetProjection } from "@/lib/marketing/headsetProjection";
import { TurningHeadset } from "./TurningHeadset";
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

export type MarkState = "idle" | "thinking" | "investigating" | "reading" | "happy" | "observing";

/**
 * Wat de mascotte draagt, per product: de headset hoort bij Support One, de
 * camera bij Content One, de antenne bij SequenceFlow als geheel (een agent
 * die meedenkt, zonder vast te zitten aan één taak).
 */
export type MarkGear = "headset" | "antenna" | "camera" | "none" | "analyst";

type Props = {
  /** Rendergrootte in px. CSS width/height wint hiervan. */
  size?: number;
  /** Gedragstoestand; stuurt tempo, blikspreiding en oogopening. */
  state?: MarkState;
  /** Volgt de muis binnen deze straal in px. 0 = uit. */
  followPointer?: number;
  /** More expressive autonomous gaze, reserved for the headline mascot. */
  lookAround?: boolean;
  className?: string;
  /** "outline" tekent alleen de contour — voor groot, decoratief gebruik. */
  variant?: "solid" | "outline";
  /** Toegankelijke naam. Lege string = puur decoratief, uit de a11y-tree. */
  title?: string;
  /** Accessoire; standaard de headset van Support One. */
  gear?: MarkGear;
  shape?: "original" | "flow" | "tile" | "drop";
  /** Eigen themakleur voor randlicht en accessoire (teamleden van Milo). Standaard het merkgroen. */
  tint?: string;
  /** Kleur van het antennetip; Milo seint daarmee welk teamlid hij erbij haalt. */
  signal?: string;
  /** Verhoog dit getal en hij draait zich één keer helemaal om, als een bol: de ogen glijden naar achteren en komen aan de andere kant terug. */
  turn?: number;
  /** Verhoog dit getal en hij knipoogt één keer met zijn rechteroog. */
  wink?: number;
  /** Hero-only expressions; ordinary app avatars retain their existing behaviour. */
  playfulShrink?: boolean;
  expression?: "neutral" | "curious" | "listening" | "pleased";
};

/** Hoe lang de blik op één punt rust, per toestand (ms). */
const FIXATION_MS: Record<MarkState, [number, number]> = {
  observing: [2800, 4800],
  idle: [1800, 3400],
  thinking: [280, 700],
  investigating: [280, 480],
  reading: [200, 480],
  happy: [340, 900],
};

/** Hoe ver de blik afdwaalt van het midden (0-1 van de maximale uitslag). */
const GAZE_SPREAD: Record<MarkState, number> = {
  observing: 0.25,
  idle: 0.45,
  thinking: 0.7,
  investigating: 0.9,
  reading: 0.9,
  happy: 0.85,
};

/** Rustopening van de ogen. Zonder mond draagt dit de uitdrukking. */
const LID_REST: Record<MarkState, number> = {
  observing: 1,
  idle: 1,
  thinking: 0.88,
  investigating: 0.95,
  reading: 1,
  happy: 0.52,
};

/** Het asymmetrische silhouet: top links van het midden, gewicht rechtsonder. */
const BODY =
  "M53 9 C77 7 99 21 109 43 C119 64 117 92 97 105 C77 118 46 117 29 106 C12 95 4 75 8 54 C13 30 31 11 53 9 Z";

/** Hoofdbeugel, rustend op de bovenkant van het hoofd. */
const BAND = "M12 63 C10 27 33 6 60 6 C87 6 110 27 108 63";
/** Arm van de microfoon, vanaf de linker oorschelp naar voren. */
const BOOM = "M12 78 C12 96 23 106 36 103";
/** Antenne met het diagonale verbindingsmotief uit het SequenceFlow-logo. */
const ANTENNA = "M54 10 C54 -9 65 -22 70 -10";
// De bol waarop de ogen liggen bij het omdraaien (viewBox-eenheden).
const FACE_CENTER = 63;
const FACE_RADIUS = 46;
const WINK_MS = 620;
const TURN_MS = 1150;
// Cartoonesk naveren: een tik opzij, terugveren, uitdempen; daarna een tijd stil.
const ANTENNA_CSS = `.sf-antenna{animation:sf-antenna-boing 6.4s cubic-bezier(.3,.6,.4,1) 1.2s infinite}
@keyframes sf-antenna-boing{0%,16%,100%{transform:rotate(0)}2%{transform:rotate(-22deg) scaleY(.9)}5%{transform:rotate(16deg) scaleY(1.06)}8%{transform:rotate(-9deg)}11%{transform:rotate(5deg)}13.5%{transform:rotate(-2deg)}}
@media (prefers-reduced-motion:reduce){.sf-antenna{animation:none}}`;
/** Cameraband als schouderband aan één kant. Twee symmetrische banden onder
    de ogen lazen als een grote glimlach, en deze mascotte heeft geen mond. */
const STRAP = "M109 46 C109 64 98 80 82 91";

/** Draaipunt van de "rechtzet"-beweging, per accessoire. */
const GEAR_PIVOT: Record<MarkGear, string> = { headset: "60 66", antenna: "54 10", camera: "62 92", none: "60 66", analyst: "63 66" };

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function SequenceMark({
  size = 64,
  state = "idle",
  followPointer = 0,
  lookAround = false,
  className,
  variant = "solid",
  title = "Support-assistent",
  gear = "headset",
  shape,
  tint,
  signal,
  turn = 0,
  wink = 0,
  expression = "neutral",
  playfulShrink = false,
}: Props) {
  const expressionRef = useRef(expression);
  useEffect(() => { expressionRef.current = expression; }, [expression]);
  const silhouette = shape ?? (gear === "none" ? "flow" : "original");
  const body = silhouette === "tile" ? "M32 12 H88 Q110 12 110 34 V88 Q110 110 88 110 H32 Q10 110 10 88 V34 Q10 12 32 12 Z"
    : silhouette === "drop" ? "M60 7 C72 25 110 43 110 73 C110 99 90 113 60 113 C30 113 10 99 10 73 C10 43 48 25 60 7 Z"
    : silhouette === "flow" ? "M48 12 C69 7 90 16 101 33 C106 41 111 53 109 63 C108 68 100 68 98 74 C96 80 108 85 104 94 C96 110 72 116 49 111 C23 106 10 88 11 64 C12 39 24 17 48 12 Z" : BODY;
  const gradientId = useId();
  const rootRef = useRef<SVGSVGElement | null>(null);
  const headRef = useRef<SVGGElement | null>(null);
  const gearRef = useRef<SVGGElement | null>(null);
  const staticHeadsetRef = useRef<SVGGElement | null>(null);
  const headsetFrontRef = useRef<SVGGElement | null>(null);
  const headsetBackRef = useRef<SVGGElement | null>(null);
  const leftEyeRef = useRef<SVGGElement | null>(null);
  const rightEyeRef = useRef<SVGGElement | null>(null);
  // Starttijd van een omdraai; de animatielus leest hem uit.
  const turnStartRef = useRef<number | null>(null);
  const turnSeen = useRef(turn);
  const winkStartRef = useRef<number | null>(null);
  const winkSeen = useRef(wink);

  useEffect(() => {
    if (wink === winkSeen.current) return;
    winkSeen.current = wink;
    winkStartRef.current = performance.now();
  }, [wink]);

  useEffect(() => {
    if (turn === turnSeen.current) return;
    turnSeen.current = turn;
    turnStartRef.current = performance.now();
  }, [turn]);

  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;

    const root = rootRef.current;
    const head = headRef.current;
    const gearNode = gearRef.current;
    const leftEye = leftEyeRef.current;
    const rightEye = rightEyeRef.current;
    if (!root || !head || !gearNode || !leftEye || !rightEye) return;

    const headsetLayers = [headsetBackRef.current, headsetFrontRef.current].map(layer => layer ? {
      root: layer,
      band: layer.querySelector('[data-headset="band"]'),
      boom: layer.querySelector('[data-headset="boom"]'),
      cups: [layer.querySelector('[data-headset="cup-0"]'), layer.querySelector('[data-headset="cup-1"]')],
      mic: layer.querySelector('[data-headset="mic"]'),
    } : null);
    const resetHeadset = () => {
      if (staticHeadsetRef.current) staticHeadsetRef.current.style.display = "";
      headsetLayers.forEach(layer => { if (layer) layer.root.style.display = "none"; });
    };
    const rotateHeadset = (angle: number) => {
      if (!staticHeadsetRef.current || !headsetLayers[0] || !headsetLayers[1]) return;
      staticHeadsetRef.current.style.display = "none";
      const geometry = headsetProjection(angle);
      headsetLayers.forEach((layer, index) => {
        if (!layer) return;
        const front = index === 1;
        layer.root.style.display = "";
        layer.band?.setAttribute("d", front ? geometry.band.front : geometry.band.back);
        layer.boom?.setAttribute("d", front ? geometry.boom.front : geometry.boom.back);
        geometry.cups.forEach((cup, side) => {
          layer.cups[side]?.setAttribute("transform", `translate(${cup.x} ${cup.y}) scale(${cup.scaleX} 1)`);
          layer.cups[side]?.setAttribute("visibility", cup.front === front ? "visible" : "hidden");
        });
        layer.mic?.setAttribute("transform", `translate(${geometry.mic.x} ${geometry.mic.y}) scale(${geometry.mic.scaleX} 1)`);
        layer.mic?.setAttribute("visibility", geometry.mic.front === front ? "visible" : "hidden");
      });
    };

    let curious = 0, listening = 0, pleased = 0;
    let lastFrame = performance.now();
    const eyeLayers = [leftEye, rightEye].map(eye => ({ normal: eye.querySelector("rect"), smile: eye.querySelector("path") }));
    let gazeX = 0;
    let gazeY = 0;
    let targetGazeX = 0;
    let targetGazeY = 0;

    const rest = LID_REST[state];
    let lidOpen = rest; // 1 = open, 0 = dicht
    let targetLid = rest;

    let pointerActive = false;
    // Tijdstip waarop hij zijn koptelefoon rechtzet; null = nu even niet.
    let adjustStart: number | null = null;
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

    let scanIndex = 0;
    const scanPoints: [number, number][] = [
      [-0.8, -0.45], [0, -0.45], [0.8, -0.45],
      [-0.8, 0.1], [0, 0.1], [0.8, 0.1],
      [-0.8, 0.55], [0, 0.55], [0.8, 0.55],
    ];
    let lookIndex = 0;
    const scheduleSaccade = () => {
      const [min, max] = lookAround ? [1400, 2600] : FIXATION_MS[state];
      later(() => {
        if (!pointerActive) {
          if (state === "investigating") {
            // Leest de denkbeeldige bronnen regel voor regel, zonder
            // willekeurige blikbewegingen die op deze plek afleiden.
            [targetGazeX, targetGazeY] = scanPoints[scanIndex];
            scanIndex = (scanIndex + 1) % scanPoints.length;
          } else if (lookAround) {
            // Look left, settle, then right: pauses make this attention, not a tic.
            const directions = [-.75, 0, .75, .25, -.35, 0];
            targetGazeX = directions[lookIndex++ % directions.length];
            targetGazeY = randomBetween(-.3, .2);
          } else {
            const spread = GAZE_SPREAD[state];
            // Kwadratische radius: de blik blijft vaker in het midden dan aan
            // de randen, wat natuurlijker leest dan een uniforme verdeling.
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.pow(Math.random(), 0.45) * spread;
            targetGazeX = Math.cos(angle) * radius;
            targetGazeY = Math.sin(angle) * radius * 0.7; // minder verticale uitslag
          }
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
      }, randomBetween(1600, 4200));
    };

    // Af en toe schuift hij zijn koptelefoon recht. Eén beweging per keer,
    // met ruime pauzes ertussen: een tic die te vaak terugkomt gaat irriteren.
    const scheduleAdjust = () => {
      later(() => {
        adjustStart = performance.now();
        scheduleAdjust();
      }, randomBetween(9000, 22000));
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

    const releasePointer = () => {
      pointerActive = false;
      targetGazeX = 0;
      targetGazeY = 0;
    };
    const start = performance.now();
    const tick = (now: number) => {
      if (disposed) return;
      const elapsed = (now - start) / 1000;
      // Preserve one continuous loop across hero poses: no gaze/blink reset.
      // Time-based easing behaves the same on 60 Hz and 120 Hz displays.
      const blend = 1 - Math.exp(-Math.min(50, now - lastFrame) / 110);
      lastFrame = now;
      curious += ((expressionRef.current === "curious" ? 1 : 0) - curious) * blend;
      listening += ((expressionRef.current === "listening" ? 1 : 0) - listening) * blend;
      pleased += ((expressionRef.current === "pleased" ? 1 : 0) - pleased) * blend;
      eyeLayers.forEach(({ normal, smile }) => {
        normal?.setAttribute("opacity", String(1 - pleased));
        smile?.setAttribute("opacity", String(pleased));
        smile?.setAttribute("transform", `scale(1 ${.5 + pleased * .5})`);
      });

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

      // Accessoire rechtzetten: optillen, twee keer wiebelen, uitdempen.
      // De demping (1 - t) zorgt dat hij tot rust komt in plaats van
      // abrupt terug te springen.
      if (turnStartRef.current !== null) {
        adjustStart = null;
        gearNode.removeAttribute("transform");
      } else if (adjustStart !== null) {
        const t = (now - adjustStart) / 820;
        if (t >= 1) {
          adjustStart = null;
          gearNode.removeAttribute("transform");
        } else {
          const damp = 1 - t;
          const lift = gear === "antenna" ? 0 : -Math.sin(t * Math.PI) * 2.4;
          const wobble = Math.sin(t * Math.PI * 4) * 3.1 * damp;
          gearNode.setAttribute(
            "transform",
            `translate(0 ${lift.toFixed(2)}) rotate(${wobble.toFixed(2)} ${GEAR_PIVOT[gear]})`,
          );
        }
      }

      // Omdraaien als een bol: elk oog staat op een hoek op het lijf. Draait
      // de bol, dan schuift het oog mee (sinus), wordt het smaller richting de
      // rand (cosinus) en verdwijnt het achterlangs, tot het aan de andere kant
      // terugkomt. Het silhouet blijft staan, zodat het geen kaartje wordt.
      const turnStart = turnStartRef.current;
      if (turnStart !== null) {
        const t = Math.min(1, (now - turnStart) / TURN_MS);
        if (t >= 1) turnStartRef.current = null;
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const angle = eased * Math.PI * 2;
        if (gear === "headset") {
          if (t >= 1) resetHeadset(); else rotateHeadset(angle);
        }
        const lid = Math.max(0.06, lidOpen);
        // De blik loopt tijdens de draai gewoon door en weegt aan begin en
        // eind volledig mee, in het midden niet. Zo eindigt de draai precies
        // in de houding waarmee de gewone blik verdergaat, zonder sprong.
        const look = Math.abs(Math.cos(eased * Math.PI));
        const place = (node: SVGGElement, baseX: number, gazeDepth: number) => {
          const rest = Math.asin((baseX - FACE_CENTER) / FACE_RADIUS);
          const phi = rest + angle;
          // Gedeeld door de rustdiepte: vooraan is het oog precies zo breed als normaal.
          const depth = Math.min(1, Math.max(0, Math.cos(phi) / Math.cos(rest))) * (1 - (1 - gazeDepth) * look);
          const x = FACE_CENTER + Math.sin(phi) * FACE_RADIUS + gazeX * 9.5 * look;
          node.setAttribute("transform", `translate(${x.toFixed(2)} ${(66 + gazeY * 6.5 * look).toFixed(2)}) scale(${depth.toFixed(3)} ${lid.toFixed(3)})`);
        };
        place(leftEye, 50, 1 - Math.max(0, gazeX) * 0.22);
        place(rightEye, 76, 1 - Math.max(0, -gazeX) * 0.22);
        if (gear === "antenna") {
          // Volg ook de kromming van de kruin: alleen horizontaal schuiven
          // laat de voet naast het hoogste punt boven het hoofd zweven.
          const shift = Math.sin(angle + Math.asin((54 - FACE_CENTER) / FACE_RADIUS)) * FACE_RADIUS - (54 - FACE_CENTER);
          const crownX = shift * 0.7;
          const crownY = (crownX * crownX) / 90;
          gearNode.setAttribute("transform", `translate(${crownX.toFixed(2)} ${crownY.toFixed(2)})`);
          if (t >= 1) gearNode.removeAttribute("transform");
        }
        head.setAttribute(
          "transform",
          `translate(${(gazeX * 3.2 * look).toFixed(2)} ${(gazeY * 2.4 * look - Math.sin(eased * Math.PI) * 3).toFixed(2)}) rotate(${(gazeX * 1.6 * look).toFixed(2)} 60 60)`,
        );
        if (running) frame = requestAnimationFrame(tick);
        return;
      }

      // Ogen: verschuiving + pseudo-diepte. Een oog dat wegdraait van de
      // kijker wordt smaller, precies zoals perspectief dat zou doen.
      const shiftX = gazeX * 9.5;
      const shiftY = gazeY * 6.5;
      const interest = lookAround ? Math.abs(gazeX) * .13 : 0;
      const leftDepth = (1 + interest - Math.max(0, gazeX) * 0.22) * (1 + curious * .14);
      const rightDepth = (1 + interest - Math.max(0, -gazeX) * 0.22) * (1 - curious * .18);
      const lid = Math.max(0.06, lidOpen);
      // Knipoog: het rechteroog gaat snel dicht, blijft even dicht en gaat
      // rustig weer open; het linkeroog knijpt een klein beetje mee.
      let winkLid = 1;
      const winkStart = winkStartRef.current;
      if (winkStart !== null) {
        const t = (now - winkStart) / WINK_MS;
        if (t >= 1) winkStartRef.current = null;
        else winkLid = t < 0.2 ? 1 - t / 0.2 : t < 0.55 ? 0 : (t - 0.55) / 0.45;
      }
      const leftLid = Math.min(lid, 0.82 + winkLid * 0.18) * (1 + interest) * (1 + curious * .15);
      const rightLid = Math.max(0.06, Math.min(lid, winkLid)) * (1 + interest) * (1 - curious * .28 - listening * .15);

      leftEye.setAttribute(
        "transform",
        `translate(${(50 + shiftX).toFixed(2)} ${(66 + shiftY).toFixed(2)}) scale(${leftDepth.toFixed(3)} ${leftLid.toFixed(3)})`,
      );
      rightEye.setAttribute(
        "transform",
        `translate(${(76 + shiftX).toFixed(2)} ${(66 + shiftY).toFixed(2)}) scale(${rightDepth.toFixed(3)} ${rightLid.toFixed(3)})`,
      );

      if (running) frame = requestAnimationFrame(tick);
    };

    // Elke mascotte werkt per frame vier elementen bij. Met zes op één pagina
    // is dat buiten beeld pure verspilling van processor en batterij, dus de
    // lus loopt alleen als hij zichtbaar is én het tabblad voorgrond heeft.
    let running = false;
    let onScreen = false;
    const startLoop = () => {
      if (running || disposed) return;
      running = true;
      frame = requestAnimationFrame(tick);
    };
    const stopLoop = () => {
      running = false;
      cancelAnimationFrame(frame);
    };
    const syncLoop = () => (onScreen && !document.hidden ? startLoop() : stopLoop());
    const visibility = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        syncLoop();
      },
      { rootMargin: "120px" },
    );
    visibility.observe(root);
    document.addEventListener("visibilitychange", syncLoop);

    scheduleSaccade();
    scheduleBlink();
    // De grote contourvariant is decoratie; zijn oorschelpen maskeren de
    // lijnen eronder, en dat masker beweegt niet mee met de wiebel.
    if (variant !== "outline") scheduleAdjust();
    if (followPointer > 0) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", releasePointer);
      window.addEventListener("blur", releasePointer);
    }

    return () => {
      disposed = true;
      stopLoop();
      visibility.disconnect();
      document.removeEventListener("visibilitychange", syncLoop);
      for (const id of timers) window.clearTimeout(id);
      timers.clear();
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", releasePointer);
      window.removeEventListener("blur", releasePointer);
      // Ook bij omschakelen naar minder beweging terug naar een complete
      // rustpose; geen halfgesloten oog of zwevend accessoire bevriezen.
      resetHeadset();
      eyeLayers.forEach(({ normal, smile }) => {
        normal?.setAttribute("opacity", "1");
        smile?.setAttribute("opacity", "0");
      });
      root.style.transform = "";
      head.removeAttribute("transform");
      gearNode.removeAttribute("transform");
      leftEye.setAttribute("transform", `translate(50 66) scale(1 ${rest})`);
      rightEye.setAttribute("transform", `translate(76 66) scale(1 ${rest})`);
    };
  }, [state, followPointer, lookAround, reducedMotion, variant, gear]);

  // Zonder animatie moet de rustpose kloppen: bij "happy" horen de ogen ook
  // dan dichtgeknepen te staan.
  const restLid = LID_REST[state];

  // De omtrekvariant erft zijn lijnkleur van de context (currentColor), zodat
  // dezelfde mascotte op elke achtergrond kan staan zonder aparte kopie.
  const outline = variant === "outline";
  const eyeProps = {
    x: -5.5, y: -12, width: 11, height: 24, rx: 5.5,
    ...(outline
      ? { fill: "none", stroke: "currentColor", strokeWidth: 0.9 }
      : { fill: "#10160E" }),
  };

  // Het merkgroen zit verder alleen in het randlicht; op de headset mag het
  // wel een vlak zijn, want daar moet het juist opvallen.
  // Alle agents dragen hetzelfde merkgroen, zodat site, app en chat één familie zijn.
  const accent = tint ?? "#C7F56F";
  const rim = tint ?? "#C7F56F";
  const gearShell = outline ? "currentColor" : accent;
  const gearFill = outline
    ? { fill: "none" as const, stroke: "currentColor", strokeWidth: 0.9 }
    : { fill: accent };
  const micFill = outline
    ? { fill: "none" as const, stroke: "currentColor", strokeWidth: 0.9 }
    : { fill: "#10160E" };
  // Arm en kapje in dezelfde donkere kleur, zodat ze als één ding lezen.
  const micShell = outline ? "currentColor" : "#10160E";
  // In de contourvariant zijn de oorschelpen hol. Zonder dit masker liepen de
  // hoofdlijn, de beugel en de microfoonarm er zichtbaar doorheen.
  const cupMask = outline && gear === "headset" ? `url(#${gradientId}-cups)` : undefined;
  const line = (width: number) => ({ fill: "none" as const, stroke: outline ? "currentColor" : undefined, strokeWidth: outline ? 0.9 : width, strokeLinecap: "round" as const });

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
        <linearGradient id={`${gradientId}-body`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          {/* Zonder eigen kleur een groene zweem; met een themakleur neutraal wit. */}
          <stop offset="100%" stopColor={tint ? "#EEEFEA" : "#E9F2D6"} />
        </linearGradient>
        {/* Randlicht: alleen langs de onderrand, waar het licht zou vallen. */}
        {cupMask && (
          <mask id={`${gradientId}-cups`} maskUnits="userSpaceOnUse" x="-20" y="-20" width="160" height="160">
            <rect x="-20" y="-20" width="160" height="160" fill="white" />
            <rect x="1.5" y="50" width="19" height="30" rx="9.5" fill="black" />
            <rect x="99.5" y="50" width="19" height="30" rx="9.5" fill="black" />
          </mask>
        )}
        <linearGradient id={`${gradientId}-rim`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="45%" stopColor={rim} stopOpacity="0" />
          <stop offset="100%" stopColor={rim} stopOpacity="0.95" />
        </linearGradient>
      </defs>

      <g ref={headRef}>
        {gear === "headset" && !outline && <TurningHeadset layerRef={headsetBackRef} accent={accent} back />}
        <g className={playfulShrink && !reducedMotion ? "sf-playful-body" : undefined}>
        {outline ? (
          <path d={body} fill="none" stroke="currentColor" strokeWidth="0.9" mask={cupMask} />
        ) : (
          <>
            <path d={body} fill={`url(#${gradientId}-body)`} />
            <path d={body} fill="none" stroke={`url(#${gradientId}-rim)`} strokeWidth="4" />
          </>
        )}

        {/* Losse oog-groepen: elk oog krijgt eigen diepte en ooglid. */}
        <g className={playfulShrink && !reducedMotion ? "sf-playful-eye sf-playful-eye-left" : undefined}>
        <g ref={leftEyeRef} transform={`translate(50 66) scale(1 ${restLid})`}>
          <rect {...eyeProps} />
          <path d="M-5 2 Q0 -7 5 2" opacity="0" fill="none" stroke={outline ? "currentColor" : "#10160E"} strokeWidth="4" strokeLinecap="round" />
        </g>
        </g>
        <g className={playfulShrink && !reducedMotion ? "sf-playful-eye sf-playful-eye-right" : undefined}>
        <g ref={rightEyeRef} transform={`translate(76 66) scale(1 ${restLid})`}>
          <rect {...eyeProps} />
          <path d="M-5 2 Q0 -7 5 2" opacity="0" fill="none" stroke={outline ? "currentColor" : "#10160E"} strokeWidth="4" strokeLinecap="round" />
        </g>
        </g>

        </g>
        {/* Het accessoire staat buiten de oogzone, zodat het de blik nooit
            afdekt. De headset maakt in één oogopslag duidelijk wat Support
            One doet; de camera doet hetzelfde voor Content One. */}
        <g ref={gearRef}>
        <g className={playfulShrink && !reducedMotion ? "sf-playful-headset" : undefined}>
          {gear === "headset" && (
            <g ref={staticHeadsetRef}>
              <path d={BAND} fill="none" stroke={gearShell} strokeWidth={outline ? 0.9 : 7} strokeLinecap="round" mask={cupMask} />
              <rect x="1.5" y="50" width="19" height="30" rx="9.5" {...gearFill} />
              <rect x="99.5" y="50" width="19" height="30" rx="9.5" {...gearFill} />
              {!outline && (
                <>
                  <rect x="6" y="57" width="10" height="16" rx="5" fill="#10160E" opacity="0.8" />
                  <rect x="104" y="57" width="10" height="16" rx="5" fill="#10160E" opacity="0.8" />
                </>
              )}
              <path d={BOOM} fill="none" stroke={micShell} strokeWidth={outline ? 0.9 : 4} strokeLinecap="round" mask={cupMask} />
              <ellipse cx="38" cy="102.5" rx="6.5" ry="4.8" transform="rotate(-12 38 102.5)" {...micFill} />
            </g>
          )}

          {gear === "headset" && !outline && <TurningHeadset layerRef={headsetFrontRef} accent={accent} />}

          {/* In de grote contourversie (achtergrond onderaan de site) is de
              antenne een dunne lijn, net als de rest van die tekening. */}
          {gear === "antenna" && (
            // Af en toe een veerkrachtige "boing" vanaf de voet van de steel.
            <g className="sf-antenna" style={{ transformBox: "view-box", transformOrigin: "54px 10px" }}>
              <style>{ANTENNA_CSS}</style>
              {/* Een los gebogen steel met het afgeronde vierkant uit het logo. */}
              {outline ? (
                <>
                  <path d={ANTENNA} {...line(0.9)} />
                  {/* Gevuld in de achtergrondkleur van de slotsectie, zodat het
                      vierkant vóór de steel staat in plaats van erdoorheen. */}
                  <rect x="64" y="-16" width="12" height="12" rx="3" fill="#0a0a0a" stroke="currentColor" strokeWidth="0.9" />
                </>
              ) : (
                <>
                  <path d={ANTENNA} {...line(3.5)} stroke={accent} />
                  <rect x="60" y="-20" width="20" height="20" rx="6" fill={signal ?? accent} opacity="0.14" style={{ transition: "fill .3s" }} />
                  <rect x="64" y="-16" width="12" height="12" rx="3" fill="#10160E" stroke={signal ?? accent} strokeWidth="3" style={{ transition: "stroke .3s" }} />
                </>
              )}

            </g>
          )}

          {gear === "analyst" && (
            outline ? (
              <g fill="none" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round">
                <rect x="36" y="52" width="27" height="28" rx="10" />
                <rect x="66" y="52" width="27" height="28" rx="10" />
                <path d="M63 62 Q64.5 60 66 62 M29 59 L36 62 M93 62 L99 59" />
              </g>
            ) : (
              // Zwart montuur met limoengroene glazen: op het witte lijf zie je
              // de bril meteen, en de ogen blijven er donker doorheen kijken.
              <g strokeLinecap="round" strokeLinejoin="round">
                <rect x="36" y="52" width="27" height="28" rx="10" fill={accent} opacity="0.3" />
                <rect x="66" y="52" width="27" height="28" rx="10" fill={accent} opacity="0.3" />
                <g fill="none" stroke="#10160E" strokeWidth="3.4">
                  <rect x="36" y="52" width="27" height="28" rx="10" />
                  <rect x="66" y="52" width="27" height="28" rx="10" />
                  <path d="M63 62 Q64.5 59.5 66 62 M29 59 L36 62 M93 62 L99 59" />
                </g>
                <path d="M41 58 Q43 55.5 46.5 56 M71 58 Q73 55.5 76.5 56" fill="none" stroke="#FFFFFF" strokeWidth="1.8" opacity="0.85" />
              </g>
            )
          )}

          {gear === "camera" && (
            <>
              <path d={STRAP} {...line(3)} stroke={outline ? "currentColor" : "#10160E"} />
              <rect x="50" y="82" width="11" height="7" rx="2" {...gearFill} />
              <rect x="42" y="87" width="40" height="27" rx="7" {...gearFill} />
              <circle cx="62" cy="100.5" r="9.5" {...micFill} />
              {!outline && (
                <>
                  <circle cx="62" cy="100.5" r="5.5" fill="none" stroke={tint ? "#2a2a33" : "#3b4a24"} strokeWidth="1.6" />
                  <circle cx="59.5" cy="98" r="1.6" fill="#FFFFFF" opacity="0.85" />
                  <circle cx="76" cy="92.5" r="2" fill="#10160E" />
                </>
              )}
            </>
          )}
        </g>
        </g>
      </g>
      <style>{`
        .sf-playful-body{transform-box:view-box;transform-origin:60px 65px;animation:sf-shrink-peek 1.8s cubic-bezier(.45,0,.2,1) both}
        .sf-playful-headset{transform-box:view-box;transform-origin:60px 12px;animation:sf-headset-dangle 1.8s ease-in-out both}
        .sf-playful-eye{transform-box:view-box;animation-duration:1.8s;animation-timing-function:cubic-bezier(.45,0,.2,1);animation-fill-mode:both}
        .sf-playful-eye-left{transform-origin:50px 66px;animation-name:sf-silly-left}
        .sf-playful-eye-right{transform-origin:76px 66px;animation-name:sf-silly-right}
        @keyframes sf-silly-left{
          0%,43%,100%{transform:scale(1)}
          18%,28%{transform:scale(1.23,1.28)}
          58%,68%{transform:scale(.8,.74)}
          84%{transform:scale(1.04)}
        }
        @keyframes sf-silly-right{
          0%,43%,100%{transform:scale(1)}
          18%,28%{transform:scale(.8,.74)}
          58%,68%{transform:scale(1.23,1.28)}
          84%{transform:scale(1.04)}
        }
        @keyframes sf-shrink-peek{
          0%,100%{transform:scale(1)}
          18%,28%{transform:translateY(9px) scale(.72)}
          43%{transform:translateY(1px) scale(.96)}
          58%,68%{transform:translateY(11px) scale(.65)}
          84%{transform:translateY(-1px) scale(1.04)}
          93%{transform:scale(.985)}
        }
        @keyframes sf-headset-dangle{
          0%,12%,100%{transform:rotate(0)}
          25%{transform:translateY(-2px) rotate(-7deg)}
          40%{transform:rotate(5deg)}
          58%{transform:translateY(-2px) rotate(-6deg)}
          72%{transform:rotate(4deg)}
          86%{transform:rotate(-2deg)}
          95%{transform:rotate(1deg)}
        }
        @media(prefers-reduced-motion:reduce){.sf-playful-body,.sf-playful-headset,.sf-playful-eye{animation:none}}
      `}</style>
    </svg>
  );
}
