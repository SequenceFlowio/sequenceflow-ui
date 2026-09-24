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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);
  const nl = language === "nl";

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const response = await fetch("/api/agent-config", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setDepartments(data.config?.escalationDepartments ?? []);
      setCanManage(data.permissions?.canManage === true);
    } catch { setLoadError(nl ? "Afdelingen konden niet laden." : "Departments could not load."); }
  }, [nl]);

  useEffect(() => { void load(); }, [load]);

  async function persist(next: Department[], success: string) {
    setBusy(true); setNotice(null);
    try {
      const response = await fetch("/api/agent-config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ escalationDepartments: next }) });
      if (!response.ok) throw new Error();
      setDepartments(next); setNotice({ tone: "success", text: success }); return true;
    } catch { return false; }
    finally { setBusy(false); }
  }

  async function add() {
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedName) return setFormError(t.settings.deptNameError);
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) return setFormError(t.settings.deptEmailError);
    if (departments?.some((department) => department.name.toLowerCase() === normalizedName.toLowerCase() || department.email.toLowerCase() === normalizedEmail)) return setFormError(nl ? "Deze afdeling of dit e-mailadres bestaat al." : "This department or email address already exists.");
    const saved = await persist([...(departments ?? []), { name: normalizedName, email: normalizedEmail }], nl ? "Afdeling toegevoegd." : "Department added.");
    if (saved) { setName(""); setEmail(""); setShowForm(false); setFormError(null); }
    else setFormError(nl ? "Opslaan mislukt. De bestaande afdelingen zijn behouden." : "Saving failed. Existing departments were kept.");
  }

  async function remove() {
    if (removeIndex == null || !departments) return;
    setDialogError(null);
    const next = departments.filter((_, index) => index !== removeIndex);
    const saved = await persist(next, nl ? "Afdeling verwijderd." : "Department removed.");
    if (saved) setRemoveIndex(null);
    else setDialogError(nl ? "Verwijderen mislukt. De afdeling is behouden." : "Removal failed. The department was kept.");
  }

  if (!departments && !loadError) return <SettingsSkeleton />;
  if (!departments) return <Notice tone="error" title={loadError ?? undefined}><button className="settings-btn" onClick={() => void load()}>{nl ? "Opnieuw proberen" : "Try again"}</button></Notice>;

  return <div className="settings-stack">
    {!canManage ? <Notice tone="info" title={nl ? "Alleen-lezen" : "Read only"}>{nl ? "Alleen beheerders kunnen afdelingen wijzigen." : "Only admins can change departments."}</Notice> : null}
    {notice ? <Notice tone={notice.tone} onClose={() => setNotice(null)}>{notice.text}</Notice> : null}
    <Section icon={<MailPlus size={18} />} title={t.settings.escalationTitle} description={t.settings.escalationDesc} action={<div className="settings-actions">{canManage && !showForm ? <button className="settings-btn primary" onClick={() => { setShowForm(true); setFormError(null); }}><Plus size={14} />{t.settings.deptAddTitle}</button> : null}</div>}>
      {departments.length ? <div className="settings-list">{departments.map((department, index) => <div className="settings-list-row" key={department.email}><div className="settings-row-copy"><strong>{department.name}</strong><span>{department.email}</span></div>{canManage ? <button type="button" className="settings-btn danger icon" title={t.settings.deptRemove} aria-label={`${t.settings.deptRemove}: ${department.name}`} onClick={() => { setDialogError(null); setRemoveIndex(index); }}><Trash2 size={14} /></button> : null}</div>)}</div> : <div className="settings-empty"><MailPlus size={18} /><strong>{t.settings.deptNone}</strong><p>{nl ? "Voeg een afdeling toe om een klantvraag vanuit de inbox door te sturen." : "Add a department to forward a customer question from the inbox."}</p></div>}

      {showForm && canManage ? <div className="settings-inline-form"><div className="settings-grid-2"><Field label={t.settings.deptNameLabel}><input className="settings-control" value={name} onChange={(event) => { setName(event.target.value); setFormError(null); }} placeholder={t.settings.deptNamePlaceholder} /></Field><Field label={t.settings.deptEmailLabel}><input className="settings-control" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setFormError(null); }} placeholder={t.settings.deptEmailPlaceholder} /></Field></div>{formError ? <p className="settings-error" role="alert">{formError}</p> : null}<div className="settings-actions"><button className="settings-btn primary" disabled={busy} onClick={() => void add()}>{busy ? <Loader2 className="settings-spin" size={14} /> : <Plus size={14} />}{t.settings.deptAddBtn.replace("+ ", "")}</button><button className="settings-btn" disabled={busy} onClick={() => { setShowForm(false); setFormError(null); }}>{t.common.cancel}</button></div></div> : null}
    </Section>
    {removeIndex != null ? <ConfirmDialog title={nl ? "Afdeling verwijderen?" : "Remove department?"} description={nl ? `Je kunt daarna niets meer doorsturen naar ${departments[removeIndex]?.name}.` : `You can no longer forward to ${departments[removeIndex]?.name}.`} confirmLabel={t.settings.deptRemove} danger busy={busy} error={dialogError} onCancel={() => { if (!busy) { setRemoveIndex(null); setDialogError(null); } }} onConfirm={() => void remove()} /> : null}
  </div>;
}
