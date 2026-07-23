"use client";

import { useEffect, useState } from "react";
import { CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { Notice, Section, SettingsSkeleton } from "./SettingsUi";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { isPaidPlan, PAID_PLAN_CATALOG, type PaidPlanId } from "@/lib/planCatalog";

type Usage = { plan: string; used: number; limit: number | null; trialEndsAt: string | null; docsUsed: number; docsLimit: number | null; membersUsed: number; membersLimit: number | null; billingPortalAvailable: boolean; canManage: boolean };

function UsageMeter({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const color = pct >= 100 ? "#ef4444" : pct >= 80 ? "#d79a00" : "#9dca43";
  return <div style={{ display: "grid", gap: 7 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, color: "var(--muted)", fontSize: 11 }}><span>{label}</span><strong style={{ color: "var(--text)" }}>{used} / {limit ?? "∞"}</strong></div><div className="settings-progress"><span style={{ width: limit ? `${pct}%` : "0%", background: color }} /></div></div>;
}

export default function BillingSettings() {
  const { language } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "warning" | "error"; text: string } | null>(null);
  const nl = language === "nl";

  async function load() {
    setLoadError(false);
    try {
      const response = await fetch("/api/billing/usage", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setUsage(await response.json());
    } catch { setLoadError(true); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout === "success") setNotice({ tone: "success", text: nl ? "Je abonnement is geactiveerd. De nieuwe limieten worden nu verwerkt." : "Your subscription is active. New limits are being applied." });
    if (checkout === "cancelled") setNotice({ tone: "warning", text: nl ? "De checkout is geannuleerd. Er is niets gewijzigd." : "Checkout was cancelled. Nothing changed." });
    if (checkout) router.replace("/settings?tab=billing", { scroll: false });
  }, [searchParams, router, nl]);

  async function openPortal() {
    setBusy("portal"); setNotice(null);
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) throw new Error(data.error || "Portal unavailable");
      window.location.href = data.url;
    } catch { setNotice({ tone: "error", text: nl ? "Het Stripe-portaal kon niet worden geopend. Probeer het opnieuw." : "The Stripe portal could not be opened. Please try again." }); setBusy(null); }
  }

  async function choosePlan(plan: PaidPlanId) {
    if (!usage) return;
    if (isPaidPlan(usage.plan)) return void openPortal();
    setBusy(plan); setNotice(null);
    try {
      const response = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
      const data = await response.json().catch(() => ({}));
      if (response.status === 409 && data.usePortal) return void openPortal();
      if (!response.ok || !data.url) throw new Error(data.error || "Checkout unavailable");
      window.location.href = data.url;
    } catch { setNotice({ tone: "error", text: nl ? "De checkout kon niet worden gestart. Probeer het opnieuw." : "Checkout could not be started. Please try again." }); setBusy(null); }
  }

  if (loadError) return <Notice tone="error" title={nl ? "Facturering kon niet laden" : "Billing failed to load"}><button className="settings-btn" onClick={() => void load()}>{nl ? "Opnieuw proberen" : "Try again"}</button></Notice>;
  if (!usage) return <SettingsSkeleton />;

  const daysLeft = usage.trialEndsAt ? Math.max(0, Math.ceil((new Date(usage.trialEndsAt).getTime() - Date.now()) / 86400000)) : null;
  return <div className="settings-stack">
    {notice ? <Notice tone={notice.tone} onClose={() => setNotice(null)}>{notice.text}</Notice> : null}
    {!usage.canManage ? <Notice tone="info" title={nl ? "Alleen-lezen" : "Read only"}>{nl ? "Alleen admins kunnen het abonnement of plan wijzigen." : "Only admins can change the subscription or plan."}</Notice> : null}
    <Section icon={<CreditCard size={18} />} title={nl ? "Abonnement en gebruik" : "Subscription and usage"} description={nl ? "Je huidige plan, capaciteit en facturatie op één plek." : "Your current plan, capacity, and billing in one place."} action={usage.canManage && usage.billingPortalAvailable ? <button className="settings-btn" disabled={busy === "portal"} onClick={() => void openPortal()}>{busy === "portal" ? <Loader2 className="settings-spin" size={14} /> : <ExternalLink size={14} />}{nl ? "Beheer abonnement" : "Manage subscription"}</button> : undefined}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}><div><span style={{ display: "block", color: "var(--muted)", fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>{nl ? "Huidig plan" : "Current plan"}</span><strong style={{ display: "block", marginTop: 3, color: "var(--text)", fontSize: 22, textTransform: "capitalize" }}>{usage.plan}</strong></div>{daysLeft != null ? <span className={`settings-status ${daysLeft <= 2 ? "warning" : "success"}`}>{daysLeft} {nl ? "dagen resterend" : "days remaining"}</span> : usage.plan === "expired" ? <span className="settings-status warning">{nl ? "Verlopen" : "Expired"}</span> : <span className="settings-status success">{nl ? "Actief" : "Active"}</span>}</div>
      <UsageMeter label={nl ? "AI-antwoorden deze maand" : "AI answers this month"} used={usage.used} limit={usage.limit} />
      <UsageMeter label={nl ? "Kennisdocumenten" : "Knowledge documents"} used={usage.docsUsed} limit={usage.docsLimit} />
      <UsageMeter label={nl ? "Teamplaatsen" : "Team seats"} used={usage.membersUsed} limit={usage.membersLimit} />
      {usage.canManage && !usage.billingPortalAvailable && isPaidPlan(usage.plan) ? <Notice tone="warning">{nl ? "Voor dit abonnement is nog geen Stripe-portaal beschikbaar. Neem contact op met support voor wijzigingen." : "No Stripe portal is available for this subscription yet. Contact support for changes."}</Notice> : null}
    </Section>

    <Section icon={<CreditCard size={18} />} title={nl ? "Plannen vergelijken" : "Compare plans"} description={nl ? "Kies het plan dat past bij je huidige volume en team." : "Choose the plan that fits your current volume and team."}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 }}>{PAID_PLAN_CATALOG.map((plan) => { const current = usage.plan === plan.id; return <article key={plan.id} style={{ display: "grid", alignContent: "start", gap: 12, minHeight: 270, padding: 16, border: `1px solid ${current ? "#9dca43" : "var(--border)"}`, borderRadius: 8, background: current ? "#fbfef6" : "var(--bg)" }}><div><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong style={{ color: "var(--text)", fontSize: 14 }}>{plan.name}</strong>{current ? <span className="settings-status success">{nl ? "Huidig" : "Current"}</span> : plan.recommended ? <span className="settings-status success">{nl ? "Aanbevolen" : "Recommended"}</span> : null}</div><div style={{ marginTop: 8, color: "var(--text)", fontSize: 24, fontWeight: 800 }}>€{plan.price}<span style={{ color: "var(--muted)", fontSize: 11, fontWeight: 500 }}>/{nl ? "mnd" : "mo"}</span></div><p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 11 }}>{plan.description[language]}</p></div><ul style={{ display: "grid", gap: 6, margin: 0, padding: 0, listStyle: "none", color: "var(--muted)", fontSize: 11 }}>{plan.features[language].map((feature) => <li key={feature}>✓ {feature}</li>)}</ul><button className={`settings-btn ${plan.recommended && !current ? "primary" : ""}`} style={{ marginTop: "auto" }} disabled={!usage.canManage || current || Boolean(busy)} onClick={() => void choosePlan(plan.id)}>{busy === plan.id ? <Loader2 className="settings-spin" size={14} /> : null}{current ? (nl ? "Huidig plan" : "Current plan") : isPaidPlan(usage.plan) ? (nl ? "Plan wijzigen" : "Change plan") : (nl ? `Kies ${plan.name}` : `Choose ${plan.name}`)}</button></article>; })}</div>
      <div className="settings-list-row"><div><strong style={{ display: "block", color: "var(--text)", fontSize: 13 }}>{nl ? "Maatwerk" : "Custom"}</strong><span style={{ display: "block", marginTop: 3, color: "var(--muted)", fontSize: 11 }}>{nl ? "Hoog volume, SLA's en maatwerkintegraties." : "High volume, SLAs, and custom integrations."}</span></div><a className="settings-btn" href="mailto:hello@sequenceflow.io?subject=Custom plan">{nl ? "Neem contact op" : "Contact us"}</a></div>
    </Section>
  </div>;
}
