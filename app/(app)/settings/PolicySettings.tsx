"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeEuro, Languages, Loader2, MessageSquareText, RotateCcw, Save, Zap } from "lucide-react";

import SenderFiltersSettings from "./SenderFiltersSettings";
import { ConfirmDialog, Field, Notice, Section, SettingsSkeleton, Toggle } from "./SettingsUi";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { useUpgradeModal } from "@/lib/upgradeModal";

type ReplyTone = "friendly_informal" | "professional" | "warm" | "concise";
type Pronoun = "informal" | "formal";
type PolicyConfig = {
  allowDiscount: boolean;
  maxDiscount: string;
  signature: string;
  languageDefault: string;
  replyTone: ReplyTone;
  replyPronounPreference: Pronoun;
  autosendEnabled: boolean;
  autosendThreshold: string;
  autosendTime1: string;
  autosendTime2: string;
};

const EMPTY: PolicyConfig = { allowDiscount: false, maxDiscount: "", signature: "", languageDefault: "nl", replyTone: "friendly_informal", replyPronounPreference: "informal", autosendEnabled: false, autosendThreshold: "0.85", autosendTime1: "08:00", autosendTime2: "16:00" };

function utcToLocal(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
  const date = new Date(); date.setUTCHours(hours, minutes, 0, 0);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function localToUtc(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
  const date = new Date(); date.setHours(hours, minutes, 0, 0);
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

export default function PolicySettings() {
  const { t, language } = useTranslation();
  const { open: openUpgrade } = useUpgradeModal();
  const signatureRef = useRef<HTMLTextAreaElement>(null);
  const [config, setConfig] = useState<PolicyConfig | null>(null);
  const [baseline, setBaseline] = useState<PolicyConfig | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [autosendAllowed, setAutosendAllowed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDisable, setConfirmDisable] = useState(false);
  const nl = language === "nl";

  async function load() {
    setLoadError(false);
    try {
      const [configResponse, usageResponse] = await Promise.all([fetch("/api/agent-config", { cache: "no-store" }), fetch("/api/billing/usage", { cache: "no-store" })]);
      if (!configResponse.ok) throw new Error();
      const data = await configResponse.json();
      const usage = usageResponse.ok ? await usageResponse.json() : null;
      const next: PolicyConfig = {
        allowDiscount: data.config.allowDiscount ?? false,
        maxDiscount: data.config.maxDiscountAmount != null ? String(data.config.maxDiscountAmount) : "",
        signature: data.config.signature ?? "",
        languageDefault: data.config.languageDefault ?? "nl",
        replyTone: data.config.replyTone ?? "friendly_informal",
        replyPronounPreference: data.config.replyPronounPreference ?? "informal",
        autosendEnabled: data.config.autosendEnabled ?? false,
        autosendThreshold: String(data.config.autosendThreshold ?? 0.85),
        autosendTime1: utcToLocal(data.config.autosendTime1 ?? "08:00"),
        autosendTime2: utcToLocal(data.config.autosendTime2 ?? "16:00"),
      };
      setConfig(next); setBaseline(next); setCanManage(data.permissions?.canManage === true);
      setAutosendAllowed(["pro", "agency", "custom"].includes(usage?.plan ?? ""));
    } catch { setLoadError(true); }
  }

  useEffect(() => { void load(); }, []);
  const dirty = useMemo(() => Boolean(config && baseline && JSON.stringify(config) !== JSON.stringify(baseline)), [config, baseline]);

  function update<K extends keyof PolicyConfig>(key: K, value: PolicyConfig[K]) {
    setConfig((current) => current ? { ...current, [key]: value } : current);
    setErrors((current) => ({ ...current, [key]: "" }));
    setNotice(null);
  }

  function validate() {
    if (!config) return false;
    const next: Record<string, string> = {};
    if (!config.signature.trim()) next.signature = nl ? "Voeg een handtekening toe voordat je opslaat." : "Add a signature before saving.";
    if (config.allowDiscount && (!config.maxDiscount || Number(config.maxDiscount) < 0)) next.maxDiscount = nl ? "Vul een geldig maximumbedrag in." : "Enter a valid maximum amount.";
    const threshold = Number(config.autosendThreshold);
    if (config.autosendEnabled && (!Number.isFinite(threshold) || threshold < 0.5 || threshold > 1)) next.autosendThreshold = nl ? "Gebruik een waarde tussen 0,50 en 1,00." : "Use a value between 0.50 and 1.00.";
    if (config.autosendEnabled && (!/^\d{2}:\d{2}$/.test(config.autosendTime1) || !/^\d{2}:\d{2}$/.test(config.autosendTime2))) next.autosendTime1 = nl ? "Kies twee geldige verzendtijden." : "Choose two valid send times.";
    setErrors(next);
    if (next.signature) signatureRef.current?.focus();
    return Object.keys(next).length === 0;
  }

  async function save() {
    if (!config || !validate()) return;
    setBusy(true); setNotice(null);
    try {
      const response = await fetch("/api/agent-config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        allowDiscount: config.allowDiscount,
        maxDiscountAmount: config.maxDiscount ? Number(config.maxDiscount) : 0,
        signature: config.signature.trim(), languageDefault: config.languageDefault, replyTone: config.replyTone,
        replyPronounPreference: config.replyPronounPreference, autosendEnabled: config.autosendEnabled,
        autosendThreshold: Number(config.autosendThreshold), autosendTime1: localToUtc(config.autosendTime1), autosendTime2: localToUtc(config.autosendTime2),
      }) });
      if (!response.ok) throw new Error();
      setBaseline(config); setNotice({ tone: "success", text: nl ? "Beleid is opgeslagen en wordt vanaf nu gebruikt." : "Policy saved and now in use." });
    } catch { setNotice({ tone: "error", text: nl ? "Opslaan mislukt. Je wijzigingen zijn niet verloren." : "Saving failed. Your changes are still here." }); }
    finally { setBusy(false); }
  }

  if (loadError) return <Notice tone="error" title={nl ? "Beleid kon niet laden" : "Policy failed to load"}><button className="settings-btn" onClick={() => void load()}>{nl ? "Opnieuw proberen" : "Try again"}</button></Notice>;
  if (!config) return <SettingsSkeleton />;

  return <div className="settings-stack">
    {!canManage ? <Notice tone="info" title={nl ? "Alleen-lezen" : "Read only"}>{nl ? "Alleen admins kunnen dit beleid wijzigen." : "Only admins can change this policy."}</Notice> : null}
    {notice ? <Notice tone={notice.tone} onClose={() => setNotice(null)}>{notice.text}</Notice> : null}

    <Section icon={<MessageSquareText size={18} />} title={nl ? "Antwoordstijl" : "Reply style"} description={nl ? "Bepaal hoe concepten klinken en worden afgesloten." : "Control how drafts sound and end."}>
      <div className="settings-grid-2">
        <Field label={t.settings.replyToneLabel} help={nl ? "De algemene schrijfstijl van ieder nieuw AI-concept." : "The general writing style for every new AI draft."}><select className="settings-control" disabled={!canManage} value={config.replyTone} onChange={(e) => update("replyTone", e.target.value as ReplyTone)}><option value="friendly_informal">{t.settings.replyToneFriendlyInformal}</option><option value="professional">{t.settings.replyToneProfessional}</option><option value="warm">{t.settings.replyToneWarm}</option><option value="concise">{t.settings.replyToneConcise}</option></select></Field>
        <Field label={t.settings.replyPronounLabel}><select className="settings-control" disabled={!canManage} value={config.replyPronounPreference} onChange={(e) => update("replyPronounPreference", e.target.value as Pronoun)}><option value="informal">{t.settings.replyPronounInformal}</option><option value="formal">{t.settings.replyPronounFormal}</option></select></Field>
      </div>
      <Field label={t.settings.replyLanguageFallbackLabel} help={t.settings.replyLanguageFallbackDesc}><select className="settings-control" disabled={!canManage} value={config.languageDefault} onChange={(e) => update("languageDefault", e.target.value)}>{Object.entries(t.knowledge.languageOptions).map(([code, label]) => <option key={code} value={code}>{label as string}</option>)}</select></Field>
      <Field label={t.settings.emailSignature} error={errors.signature}><textarea ref={signatureRef} className="settings-control" style={{ minHeight: 120, resize: "vertical" }} disabled={!canManage} value={config.signature} onChange={(e) => update("signature", e.target.value)} placeholder={t.settings.emailSignaturePlaceholder} /></Field>
    </Section>

    <Section icon={<BadgeEuro size={18} />} title={nl ? "Commercieel beleid" : "Commercial policy"} description={t.settings.allowDiscountDesc} action={<Toggle checked={config.allowDiscount} disabled={!canManage} label={t.settings.allowDiscount} onChange={() => update("allowDiscount", !config.allowDiscount)} />}>
      {config.allowDiscount ? <Field label={t.settings.maxDiscount} help={nl ? "De AI kan nooit een hoger bedrag voorstellen dan deze grens." : "The AI can never suggest an amount above this limit."} error={errors.maxDiscount}><input className="settings-control" type="number" min="0" disabled={!canManage} value={config.maxDiscount} onChange={(e) => update("maxDiscount", e.target.value)} placeholder={t.settings.maxDiscountPlaceholder} /></Field> : <Notice tone="info">{nl ? "Kortingsvoorstellen staan uit." : "Discount suggestions are disabled."}</Notice>}
    </Section>

    <Section icon={<Zap size={18} />} title={t.autosend.title} description={t.autosend.description} action={<Toggle checked={config.autosendEnabled && autosendAllowed} disabled={!canManage || !autosendAllowed} label={t.autosend.title} onChange={() => config.autosendEnabled ? setConfirmDisable(true) : update("autosendEnabled", true)} />}>
      {!autosendAllowed ? <Notice tone="warning" title={nl ? "Beschikbaar vanaf Pro" : "Available on Pro"}>{t.autosend.lockedText} <button className="settings-btn ghost" onClick={() => openUpgrade()}>{t.autosend.upgradeCta}</button></Notice> : config.autosendEnabled ? <>
        <div className="settings-grid-2"><Field label={t.autosend.thresholdLabel} help={t.autosend.thresholdDesc} error={errors.autosendThreshold}><input className="settings-control" type="number" min="0.5" max="1" step="0.05" disabled={!canManage} value={config.autosendThreshold} onChange={(e) => update("autosendThreshold", e.target.value)} /></Field><Field label={nl ? "Tijdzone" : "Timezone"}><div className="settings-control" style={{ display: "flex", alignItems: "center" }}><Languages size={15} style={{ marginRight: 7 }} />{Intl.DateTimeFormat().resolvedOptions().timeZone}</div></Field></div>
        <div className="settings-grid-2"><Field label={t.autosend.time1Label} error={errors.autosendTime1}><input className="settings-control" type="time" disabled={!canManage} value={config.autosendTime1} onChange={(e) => update("autosendTime1", e.target.value)} /></Field><Field label={t.autosend.time2Label}><input className="settings-control" type="time" disabled={!canManage} value={config.autosendTime2} onChange={(e) => update("autosendTime2", e.target.value)} /></Field></div>
      </> : <Notice tone="info">{nl ? "Auto-send staat uit. Alle concepten blijven ter beoordeling in de inbox." : "Auto-send is off. Every draft remains in the review inbox."}</Notice>}
    </Section>

    <SenderFiltersSettings />

    {dirty && canManage ? <div className="settings-savebar"><p>{nl ? "Je hebt niet-opgeslagen wijzigingen" : "You have unsaved changes"}</p><div><button className="settings-btn" disabled={busy} onClick={() => { setConfig(baseline ?? EMPTY); setErrors({}); }}><RotateCcw size={14} />{nl ? "Annuleren" : "Discard"}</button><button className="settings-btn primary" disabled={busy} onClick={() => void save()}>{busy ? <Loader2 className="settings-spin" size={14} /> : <Save size={14} />}{busy ? t.settings.stateSaving : nl ? "Wijzigingen opslaan" : "Save changes"}</button></div></div> : null}
    {confirmDisable ? <ConfirmDialog title={nl ? "Auto-send uitschakelen?" : "Disable auto-send?"} description={nl ? "Ingeplande tickets gaan terug naar handmatige beoordeling." : "Scheduled tickets will return to manual review."} confirmLabel={nl ? "Uitschakelen" : "Disable"} onCancel={() => setConfirmDisable(false)} onConfirm={() => { update("autosendEnabled", false); setConfirmDisable(false); }} /> : null}
  </div>;
}
