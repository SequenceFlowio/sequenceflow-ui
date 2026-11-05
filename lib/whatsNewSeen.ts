"use client";

import { useSyncExternalStore } from "react";

// Welke entries iemand gezien heeft, per browser. Geen database nodig: wie op
// een ander apparaat inlogt, ziet de badge daar nog één keer.
const STORAGE_KEY = "sf_whats_new_seen";
const EMPTY: ReadonlySet<string> = new Set();

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedSet: ReadonlySet<string> = EMPTY;
// Als opslag geblokkeerd is, onthouden we het alleen voor deze sessie.
let memorySeen: ReadonlySet<string> = EMPTY;

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => { listeners.delete(onChange); window.removeEventListener("storage", onChange); };
}

function readSeen(): ReadonlySet<string> {
  let raw: string | null = null;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch { return memorySeen; }
  // Zelfde tekst, zelfde Set: useSyncExternalStore wil een stabiele waarde.
  if (raw === cachedRaw) return cachedSet;
  cachedRaw = raw;
  try {
    const ids = JSON.parse(raw ?? "[]");
    cachedSet = new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : []);
  } catch {
    cachedSet = EMPTY;
  }
  return cachedSet;
}

/** null op de server en bij de eerste render: dan tonen we geen badge, zodat hij niet flitst. */
export function useSeenWhatsNew(): ReadonlySet<string> | null {
  return useSyncExternalStore<ReadonlySet<string> | null>(subscribe, readSeen, () => null);
}

export function markWhatsNewSeen(ids: string[]) {
  const seen = readSeen();
  if (ids.every((id) => seen.has(id))) return;
  const next = [...new Set([...seen, ...ids])];
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { memorySeen = new Set(next); }
  for (const listener of listeners) listener();
}
