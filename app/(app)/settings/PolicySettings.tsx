"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeEuro, Languages, Loader2, MessageSquareText, RotateCcw, Save, Zap } from "lucide-react";

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
  // Aanzetten vraagt een expliciete bevestiging van de risico's, elke keer.
  const [confirmEnable, setConfirmEnable] = useState(false);
  const [riskAccepted, setRiskAccepted] = useState(false);
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
    if (config.autosendEnabled && (!/^\d{2}:\d{2}$/.test(config.autosendTime1) || !/^\d{2}:\d{2}$/.test(config.autosendTime2))) {
      const message = nl ? "Kies twee geldige verzendtijden." : "Choose two valid send times.";
      next.autosendTime1 = message;
      next.autosendTime2 = message;
    }
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
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const fieldMap: Record<string, keyof PolicyConfig> = { maxDiscountAmount: "maxDiscount" };
        const field = fieldMap[data.field] ?? data.field;
        if (field && field in config) setErrors((current) => ({ ...current, [field]: data.error || (nl ? "Controleer deze waarde." : "Check this value.") }));
        throw new Error();
      }
      const saved = { ...config, signature: config.signature.trim() };
      setConfig(saved);
      setBaseline(saved);
      setNotice({ tone: "success", text: nl ? "Opgeslagen. Support One gebruikt dit vanaf het volgende antwoord." : "Saved. Support One uses this from the next reply." });
    } catch { setNotice({ tone: "error", text: nl ? "Opslaan mislukt. Je wijzigingen zijn niet verloren." : "Saving failed. Your changes are still here." }); }
    finally { setBusy(false); }
  }

  // De drempel in woorden; de onderliggende waarde blijft 0,50–1,00.
  const thresholdOptions = [
    { value: "0.95", label: nl ? "Alleen als Support One heel zeker is" : "Only when Support One is very sure" },
    { value: "0.85", label: nl ? "Als Support One zeker is (aanbevolen)" : "When Support One is sure (recommended)" },
    { value: "0.75", label: nl ? "Ook als Support One redelijk zeker is" : "Also when Support One is fairly sure" },
  ];
  if (config && !thresholdOptions.some((option) => option.value === config.autosendThreshold)) {
    thresholdOptions.push({ value: config.autosendThreshold, label: nl ? `Eigen instelling (${config.autosendThreshold.replace(".", ",")})` : `Custom (${config.autosendThreshold})` });
  }

  if (loadError) return <Notice tone="error" title={nl ? "Instellingen konden niet laden" : "Settings failed to load"}><button className="settings-btn" onClick={() => void load()}>{nl ? "Opnieuw proberen" : "Try again"}</button></Notice>;
  if (!config) return <SettingsSkeleton />;

  return <div className="settings-stack">
    {!canManage ? <Notice tone="info" title={nl ? "Alleen-lezen" : "Read only"}>{nl ? "Alleen beheerders kunnen dit wijzigen." : "Only admins can change this."}</Notice> : null}
    {notice ? <Notice tone={notice.tone} onClose={() => setNotice(null)}>{notice.text}</Notice> : null}
    <Section icon={<MessageSquareText size={18} />} title={nl ? "Toon en ondertekening" : "Tone and signature"} description={nl ? "De basis voor elk antwoordconcept. Afspraken op Antwoordstijl verfijnen dit." : "The basis for every reply draft. Rules on Reply style refine it."}>
      <div className="settings-grid-2">
        <Field label={t.settings.replyToneLabel} ><select className="settings-control" disabled={!canManage} value={config.replyTone} onChange={(e) => update("replyTone", e.target.value as ReplyTone)}><option value="friendly_informal">{t.settings.replyToneFriendlyInformal}</option><option value="professional">{t.settings.replyToneProfessional}</option><option value="warm">{t.settings.replyToneWarm}</option><option value="concise">{t.settings.replyToneConcise}</option></select></Field>
        <Field label={t.settings.replyPronounLabel}><select className="settings-control" disabled={!canManage} value={config.replyPronounPreference} onChange={(e) => update("replyPronounPreference", e.target.value as Pronoun)}><option value="informal">{t.settings.replyPronounInformal}</option><option value="formal">{t.settings.replyPronounFormal}</option></select></Field>
      </div>
      <Field label={t.settings.replyLanguageFallbackLabel} help={t.settings.replyLanguageFallbackDesc}><select className="settings-control" disabled={!canManage} value={config.languageDefault} onChange={(e) => update("languageDefault", e.target.value)}>{Object.entries(t.knowledge.languageOptions).map(([code, label]) => <option key={code} value={code}>{label as string}</option>)}</select></Field>
      <Field label={t.settings.emailSignature} error={errors.signature}><textarea ref={signatureRef} className="settings-control" style={{ minHeight: 120, resize: "vertical" }} disabled={!canManage} value={config.signature} onChange={(e) => update("signature", e.target.value)} placeholder={t.settings.emailSignaturePlaceholder} /></Field>
    </Section>

    <Section icon={<BadgeEuro size={18} />} title={nl ? "Korting" : "Discounts"} description={t.settings.allowDiscountDesc} action={<Toggle checked={config.allowDiscount} disabled={!canManage} label={t.settings.allowDiscount} onChange={() => update("allowDiscount", !config.allowDiscount)} />}>
      {config.allowDiscount ? <Field label={t.settings.maxDiscount} help={nl ? "Support One stelt nooit een hoger bedrag voor dan deze grens." : "Support One never suggests an amount above this limit."} error={errors.maxDiscount}><input className="settings-control" type="number" min="0" disabled={!canManage} value={config.maxDiscount} onChange={(e) => update("maxDiscount", e.target.value)} placeholder={t.settings.maxDiscountPlaceholder} /></Field> : <Notice tone="info">{nl ? "Support One biedt geen korting aan." : "Support One does not offer discounts."}</Notice>}
    </Section>

    <Section icon={<Zap size={18} />} title={t.autosend.title} description={t.autosend.description} action={<Toggle checked={config.autosendEnabled && autosendAllowed} disabled={!canManage || !autosendAllowed} label={t.autosend.title} onChange={() => { if (config.autosendEnabled) setConfirmDisable(true); else { setRiskAccepted(false); setConfirmEnable(true); } }} />}>
      {!autosendAllowed ? <Notice tone="warning" title={nl ? "Beschikbaar vanaf Growth" : "Available from Growth"}>{t.autosend.lockedText} <button className="settings-btn ghost" onClick={() => openUpgrade()}>{t.autosend.upgradeCta}</button></Notice> : config.autosendEnabled ? <>
        <div className="settings-grid-2"><Field label={t.autosend.thresholdLabel} help={t.autosend.thresholdDesc} error={errors.autosendThreshold}><select className="settings-control" disabled={!canManage} value={config.autosendThreshold} onChange={(e) => update("autosendThreshold", e.target.value)}>{thresholdOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field><Field label={nl ? "Tijdzone" : "Timezone"}><div className="settings-control" style={{ display: "flex", alignItems: "center" }}><Languages size={15} style={{ marginRight: 7 }} />{Intl.DateTimeFormat().resolvedOptions().timeZone}</div></Field></div>
        <div className="settings-grid-2"><Field label={t.autosend.time1Label} error={errors.autosendTime1}><input className="settings-control" type="time" disabled={!canManage} value={config.autosendTime1} onChange={(e) => update("autosendTime1", e.target.value)} /></Field><Field label={t.autosend.time2Label} error={errors.autosendTime2}><input className="settings-control" type="time" disabled={!canManage} value={config.autosendTime2} onChange={(e) => update("autosendTime2", e.target.value)} /></Field></div>
        <Notice tone="warning">{nl ? "Staat aan: antwoorden die Support One zeker genoeg vindt, worden zonder controle verstuurd. Jij blijft verantwoordelijk voor wat er de deur uit gaat. Sla wijzigingen op om ze te laten ingaan." : "On: replies Support One is sure enough about are sent without review. You remain responsible for what goes out. Save changes for them to take effect."}</Notice>
      </> : <Notice tone="info">{nl ? "Staat uit. Elk antwoordconcept blijft ter beoordeling in de inbox." : "Off. Every reply draft stays in the inbox for review."}</Notice>}
    </Section>

    {dirty && canManage ? <div className="settings-savebar"><p>{nl ? "Je hebt niet-opgeslagen wijzigingen" : "You have unsaved changes"}</p><div><button className="settings-btn" disabled={busy} onClick={() => { setConfig({ ...(baseline ?? EMPTY) }); setErrors({}); setNotice(null); }}><RotateCcw size={14} />{nl ? "Annuleren" : "Discard"}</button><button className="settings-btn primary" disabled={busy} onClick={() => void save()}>{busy ? <Loader2 className="settings-spin" size={14} /> : <Save size={14} />}{busy ? t.settings.stateSaving : nl ? "Wijzigingen opslaan" : "Save changes"}</button></div></div> : null}
    {confirmEnable ? <div className="settings-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setConfirmEnable(false)}><div className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="autosend-risk-title" style={{ width: "min(100%, 520px)" }}>
      <header className="settings-modal-head"><div><h3 id="autosend-risk-title">{nl ? "Automatisch versturen aanzetten?" : "Turn on automatic sending?"}</h3><p>{nl ? "Antwoorden gaan dan de deur uit zonder dat iemand ze eerst leest." : "Replies are then sent without anyone reading them first."}</p></div></header>
      <div className="settings-modal-body">
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6, color: "var(--muted)", fontSize: 13, lineHeight: 1.55 }}>
          <li>{nl ? "AI kan fouten maken, bijvoorbeeld over bestellingen, bezorging, beleid, bedragen of terugbetalingen." : "AI can make mistakes, for example about orders, delivery, policies, amounts or refunds."}</li>
          <li>{nl ? "Twijfelt Support One, of vraagt een klantvraag om een beslissing zoals een annulering, dan blijft het antwoord altijd ter beoordeling." : "When Support One is unsure, or a question needs a decision such as a cancellation, the reply always stays in review."}</li>
          <li>{nl ? "Jij blijft verantwoordelijk voor wat er namens je bedrijf wordt verstuurd. SequenceFlow is niet aansprakelijk voor de inhoud of gevolgen van automatisch verstuurde antwoorden." : "You remain responsible for what is sent on behalf of your business. SequenceFlow is not liable for the content or consequences of automatically sent replies."}</li>
        </ul>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, lineHeight: 1.5, color: "var(--text)", cursor: "pointer" }}>
          <input type="checkbox" checked={riskAccepted} onChange={(event) => setRiskAccepted(event.target.checked)} style={{ marginTop: 3, width: 16, height: 16, accentColor: "#c7f56f" }} />
          <span>{nl ? "Ik begrijp de risico's en neem de verantwoordelijkheid voor automatisch verstuurde antwoorden. " : "I understand the risks and take responsibility for automatically sent replies. "}<a href="/terms" target="_blank" rel="noreferrer" style={{ color: "var(--sf-green)" }}>{nl ? "Voorwaarden" : "Terms"}</a></span>
        </label>
      </div>
      <div className="settings-modal-actions"><button type="button" className="settings-btn" onClick={() => setConfirmEnable(false)}>{nl ? "Annuleren" : "Cancel"}</button><button type="button" className="settings-btn primary" disabled={!riskAccepted} onClick={() => { update("autosendEnabled", true); setConfirmEnable(false); }}>{nl ? "Aanzetten" : "Turn on"}</button></div>
    </div></div> : null}
    {confirmDisable ? <ConfirmDialog title={nl ? "Automatisch versturen uitzetten?" : "Turn off automatic sending?"} description={nl ? "Ingeplande antwoorden gaan terug naar Ter beoordeling." : "Scheduled replies go back to review."} confirmLabel={nl ? "Uitschakelen" : "Disable"} onCancel={() => setConfirmDisable(false)} onConfirm={() => { update("autosendEnabled", false); setConfirmDisable(false); }} /> : null}
  </div>;
}
