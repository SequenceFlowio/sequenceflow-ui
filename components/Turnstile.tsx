"use client";

import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile: een botcheck die mensen meestal niet eens zien
 * (alleen bij twijfel verschijnt een vinkje). Zonder
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY rendert dit niets en krijgt het formulier
 * geen token; de server slaat de check dan ook over.
 *
 * Een token is één keer bruikbaar. Na een mislukte poging: verhoog resetKey,
 * dan haalt de widget een nieuw token.
 */

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window { turnstile?: TurnstileApi }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

function loadScript(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing")));
    script.onerror = () => { scriptPromise = null; reject(new Error("turnstile script failed")); };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function Turnstile({ onToken, resetKey = 0, lang = "nl", theme = "dark" }: {
  onToken: (token: string | null) => void;
  resetKey?: number;
  lang?: "nl" | "en";
  theme?: "dark" | "light" | "auto";
}) {
  const box = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);
  useEffect(() => { callback.current = onToken; }, [onToken]);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !box.current) return;
    let widgetId: string | null = null;
    let cancelled = false;
    callback.current(null);
    loadScript().then((api) => {
      if (cancelled || !box.current) return;
      widgetId = api.render(box.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme,
        language: lang,
        appearance: "interaction-only",
        callback: (token: string) => callback.current(token),
        "expired-callback": () => callback.current(null),
        "error-callback": () => callback.current(null),
      });
    }).catch((error) => console.error("[turnstile]", error));
    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [resetKey, lang, theme]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={box} className="sf-turnstile" />;
}
