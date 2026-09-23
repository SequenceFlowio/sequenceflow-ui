"use client";

import { useSyncExternalStore } from "react";

import { SequenceMark } from "@/components/marketing/SequenceMark";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { useUpgradeModal } from "@/lib/upgradeModal";

type Props = {
  plan:     string;
  daysLeft: number | null;
};

/** Pas in de laatste dagen: eerder is een aftelmelding alleen maar ruis. */
const SHOW_FROM_DAYS_LEFT = 3;

// Wegklikken geldt voor de rest van de dag, niet tot de volgende paginalaad.
const dismissKey = () => `sf_trial_note_hidden_${new Date().toLocaleDateString("sv-SE")}`;
const listeners = new Set<() => void>();
function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => { listeners.delete(onChange); };
}
function readHidden() {
  try { return localStorage.getItem(dismissKey()) === "1"; } catch { return false; }
}

export function TrialBanner({ plan, daysLeft }: Props) {
  const hidden = useSyncExternalStore(subscribe, readHidden, () => false);
  const { open: openUpgrade } = useUpgradeModal();
  const { language } = useTranslation();
  const nl = language === "nl";

  if (hidden || plan !== "trial" || daysLeft === null || daysLeft > SHOW_FROM_DAYS_LEFT) return null;

  function hide() {
    try { localStorage.setItem(dismissKey(), "1"); } catch { /* opslag geblokkeerd: dan alleen voor deze weergave */ }
    for (const listener of listeners) listener();
  }

  const label = daysLeft <= 0
    ? (nl ? "Je proefperiode loopt vandaag af." : "Your trial ends today.")
    : daysLeft === 1
      ? (nl ? "Nog 1 dag in je proefperiode." : "1 day left in your trial.")
      : (nl ? `Nog ${daysLeft} dagen in je proefperiode.` : `${daysLeft} days left in your trial.`);

  return (
    <div className="sf-trial-note" role="status">
      <SequenceMark size={26} state="idle" title="" />
      <span>{label}</span>
      <button type="button" className="sf-trial-note__cta" onClick={() => openUpgrade()}>
        {nl ? "Kies een plan" : "Choose a plan"}
      </button>
      <button type="button" className="sf-trial-note__close" onClick={hide} aria-label={nl ? "Verbergen voor vandaag" : "Hide for today"}>
        ×
      </button>
    </div>
  );
}
