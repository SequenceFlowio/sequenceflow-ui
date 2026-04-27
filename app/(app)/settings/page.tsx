"use client";

import { useState, useEffect, Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { useUpgradeModal } from "@/lib/upgradeModal";

type Tab = "policy" | "integrations" | "team" | "escalation" | "billing";

// Convert stored UTC "HH:MM" → browser-local "HH:MM" for display
function utcToLocal(utcTime: string): string {
  const [h, m] = utcTime.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return utcTime;
  const d = new Date();
  d.setUTCHours(h, m, 0, 0);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Convert browser-local "HH:MM" → UTC "HH:MM" before saving
function localToUtc(localTime: string): string {
  const [h, m] = localTime.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return localTime;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

type Department = { name: string; email: string };
type TeamMember = { user_id: string; email: string | null; name: string | null; role: string };
type UsageInfo = { plan: string; used: number; limit: number; trialEndsAt: string | null };

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 13px",
  borderRadius: "10px",
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  transition: "border-color 120ms ease, box-shadow 120ms ease, background 120ms ease",
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "8px" }}>
      {children}
    </label>
  );
}

const pageTitleStyle: React.CSSProperties = {
  fontSize: "28px",
  fontWeight: 800,
  letterSpacing: "-0.03em",
  color: "var(--text)",
  margin: 0,
};

const pageSubtitleStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "var(--muted)",
  marginTop: "8px",
  lineHeight: 1.65,
  maxWidth: 680,
};

const segmentedWrapStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: 4,
  borderRadius: 16,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
  width: "fit-content",
  flexWrap: "wrap",
};

const sectionCardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  overflow: "hidden",
  boxShadow: "0 18px 36px rgba(15,23,42,0.035)",
};

const sectionHeaderStyle: React.CSSProperties = {
  padding: "14px 18px",
  borderBottom: "1px solid var(--border)",
  display: "grid",
  gap: 6,
  background: "var(--surface-subtle)",
};

const sectionBodyStyle: React.CSSProperties = {
  padding: "18px",
  display: "grid",
  gap: 18,
};

const eyebrowStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "11px",
  fontWeight: 700,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

function SectionCard({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section style={sectionCardStyle}>
      <div
        style={
          action
            ? { ...sectionHeaderStyle, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }
            : sectionHeaderStyle
        }
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {eyebrow ? <p style={eyebrowStyle}>{eyebrow}</p> : null}
          <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>{title}</p>
          {description ? (
            <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)", lineHeight: 1.65 }}>
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div style={{ flexShrink: 0 }}>{action}</div> : null}
      </div>
      {children ? <div style={sectionBodyStyle}>{children}</div> : null}
    </section>
  );
}

function Toggle({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        border: "none",
        background: checked ? "#C7F56F" : "var(--border)",
        cursor: disabled ? "not-allowed" : "pointer",
        position: "relative",
        transition: "background 120ms ease, opacity 120ms ease",
        opacity: disabled ? 0.45 : 1,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: 999,
          background: checked ? "#0f1a00" : "#6B7280",
          transition: "left 120ms ease",
        }}
      />
    </button>
  );
}

function TzBadge({ time1, time2 }: { time1: string; time2: string }) {
  const [showUtc, setShowUtc] = useState(false);
  const [hovered, setHovered] = useState(false);
  const tz     = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const utc1   = localToUtc(time1);
  const utc2   = localToUtc(time2);
  const label  = showUtc ? `UTC ${utc1} & ${utc2}` : tz;

  return (
    <button
      onClick={() => setShowUtc(v => !v)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: "5px",
        marginTop: "8px", padding: "4px 10px", borderRadius: "20px",
        border: `1px solid ${hovered ? "rgba(199,245,111,0.5)" : "var(--border)"}`,
        background: hovered ? "rgba(199,245,111,0.07)" : "var(--surface)",
        color: "var(--text)", fontSize: "11px", fontWeight: 500,
        cursor: "pointer", transition: "border-color 0.15s, background 0.15s",
        outline: "none", fontFamily: "inherit",
      }}
      title={showUtc ? "Click to show timezone" : "Click to show UTC times"}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
      {label}
    </button>
  );
}

function SettingsContent() {
  const { t } = useTranslation();
  const ts = t.settings;
  const searchParams = useSearchParams();
  const { open: openUpgrade } = useUpgradeModal();
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tab = searchParams.get("tab");
    if (tab === "integrations") return "integrations";
    if (tab === "escalation")   return "escalation";
    if (tab === "billing")      return "billing";
    if (tab === "team")         return "team";
    return "policy";
  });

  // Policy
  const [allowDiscount, setAllow]       = useState(false);
  const [maxDiscount, setMaxDiscount]   = useState("");
  const [signature, setSignature]       = useState("");
  const [languageDefault, setLanguageDefault] = useState("nl");
  const [saveState, setSaveState]       = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [settingsNotice, setSettingsNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Autosend
  const [autosendEnabled, setAutosendEnabled]       = useState(false);
  const [autosendThreshold, setAutosendThreshold]   = useState("0.85");
  const [autosendTime1, setAutosendTime1]           = useState("08:00");
  const [autosendTime2, setAutosendTime2]           = useState("16:00");
  const [howItWorksOpen, setHowItWorksOpen]         = useState(false);

  // Integrations
  // Escalation departments
  const [departments, setDepartments]   = useState<Department[]>([]);
  const [newDeptName, setNewDeptName]   = useState("");
  const [newDeptEmail, setNewDeptEmail] = useState("");
  const [deptSaveState, setDeptSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [addError, setAddError]         = useState("");

  // Billing
  const [usage, setUsage]               = useState<UsageInfo | null>(null);
  const [portalLoading, setPortalLoading]     = useState(false);

  // Email forwarding setup
  const [inboundEmail, setInboundEmail]   = useState("");
  const [senderEmail, setSenderEmail]     = useState("");
  const [senderName, setSenderName]       = useState("");
  const [copiedInbound, setCopiedInbound] = useState(false);
  const [copiedForwardingCode, setCopiedForwardingCode] = useState(false);
  const [senderSaveState, setSenderSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [gmailForwardingVerificationPending, setGmailForwardingVerificationPending] = useState(false);
  const [gmailForwardingVerificationCode, setGmailForwardingVerificationCode] = useState("");
  const [gmailForwardingVerificationLink, setGmailForwardingVerificationLink] = useState("");

  // Team
  const [members, setMembers]           = useState<TeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [inviteEmail, setInviteEmail]   = useState("");
  const [inviteRole, setInviteRole]     = useState("agent");
  const [inviteState, setInviteState]   = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [inviteError, setInviteError]   = useState("");
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);

  // Load config on mount
  useEffect(() => {
    fetch("/api/agent-config")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.config) return;
        const c = data.config;
        setAllow(c.allowDiscount ?? false);
        setMaxDiscount(c.maxDiscountAmount != null ? String(c.maxDiscountAmount) : "");
        setSignature(c.signature ?? "");
        setLanguageDefault(c.languageDefault ?? "nl");
        setDepartments(c.escalationDepartments ?? []);
        setAutosendEnabled(c.autosendEnabled ?? false);
        setAutosendThreshold(c.autosendThreshold != null ? String(c.autosendThreshold) : "0.85");
        setAutosendTime1(utcToLocal(c.autosendTime1 ?? "08:00"));
        setAutosendTime2(utcToLocal(c.autosendTime2 ?? "16:00"));
        setSenderEmail(c.senderEmail ?? "");
        setSenderName(c.senderName ?? "");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/integrations/email/setup")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        setInboundEmail(data.inboundEmail ?? "");
        setGmailForwardingVerificationPending(Boolean(data.gmailForwardingVerificationPending));
        setGmailForwardingVerificationCode(data.gmailForwardingVerificationCode ?? "");
        setGmailForwardingVerificationLink(data.gmailForwardingVerificationLink ?? "");
        // Intentionally do NOT touch senderEmail / senderName here.
        // `/api/agent-config` is the single source of truth for those, and
        // mounting this effect with an empty dep array means the previous
        // `if (!senderEmail)` guard always saw a stale closure value of "",
        // so it would happily overwrite the value the agent-config effect
        // had just set — making the field appear to "revert" after save.
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/billing/usage")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setUsage(data); })
      .catch(() => {});
  }, []);

  function loadMembers() {
    setMembersLoading(true);
    fetch("/api/team/members")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.members) setMembers(data.members); })
      .catch(() => {})
      .finally(() => setMembersLoading(false));
  }
  useEffect(() => { loadMembers(); }, []);

  async function handlePortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      // ignore
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleInvite() {
    setInviteError("");
    if (!inviteEmail || !inviteEmail.includes("@")) {
      setInviteError(ts.teamInviteEmailErr);
      return;
    }
    setInviteState("sending");
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error ?? ts.teamInviteFailErr);
        setInviteState("error");
      } else {
        setInviteState("sent");
        setInviteEmail("");
        loadMembers();
      }
    } catch {
      setInviteState("error");
      setInviteError(ts.teamInviteFailErr);
    } finally {
      setTimeout(() => setInviteState("idle"), 3000);
    }
  }

  async function handleRemoveMember(userId: string) {
    try {
      const res = await fetch("/api/team/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        loadMembers();
        setSettingsNotice({ type: "success", message: ts.stateSaved });
      } else {
        setSettingsNotice({ type: "error", message: ts.stateError });
      }
    } catch {
      setSettingsNotice({ type: "error", message: ts.stateError });
    }
  }

  async function handleSave() {
    if (!signature.trim()) {
      setSaveState("idle");
      setSettingsNotice({ type: "error", message: ts.signatureMissingAlert });
      return;
    }
    setSaveState("saving");
    try {
      const res = await fetch("/api/agent-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empathyEnabled:        true,
          allowDiscount,
          maxDiscountAmount:     maxDiscount ? Number(maxDiscount) : null,
          signature,
          languageDefault,
          escalationDepartments: departments,
          autosendEnabled,
          autosendThreshold:     autosendThreshold ? Number(autosendThreshold) : 0.85,
          autosendTime1: localToUtc(autosendTime1),
          autosendTime2: localToUtc(autosendTime2),
        }),
      });
      if (res.ok) {
        setSaveState("saved");
        setSettingsNotice({ type: "success", message: ts.stateSaved });
      } else {
        setSaveState("error");
        setSettingsNotice({ type: "error", message: ts.stateError });
      }
    } catch {
      setSaveState("error");
      setSettingsNotice({ type: "error", message: ts.stateError });
    } finally {
      setTimeout(() => setSaveState("idle"), 2500);
    }
  }

  async function saveDepartments(updated: Department[]) {
    setDeptSaveState("saving");
    try {
      const res = await fetch("/api/agent-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empathyEnabled:        true,
          allowDiscount,
          maxDiscountAmount:     maxDiscount ? Number(maxDiscount) : null,
          signature,
          escalationDepartments: updated,
        }),
      });
      setDeptSaveState(res.ok ? "saved" : "error");
    } catch {
      setDeptSaveState("error");
    } finally {
      setTimeout(() => setDeptSaveState("idle"), 2000);
    }
  }

  function handleAddDept() {
    setAddError("");
    if (!newDeptName.trim()) { setAddError(ts.deptNameError); return; }
    if (!newDeptEmail.trim() || !newDeptEmail.includes("@")) { setAddError(ts.deptEmailError); return; }
    const updated = [...departments, { name: newDeptName.trim(), email: newDeptEmail.trim() }];
    setDepartments(updated);
    setNewDeptName("");
    setNewDeptEmail("");
    saveDepartments(updated);
  }

  function handleRemoveDept(idx: number) {
    const updated = departments.filter((_, i) => i !== idx);
    setDepartments(updated);
    saveDepartments(updated);
  }

  async function saveSenderConfig() {
    setSenderSaveState("saving");
    try {
      const res = await fetch("/api/agent-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowDiscount:         allowDiscount,
          maxDiscountAmount:     maxDiscount ? Number(maxDiscount) : 0,
          signature:             signature,
          escalationDepartments: departments,
          autosendEnabled:       autosendEnabled,
          autosendThreshold:     Number(autosendThreshold),
          autosendTime1:         localToUtc(autosendTime1),
          autosendTime2:         localToUtc(autosendTime2),
          senderEmail:           senderEmail.trim(),
          senderName:            senderName.trim(),
        }),
      });
      if (res.ok) {
        setSenderSaveState("saved");
        setSettingsNotice({ type: "success", message: ts.stateSaved });
      } else {
        setSenderSaveState("error");
        setSettingsNotice({ type: "error", message: ts.stateError });
      }
    } catch {
      setSenderSaveState("error");
      setSettingsNotice({ type: "error", message: ts.stateError });
    } finally {
      setTimeout(() => setSenderSaveState("idle"), 2500);
    }
  }

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error     = searchParams.get("error");
    if (connected === "gmail") {
      setSettingsNotice({ type: "success", message: ts.gmailConnectedSuccessMsg });
    } else if (error) {
      const messages: Record<string, string> = {
        access_denied:         ts.oauthAccessDenied,
        invalid_callback:      ts.oauthInvalidCallback,
        invalid_state:         ts.oauthInvalidState,
        token_exchange_failed: ts.oauthTokenExchangeFailed,
        userinfo_failed:       ts.oauthUserinfoFailed,
        db_error:              ts.oauthDbError,
      };
      setSettingsNotice({ type: "error", message: messages[error] ?? `${ts.oauthGenericErrorPrefix} ${error}` });
    }
  }, [searchParams, ts]);


  const TABS: { id: Tab; label: string }[] = [
    { id: "policy",       label: ts.tabPolicy       },
    { id: "integrations", label: ts.tabIntegrations },
    { id: "escalation",   label: ts.tabEscalation   },
    { id: "team",         label: ts.tabTeam         },
    { id: "billing",      label: ts.tabBilling      },
  ];

  const tabBtn = (id: Tab): React.CSSProperties => ({
    minWidth: id === "integrations" ? 116 : 92,
    height: 40,
    borderRadius: 12,
    border: "none",
    background: activeTab === id ? "var(--surface-2)" : "transparent",
    boxShadow: activeTab === id ? "0 6px 18px rgba(15,23,42,0.08)" : "none",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: activeTab === id ? 700 : 600,
    color: activeTab === id ? "var(--text)" : "var(--muted)",
    transition: "all 120ms ease",
    whiteSpace: "nowrap" as const,
    padding: "0 14px",
  });

  const previewName = senderName.trim() || ts.senderPreviewFallbackName;
  const previewEmail = senderEmail.trim() || ts.senderEmailPlaceholder;

  return (
    <div className="mx-auto max-w-screen-md px-4 py-10 sm:px-6 lg:px-10 lg:py-12">

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .settings-tab-content { animation: fadeSlideIn 0.2s ease; }
        .dept-row:hover .dept-remove { opacity: 1 !important; }
      `}</style>

      <div className="mb-8" style={{ display: "grid", gap: 10 }}>
        <div>
          <h1 style={pageTitleStyle}>{t.settings.title}</h1>
          <p style={pageSubtitleStyle}>{t.settings.subtitle}</p>
        </div>

        {settingsNotice && (
          <div
            style={{
              borderRadius: 14,
              border: `1px solid ${settingsNotice.type === "success" ? "rgba(199,245,111,0.28)" : "rgba(239,68,68,0.25)"}`,
              background: settingsNotice.type === "success" ? "rgba(199,245,111,0.08)" : "rgba(239,68,68,0.08)",
              color: settingsNotice.type === "success" ? "var(--tone-success-strong)" : "#f87171",
              padding: "12px 14px",
              fontSize: 13,
              lineHeight: 1.6,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <span>{settingsNotice.message}</span>
            <button
              type="button"
              onClick={() => setSettingsNotice(null)}
              style={{ border: "none", background: "transparent", color: "inherit", cursor: "pointer", fontSize: 12, fontWeight: 700 }}
            >
              {t.common.close}
            </button>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="mb-8 overflow-x-auto">
        <div className="flex min-w-max gap-3" style={segmentedWrapStyle}>
          {TABS.map(({ id, label }) => (
            <button key={id} onClick={() => setActiveTab(id)} style={tabBtn(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Policy tab ── */}
      {activeTab === "policy" && (
        <div className="settings-tab-content flex flex-col gap-6 max-w-2xl">
          <SectionCard
            title={ts.allowDiscount}
            description={ts.allowDiscountDesc}
            action={<Toggle checked={allowDiscount} onChange={() => setAllow(!allowDiscount)} />}
          >
            {allowDiscount ? (
              <div>
                <Label>{ts.maxDiscount}</Label>
                <input
                  type="number"
                  value={maxDiscount}
                  onChange={(e) => setMaxDiscount(e.target.value)}
                  placeholder={ts.maxDiscountPlaceholder}
                  style={inputStyle}
                />
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title={ts.emailSignature}>
            <div>
              <textarea
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                rows={5}
                placeholder={ts.emailSignaturePlaceholder}
                style={{ ...inputStyle, minHeight: 160, resize: "vertical", borderColor: !signature.trim() ? "rgba(251,191,36,0.55)" : "var(--border)" }}
              />
              {!signature.trim() && (
                <p style={{ fontSize: 12, color: "#d19a00", margin: "8px 0 0", lineHeight: 1.55 }}>
                  {ts.signatureWarning}
                </p>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title={ts.replyLanguageFallbackLabel}
            description={ts.replyLanguageFallbackDesc}
          >
            <select
              value={languageDefault}
              onChange={(e) => setLanguageDefault(e.target.value)}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              {Object.entries(t.knowledge.languageOptions).map(([code, label]) => (
                <option key={code} value={code}>{label as string}</option>
              ))}
            </select>
          </SectionCard>

          {/* ── Auto-send card ── */}
          {(() => {
            const autosendAllowed = ["pro", "agency", "custom"].includes(usage?.plan ?? "");
            const ta = t.autosend;
            return (
              <section style={sectionCardStyle}>
                {/* Card header */}
                <div style={{
                  ...sectionHeaderStyle,
                  background: autosendAllowed ? "var(--surface-subtle)" : "var(--bg)",
                  borderBottom: "1px solid var(--border)",
                  display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px",
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)", margin: 0 }}>
                        {ta.title}
                      </p>
                      <span style={{
                        fontSize: "10px", fontWeight: 700, color: "#000",
                        background: "#C7F56F", borderRadius: "6px",
                        padding: "1px 8px", letterSpacing: "0.05em",
                      }}>
                        {ta.badge}
                      </span>
                    </div>
                    <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
                      {ta.description}
                    </p>
                  </div>
                  {/* Toggle — disabled if not on Pro+ */}
                  <Toggle
                    onChange={() => autosendAllowed && setAutosendEnabled(v => !v)}
                    disabled={!autosendAllowed}
                    checked={autosendEnabled && autosendAllowed}
                  />
                </div>

                {/* Locked overlay */}
                {!autosendAllowed && (
                  <div style={{ ...sectionBodyStyle, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                    <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0 }}>
                      {ta.lockedText}
                    </p>
                    <button
                      onClick={() => openUpgrade()}
                      style={{
                        flexShrink: 0, fontSize: "12px", fontWeight: 700,
                        color: "var(--tone-success)", background: "none", border: "none",
                        cursor: "pointer", padding: 0, textDecoration: "underline", whiteSpace: "nowrap",
                      }}
                    >
                      {ta.upgradeCta}
                    </button>
                  </div>
                )}

                {/* Settings — only shown when autosend enabled and on correct plan */}
                {autosendAllowed && autosendEnabled && (
                  <div style={{ ...sectionBodyStyle, display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div>
                      <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 12px", lineHeight: 1.5 }}>
                        {ta.enableDesc}
                      </p>
                    </div>

                    <div>
                      <Label>{ta.thresholdLabel}</Label>
                      <input
                        type="number" min="0.50" max="1.00" step="0.05"
                        value={autosendThreshold}
                        onChange={e => setAutosendThreshold(e.target.value)}
                        style={inputStyle}
                      />
                      <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
                        {ta.thresholdDesc}
                      </p>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <div>
                        <Label>{ta.time1Label}</Label>
                        <input
                          type="time" value={autosendTime1}
                          onChange={e => setAutosendTime1(e.target.value)}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <Label>{ta.time2Label}</Label>
                        <input
                          type="time" value={autosendTime2}
                          onChange={e => setAutosendTime2(e.target.value)}
                          style={inputStyle}
                        />
                      </div>
                    </div>
                    <TzBadge time1={autosendTime1} time2={autosendTime2} />

                    {/* How it works collapsible */}
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                      <button
                        onClick={() => setHowItWorksOpen(v => !v)}
                        style={{
                          background: "none", border: "none", padding: 0,
                          cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
                          fontSize: "12px", fontWeight: 600, color: "var(--muted)",
                        }}
                      >
                        <span style={{ transition: "transform 0.2s", display: "inline-block", transform: howItWorksOpen ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                        {ta.howItWorks}
                      </button>
                      {howItWorksOpen && (
                        <ol style={{ margin: "10px 0 0 18px", padding: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
                          {[ta.step1, ta.step2, ta.step3, ta.step4, ta.step5].map((step, i) => (
                            <li key={i} style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.5 }}>{step}</li>
                          ))}
                        </ol>
                      )}
                    </div>
                  </div>
                )}
              </section>
            );
          })()}

          <button
            onClick={handleSave} disabled={saveState === "saving"}
            style={{
              alignSelf: "flex-start", minHeight: 48, padding: "12px 24px", borderRadius: "14px",
              border: "none",
              background: saveState === "saved" ? "#a8cc50" : saveState === "error" ? "rgba(239,68,68,0.15)" : "#C7F56F",
              color: saveState === "error" ? "#f87171" : "#1a1a1a",
              fontSize: "14px", fontWeight: 800,
              cursor: saveState === "saving" ? "not-allowed" : "pointer",
              opacity: saveState === "saving" ? 0.7 : 1,
              transition: "background 0.2s, transform 0.1s, box-shadow 0.15s",
              boxShadow: "0 10px 24px rgba(199,245,111,0.25)",
            }}
          >
            {saveState === "saving" ? ts.stateSaving : saveState === "saved" ? ts.stateSaved : saveState === "error" ? ts.stateError : ts.save}
          </button>
        </div>
      )}

      {/* ── Integrations tab ── */}
      {activeTab === "integrations" && (
        <div className="settings-tab-content flex flex-col gap-6">
          <SectionCard eyebrow={ts.tabIntegrations} title={ts.forwardingTitle} description={ts.forwardingDesc}>
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Label>{ts.forwardingAddressLabel}</Label>
                <div style={{ display: "flex", alignItems: "center", gap: 10, borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg)", padding: "12px 14px" }}>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, color: "var(--text)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                    {inboundEmail || t.common.loading}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (inboundEmail) {
                        navigator.clipboard.writeText(inboundEmail);
                        setCopiedInbound(true);
                        setTimeout(() => setCopiedInbound(false), 2000);
                      }
                    }}
                    style={{
                      minHeight: 40,
                      padding: "0 14px",
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: copiedInbound ? "rgba(199,245,111,0.12)" : "transparent",
                      color: copiedInbound ? "var(--tone-success-strong)" : "var(--text)",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    {copiedInbound ? ts.forwardingCopied : ts.forwardingCopy}
                  </button>
                </div>
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
                  {ts.forwardingAddressHelp}
                </p>
              </div>
            </div>

            {gmailForwardingVerificationPending && (
              <div
                style={{
                  borderRadius: 14,
                  border: "1px solid rgba(251,191,36,0.28)",
                  background: "rgba(251,191,36,0.08)",
                  padding: 16,
                  display: "grid",
                  gap: 12,
                }}
              >
                <div style={{ display: "grid", gap: 4 }}>
                  <p style={eyebrowStyle}>{ts.forwardingVerificationEyebrow}</p>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                    {ts.forwardingVerificationTitle}
                  </p>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.65 }}>
                    {ts.forwardingVerificationDesc}
                  </p>
                </div>

                {gmailForwardingVerificationCode ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 220, borderRadius: 12, border: "1px solid rgba(251,191,36,0.22)", background: "var(--surface)", padding: "12px 14px" }}>
                      <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        {ts.forwardingVerificationCodeLabel}
                      </p>
                      <p style={{ margin: 0, fontSize: 16, fontWeight: 800, letterSpacing: "0.08em", color: "var(--text)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                        {gmailForwardingVerificationCode}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(gmailForwardingVerificationCode);
                        setCopiedForwardingCode(true);
                        setTimeout(() => setCopiedForwardingCode(false), 2000);
                      }}
                      style={{
                        minHeight: 40,
                        padding: "0 14px",
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: copiedForwardingCode ? "rgba(199,245,111,0.12)" : "var(--surface)",
                        color: copiedForwardingCode ? "var(--tone-success-strong)" : "var(--text)",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      {copiedForwardingCode ? ts.forwardingCopied : ts.forwardingVerificationCopy}
                    </button>
                  </div>
                ) : null}

                {gmailForwardingVerificationLink ? (
                  <a
                    href={gmailForwardingVerificationLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      minHeight: 40,
                      width: "fit-content",
                      padding: "0 14px",
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                      color: "var(--text)",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {ts.forwardingVerificationOpenLink}
                  </a>
                ) : null}
              </div>
            )}

            <div style={{ borderRadius: 16, border: "1px solid rgba(199,245,111,0.18)", background: "linear-gradient(180deg, rgba(199,245,111,0.06), rgba(199,245,111,0.02))", padding: 18, display: "grid", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "grid", gap: 4 }}>
                  <p style={eyebrowStyle}>{ts.forwardingGuideEyebrow}</p>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{ts.forwardingGuideTitle}</p>
                </div>
                <a
                  href="https://mail.google.com/mail/u/0/#settings/fwdandpop"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    minHeight: 40,
                    padding: "0 14px",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    color: "var(--text)",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {ts.forwardingOpenGmail}
                </a>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 6,
                  padding: "14px 16px",
                  borderRadius: 14,
                  border: "1px solid rgba(199,245,111,0.24)",
                  background: "rgba(199,245,111,0.1)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 22,
                      height: 22,
                      borderRadius: 999,
                      background: "rgba(199,245,111,0.28)",
                      color: "var(--tone-success-strong)",
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    !
                  </span>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                    {ts.forwardingGuideNoticeTitle}
                  </p>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.65 }}>
                  {ts.forwardingGuideNoticeDesc}
                </p>
              </div>

              {[
                { title: ts.forwardingStep1Title, desc: ts.forwardingStep1Desc },
                { title: ts.forwardingStep2Title, desc: ts.forwardingStep2Desc },
                { title: ts.forwardingStep3Title, desc: ts.forwardingStep3Desc },
                { title: ts.forwardingStep4Title, desc: ts.forwardingStep4Desc.replace("{address}", inboundEmail || "…") },
              ].map((step, i) => (
                <div key={step.title} style={{ display: "grid", gridTemplateColumns: "28px minmax(0,1fr)", gap: 12, alignItems: "start" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "var(--text)" }}>
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div style={{ display: "grid", gap: 3 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{step.title}</p>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.65 }}>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard eyebrow={ts.senderTitle} title={ts.senderTitle} description={ts.senderDesc}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(260px,0.9fr)", gap: 18 }}>
              <div style={{ display: "grid", gap: 14 }}>
                <div>
                  <Label>{ts.senderNameLabel}</Label>
                  <input type="text" value={senderName} onChange={e => setSenderName(e.target.value)} placeholder={ts.senderNamePlaceholder} style={inputStyle} />
                </div>
                <div>
                  <Label>{ts.senderEmailLabel}</Label>
                  <input type="email" value={senderEmail} onChange={e => setSenderEmail(e.target.value)} placeholder={ts.senderEmailPlaceholder} style={inputStyle} />
                  <p style={{ fontSize: 12, color: "var(--muted)", margin: "8px 0 0", lineHeight: 1.6 }}>{ts.senderHelp}</p>
                </div>
              </div>

              <div style={{ border: "1px solid var(--border)", borderRadius: 14, background: "var(--bg)", overflow: "hidden" }}>
                <div style={sectionHeaderStyle}>
                  <p style={eyebrowStyle}>{ts.senderPreviewLabel}</p>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.65 }}>{ts.senderPreviewDescription}</p>
                </div>
                <div style={{ padding: 18, display: "grid", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(199,245,111,0.18)", color: "var(--tone-success-strong)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 }}>
                      {previewName.slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{previewName}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{previewEmail}</p>
                    </div>
                  </div>
                  <div style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", padding: "12px 14px", fontSize: 13, color: "var(--muted)", lineHeight: 1.65 }}>
                    {ts.senderPreviewPrefix} <strong style={{ color: "var(--text)" }}>{previewName}</strong> {ts.senderPreviewConnector} <strong style={{ color: "var(--text)" }}>{previewEmail}</strong>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={saveSenderConfig}
              disabled={senderSaveState === "saving"}
              style={{
                alignSelf: "flex-start",
                minHeight: 48,
                padding: "12px 24px",
                borderRadius: 14,
                border: "none",
                background: senderSaveState === "saved" ? "#a8cc50" : senderSaveState === "error" ? "rgba(239,68,68,0.14)" : "#C7F56F",
                color: senderSaveState === "error" ? "#f87171" : "#1a1a1a",
                fontSize: 14,
                fontWeight: 800,
                cursor: senderSaveState === "saving" ? "not-allowed" : "pointer",
                opacity: senderSaveState === "saving" ? 0.7 : 1,
                boxShadow: "0 10px 24px rgba(199,245,111,0.25)",
              }}
            >
              {senderSaveState === "saving" ? ts.stateSaving : senderSaveState === "saved" ? ts.stateSaved : senderSaveState === "error" ? ts.stateError : ts.save}
            </button>
          </SectionCard>

          <section style={{ ...sectionCardStyle, opacity: 0.72 }}>
            <div style={{ ...sectionHeaderStyle, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <p style={eyebrowStyle}>{ts.bolComingSoon}</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{t.settings.bolTitle}</p>
                <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.65 }}>{t.settings.bolDesc}</p>
              </div>
              <button disabled style={{ minHeight: 40, padding: "0 14px", borderRadius: 12, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: 13, fontWeight: 700, cursor: "not-allowed", opacity: 0.55 }}>
                {ts.bolConnect}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ── Escalation tab ── */}
      {activeTab === "escalation" && (
        <div className="settings-tab-content flex flex-col gap-6 max-w-lg">
          <SectionCard eyebrow={ts.tabEscalation} title={ts.escalationTitle} description={ts.escalationDesc}>
            {departments.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {departments.map((dept, i) => (
                <div key={i} className="dept-row" style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
                  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px",
                  padding: "12px 16px", transition: "border-color 0.15s",
                }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", margin: "0 0 2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {dept.name}
                    </p>
                    <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {dept.email}
                    </p>
                  </div>
                  <button
                    className="dept-remove"
                    onClick={() => handleRemoveDept(i)}
                    style={{ opacity: 0, flexShrink: 0, background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", borderRadius: "6px", padding: "4px 10px", fontSize: "12px", fontWeight: 500, cursor: "pointer", transition: "opacity 0.15s" }}
                  >
                    {ts.deptRemove}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              padding: "28px 20px", borderRadius: "14px", textAlign: "center",
              border: "1px dashed var(--border)", background: "var(--bg)",
            }}>
              <p style={{ fontSize: "13px", color: "var(--text)", fontWeight: 700, margin: "0 0 4px" }}>
                {ts.deptNone}
              </p>
              <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
                {ts.deptNoneDesc}
              </p>
            </div>
          )}
          </SectionCard>

          <SectionCard eyebrow={ts.deptAddTitle} title={ts.deptAddTitle} description={ts.escalationDesc}>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <Label>{ts.deptNameLabel}</Label>
                <input
                  type="text" placeholder={ts.deptNamePlaceholder}
                  value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddDept()}
                  style={inputStyle}
                />
              </div>
              <div>
                <Label>{ts.deptEmailLabel}</Label>
                <input
                  type="email" placeholder={ts.deptEmailPlaceholder}
                  value={newDeptEmail} onChange={(e) => setNewDeptEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddDept()}
                  style={inputStyle}
                />
              </div>
              {addError && (
                <p style={{ fontSize: "12px", color: "#f87171", margin: 0 }}>{addError}</p>
              )}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <button
                  onClick={handleAddDept}
                  style={{
                    minHeight: 48, padding: "12px 20px", borderRadius: "14px", border: "none",
                    background: "#C7F56F", color: "#1a1a1a", fontSize: "14px", fontWeight: 800,
                    cursor: "pointer", boxShadow: "0 10px 24px rgba(199,245,111,0.24)",
                  }}
                >
                  {ts.deptAddBtn}
                </button>
                {deptSaveState !== "idle" && (
                  <span style={{
                    fontSize: "12px", fontWeight: 500,
                    color: deptSaveState === "saved" ? "#C7F56F" : deptSaveState === "error" ? "#f87171" : "var(--muted)",
                    transition: "opacity 0.2s",
                  }}>
                    {deptSaveState === "saving" ? ts.stateSaving : deptSaveState === "saved" ? ts.stateSaved : ts.stateError}
                  </span>
                )}
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── Team tab ── */}
      {activeTab === "team" && (
        <div className="settings-tab-content flex flex-col gap-6 max-w-lg">
          <SectionCard eyebrow={ts.tabTeam} title={ts.teamInviteTitle} description={ts.subtitle}>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <Label>{ts.teamEmailLabel}</Label>
                <input
                  type="email" placeholder={ts.teamEmailPlaceholder}
                  value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleInvite()}
                  style={inputStyle}
                />
              </div>
              <div>
                <Label>{ts.teamRoleLabel}</Label>
                <select
                  value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                  style={{ ...inputStyle, cursor: "pointer" }}
                >
                  <option value="agent">{ts.teamRoleAgent}</option>
                  <option value="admin">{ts.teamRoleAdmin}</option>
                </select>
              </div>
              {inviteError && (
                <p style={{ fontSize: "12px", color: "#f87171", margin: 0 }}>{inviteError}</p>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <button
                  onClick={handleInvite} disabled={inviteState === "sending"}
                  style={{
                    minHeight: 48, padding: "12px 24px", borderRadius: "14px", border: "none",
                    background: inviteState === "sent" ? "#a8cc50" : inviteState === "error" ? "rgba(239,68,68,0.15)" : "#C7F56F",
                    color: inviteState === "error" ? "#f87171" : "#1a1a1a",
                    fontSize: "14px", fontWeight: 800,
                    cursor: inviteState === "sending" ? "not-allowed" : "pointer",
                    opacity: inviteState === "sending" ? 0.7 : 1,
                    boxShadow: "0 10px 24px rgba(199,245,111,0.24)",
                  }}
                >
                  {inviteState === "sending" ? ts.teamInviteSending : inviteState === "sent" ? ts.teamInviteSent : ts.teamInviteBtn}
                </button>
              </div>
            </div>
          </SectionCard>

          <section style={sectionCardStyle}>
            <div style={sectionHeaderStyle}>
              <p style={eyebrowStyle}>{t.settings.teamMembers}</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{t.settings.teamMembers}</p>
            </div>
            <div className="overflow-x-auto">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 80px", padding: "10px 20px", borderBottom: "1px solid var(--border)", minWidth: "400px" }}>
                {[t.settings.colName, t.settings.colEmail, t.settings.colRole, ""].map((h, i) => (
                  <span key={i} style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    {h}
                  </span>
                ))}
              </div>
              {membersLoading && (
                <div style={{ padding: "30px 20px", textAlign: "center" }}>
                  <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>{ts.teamLoading}</p>
                </div>
              )}
              {!membersLoading && members.length === 0 && (
                <div style={{ padding: "40px 20px", textAlign: "center" }}>
                  <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>{t.settings.noTeamMembers}</p>
                </div>
              )}
              {!membersLoading && members.map(m => (
                <div key={m.user_id} className="dept-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 80px", padding: "12px 20px", borderBottom: "1px solid var(--border)", alignItems: "center", gap: "8px", minWidth: "400px" }}>
                  <span style={{ fontSize: "13px", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.name || "—"}
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.email || "—"}
                  </span>
                  <span style={{ fontSize: "11px", fontWeight: 600, borderRadius: 6, padding: "3px 9px", background: m.role === "admin" ? "rgba(199,245,111,0.18)" : "var(--surface-2)", color: m.role === "admin" ? "var(--tone-success-strong)" : "var(--muted)", display: "inline-block", width: "fit-content", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    {m.role === "admin" ? ts.teamRoleAdmin : ts.teamRoleAgent}
                  </span>
                  <button
                    className="dept-remove"
                    onClick={() => setMemberToRemove(m)}
                    style={{ opacity: 0, background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", borderRadius: "6px", padding: "4px 10px", fontSize: "12px", fontWeight: 500, cursor: "pointer", transition: "opacity 0.15s" }}
                  >
                    {ts.teamRemove}
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ── Billing tab ── */}
      {activeTab === "billing" && (
        <div className="settings-tab-content flex flex-col gap-6">

          {/* Current plan + usage */}
          {usage && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginBottom: "20px", flexWrap: "wrap" }}>
                <div>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>
                    {ts.billingCurrentPlan}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em", textTransform: "capitalize" }}>
                      {usage.plan}
                    </span>
                    {usage.plan === "trial" && usage.trialEndsAt && (() => {
                      const days = Math.max(0, Math.ceil((new Date(usage.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                      return (
                        <span style={{ fontSize: "11px", fontWeight: 700, background: "rgba(251,191,36,0.15)", color: "#fbbf24", borderRadius: "4px", padding: "2px 7px" }}>
                          {days} {days === 1 ? ts.billingTrialDay : ts.billingTrialDays}
                        </span>
                      );
                    })()}
                    {usage.plan === "expired" && (
                      <span style={{ fontSize: "11px", fontWeight: 700, background: "rgba(239,68,68,0.15)", color: "#f87171", borderRadius: "4px", padding: "2px 7px" }}>
                        {ts.billingExpired}
                      </span>
                    )}
                  </div>
                </div>
                {["starter", "pro", "agency", "custom"].includes(usage.plan) && (
                  <button
                    onClick={handlePortal} disabled={portalLoading}
                    style={{ padding: "8px 18px", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "var(--text)", fontSize: "13px", fontWeight: 500, cursor: portalLoading ? "not-allowed" : "pointer", opacity: portalLoading ? 0.6 : 1 }}
                  >
                    {portalLoading ? "…" : ts.billingManage}
                  </button>
                )}
              </div>

              {/* Usage meter */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>{ts.billingEmailsMonth}</span>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text)" }}>
                    {usage.used} / {usage.limit === Infinity ? "∞" : usage.limit}
                  </span>
                </div>
                {usage.limit > 0 && (
                  <div style={{ height: "6px", background: "var(--border)", borderRadius: "3px", overflow: "hidden" }}>
                    {(() => {
                      const pct = Math.min(100, Math.round((usage.used / usage.limit) * 100));
                      const color = pct >= 100 ? "#f87171" : pct >= 80 ? "#fbbf24" : "#C7F56F";
                      return (
                        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "3px", transition: "width 0.4s ease" }} />
                      );
                    })()}
                  </div>
                )}
                <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
                  {ts.billingCycleReset}
                </p>
              </div>
            </div>
          )}

          {/* Plan cards */}
          <div className="billing-plans-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
            <style>{`@media (max-width: 640px) { .billing-plans-grid { grid-template-columns: 1fr !important; } }`}</style>
            {([
              { id: "starter" as const, name: "Starter", price: "€39", recommended: false },
              { id: "pro"     as const, name: "Pro",     price: "€99", recommended: true  },
              { id: "agency"  as const, name: "Agency",  price: "€299", recommended: false },
            ]).map(plan => {
              const isCurrent = usage?.plan === plan.id;
              const features = ts.planFeatures[plan.id];
              return (
                <div key={plan.id} style={{
                  background: "var(--surface)",
                  border: `2px solid ${isCurrent ? "#C7F56F" : plan.recommended ? "rgba(199,245,111,0.25)" : "var(--border)"}`,
                  borderRadius: "14px", padding: "20px",
                  display: "flex", flexDirection: "column", gap: "12px",
                  position: "relative",
                }}>
                  {plan.recommended && !isCurrent && (
                    <span style={{
                      position: "absolute", top: "-11px", left: "50%", transform: "translateX(-50%)",
                      fontSize: "10px", fontWeight: 700, background: "#C7F56F", color: "#1a1a1a",
                      borderRadius: "4px", padding: "2px 10px", letterSpacing: "0.06em", whiteSpace: "nowrap",
                    }}>
                      {ts.billingRecommended}
                    </span>
                  )}
                  <div>
                    <p style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)", margin: "0 0 2px" }}>{plan.name}</p>
                    <p style={{ fontSize: "24px", fontWeight: 700, color: "var(--text)", margin: 0 }}>
                      {plan.price}<span style={{ fontSize: "13px", fontWeight: 400, color: "var(--muted)" }}>{ts.billingPerMonth}</span>
                    </p>
                  </div>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "5px", flex: 1 }}>
                    {features.map(f => (
                      <li key={f} style={{ fontSize: "12px", color: f.includes("✦") ? "var(--text)" : "var(--muted)", fontWeight: f.includes("✦") ? 600 : 400, display: "flex", alignItems: "center", gap: "5px" }}>
                        {f.includes("✦") && <span style={{ color: "var(--tone-success)", fontSize: "10px" }}>✦</span>}
                        {f.replace(" ✦", "")}
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#000", background: "#C7F56F", borderRadius: "99px", padding: "3px 10px", textAlign: "center", display: "inline-block" }}>{ts.billingCurrentBadge}</span>
                  ) : (
                    <button
                      onClick={() => openUpgrade()}
                      style={{
                        padding: "9px 0", borderRadius: "8px",
                        background: plan.recommended ? "#C7F56F" : "transparent",
                        border: plan.recommended ? "none" : "1px solid var(--border)",
                        color: plan.recommended ? "#1a1a1a" : "var(--text)",
                        fontSize: "13px", fontWeight: 600,
                        cursor: "pointer", transition: "background 0.15s",
                      } as React.CSSProperties}
                    >
                      {ts.billingChoose}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Custom plan */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px",
            padding: "16px 20px", borderRadius: "12px",
            border: "1px solid var(--border)", background: "var(--surface)",
            flexWrap: "wrap",
          }}>
            <div>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", margin: "0 0 2px" }}>{ts.customTitle}</p>
              <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0 }}>{ts.customDesc}</p>
            </div>
            <a
              href="mailto:hello@sequenceflow.io?subject=Custom plan"
              style={{
                padding: "8px 18px", borderRadius: "8px", border: "1px solid var(--border)",
                color: "var(--text)", fontSize: "13px", fontWeight: 500,
                textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0,
              }}
            >
              {ts.customContact}
            </a>
          </div>

          <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0 }}>
            {ts.billingPortalText}{" "}
            <button onClick={handlePortal} style={{ background: "none", border: "none", color: "var(--tone-success)", cursor: "pointer", fontSize: "12px", padding: 0, textDecoration: "underline" }}>
              {ts.billingPortalLink}
            </button>.
          </p>
        </div>
      )}

      {memberToRemove && (
        <div
          className="sf-modal-overlay"
          onClick={() => setMemberToRemove(null)}
        >
          <div
            className="sf-modal"
            style={{ maxWidth: 480, border: "1px solid var(--border)" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sf-modal__header">
              <div className="sf-modal__header-left">
                <span className="sf-modal__icon" style={{ background: "rgba(239,68,68,0.12)" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" />
                    <path d="M8 6V4h8v2" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                </span>
                <div>
                  <p className="sf-modal__title">{ts.teamRemoveTitle}</p>
                  <p className="sf-modal__subtitle">
                    {ts.teamRemoveSubtitle.replace("{email}", memberToRemove.email ?? "—")}
                  </p>
                </div>
              </div>
              <button className="sf-modal__close" onClick={() => setMemberToRemove(null)} aria-label={t.common.close}>
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M5 5l10 10M15 5 5 15" />
                </svg>
              </button>
            </div>

            <div className="sf-modal__body" style={{ display: "grid", gap: 12 }}>
              <div style={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--bg)", padding: 14, display: "grid", gap: 4 }}>
                <p style={eyebrowStyle}>{ts.teamEmailLabel}</p>
                <p style={{ margin: 0, fontSize: 14, color: "var(--text)", lineHeight: 1.6 }}>
                  {memberToRemove.email ?? "—"}
                </p>
              </div>
            </div>

            <div className="sf-modal__footer" style={{ gap: 10 }}>
              <button
                type="button"
                onClick={() => setMemberToRemove(null)}
                style={{
                  minHeight: 42,
                  padding: "0 16px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text)",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = memberToRemove.user_id;
                  setMemberToRemove(null);
                  await handleRemoveMember(id);
                }}
                style={{
                  minHeight: 42,
                  padding: "0 16px",
                  borderRadius: 12,
                  border: "1px solid rgba(239,68,68,0.24)",
                  background: "rgba(239,68,68,0.08)",
                  color: "#f87171",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {ts.teamRemoveConfirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}
