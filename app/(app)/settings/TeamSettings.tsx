"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, UserPlus, Users } from "lucide-react";

import { ConfirmDialog, Field, Notice, Section, SettingsSkeleton } from "./SettingsUi";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { useUpgradeModal } from "@/lib/upgradeModal";

type Member = { user_id: string; email: string | null; name: string | null; role: "admin" | "agent"; status: "active" | "invited"; isCurrentUser: boolean };
type TeamResponse = { members: Member[]; currentUserId: string; canManage: boolean; seats: { used: number; limit: number | null } };

function initials(member: Member) {
  const source = member.name?.trim() || member.email?.split("@")[0] || "?";
  const parts = source.split(/\s+/);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)?.[0] ?? ""}` : source.slice(0, 2)).toUpperCase();
}

export default function TeamSettings() {
  const { t, language } = useTranslation();
  const { open: openUpgrade } = useUpgradeModal();
  const [team, setTeam] = useState<TeamResponse | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"agent" | "admin">("agent");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [removeMember, setRemoveMember] = useState<Member | null>(null);
  const nl = language === "nl";

  async function load() {
    setLoadError(false);
    try {
      const response = await fetch("/api/team/members", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setTeam(await response.json());
    } catch { setLoadError(true); }
  }
  useEffect(() => { void load(); }, []);

  const activeCount = team?.members.filter((member) => member.status === "active").length ?? 0;
  const invitedCount = team?.members.filter((member) => member.status === "invited").length ?? 0;
  const adminCount = team?.members.filter((member) => member.role === "admin").length ?? 0;
  const atLimit = Boolean(team?.seats.limit != null && team.seats.used >= team.seats.limit);
  const sortedMembers = useMemo(() => [...(team?.members ?? [])].sort((a, b) => Number(b.isCurrentUser) - Number(a.isCurrentUser) || a.status.localeCompare(b.status)), [team]);

  async function invite() {
    const normalized = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalized)) return setError(t.settings.teamInviteEmailErr);
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/team/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: normalized, role }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t.settings.teamInviteFailErr);
      setEmail(""); setShowInvite(false); setNotice({ tone: "success", text: nl ? `Uitnodiging verstuurd naar ${normalized}.` : `Invitation sent to ${normalized}.` }); await load();
    } catch (mutationError) { setError(mutationError instanceof Error ? mutationError.message : t.settings.teamInviteFailErr); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!removeMember) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/team/members", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: removeMember.user_id }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t.settings.teamInviteFailErr);
      setRemoveMember(null); setNotice({ tone: "success", text: nl ? "Teamlid verwijderd." : "Team member removed." }); await load();
    } catch (mutationError) { setError(mutationError instanceof Error ? mutationError.message : t.settings.teamInviteFailErr); }
    finally { setBusy(false); }
  }

  if (loadError) return <Notice tone="error" title={nl ? "Team kon niet laden" : "Team failed to load"}><button className="settings-btn" onClick={() => void load()}>{nl ? "Opnieuw proberen" : "Try again"}</button></Notice>;
  if (!team) return <SettingsSkeleton />;

  return <div className="settings-stack">
    {notice ? <Notice tone={notice.tone} onClose={() => setNotice(null)}>{notice.text}</Notice> : null}
    {!team.canManage ? <Notice tone="info" title={nl ? "Alleen-lezen" : "Read only"}>{nl ? "Alleen admins kunnen teamleden uitnodigen of verwijderen." : "Only admins can invite or remove team members."}</Notice> : null}
    <div className="settings-metrics"><div className="settings-metric"><strong>{team.seats.used} / {team.seats.limit ?? "∞"}</strong><span>{nl ? "teamplaatsen bezet" : "team seats used"}</span></div><div className="settings-metric"><strong>{activeCount}</strong><span>{nl ? "actieve leden" : "active members"}</span></div><div className="settings-metric"><strong>{invitedCount}</strong><span>{nl ? "uitgenodigd" : "invited"}</span></div></div>

    <Section icon={<Users size={18} />} title={t.settings.teamMembers} description={nl ? "Beheer wie toegang heeft tot deze SequenceFlow-workspace." : "Manage who has access to this SequenceFlow workspace."} status={<span className="settings-status success">{team.members.length} {nl ? "leden" : "members"}</span>}>
      <div className="settings-list">{sortedMembers.map((member) => {
        const protectedMember = member.isCurrentUser || (member.role === "admin" && adminCount <= 1);
        const reason = member.isCurrentUser ? (nl ? "Je kunt je eigen account niet verwijderen." : "You cannot remove your own account.") : (nl ? "Een workspace moet minimaal één admin houden." : "A workspace must retain at least one admin.");
        return <div className="settings-list-row" key={member.user_id}><div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}><span style={{ width: 34, height: 34, display: "grid", placeItems: "center", flex: "none", borderRadius: "50%", background: "#eff8df", color: "#527717", fontSize: 11, fontWeight: 850 }}>{initials(member)}</span><div style={{ minWidth: 0 }}><div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}><strong style={{ color: "var(--text)", fontSize: 13 }}>{member.name || member.email || "–"}</strong>{member.isCurrentUser ? <span className="settings-status success">{nl ? "Jij" : "You"}</span> : null}<span className={`settings-status ${member.status === "invited" ? "warning" : ""}`}>{member.status === "invited" ? (nl ? "Uitgenodigd" : "Invited") : (nl ? "Actief" : "Active")}</span></div><span style={{ display: "block", marginTop: 3, color: "var(--muted)", fontSize: 11, overflowWrap: "anywhere" }}>{member.email ?? "–"} · {member.role === "admin" ? t.settings.teamRoleAdmin : t.settings.teamRoleAgent}</span></div></div>{team.canManage ? <button type="button" className="settings-btn danger" disabled={protectedMember} title={protectedMember ? reason : t.settings.teamRemove} aria-label={`${t.settings.teamRemove}: ${member.email}`} onClick={() => setRemoveMember(member)}><Trash2 size={14} /></button> : null}</div>;
      })}</div>

      {team.canManage && !showInvite ? atLimit ? <Notice tone="warning" title={nl ? "Teamlimiet bereikt" : "Team limit reached"}>{nl ? "Upgrade je plan om meer teamleden toe te voegen." : "Upgrade your plan to add more team members."} <button className="settings-btn ghost" onClick={() => openUpgrade()}>{nl ? "Bekijk plannen" : "View plans"}</button></Notice> : <button className="settings-btn primary" onClick={() => setShowInvite(true)}><UserPlus size={14} />{t.settings.teamInviteTitle}</button> : null}

      {showInvite && team.canManage ? <div style={{ display: "grid", gap: 12, paddingTop: 4 }}><div className="settings-grid-2"><Field label={t.settings.teamEmailLabel}><input className="settings-control" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(null); }} placeholder={t.settings.teamEmailPlaceholder} /></Field><Field label={t.settings.teamRoleLabel} help={nl ? "Agents behandelen tickets. Admins beheren ook instellingen, integraties en teamleden." : "Agents handle tickets. Admins also manage settings, integrations, and team members."}><select className="settings-control" value={role} onChange={(event) => setRole(event.target.value as "agent" | "admin")}><option value="agent">{t.settings.teamRoleAgent}</option><option value="admin">{t.settings.teamRoleAdmin}</option></select></Field></div>{error ? <p className="settings-error" role="alert">{error}</p> : null}<div style={{ display: "flex", gap: 8 }}><button className="settings-btn primary" disabled={busy} onClick={() => void invite()}>{busy ? <Loader2 className="settings-spin" size={14} /> : <Plus size={14} />}{t.settings.teamInviteBtn}</button><button className="settings-btn" disabled={busy} onClick={() => { setShowInvite(false); setError(null); }}>{t.common.cancel}</button></div></div> : null}
    </Section>
    {removeMember ? <><ConfirmDialog title={t.settings.teamRemoveTitle} description={t.settings.teamRemoveSubtitle.replace("{email}", removeMember.email ?? "–")} confirmLabel={t.settings.teamRemoveConfirm} danger busy={busy} onCancel={() => { if (!busy) { setRemoveMember(null); setError(null); } }} onConfirm={() => void remove()} />{error ? <div style={{ position: "fixed", zIndex: 10001, left: "50%", bottom: 24, transform: "translateX(-50%)" }}><Notice tone="error">{error}</Notice></div> : null}</> : null}
  </div>;
}
