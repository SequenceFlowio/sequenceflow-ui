"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import { useReducedMotion } from "./useReducedMotion";

/**
 * Reveal — laat zijn inhoud één keer binnenkomen zodra die in beeld scrolt.
 *
 * Bewust één keer: een element dat bij elke scrollrichting opnieuw animeert
 * voelt als een storing, niet als een detail. De inhoud staat altijd in de
 * HTML, dus zonder JavaScript of bij reduced motion is de pagina gewoon
 * volledig zichtbaar.
 */

type Props = {
  children: ReactNode;
  /** Vertraging in ms, voor het staffelen van naast elkaar liggende items. */
  delay?: number;
  as?: "div" | "section" | "article" | "li";
  className?: string;
  id?: string;
};

export function Reveal({ children, delay = 0, as = "div", className, id }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node || reducedMotion) return;

    let answered = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        answered = true;
        // Ook tonen wanneer het element al boven het scherm ligt: bij een
        // ankersprong of een snelle scroll komt het nooit "in beeld", en dan
        // zou de sectie leeg blijven tot je terugscrollt.
        const passed = entry.boundingClientRect.bottom <= 0;
        if (!entry.isIntersecting && !passed) return;
        setShown(true);
        observer.disconnect();
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(node);

    // Een gezonde browser antwoordt meteen na observe(), ook als het element
    // nog niet in beeld is. Blijft dat antwoord uit, dan is de observer om wat
    // voor reden dan ook niet bruikbaar — en dan tonen we de inhoud gewoon.
    // Een onzichtbare marketingpagina is een veel erger probleem dan een
    // gemiste animatie.
    const failsafe = window.setTimeout(() => {
      if (!answered) setShown(true);
    }, 2000);

    return () => {
      window.clearTimeout(failsafe);
      observer.disconnect();
    };
  }, [reducedMotion]);

  const Tag = as as "div";
  const visible = shown || reducedMotion;
  return (
    <Tag
      ref={ref as RefObject<HTMLDivElement>}
      id={id}
      className={`mk-reveal${visible ? " is-in" : ""}${className ? ` ${className}` : ""}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
