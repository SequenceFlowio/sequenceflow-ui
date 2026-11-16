"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Lock, PackageX, ShoppingCart, Snail, TriangleAlert } from "lucide-react";

import Link from "@/components/shopify/AppLink";
import { SequenceMark } from "@/components/marketing/SequenceMark";
import { otisSays } from "@/lib/assistants/team";
import { shopDay, type InventoryAction, type InventorySummary } from "@/lib/inventory/core";
import { inventoryDemoView } from "@/lib/inventory/demo";
import { appFetch } from "@/lib/shopify/client";
import { useUpgradeModal } from "@/lib/upgradeModal";

import styles from "./page.module.css";

type OtisView = { summary: InventorySummary; actions: InventoryAction[]; builtAt?: string };
type State =
  | { kind: "loading" }
  | { kind: "hidden" }
  | { kind: "live"; view: OtisView; alerts: number }
  | { kind: "locked"; view: OtisView };

/**
 * Otis op het overzicht: wat er met de voorraad speelt, onder Seffy's cijfers.
 * Zonder Scale een voorbeeld met verzonnen cijfers, grijs en op slot, met een
 * knop om te upgraden. Staat de voorraadfunctie uit, dan toont dit niets.
 */
export function OtisPanel({ nl, enabled = process.env.NEXT_PUBLIC_INVENTORY_ADVICE_ENABLED === "true" }: { nl: boolean; enabled?: boolean }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const { open } = useUpgradeModal();

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const language = nl ? "nl" : "en";
    (async () => {
      try {
        const response = await appFetch(`/api/inventory?status=attention&limit=1&lang=${language}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json().catch(() => ({}));
        if (controller.signal.aborted) return;
        if (response.status === 403 && data?.upgrade === true) {
          const demo = inventoryDemoView(shopDay(new Date()), language);
          setState({ kind: "locked", view: { summary: demo.summary, actions: demo.actions } });
          return;
        }
        if (!response.ok) { setState({ kind: "hidden" }); return; }
        const count = await appFetch("/api/inventory/alerts/count", { cache: "no-store", signal: controller.signal }).then((res) => (res.ok ? res.json() : { open: 0 })).catch(() => ({ open: 0 }));
        if (!controller.signal.aborted) setState({ kind: "live", view: data as OtisView, alerts: Number(count?.open ?? 0) });
      } catch {
        if (!controller.signal.aborted) setState({ kind: "hidden" });
      }
    })();
    return () => controller.abort();
  }, [nl, enabled]);

  if (!enabled || state.kind === "hidden") return null;
  if (state.kind === "loading") return <section className={`${styles.panel} ${styles.otis}`} aria-busy="true"><p className={styles.empty}>{nl ? "Otis telt je voorraad…" : "Otis is counting your stock…"}</p></section>;

  const locked = state.kind === "locked";
  const { summary, actions } = state.view;
  const money = (value: number) => new Intl.NumberFormat(nl ? "nl-NL" : "en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
  const tiles = [
    { icon: PackageX, label: nl ? "Uitverkocht" : "Sold out", value: String(summary.outOfStockVariants), note: nl ? "varianten" : "variants" },
    { icon: TriangleAlert, label: nl ? "Bijna op" : "Running low", value: String(summary.lowVariants), note: nl ? "varianten" : "variants" },
    { icon: ShoppingCart, label: nl ? "Bij te bestellen" : "To reorder", value: summary.toOrderUnits.toLocaleString(nl ? "nl-NL" : "en-GB"), note: nl ? `stuks, ${summary.toOrderVariants} varianten` : `units, ${summary.toOrderVariants} variants` },
    { icon: Snail, label: nl ? "Ligt stil" : "Sitting still", value: money(summary.deadStockValue), note: nl ? `${summary.deadVariants} varianten` : `${summary.deadVariants} variants` },
  ];

  const body = (
    <>
      <div className={styles.panelHeader}>
        <div className={styles.otisHead}>
          <span className={styles.otisMark}><SequenceMark size={52} gear="analyst" state="observing" title="" /></span>
          <div>
            <span className={styles.eyebrow}>OTIS · {nl ? "VOORRAAD & INKOOP" : "STOCK & BUYING"}</span>
            <h2 id="otis-title">{otisSays({ language: nl ? "nl" : "en", variants: summary.variants, outOfStock: summary.outOfStockVariants, low: summary.lowVariants, toOrder: summary.toOrderVariants, dead: summary.deadVariants })}</h2>
          </div>
        </div>
        {!locked ? <Link href="/inventory">{state.kind === "live" && state.alerts ? (nl ? `${state.alerts} meldingen` : `${state.alerts} alerts`) : (nl ? "Naar Otis" : "Open Otis")}<ArrowRight size={15} aria-hidden /></Link> : null}
      </div>
      <div className={styles.otisTiles}>
        {tiles.map(({ icon: Icon, label, value, note }) => (
          <div key={label} className={styles.otisTile}><Icon size={18} aria-hidden /><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
        ))}
      </div>
      {actions.length ? (
        <ul className={styles.otisActions} aria-label={nl ? "Wat Otis deze week zou doen" : "What Otis would do this week"}>
          {actions.slice(0, 3).map((action) => (
            <li key={`${action.kind}-${action.variantKey}`}><strong>{action.title}</strong><span>{action.text}</span>{action.impact > 0 ? <small>{money(action.impact)}</small> : null}</li>
          ))}
        </ul>
      ) : null}
    </>
  );

  if (!locked) return <section className={`${styles.panel} ${styles.otis}`} aria-labelledby="otis-title">{body}</section>;

  return (
    <section className={`${styles.panel} ${styles.otis} ${styles.otisLockedWrap}`} aria-label={nl ? "Otis, voorraadagent (Scale)" : "Otis, stock agent (Scale)"}>
      <div className={styles.otisLocked} aria-hidden="true" inert>{body}</div>
      <div className={styles.otisGate}>
        <span className={styles.otisBadge}><Lock size={13} aria-hidden />{nl ? "Scale-pakket" : "Scale plan"}</span>
        <h2>{nl ? "Otis houdt je voorraad bij" : "Otis keeps track of your stock"}</h2>
        <p>{nl ? "Per maat en kleur: wat uitverkocht raakt, wat stil ligt en hoeveel je bijbestelt. Dit is een voorbeeld met verzonnen cijfers." : "Per size and colour: what sells out, what sits still and how much to reorder. This is an example with made-up numbers."}</p>
        <div className={styles.otisGateActions}>
          <button type="button" className={styles.primaryLink} onClick={() => open()}>{nl ? "Upgrade naar Scale" : "Upgrade to Scale"}<ArrowRight size={16} aria-hidden /></button>
          <Link href="/inventory" className={styles.secondaryLink}>{nl ? "Bekijk wat Otis doet" : "See what Otis does"}</Link>
        </div>
      </div>
    </section>
  );
}
