"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MailPlus, Plus, Trash2 } from "lucide-react";

import { ConfirmDialog, Field, Notice, Section, SettingsSkeleton } from "./SettingsUi";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

type Department = { name: string; email: string };

export default function EscalationSettings() {
  const { t, language } = useTranslation();
  const [departments, setDepartments] = useState<Department[] | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);
  const nl = language === "nl";

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/agent-config", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setDepartments(data.config?.escalationDepartments ?? []);
      setCanManage(data.permissions?.canManage === true);
    } catch { setError(nl ? "Escalatieroutes konden niet laden." : "Escalation routes could not load."); }
  }, [nl]);

  useEffect(() => { void load(); }, [load]);

  async function persist(next: Department[], success: string) {
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/agent-config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ escalationDepartments: next }) });
      if (!response.ok) throw new Error();
      setDepartments(next); setNotice({ tone: "success", text: success }); return true;
    } catch { setNotice({ tone: "error", text: nl ? "De wijziging kon niet worden opgeslagen. De bestaande routes zijn behouden." : "The change could not be saved. Existing routes were preserved." }); return false; }
    finally { setBusy(false); }
  }

  async function add() {
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedName) return setError(t.settings.deptNameError);
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) return setError(t.settings.deptEmailError);
    if (departments?.some((department) => department.name.toLowerCase() === normalizedName.toLowerCase() || department.email.toLowerCase() === normalizedEmail)) return setError(nl ? "Deze afdeling of dit e-mailadres bestaat al." : "This department or email address already exists.");
    const saved = await persist([...(departments ?? []), { name: normalizedName, email: normalizedEmail }], nl ? "Escalatieroute toegevoegd." : "Escalation route added.");
    if (saved) { setName(""); setEmail(""); setShowForm(false); setError(null); }
  }

  async function remove() {
    if (removeIndex == null || !departments) return;
    const next = departments.filter((_, index) => index !== removeIndex);
    const saved = await persist(next, nl ? "Escalatieroute verwijderd." : "Escalation route removed.");
    if (saved) setRemoveIndex(null);
  }

  if (!departments && !error) return <SettingsSkeleton />;
  if (!departments) return <Notice tone="error" title={error ?? undefined}><button className="settings-btn" onClick={() => void load()}>{nl ? "Opnieuw proberen" : "Try again"}</button></Notice>;

  return <div className="settings-stack">
    {!canManage ? <Notice tone="info" title={nl ? "Alleen-lezen" : "Read only"}>{nl ? "Alleen admins kunnen escalatieroutes wijzigen." : "Only admins can change escalation routes."}</Notice> : null}
    {notice ? <Notice tone={notice.tone} onClose={() => setNotice(null)}>{notice.text}</Notice> : null}
    <Section icon={<MailPlus size={18} />} title={t.settings.escalationTitle} description={t.settings.escalationDesc} status={<span className={`settings-status ${departments.length ? "success" : "warning"}`}>{departments.length} {nl ? "routes actief" : "active routes"}</span>}>
      {departments.length ? <div className="settings-list">{departments.map((department, index) => <div className="settings-list-row" key={`${department.email}-${index}`}><div style={{ minWidth: 0 }}><strong style={{ display: "block", color: "var(--text)", fontSize: 13 }}>{department.name}</strong><span style={{ display: "block", marginTop: 3, color: "var(--muted)", fontSize: 11, overflowWrap: "anywhere" }}>{department.email}</span></div>{canManage ? <button type="button" className="settings-btn danger" title={t.settings.deptRemove} aria-label={`${t.settings.deptRemove}: ${department.name}`} onClick={() => setRemoveIndex(index)}><Trash2 size={14} /></button> : null}</div>)}</div> : <div className="settings-empty"><strong>{t.settings.deptNone}</strong><p>{nl ? "Maak een route aan zodat medewerkers geëscaleerde tickets direct naar de juiste afdeling kunnen sturen." : "Create a route so agents can send escalated tickets to the right department."}</p></div>}

      {showForm && canManage ? <div style={{ display: "grid", gap: 12, paddingTop: 4 }}><div className="settings-grid-2"><Field label={t.settings.deptNameLabel}><input className="settings-control" value={name} onChange={(event) => { setName(event.target.value); setError(null); }} placeholder={t.settings.deptNamePlaceholder} /></Field><Field label={t.settings.deptEmailLabel}><input className="settings-control" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(null); }} placeholder={t.settings.deptEmailPlaceholder} /></Field></div>{error ? <p className="settings-error" role="alert">{error}</p> : null}<div style={{ display: "flex", gap: 8 }}><button className="settings-btn primary" disabled={busy} onClick={() => void add()}>{busy ? <Loader2 className="settings-spin" size={14} /> : <Plus size={14} />}{t.settings.deptAddBtn.replace("+ ", "")}</button><button className="settings-btn" disabled={busy} onClick={() => { setShowForm(false); setError(null); }}>{t.common.cancel}</button></div></div> : canManage ? <button className="settings-btn primary" onClick={() => setShowForm(true)}><Plus size={14} />{t.settings.deptAddTitle}</button> : null}
    </Section>
    {removeIndex != null ? <ConfirmDialog title={nl ? "Escalatieroute verwijderen?" : "Remove escalation route?"} description={nl ? `Nieuwe escalaties kunnen daarna niet meer naar ${departments[removeIndex]?.name}.` : `New escalations can no longer be sent to ${departments[removeIndex]?.name}.`} confirmLabel={t.settings.deptRemove} danger busy={busy} onCancel={() => !busy && setRemoveIndex(null)} onConfirm={() => void remove()} /> : null}
  </div>;
}
