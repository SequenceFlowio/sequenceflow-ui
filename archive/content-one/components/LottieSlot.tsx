"use client";

import { useEffect, useRef } from "react";

import { useReducedMotion } from "./useReducedMotion";

/**
 * LottieSlot — speelt een Lottie-bestand uit public/lottie af, alleen zolang
 * het in beeld is. De lichte speler (zonder expressions) volstaat voor onze
 * animaties en scheelt flink in bundelgrootte; hij wordt pas geladen als het
 * blok bijna in beeld komt.
 *
 * Bij reduced motion blijft de animatie op een rustig frame staan in plaats
 * van te verdwijnen: de illustratie draagt ook betekenis.
 */

type Props = {
  /** Pad onder public, bijvoorbeeld "/lottie/pulse.json". */
  src: string;
  className?: string;
  /** Frame dat getoond wordt bij reduced motion. */
  stillFrame?: number;
  /** Toegankelijke beschrijving; leeg = decoratief. */
  label?: string;
};

export function LottieSlot({ src, className, stillFrame = 90, label = "" }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let cancelled = false;
    let animation: { play(): void; pause(): void; goToAndStop(value: number, isFrame?: boolean): void; destroy(): void } | null = null;
    let visible = false;

    const load = async () => {
      const { default: lottie } = await import("lottie-web/build/player/lottie_light");
      if (cancelled || animation) return;
      animation = lottie.loadAnimation({
        container: node,
        renderer: "svg",
        loop: !reducedMotion,
        autoplay: false,
        path: src,
        rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
      });
      if (reducedMotion) animation.goToAndStop(stillFrame, true);
      else if (visible) animation.play();
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !animation) void load();
        if (!animation || reducedMotion) return;
        if (visible) animation.play();
        else animation.pause();
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(node);

    return () => {
      cancelled = true;
      observer.disconnect();
      animation?.destroy();
    };
  }, [src, reducedMotion, stillFrame]);

  return (
    <div
      ref={ref}
      className={`mk-lottie${className ? ` ${className}` : ""}`}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    />
  );
}
