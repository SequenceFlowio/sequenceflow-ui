"use client";

import { useMemo } from "react";
import { CreditCard, Moon, Palette, Route, ShieldCheck, Sun, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import BillingSettings from "./BillingSettings";
import EscalationSettings from "./EscalationSettings";
import PolicySettings from "./PolicySettings";
import { Section, SettingsStyles } from "./SettingsUi";
import TeamSettings from "./TeamSettings";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { useTheme } from "@/lib/theme/ThemeProvider";

type Tab = "policy" | "escalation" | "team" | "billing" | "appearance";

const VALID_TABS = new Set<Tab>(["policy", "escalation", "team", "billing", "appearance"]);

export default function SettingsClient() {
  const { t, language } = useTranslation();
  const { mode, setMode } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab") as Tab | null;
  const activeTab: Tab = requestedTab && VALID_TABS.has(requestedTab) ? requestedTab : "policy";
  const nl = language === "nl";

  const tabs = useMemo(() => [
    { id: "policy" as const, label: t.settings.tabPolicy, icon: ShieldCheck },
    { id: "escalation" as const, label: t.settings.tabEscalation, icon: Route },
    { id: "team" as const, label: t.settings.tabTeam, icon: Users },
    { id: "billing" as const, label: t.settings.tabBilling, icon: CreditCard },
    { id: "appearance" as const, label: nl ? "Weergave" : "Appearance", icon: Palette },
  ], [t, nl]);

  function selectTab(tab: Tab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    params.delete("checkout");
    router.push(`/settings?${params.toString()}`, { scroll: false });
  }

  return (
    <main className="settings-page">
      <SettingsStyles />
      <header className="settings-heading">
        <h1>{t.settings.title}</h1>
        <p>{nl ? "Beheer hoe Support antwoordt, samenwerkt en eruitziet voor je team." : "Manage how Support responds, works with your team and appears in the app."}</p>
      </header>

      <nav className="settings-tabs-wrap" aria-label={nl ? "Instellingencategorieën" : "Settings categories"}>
        <div className="settings-tabs">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`settings-tab${activeTab === id ? " active" : ""}`}
              aria-current={activeTab === id ? "page" : undefined}
              onClick={() => selectTab(id)}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </nav>

      <div aria-live="polite">
        {activeTab === "policy" ? <PolicySettings /> : null}
        {activeTab === "escalation" ? <EscalationSettings /> : null}
        {activeTab === "team" ? <TeamSettings /> : null}
        {activeTab === "billing" ? <BillingSettings /> : null}
        {activeTab === "appearance" ? (
          <div className="settings-stack">
            <Section
              icon={<Palette size={17} />}
              title={nl ? "Huisstijl" : "Appearance"}
              description={nl ? "Donker met limoen is de standaard. Je keuze geldt alleen voor deze browser." : "Dark with lime is the default. Your choice applies to this browser only."}
            >
              <div className="settings-appearance-options">
                <button type="button" className={`settings-appearance-choice${mode === "dark" ? " active" : ""}`} aria-pressed={mode === "dark"} onClick={() => setMode("dark")}>
                  <span className="settings-appearance-swatch dark"><Moon size={20} /></span>
                  <strong>{nl ? "Donker" : "Dark"}</strong>
                  <small>{nl ? "Zwart met limoen" : "Black with lime"}</small>
                </button>
                <button type="button" className={`settings-appearance-choice${mode === "light" ? " active" : ""}`} aria-pressed={mode === "light"} onClick={() => setMode("light")}>
                  <span className="settings-appearance-swatch light"><Sun size={20} /></span>
                  <strong>{nl ? "Licht" : "Light"}</strong>
                  <small>{nl ? "Lichte werkruimte" : "Light workspace"}</small>
                </button>
              </div>
            </Section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
