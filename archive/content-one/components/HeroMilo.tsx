"use client";

import { useEffect, useRef, useState } from "react";

import { SequenceMark, type MarkState } from "./SequenceMark";
import { useReducedMotion } from "./useReducedMotion";

/**
 * Milo tussen de woorden van de kop. Hij blijft op zijn plek maar leeft:
 * om de paar seconden draait hij zich om, knipoogt hij, maakt hij een rondje
 * of een klein sprongetje. Bij het omdraaien waaien er een paar windstreepjes
 * mee, bij de knipoog fonkelt er één sterretje. Elke beweging is kort en
 * eindigt precies waar hij begon, zodat de regel nooit verspringt. Bij
 * "minder beweging" staat hij stil, en op een tabblad op de achtergrond doet
 * hij niets.
 */

const MOVES = ["turn", "hop", "wink", "spin"] as const;
type Move = (typeof MOVES)[number];

const FACE: Record<Move, MarkState> = { turn: "observing", spin: "happy", hop: "happy", wink: "observing" };
/** Hoe lang een beweging duurt, inclusief de effecten eromheen (ms). */
const DURATION: Record<Move, number> = { turn: 1300, spin: 1150, hop: 850, wink: 950 };

// Windstreepjes: stukjes van liggende ellipsen om het lijf, aan de voorkant,
// links en rechts. Ze lopen in de draairichting mee (de voorkant schuift naar
// rechts) en zijn alleen te zien in het snelste deel van de draai.
const CX = 60;
const RX = 74;
const RY = 15;
// Bewust ongelijk links en rechts, anders lezen ze als snorharen.
const WIND = [
  { y: 50, from: 172, to: 132, delay: 0 },
  { y: 70, from: 178, to: 122, delay: 60 },
  { y: 88, from: 168, to: 140, delay: 130 },
  { y: 40, from: 46, to: 12, delay: 40 },
  { y: 76, from: 38, to: 4, delay: 110 },
];

function arc(cy: number, from: number, to: number) {
  const point = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return `${(CX + RX * Math.cos(rad)).toFixed(1)} ${(cy + RY * Math.sin(rad)).toFixed(1)}`;
  };
  // Van een grotere naar een kleinere hoek: tegen de klok in (sweep 0).
  return `M${point(from)} A${RX} ${RY} 0 0 0 ${point(to)}`;
}

export function HeroMilo({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const [move, setMove] = useState<Move | null>(null);
  // Omdraaien en knipogen doet de mascotte zelf; hier tellen we alleen hoe vaak.
  const [turns, setTurns] = useState(0);
  const [winks, setWinks] = useState(0);
  const index = useRef(0);

  useEffect(() => {
    if (reduced) return;
    let timer = 0;
    let reset = 0;
    const schedule = (delay: number) => {
      timer = window.setTimeout(() => {
        if (!document.hidden) {
          const next = MOVES[index.current % MOVES.length];
          index.current += 1;
          setMove(next);
          if (next === "turn") setTurns((count) => count + 1);
          if (next === "wink") setWinks((count) => count + 1);
          // Een timer in plaats van onAnimationEnd: de windstreepjes, het
          // sterretje en de antenne vuren ook animationend af, en die mogen de
          // hoofdbeweging niet halverwege stoppen.
          window.clearTimeout(reset);
          reset = window.setTimeout(() => setMove(null), DURATION[next]);
        }
        schedule(4200 + Math.random() * 2600);
      }, delay);
    };
    schedule(1800);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(reset);
    };
  }, [reduced]);

  return (
    <span className={`hero-milo${className ? ` ${className}` : ""}${move ? ` is-${move}` : ""}`} aria-hidden>
      <SequenceMark size={56} gear="antenna" state={move ? FACE[move] : "observing"} turn={turns} wink={winks} title="" />
      {move === "turn" && (
        <svg key={`wind-${turns}`} className="hero-milo-fx" viewBox="-48 -48 216 216" aria-hidden>
          {WIND.map(({ y, from, to, delay }) => (
            <path key={`${y}-${from}`} d={arc(y, from, to)} pathLength={1} style={{ animationDelay: `${300 + delay}ms` }} />
          ))}
        </svg>
      )}
      {move === "wink" && (
        <svg key={`star-${winks}`} className="hero-milo-fx" viewBox="-48 -48 216 216" aria-hidden>
          <g transform="translate(117 34)"><path className="hero-milo-star" d="M0 -9 C1 -2 2 -1 9 0 C2 1 1 2 0 9 C-1 2 -2 1 -9 0 C-2 -1 -1 -2 0 -9 Z" /></g>
        </svg>
      )}
      <style>{`
        .hero-milo{position:relative;display:inline-block;transform-origin:50% 60%}
        .hero-milo>svg:first-child{display:block;width:100%;height:100%}
        .hero-milo-fx{position:absolute;left:-40%;top:-40%;width:180%;height:180%;overflow:visible;pointer-events:none}
        .hero-milo-fx path{fill:none;stroke:#C7F56F;stroke-width:2.6;stroke-linecap:round;stroke-dasharray:1 1;stroke-dashoffset:1;opacity:0;animation:hero-milo-wind .62s cubic-bezier(.3,.1,.3,1) both}
        .hero-milo-fx .hero-milo-star{fill:#C7F56F;stroke:none;stroke-dasharray:none;transform-origin:0 0;animation:hero-milo-star .8s cubic-bezier(.3,1.4,.5,1) .14s both}
        .hero-milo.is-turn{animation:hero-milo-turn 1.25s cubic-bezier(.45,.05,.25,1)}
        .hero-milo.is-spin{animation:hero-milo-spin 1.1s cubic-bezier(.5,0,.2,1)}
        .hero-milo.is-hop{animation:hero-milo-hop .8s cubic-bezier(.3,.7,.3,1)}
        .hero-milo.is-wink{animation:hero-milo-wink .9s cubic-bezier(.3,.7,.3,1)}
        @keyframes hero-milo-turn{
          0%,100%{transform:translateY(0) scale(1)}
          12%{transform:translateY(2%) scale(1.04,.96)}
          50%{transform:translateY(-8%) scale(.98,1.02)}
          88%{transform:translateY(1%) scale(1.03,.97)}
        }
        @keyframes hero-milo-spin{
          0%{transform:rotate(0) scale(1)}
          15%{transform:rotate(-14deg) scale(.94,1.04)}
          75%{transform:rotate(372deg) scale(1.04)}
          100%{transform:rotate(360deg) scale(1)}
        }
        @keyframes hero-milo-hop{
          0%,100%{transform:translateY(0) scale(1)}
          20%{transform:translateY(4%) scale(1.08,.9)}
          50%{transform:translateY(-22%) scale(.96,1.05)}
          78%{transform:translateY(2%) scale(1.06,.94)}
        }
        @keyframes hero-milo-wink{
          0%,100%{transform:rotate(0)}
          25%,60%{transform:rotate(-7deg) translateY(-2%)}
        }
        @keyframes hero-milo-wind{
          0%{stroke-dashoffset:1;opacity:0}
          20%{opacity:.85}
          60%{opacity:.7}
          100%{stroke-dashoffset:-1;opacity:0}
        }
        @keyframes hero-milo-star{
          0%{transform:scale(0) rotate(-40deg);opacity:0}
          35%{transform:scale(1.2) rotate(10deg);opacity:1}
          65%{transform:scale(1) rotate(0);opacity:1}
          100%{transform:scale(.4) rotate(30deg);opacity:0}
        }
        @media (prefers-reduced-motion:reduce){.hero-milo,.hero-milo-fx *{animation:none!important}.hero-milo-fx{display:none}}
      `}</style>
    </span>
  );
}
