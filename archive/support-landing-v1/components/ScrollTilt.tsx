"use client";

import { useEffect } from "react";

/**
 * Kantelt kaartjes mee met het scrollen: in het midden van het scherm staan
 * ze recht, pas bij de rand van het scherm kantelen ze terug naar hun
 * schuine stand (--tilt in de CSS). Zonder JavaScript of met "minder
 * beweging" blijven ze gewoon schuin staan.
 */
export function ScrollTilt({ selector }: { selector: string }) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
    if (!elements.length) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const middle = window.innerHeight / 2;
      for (const element of elements) {
        const rect = element.getBoundingClientRect();
        const offset = Math.abs(rect.top + rect.height / 2 - middle) / middle;
        // Zolang het kaartje ruim in beeld is, staat het helemaal recht; alleen
        // bij het binnenkomen en weggaan aan de rand van het scherm kantelt het.
        const amount = Math.min(1, Math.max(0, (offset - 0.45) / 0.5));
        element.style.setProperty("--tilt-amount", (amount * amount * (3 - 2 * amount)).toFixed(3));
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [selector]);

  return null;
}
