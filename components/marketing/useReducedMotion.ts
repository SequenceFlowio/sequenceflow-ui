"use client";

import { useSyncExternalStore } from "react";

/**
 * Leest de systeemvoorkeur "prefers-reduced-motion" als externe store, zodat
 * React er direct op kan renderen in plaats van via een effect dat state zet
 * (dat veroorzaakt een tweede render en een zichtbare flits animatie).
 *
 * Op de server is het antwoord altijd `false`: we weten de voorkeur daar niet,
 * en de client corrigeert bij hydration zonder dat er al iets bewogen heeft.
 */

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onStoreChange: () => void) {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
