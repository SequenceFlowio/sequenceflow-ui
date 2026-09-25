"use client";

declare global {
  interface Window { shopify?: { idToken(): Promise<string> }; }
}
export function embeddedPath(path: string) {
  if (typeof window === "undefined" || !window.location.pathname.startsWith("/shopify")) return path;
  if (!/^\/(dashboard|inbox|integrations|knowledge|agent-profile|settings|upgrade)(?:[/?#]|$)/.test(path)) return path;
  const target = new URL(`/shopify${path}`, window.location.origin);
  const current = new URLSearchParams(window.location.search);
  for (const key of ["host", "shop", "embedded"]) {
    const value = current.get(key);
    if (value) target.searchParams.set(key, value);
  }
  return `${target.pathname}${target.search}${target.hash}`;
}

/** Attach Shopify credentials only to this application's own API requests. */
export async function appFetch(input: RequestInfo | URL, init?: RequestInit) {
  if (typeof window === "undefined" || !window.location.pathname.startsWith("/shopify")) return fetch(input, init);
  const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
  if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/")) return fetch(input, init);
  if (!window.shopify) throw new Error("Open SequenceFlow Support vanuit Shopify.");
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  headers.set("Authorization", `Bearer ${await window.shopify.idToken()}`);
  headers.set("x-sequenceflow-auth", "shopify");
  return fetch(input, { ...init, headers });
}
