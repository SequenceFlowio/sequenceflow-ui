"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { useUpgradeModal } from "@/lib/upgradeModal";

type Tab = "policy" | "integrations" | "team" | "escalation" | "billing";

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

function SettingsContent() {
  const { t } = useTranslation();
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
  const [allowDiscount, setAllow]     = useState(false);
  const [maxDiscount, setMaxDiscount] = useState("");
  const [threshold, setThreshold]     = useState("0.60");
  const [signature, setSignature]     = useState("");
  const [saveState, setSaveState]     = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Integrations
  const [integrations, setIntegrations] = useState<Record<string, IntegrationInfo>>({});
  const [banner, setBanner]             = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

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
        setDepartments(c.escalationDepartments ?? []);
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
      setInviteError("Vul een geldig e-mailadres in.");
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
        setInviteError(data.error ?? "Uitnodigen mislukt.");
        setInviteState("error");
      } else {
        setInviteState("sent");
        setInviteEmail("");
        loadMembers();
      }
    } catch {
      setInviteState("error");
      setInviteError("Uitnodigen mislukt. Probeer opnieuw.");
    } finally {
      setTimeout(() => setInviteState("idle"), 3000);
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!window.confirm("Weet je zeker dat je dit teamlid wilt verwijderen?")) return;
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
          escalationDepartments: departments,
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
    if (!newDeptName.trim()) { setAddError("Vul een naam in."); return; }
    if (!newDeptEmail.trim() || !newDeptEmail.includes("@")) { setAddError("Vul een geldig e-mailadres in."); return; }
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

  function fetchIntegrations() {
    fetch("/api/integrations/status")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.integrations) setIntegrations(data.integrations); })
      .catch(() => {});
  }
  useEffect(() => { fetchIntegrations(); }, []);

  async function handleDisconnect() {
    if (!window.confirm("Weet je zeker dat je Gmail wilt loskoppelen?")) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/integrations/gmail/disconnect", { method: "POST" });
      if (res.ok) {
        fetchIntegrations();
        setBanner({ type: "success", message: "Gmail losgekoppeld." });
      } else {
        setBanner({ type: "error", message: "Loskoppelen mislukt. Probeer opnieuw." });
      }
    } finally {
      setDisconnecting(false);
    }
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "policy",       label: t.settings.tabPolicy       },
    { id: "integrations", label: t.settings.tabIntegrations },
    { id: "escalation",   label: "Escalatie"                },
    { id: "team",         label: t.settings.tabTeam         },
    { id: "billing",      label: "Facturering"              },
  ];

  const tabBtn = (id: Tab): React.CSSProperties => ({
    padding: "8px 18px", border: "none", background: "transparent",
    cursor: "pointer", fontSize: "13px",
    fontWeight: activeTab === id ? 600 : 400,
    color: activeTab === id ? "var(--text)" : "var(--muted)",
    borderBottom: activeTab === id ? "2px solid #B4F000" : "2px solid transparent",
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
                border: "none", background: allowDiscount ? "#B4F000" : "var(--border)",
                cursor: "pointer", position: "relative", transition: "background 0.2s", marginTop: "2px",
              }}
            >
              <span style={{
                position: "absolute", top: "3px",
                left: allowDiscount ? "20px" : "3px",
                width: "16px", height: "16px", borderRadius: "50%",
                background: allowDiscount ? "#0B1220" : "#6B7280",
                transition: "left 0.2s",
              }} />
            </button>
          </div>

          <div>
            <Label>{t.settings.maxDiscount}</Label>
            <input
              type="number" value={maxDiscount}
              onChange={(e) => setMaxDiscount(e.target.value)}
              placeholder="bijv. 25"
              disabled={!allowDiscount}
              style={{ ...inputStyle, opacity: allowDiscount ? 1 : 0.4, cursor: allowDiscount ? "text" : "not-allowed" }}
            />
          </div>

          <div>
            <Label>{t.settings.confidenceThreshold}</Label>
            <input
              type="number" min="0" max="1" step="0.05"
              value={threshold} onChange={(e) => setThreshold(e.target.value)}
              style={inputStyle}
            />
            <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "5px" }}>
              {t.settings.confidenceThresholdDesc}
            </p>
          </div>

          <div>
            <Label>{t.settings.emailSignature}</Label>
            <textarea
              value={signature} onChange={(e) => setSignature(e.target.value)}
              rows={4} placeholder={"Bijv. Met vriendelijke groet,\nHet Support Team"}
              style={inputStyle}
            />
          </div>

          <button
            onClick={handleSave} disabled={saveState === "saving"}
            style={{
              alignSelf: "flex-start", padding: "10px 24px", borderRadius: "8px",
              border: "none",
              background: saveState === "saved" ? "#86b800" : saveState === "error" ? "rgba(239,68,68,0.15)" : "#B4F000",
              color: saveState === "error" ? "#f87171" : "#0B1220",
              fontSize: "13px", fontWeight: 600,
              cursor: saveState === "saving" ? "not-allowed" : "pointer",
              opacity: saveState === "saving" ? 0.7 : 1,
              transition: "background 0.2s, transform 0.1s",
            }}
          >
            {saveState === "saving" ? "Opslaan…" : saveState === "saved" ? "Opgeslagen ✓" : saveState === "error" ? "Opslaan mislukt" : t.settings.save}
          </button>
        </div>
      )}

      {/* ── Integrations tab ── */}
      {activeTab === "integrations" && (
        <div className="settings-tab-content flex flex-col gap-3">
          {banner && (
            <div style={{
              padding: "12px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 500,
              background: banner.type === "success" ? "rgba(180,240,0,0.12)" : "rgba(239,68,68,0.12)",
              border: `1px solid ${banner.type === "success" ? "rgba(180,240,0,0.35)" : "rgba(239,68,68,0.35)"}`,
              color: banner.type === "success" ? "#B4F000" : "#f87171",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
            }}>
              <span>{banner.message}</span>
              <button onClick={() => setBanner(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: "16px", lineHeight: 1, padding: 0 }}>×</button>
            </div>
          )}

          {(() => {
            const gmail = integrations["gmail"];
            const gmailStatus = gmail?.status ?? null;
            const isConnected = gmailStatus === "connected" || gmailStatus === "active";
            return (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px 24px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                    <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text)", margin: 0 }}>
                      {t.settings.gmailTitle}
                    </p>
                    {isConnected && (
                      <span style={{ fontSize: "10px", fontWeight: 700, background: "rgba(180,240,0,0.15)", color: "#B4F000", borderRadius: "4px", padding: "1px 6px", letterSpacing: "0.04em" }}>
                        VERBONDEN
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0 }}>
                    {isConnected && gmail?.account_email ? gmail.account_email : t.settings.gmailDesc}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                  {isConnected && (
                    <button onClick={handleDisconnect} disabled={disconnecting}
                      style={{ padding: "8px 18px", borderRadius: "8px", border: "1px solid rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.08)", color: "#f87171", fontSize: "13px", fontWeight: 500, cursor: disconnecting ? "not-allowed" : "pointer", opacity: disconnecting ? 0.6 : 1 }}>
                      {disconnecting ? "…" : "Verwijder"}
                    </button>
                  )}
                  <a href="/api/integrations/google/start"
                    style={{ padding: "8px 18px", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "var(--text)", fontSize: "13px", fontWeight: 500, cursor: "pointer", textDecoration: "none", display: "inline-block" }}>
                    {isConnected ? "Opnieuw verbinden" : t.settings.connectGmail}
                  </a>
                </div>
              </div>
            );
          })()}

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px 24px", opacity: 0.6 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text)", margin: 0 }}>{t.settings.bolTitle}</p>
                <span style={{ fontSize: "10px", fontWeight: 700, background: "var(--border)", color: "var(--muted)", borderRadius: "4px", padding: "1px 5px", letterSpacing: "0.04em" }}>BINNENKORT</span>
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
              Escalatie-afdelingen
            </p>
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0, lineHeight: 1.55 }}>
              Voeg e-mailadressen toe voor afdelingen waarnaar geëscaleerde tickets worden doorgestuurd.
              Bij het escaleren kun je kiezen naar welke afdeling je de e-mail verzendt.
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
                    Verwijder
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
                Nog geen afdelingen toegevoegd.
              </p>
              <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0, opacity: 0.7 }}>
                Voeg hieronder een afdeling toe.
              </p>
            </div>
          )}

          {/* Add department form */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "18px 20px" }}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 14px" }}>
              Afdeling toevoegen
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <Label>Naam afdeling</Label>
                <input
                  type="text" placeholder="bijv. Finance"
                  value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddDept()}
                  style={inputStyle}
                />
              </div>
              <div>
                <Label>E-mailadres</Label>
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
                    background: "#B4F000", color: "#0B1220", fontSize: "13px", fontWeight: 600,
                    cursor: "pointer", transition: "background 0.15s, transform 0.1s",
                  }}
                >
                  + Toevoegen
                </button>
                {deptSaveState !== "idle" && (
                  <span style={{
                    fontSize: "12px", fontWeight: 500,
                    color: deptSaveState === "saved" ? "#B4F000" : deptSaveState === "error" ? "#f87171" : "var(--muted)",
                    transition: "opacity 0.2s",
                  }}>
                    {deptSaveState === "saving" ? "Opslaan…" : deptSaveState === "saved" ? "Opgeslagen ✓" : "Opslaan mislukt"}
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
              Teamlid uitnodigen
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <Label>E-mailadres</Label>
                <input
                  type="email" placeholder="naam@bedrijf.nl"
                  value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleInvite()}
                  style={inputStyle}
                />
              </div>
              <div>
                <Label>Rol</Label>
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
                    background: inviteState === "sent" ? "#86b800" : inviteState === "error" ? "rgba(239,68,68,0.15)" : "#B4F000",
                    color: inviteState === "error" ? "#f87171" : "#0B1220",
                    fontSize: "13px", fontWeight: 600,
                    cursor: inviteState === "sending" ? "not-allowed" : "pointer",
                    opacity: inviteState === "sending" ? 0.7 : 1,
                    transition: "background 0.2s",
                  }}
                >
                  {inviteState === "sending" ? "Verzenden…" : inviteState === "sent" ? "Uitnodiging verzonden ✓" : "Uitnodiging sturen"}
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
                  <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>Laden…</p>
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
                  <span style={{ fontSize: "11px", fontWeight: 600, borderRadius: "4px", padding: "2px 7px", background: m.role === "admin" ? "rgba(180,240,0,0.12)" : "var(--border)", color: m.role === "admin" ? "#B4F000" : "var(--muted)", display: "inline-block", width: "fit-content" }}>
                    {m.role}
                  </span>
                  <button
                    className="dept-remove"
                    onClick={() => handleRemoveMember(m.user_id)}
                    style={{ opacity: 0, background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", borderRadius: "6px", padding: "4px 10px", fontSize: "12px", fontWeight: 500, cursor: "pointer", transition: "opacity 0.15s" }}
                  >
                    Verwijder
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
                    Huidig plan
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em", textTransform: "capitalize" }}>
                      {usage.plan}
                    </span>
                    {usage.plan === "trial" && usage.trialEndsAt && (() => {
                      const days = Math.max(0, Math.ceil((new Date(usage.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                      return (
                        <span style={{ fontSize: "11px", fontWeight: 700, background: "rgba(251,191,36,0.15)", color: "#fbbf24", borderRadius: "4px", padding: "2px 7px" }}>
                          {days} {days === 1 ? "dag" : "dagen"} resterend
                        </span>
                      );
                    })()}
                    {usage.plan === "expired" && (
                      <span style={{ fontSize: "11px", fontWeight: 700, background: "rgba(239,68,68,0.15)", color: "#f87171", borderRadius: "4px", padding: "2px 7px" }}>
                        VERLOPEN
                      </span>
                    )}
                  </div>
                </div>
                {["starter", "pro", "agency", "custom"].includes(usage.plan) && (
                  <button
                    onClick={handlePortal} disabled={portalLoading}
                    style={{ padding: "8px 18px", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "var(--text)", fontSize: "13px", fontWeight: 500, cursor: portalLoading ? "not-allowed" : "pointer", opacity: portalLoading ? 0.6 : 1 }}
                  >
                    {portalLoading ? "…" : "Beheer abonnement"}
                  </button>
                )}
              </div>

              {/* Usage meter */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>E-mails deze maand</span>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text)" }}>
                    {usage.used} / {usage.limit === Infinity ? "∞" : usage.limit}
                  </span>
                </div>
                {usage.limit > 0 && (
                  <div style={{ height: "6px", background: "var(--border)", borderRadius: "3px", overflow: "hidden" }}>
                    {(() => {
                      const pct = Math.min(100, Math.round((usage.used / usage.limit) * 100));
                      const color = pct >= 100 ? "#f87171" : pct >= 80 ? "#fbbf24" : "#B4F000";
                      return (
                        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "3px", transition: "width 0.4s ease" }} />
                      );
                    })()}
                  </div>
                )}
                <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
                  Factuurperiode reset elke maand
                </p>
              </div>
            </div>
          )}

          {/* Plan cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
            {([
              {
                id: "starter", name: "Starter", price: "€39", recommended: false,
                features: ["250 emails / maand", "1 inbox", "2 teamleden", "Concepten ter goedkeuring"],
              },
              {
                id: "pro", name: "Pro", price: "€99", recommended: true,
                features: ["750 emails / maand", "3 inboxes", "5 teamleden", "Auto-send ✦", "Volledige analytics"],
              },
              {
                id: "agency", name: "Agency", price: "€299", recommended: false,
                features: ["2.000 emails / maand", "10 inboxes", "Onbeperkte teamleden", "Auto-send ✦", "Prioriteitsondersteuning"],
              },
            ] as const).map(plan => {
              const isCurrent = usage?.plan === plan.id;
              return (
                <div key={plan.id} style={{
                  background: "var(--surface)",
                  border: `2px solid ${isCurrent ? "#B4F000" : plan.recommended ? "rgba(180,240,0,0.25)" : "var(--border)"}`,
                  borderRadius: "14px", padding: "20px",
                  display: "flex", flexDirection: "column", gap: "12px",
                  position: "relative",
                }}>
                  {plan.recommended && !isCurrent && (
                    <span style={{
                      position: "absolute", top: "-11px", left: "50%", transform: "translateX(-50%)",
                      fontSize: "10px", fontWeight: 700, background: "#B4F000", color: "#0B1220",
                      borderRadius: "4px", padding: "2px 10px", letterSpacing: "0.06em", whiteSpace: "nowrap",
                    }}>
                      AANBEVOLEN
                    </span>
                  )}
                  <div>
                    <p style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)", margin: "0 0 2px" }}>{plan.name}</p>
                    <p style={{ fontSize: "24px", fontWeight: 700, color: isCurrent ? "#B4F000" : "var(--text)", margin: 0 }}>
                      {plan.price}<span style={{ fontSize: "13px", fontWeight: 400, color: "var(--muted)" }}>/mnd</span>
                    </p>
                  </div>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "5px", flex: 1 }}>
                    {plan.features.map(f => (
                      <li key={f} style={{ fontSize: "12px", color: f.includes("✦") ? "var(--text)" : "var(--muted)", fontWeight: f.includes("✦") ? 600 : 400, display: "flex", alignItems: "center", gap: "5px" }}>
                        {f.includes("✦") && <span style={{ color: "#B4F000", fontSize: "10px" }}>✦</span>}
                        {f.replace(" ✦", "")}
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "#B4F000", textAlign: "center" }}>Huidig plan</span>
                  ) : (
                    <button
                      onClick={() => openUpgrade()}
                      style={{
                        padding: "9px 0", borderRadius: "8px",
                        background: plan.recommended ? "#B4F000" : "transparent",
                        border: plan.recommended ? "none" : "1px solid var(--border)",
                        color: plan.recommended ? "#0B1220" : "var(--text)",
                        fontSize: "13px", fontWeight: 600,
                        cursor: "pointer", transition: "background 0.15s",
                      } as React.CSSProperties}
                    >
                      Kiezen
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
              <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", margin: "0 0 2px" }}>Custom — vanaf €499/mnd</p>
              <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0 }}>Hoog volume, SLA-garanties, dedicated onboarding en maatwerk integraties.</p>
            </div>
            <a
              href="mailto:hello@sequenceflow.io?subject=Custom plan"
              style={{
                padding: "8px 18px", borderRadius: "8px", border: "1px solid var(--border)",
                color: "var(--text)", fontSize: "13px", fontWeight: 500,
                textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0,
              }}
            >
              Neem contact op →
            </a>
          </div>

          <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0 }}>
            Facturen bekijken? Ga naar het{" "}
            <button onClick={handlePortal} style={{ background: "none", border: "none", color: "#B4F000", cursor: "pointer", fontSize: "12px", padding: 0, textDecoration: "underline" }}>
              Stripe-portaal
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
