"use client";

import { useEffect, useMemo, useRef } from "react";
import { CreditCard, Route, ShieldCheck, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import BillingSettings from "./BillingSettings";
import EscalationSettings from "./EscalationSettings";
import PolicySettings from "./PolicySettings";
import { SettingsStyles } from "./SettingsUi";
import TeamSettings from "./TeamSettings";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

type Tab = "policy" | "escalation" | "team" | "billing";

const VALID_TABS = new Set<Tab>(["policy", "escalation", "team", "billing"]);

export default function SettingsClient() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab") as Tab | null;
  const activeTab: Tab = requestedTab && VALID_TABS.has(requestedTab) ? requestedTab : "policy";
  const nl = language === "nl";
  const activeTabRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeTab]);

  const tabs = useMemo(() => [
    { id: "policy" as const, label: t.settings.tabPolicy, icon: ShieldCheck },
    { id: "escalation" as const, label: t.settings.tabEscalation, icon: Route },
    { id: "team" as const, label: t.settings.tabTeam, icon: Users },
    { id: "billing" as const, label: t.settings.tabBilling, icon: CreditCard },
  ], [t]);

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
        <p>{nl ? "Beheer hoe Support One antwoordt en met je team samenwerkt." : "Manage how Support One responds and works with your team."}</p>
      </header>

      <nav className="settings-tabs-wrap" aria-label={nl ? "Instellingencategorieën" : "Settings categories"}>
        <div className="settings-tabs">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              ref={activeTab === id ? activeTabRef : undefined}
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
      </div>
    </main>
  );
}
