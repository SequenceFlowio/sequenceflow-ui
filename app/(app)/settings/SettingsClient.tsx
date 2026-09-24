"use client";

import { useEffect, useMemo, useRef } from "react";
import { CreditCard, MessageSquareText, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import BillingSettings from "./BillingSettings";
import EscalationSettings from "./EscalationSettings";
import PolicySettings from "./PolicySettings";
import { SettingsStyles } from "./SettingsUi";
import TeamSettings from "./TeamSettings";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

type Tab = "policy" | "team" | "billing";

const VALID_TABS = new Set<Tab>(["policy", "team", "billing"]);

export default function SettingsClient() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Doorsturen woonde vroeger in een eigen tab; oude links landen bij Team.
  const rawTab = searchParams.get("tab");
  const requestedTab = (rawTab === "escalation" ? "team" : rawTab) as Tab | null;
  const activeTab: Tab = requestedTab && VALID_TABS.has(requestedTab) ? requestedTab : "policy";
  const nl = language === "nl";
  const activeTabRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeTab]);

  const tabs = useMemo(() => [
    { id: "policy" as const, label: t.settings.tabPolicy, icon: MessageSquareText },
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
        <p>{nl ? "Hoe Support One antwoordt, wie meewerkt en je abonnement." : "How Support One replies, who works with it and your plan."}</p>
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
        {activeTab === "team" ? <div className="settings-stack"><TeamSettings /><EscalationSettings /></div> : null}
        {activeTab === "billing" ? <BillingSettings /> : null}
      </div>
    </main>
  );
}
