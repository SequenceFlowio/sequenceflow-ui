"use client";

import { useEffect, useRef, useState } from "react";

import { SequenceMark, type MarkState } from "./SequenceMark";
import { useReducedMotion } from "./useReducedMotion";

/**
 * Milo tussen de woorden van de kop. Hij blijft op zijn plek maar leeft:
 * om de paar seconden draait hij zich om, maakt hij een rondje met zijn
 * antenne of een klein sprongetje. Elke beweging is kort en eindigt precies
 * waar hij begon, zodat de regel nooit verspringt. Bij "minder beweging"
 * staat hij stil, en op een tabblad op de achtergrond doet hij niets.
 */

const MOVES = ["turn", "spin", "hop"] as const;
type Move = (typeof MOVES)[number];

const FACE: Record<Move, MarkState> = { turn: "observing", spin: "happy", hop: "happy" };

export function HeroMilo({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const [move, setMove] = useState<Move | null>(null);
  const index = useRef(0);

  useEffect(() => {
    if (reduced) return;
    let timer = 0;
    const schedule = (delay: number) => {
      timer = window.setTimeout(() => {
        if (!document.hidden) {
          setMove(MOVES[index.current % MOVES.length]);
          index.current += 1;
        }
        schedule(4200 + Math.random() * 2600);
      }, delay);
    };
    schedule(1800);
    return () => window.clearTimeout(timer);
  }, [reduced]);

  return (
    <span className={`hero-milo${className ? ` ${className}` : ""}${move ? ` is-${move}` : ""}`} onAnimationEnd={() => setMove(null)} aria-hidden>
      <SequenceMark size={56} gear="antenna" state={move ? FACE[move] : "observing"} title="" />
      <style>{`
        .hero-milo{display:inline-block;transform-origin:50% 60%;perspective:240px}
        .hero-milo>svg{display:block;width:100%;height:100%}
        .hero-milo.is-turn{animation:hero-milo-turn 1.25s cubic-bezier(.45,.05,.25,1)}
        .hero-milo.is-spin{animation:hero-milo-spin 1.1s cubic-bezier(.5,0,.2,1)}
        .hero-milo.is-hop{animation:hero-milo-hop .8s cubic-bezier(.3,.7,.3,1)}
        @keyframes hero-milo-turn{
          0%{transform:rotateY(0)}
          18%{transform:rotateY(-24deg) translateY(-2%)}
          70%{transform:rotateY(380deg) translateY(-6%)}
          100%{transform:rotateY(360deg)}
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
        @media (prefers-reduced-motion:reduce){.hero-milo{animation:none!important}}
      `}</style>
    </span>
  );
}
