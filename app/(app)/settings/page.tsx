"use client";

import { useState, useEffect, Suspense } from "react";
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
  padding: "9px 12px",
  borderRadius: "8px",
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontSize: "13px", fontWeight: 500, color: "var(--muted)", display: "block", marginBottom: "6px" }}>
      {children}
    </label>
  );
}

type IntegrationInfo = { connected: boolean; account_email: string | null; status: string | null };

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

  // Autosend
  const [autosendEnabled, setAutosendEnabled]       = useState(false);
  const [autosendThreshold, setAutosendThreshold]   = useState("0.85");
  const [autosendTime1, setAutosendTime1]           = useState("08:00");
  const [autosendTime2, setAutosendTime2]           = useState("16:00");
  const [howItWorksOpen, setHowItWorksOpen]         = useState(false);

  // Integrations
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Escalation departments
  const [departments, setDepartments]   = useState<Department[]>([]);
  const [newDeptName, setNewDeptName]   = useState("");
  const [newDeptEmail, setNewDeptEmail] = useState("");
  const [deptSaveState, setDeptSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [addError, setAddError]         = useState("");

  // Billing
  const [usage, setUsage]               = useState<UsageInfo | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading]     = useState(false);

  // Email forwarding setup
  const [inboundEmail, setInboundEmail]   = useState("");
  const [emailsReceived, setEmailsReceived] = useState(0);
  const [senderEmail, setSenderEmail]     = useState("");
  const [senderName, setSenderName]       = useState("");
  const [copiedInbound, setCopiedInbound] = useState(false);
  const [senderSaveState, setSenderSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Team
  const [members, setMembers]           = useState<TeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [inviteEmail, setInviteEmail]   = useState("");
  const [inviteRole, setInviteRole]     = useState("agent");
  const [inviteState, setInviteState]   = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [inviteError, setInviteError]   = useState("");

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
        setEmailsReceived(data.emailsReceived ?? 0);
        if (!senderEmail) setSenderEmail(data.senderEmail ?? "");
        if (!senderName)  setSenderName(data.senderName  ?? "");
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function handleCheckout(plan: string) {
    setCheckoutLoading(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      // ignore
    } finally {
      setCheckoutLoading(null);
    }
  }

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
    if (!window.confirm(ts.confirmRemoveMember)) return;
    try {
      const res = await fetch("/api/team/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) loadMembers();
    } catch {
      // ignore
    }
  }

  async function handleSave() {
    if (!signature.trim()) {
      setSaveState("idle");
      window.alert(ts.signatureMissingAlert);
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
      setSaveState(res.ok ? "saved" : "error");
    } catch {
      setSaveState("error");
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
      setSenderSaveState(res.ok ? "saved" : "error");
    } catch {
      setSenderSaveState("error");
    } finally {
      setTimeout(() => setSenderSaveState("idle"), 2500);
    }
  }

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error     = searchParams.get("error");
    if (connected === "gmail") {
      setBanner({ type: "success", message: "Gmail connected successfully." });
    } else if (error) {
      const messages: Record<string, string> = {
        access_denied:         "Access denied — you cancelled the Google sign-in.",
        invalid_callback:      "Invalid OAuth callback. Please try again.",
        invalid_state:         "OAuth state mismatch. Please try again.",
        token_exchange_failed: "Failed to exchange OAuth token. Please try again.",
        userinfo_failed:       "Could not retrieve your Google account info.",
        db_error:              "Failed to save integration. Please try again.",
      };
      setBanner({ type: "error", message: messages[error] ?? `OAuth error: ${error}` });
    }
  }, [searchParams]);


  const TABS: { id: Tab; label: string }[] = [
    { id: "policy",       label: ts.tabPolicy       },
    { id: "integrations", label: ts.tabIntegrations },
    { id: "escalation",   label: ts.tabEscalation   },
    { id: "team",         label: ts.tabTeam         },
  ];

  const tabBtn = (id: Tab): React.CSSProperties => ({
    padding: "8px 18px", border: "none", background: "transparent",
    cursor: "pointer", fontSize: "13px",
    fontWeight: activeTab === id ? 600 : 400,
    color: activeTab === id ? "var(--text)" : "var(--muted)",
    borderBottom: activeTab === id ? "2px solid #C7F56F" : "2px solid transparent",
    marginBottom: "-1px", transition: "all 0.15s", whiteSpace: "nowrap" as const,
  });

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

      <div className="mb-8">
        <h1 style={{ fontSize: "26px", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text)", margin: 0 }}>
          {t.settings.title}
        </h1>
        <p style={{ fontSize: "14px", color: "var(--muted)", marginTop: "6px" }}>
          {t.settings.subtitle}
        </p>
      </div>

      {/* Tab bar */}
      <div className="mb-8 overflow-x-auto" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex min-w-max gap-0.5">
          {TABS.map(({ id, label }) => (
            <button key={id} onClick={() => setActiveTab(id)} style={tabBtn(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Policy tab ── */}
      {activeTab === "policy" && (
        <div className="settings-tab-content flex flex-col gap-6 max-w-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text)", margin: "0 0 3px" }}>
                {t.settings.allowDiscount}
              </p>
              <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0 }}>
                {t.settings.allowDiscountDesc}
              </p>
            </div>
            <button
              onClick={() => setAllow(!allowDiscount)}
              style={{
                flexShrink: 0, width: "40px", height: "22px", borderRadius: "11px",
                border: "none", background: allowDiscount ? "#C7F56F" : "var(--border)",
                cursor: "pointer", position: "relative", transition: "background 0.2s", marginTop: "2px",
              }}
            >
              <span style={{
                position: "absolute", top: "3px",
                left: allowDiscount ? "20px" : "3px",
                width: "16px", height: "16px", borderRadius: "50%",
                background: allowDiscount ? "#1a1a1a" : "#6B7280",
                transition: "left 0.2s",
              }} />
            </button>
          </div>

          <div>
            <Label>{t.settings.maxDiscount}</Label>
            <input
              type="number" value={maxDiscount}
              onChange={(e) => setMaxDiscount(e.target.value)}
              placeholder={ts.maxDiscountPlaceholder}
              disabled={!allowDiscount}
              style={{ ...inputStyle, opacity: allowDiscount ? 1 : 0.4, cursor: allowDiscount ? "text" : "not-allowed" }}
            />
          </div>

          <div>
            <Label>{t.settings.emailSignature}</Label>
            <textarea
              value={signature} onChange={(e) => setSignature(e.target.value)}
              rows={4} placeholder={ts.emailSignaturePlaceholder}
              style={{ ...inputStyle, borderColor: !signature.trim() ? "rgba(251,191,36,0.6)" : undefined }}
            />
            {!signature.trim() && (
              <p style={{ fontSize: "12px", color: "#fbbf24", margin: "5px 0 0", display: "flex", alignItems: "center", gap: "5px" }}>
                ⚠️ {ts.signatureWarning}
              </p>
            )}
          </div>

          <div>
            <Label>{ts.replyLanguageFallbackLabel}</Label>
            <select
              value={languageDefault}
              onChange={(e) => setLanguageDefault(e.target.value)}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              {Object.entries(t.knowledge.languageOptions).map(([code, label]) => (
                <option key={code} value={code}>{label as string}</option>
              ))}
            </select>
            <p style={{ fontSize: "11px", color: "var(--muted)", margin: "5px 0 0" }}>
              {ts.replyLanguageFallbackDesc}
            </p>
          </div>

          {/* ── Auto-send card ── */}
          {(() => {
            const autosendAllowed = ["pro", "agency", "custom"].includes(usage?.plan ?? "");
            const ta = t.autosend;
            return (
              <div style={{
                border: "1px solid var(--border)", borderRadius: "12px",
                overflow: "hidden",
              }}>
                {/* Card header */}
                <div style={{
                  padding: "16px 20px",
                  background: autosendAllowed ? "var(--surface)" : "var(--bg)",
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
                        background: "#C7F56F", borderRadius: "99px",
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
                  <button
                    onClick={() => autosendAllowed && setAutosendEnabled(v => !v)}
                    disabled={!autosendAllowed}
                    style={{
                      flexShrink: 0, width: "40px", height: "22px", borderRadius: "11px",
                      border: "none",
                      background: autosendEnabled && autosendAllowed ? "#C7F56F" : "var(--border)",
                      cursor: autosendAllowed ? "pointer" : "not-allowed",
                      position: "relative", transition: "background 0.2s", marginTop: "2px",
                      opacity: autosendAllowed ? 1 : 0.5,
                    }}
                  >
                    <span style={{
                      position: "absolute", top: "3px",
                      left: autosendEnabled && autosendAllowed ? "20px" : "3px",
                      width: "16px", height: "16px", borderRadius: "50%",
                      background: autosendEnabled && autosendAllowed ? "#1a1a1a" : "#6B7280",
                      transition: "left 0.2s",
                    }} />
                  </button>
                </div>

                {/* Locked overlay */}
                {!autosendAllowed && (
                  <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                    <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0 }}>
                      {ta.lockedText}
                    </p>
                    <button
                      onClick={() => openUpgrade()}
                      style={{
                        flexShrink: 0, fontSize: "12px", fontWeight: 700,
                        color: "#3d6200", background: "none", border: "none",
                        cursor: "pointer", padding: 0, textDecoration: "underline", whiteSpace: "nowrap",
                      }}
                    >
                      {ta.upgradeCta}
                    </button>
                  </div>
                )}

                {/* Settings — only shown when autosend enabled and on correct plan */}
                {autosendAllowed && autosendEnabled && (
                  <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
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
              </div>
            );
          })()}

          <button
            onClick={handleSave} disabled={saveState === "saving"}
            style={{
              alignSelf: "flex-start", padding: "10px 24px", borderRadius: "8px",
              border: "none",
              background: saveState === "saved" ? "#a8cc50" : saveState === "error" ? "rgba(239,68,68,0.15)" : "#C7F56F",
              color: saveState === "error" ? "#f87171" : "#1a1a1a",
              fontSize: "13px", fontWeight: 600,
              cursor: saveState === "saving" ? "not-allowed" : "pointer",
              opacity: saveState === "saving" ? 0.7 : 1,
              transition: "background 0.2s, transform 0.1s",
            }}
          >
            {saveState === "saving" ? ts.stateSaving : saveState === "saved" ? ts.stateSaved : saveState === "error" ? ts.stateError : ts.save}
          </button>
        </div>
      )}

      {/* ── Integrations tab ── */}
      {activeTab === "integrations" && (
        <div className="settings-tab-content flex flex-col gap-4">

          {/* ── Email forwarding card ── */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)", margin: 0 }}>{ts.forwardingTitle}</p>
              {emailsReceived > 0 && (
                <span style={{ fontSize: "10px", fontWeight: 700, background: "#C7F56F", color: "#000", borderRadius: "99px", padding: "1px 8px", letterSpacing: "0.04em" }}>
                  {ts.forwardingActiveBadge}
                </span>
              )}
            </div>
            <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 16px" }}>
              {ts.forwardingDesc}
            </p>

            <Label>{ts.forwardingAddressLabel}</Label>
            <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
              <input
                readOnly
                value={inboundEmail || t.common.loading}
                style={{ ...inputStyle, fontFamily: "monospace", fontSize: "12px", background: "var(--bg)", color: "var(--text)", flex: 1 }}
              />
              <button
                onClick={() => {
                  if (inboundEmail) {
                    navigator.clipboard.writeText(inboundEmail);
                    setCopiedInbound(true);
                    setTimeout(() => setCopiedInbound(false), 2000);
                  }
                }}
                style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid var(--border)", background: copiedInbound ? "rgba(199,245,111,0.12)" : "var(--surface)", color: copiedInbound ? "#C7F56F" : "var(--text)", fontSize: "13px", fontWeight: 500, cursor: "pointer", flexShrink: 0, transition: "all 0.15s" }}
              >
                {copiedInbound ? ts.forwardingCopied : ts.forwardingCopy}
              </button>
            </div>

            <div style={{ background: "linear-gradient(180deg, rgba(199,245,111,0.06), rgba(199,245,111,0.02))", border: "1px solid rgba(199,245,111,0.18)", borderRadius: "14px", padding: "16px", marginBottom: "4px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <p style={{ fontSize: "11px", fontWeight: 700, color: "#8aa93a", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {ts.forwardingGuideEyebrow}
                  </p>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)", margin: 0 }}>{ts.forwardingGuideTitle}</p>
                </div>
                <a
                  href="https://mail.google.com/mail/u/0/#settings/fwdandpop"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: "11px", fontWeight: 600, color: "var(--text)",
                    background: "var(--surface)", border: "1px solid var(--border)",
                    borderRadius: "6px", padding: "4px 10px", textDecoration: "none",
                    display: "inline-flex", alignItems: "center", gap: "4px",
                    flexShrink: 0,
                  }}
                >
                  {ts.forwardingOpenGmail}
                </a>
              </div>
              {[
                {
                  title: ts.forwardingStep1Title,
                  desc: ts.forwardingStep1Desc,
                },
                {
                  title: ts.forwardingStep2Title,
                  desc: ts.forwardingStep2Desc,
                },
                {
                  title: ts.forwardingStep3Title,
                  desc: ts.forwardingStep3Desc,
                },
                {
                  title: ts.forwardingStep4Title,
                  desc: ts.forwardingStep4Desc.replace("{address}", inboundEmail || "…"),
                },
              ].map((step, i) => (
                <div key={i} style={{ display: "flex", gap: "10px", marginBottom: i < 3 ? "12px" : 0 }}>
                  <span style={{ width: "20px", height: "20px", borderRadius: "50%", background: "rgba(255,255,255,0.7)", color: "var(--text)", fontSize: "10px", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "1px", border: "1px solid var(--border)" }}>{i + 1}</span>
                  <div>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text)" }}>{step.title}</span>
                    <span style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.55 }}> — {step.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Sender config card ── */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px 24px" }}>
            <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)", margin: "0 0 4px" }}>{ts.senderTitle}</p>
            <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 16px" }}>
              {ts.senderDesc}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "440px" }}>
              <div>
                <Label>{ts.senderNameLabel}</Label>
                <input
                  type="text"
                  value={senderName}
                  onChange={e => setSenderName(e.target.value)}
                  placeholder={ts.senderNamePlaceholder}
                  style={inputStyle}
                />
              </div>
              <div>
                <Label>{ts.senderEmailLabel}</Label>
                <input
                  type="email"
                  value={senderEmail}
                  onChange={e => setSenderEmail(e.target.value)}
                  placeholder="reply@emailreply.sequenceflow.io"
                  style={inputStyle}
                />
                <p style={{ fontSize: "11px", color: "var(--muted)", margin: "5px 0 0" }}>
                  {ts.senderHelp}
                </p>
              </div>
              <button
                onClick={saveSenderConfig}
                disabled={senderSaveState === "saving"}
                style={{ alignSelf: "flex-start", padding: "8px 20px", borderRadius: "8px", border: "none", background: senderSaveState === "saved" ? "rgba(199,245,111,0.2)" : "var(--text)", color: senderSaveState === "saved" ? "#C7F56F" : "var(--bg)", fontSize: "13px", fontWeight: 600, cursor: senderSaveState === "saving" ? "not-allowed" : "pointer", opacity: senderSaveState === "saving" ? 0.6 : 1, transition: "all 0.15s" }}
              >
                {senderSaveState === "saving" ? ts.stateSaving : senderSaveState === "saved" ? ts.stateSaved : senderSaveState === "error" ? ts.stateError : ts.save}
              </button>
            </div>
          </div>

          {/* ── Bol.com coming soon ── */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px 24px", opacity: 0.6 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text)", margin: 0 }}>{t.settings.bolTitle}</p>
                <span style={{ fontSize: "10px", fontWeight: 700, background: "var(--border)", color: "var(--muted)", borderRadius: "4px", padding: "1px 5px", letterSpacing: "0.04em" }}>{ts.bolComingSoon}</span>
              </div>
              <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0 }}>{t.settings.bolDesc}</p>
            </div>
            <button disabled style={{ flexShrink: 0, padding: "8px 18px", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: "13px", fontWeight: 500, cursor: "not-allowed", opacity: 0.5 }}>
              Connect
            </button>
          </div>
        </div>
      )}

      {/* ── Escalation tab ── */}
      {activeTab === "escalation" && (
        <div className="settings-tab-content flex flex-col gap-6 max-w-lg">

          <div>
            <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text)", margin: "0 0 4px" }}>
              {ts.escalationTitle}
            </p>
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0, lineHeight: 1.55 }}>
              {ts.escalationDesc}
            </p>
          </div>

          {/* Department list */}
          {departments.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
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
              padding: "28px 20px", borderRadius: "12px", textAlign: "center",
              border: "1px dashed var(--border)", background: "transparent",
            }}>
              <p style={{ fontSize: "13px", color: "var(--muted)", margin: "0 0 4px" }}>
                {ts.deptNone}
              </p>
              <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0, opacity: 0.7 }}>
                {ts.deptNoneDesc}
              </p>
            </div>
          )}

          {/* Add department form */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "18px 20px" }}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 14px" }}>
              {ts.deptAddTitle}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <Label>{ts.deptNameLabel}</Label>
                <input
                  type="text" placeholder="bijv. Finance"
                  value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddDept()}
                  style={inputStyle}
                />
              </div>
              <div>
                <Label>{ts.deptEmailLabel}</Label>
                <input
                  type="email" placeholder="bijv. finance@bedrijf.nl"
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
                    padding: "9px 20px", borderRadius: "8px", border: "none",
                    background: "#C7F56F", color: "#1a1a1a", fontSize: "13px", fontWeight: 600,
                    cursor: "pointer", transition: "background 0.15s, transform 0.1s",
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
          </div>

        </div>
      )}

      {/* ── Team tab ── */}
      {activeTab === "team" && (
        <div className="settings-tab-content flex flex-col gap-6 max-w-lg">

          {/* Invite form */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "18px 20px" }}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 14px" }}>
              {ts.teamInviteTitle}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <Label>{ts.teamEmailLabel}</Label>
                <input
                  type="email" placeholder="naam@bedrijf.nl"
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
                  <option value="agent">Agent</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {inviteError && (
                <p style={{ fontSize: "12px", color: "#f87171", margin: 0 }}>{inviteError}</p>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <button
                  onClick={handleInvite} disabled={inviteState === "sending"}
                  style={{
                    padding: "9px 20px", borderRadius: "8px", border: "none",
                    background: inviteState === "sent" ? "#a8cc50" : inviteState === "error" ? "rgba(239,68,68,0.15)" : "#C7F56F",
                    color: inviteState === "error" ? "#f87171" : "#1a1a1a",
                    fontSize: "13px", fontWeight: 600,
                    cursor: inviteState === "sending" ? "not-allowed" : "pointer",
                    opacity: inviteState === "sending" ? 0.7 : 1,
                    transition: "background 0.2s",
                  }}
                >
                  {inviteState === "sending" ? ts.teamInviteSending : inviteState === "sent" ? ts.teamInviteSent : ts.teamInviteBtn}
                </button>
              </div>
            </div>
          </div>

          {/* Member list */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", overflow: "hidden" }}>
            <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase", margin: 0, padding: "14px 20px 0" }}>
              {t.settings.teamMembers}
            </p>
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
                  <span style={{ fontSize: "11px", fontWeight: 600, borderRadius: "99px", padding: "2px 9px", background: m.role === "admin" ? "#C7F56F" : "var(--border)", color: m.role === "admin" ? "#000" : "var(--muted)", display: "inline-block", width: "fit-content" }}>
                    {m.role}
                  </span>
                  <button
                    className="dept-remove"
                    onClick={() => handleRemoveMember(m.user_id)}
                    style={{ opacity: 0, background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", borderRadius: "6px", padding: "4px 10px", fontSize: "12px", fontWeight: 500, cursor: "pointer", transition: "opacity 0.15s" }}
                  >
                    {ts.teamRemove}
                  </button>
                </div>
              ))}
            </div>
          </div>
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
                        {f.includes("✦") && <span style={{ color: "#3d6200", fontSize: "10px" }}>✦</span>}
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
            <button onClick={handlePortal} style={{ background: "none", border: "none", color: "#3d6200", cursor: "pointer", fontSize: "12px", padding: 0, textDecoration: "underline" }}>
              {ts.billingPortalLink}
            </button>.
          </p>
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
