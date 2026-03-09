"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

type Tab = "policy" | "integrations" | "team";

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

type IntegrationInfo = { connected: boolean; account_email: string | null; status: string };

export default function SettingsPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab]     = useState<Tab>(() =>
    searchParams.get("tab") === "integrations" ? "integrations" : "policy"
  );
  const [allowDiscount, setAllow]     = useState(false);
  const [maxDiscount, setMaxDiscount] = useState("");
  const [threshold, setThreshold]     = useState("0.60");
  const [signature, setSignature]     = useState("");

  // Integration status
  const [integrations, setIntegrations] = useState<Record<string, IntegrationInfo>>({});
  const [banner, setBanner]             = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error     = searchParams.get("error");
    if (connected === "gmail") {
      setBanner({ type: "success", message: "Gmail connected successfully." });
    } else if (error) {
      const messages: Record<string, string> = {
        access_denied:        "Access denied — you cancelled the Google sign-in.",
        invalid_callback:     "Invalid OAuth callback. Please try again.",
        invalid_state:        "OAuth state mismatch. Please try again.",
        token_exchange_failed:"Failed to exchange OAuth token. Please try again.",
        userinfo_failed:      "Could not retrieve your Google account info.",
        db_error:             "Failed to save integration. Please try again.",
      };
      setBanner({ type: "error", message: messages[error] ?? `OAuth error: ${error}` });
    }
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/integrations/status")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.integrations) setIntegrations(data.integrations); })
      .catch(() => {});
  }, []);

  const TABS: { id: Tab; label: string }[] = [
    { id: "policy",       label: t.settings.tabPolicy       },
    { id: "integrations", label: t.settings.tabIntegrations },
    { id: "team",         label: t.settings.tabTeam         },
  ];

  return (
    <div className="mx-auto max-w-screen-md px-4 py-10 sm:px-6 lg:px-10 lg:py-12">

      {/* Page header */}
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
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                padding: "8px 18px", border: "none", background: "transparent",
                cursor: "pointer", fontSize: "13px",
                fontWeight: activeTab === id ? 600 : 400,
                color: activeTab === id ? "var(--text)" : "var(--muted)",
                borderBottom: activeTab === id ? "2px solid #B4F000" : "2px solid transparent",
                marginBottom: "-1px", transition: "all 0.15s", whiteSpace: "nowrap",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Policy tab ── */}
      {activeTab === "policy" && (
        <div className="flex flex-col gap-6 max-w-lg">

          {/* Allow discount toggle */}
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
                cursor: "pointer", position: "relative", transition: "background 0.15s", marginTop: "2px",
              }}
            >
              <span style={{
                position: "absolute", top: "3px",
                left: allowDiscount ? "20px" : "3px",
                width: "16px", height: "16px", borderRadius: "50%",
                background: allowDiscount ? "#0B1220" : "#6B7280",
                transition: "left 0.15s",
              }} />
            </button>
          </div>

          {/* Max discount */}
          <div>
            <Label>{t.settings.maxDiscount}</Label>
            <input
              type="number"
              value={maxDiscount}
              onChange={(e) => setMaxDiscount(e.target.value)}
              placeholder="e.g. 25"
              disabled={!allowDiscount}
              style={{ ...inputStyle, opacity: allowDiscount ? 1 : 0.4, cursor: allowDiscount ? "text" : "not-allowed" }}
            />
          </div>

          {/* Confidence threshold */}
          <div>
            <Label>{t.settings.confidenceThreshold}</Label>
            <input
              type="number" min="0" max="1" step="0.05"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              style={inputStyle}
            />
            <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "5px" }}>
              {t.settings.confidenceThresholdDesc}
            </p>
          </div>

          {/* Signature */}
          <div>
            <Label>{t.settings.emailSignature}</Label>
            <textarea
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              rows={4}
              placeholder={"e.g. Kind regards,\nThe Support Team"}
              style={inputStyle}
            />
          </div>

          <button style={{
            alignSelf: "flex-start", padding: "10px 24px", borderRadius: "8px",
            border: "none", background: "#B4F000", color: "#0B1220",
            fontSize: "13px", fontWeight: 600, cursor: "pointer",
          }}>
            {t.settings.save}
          </button>
        </div>
      )}

      {/* ── Integrations tab ── */}
      {activeTab === "integrations" && (
        <div className="flex flex-col gap-3">

          {/* Banner */}
          {banner && (
            <div style={{
              padding: "12px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 500,
              background: banner.type === "success" ? "rgba(180,240,0,0.12)" : "rgba(239,68,68,0.12)",
              border: `1px solid ${banner.type === "success" ? "rgba(180,240,0,0.35)" : "rgba(239,68,68,0.35)"}`,
              color: banner.type === "success" ? "#B4F000" : "#f87171",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
            }}>
              <span>{banner.message}</span>
              <button
                onClick={() => setBanner(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: "16px", lineHeight: 1, padding: 0 }}
              >
                ×
              </button>
            </div>
          )}

          {/* Gmail */}
          {(() => {
            const gmail = integrations["gmail"];
            return (
              <div
                className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px 24px" }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                    <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text)", margin: 0 }}>
                      {t.settings.gmailTitle}
                    </p>
                    {gmail?.connected && (
                      <span style={{
                        fontSize: "10px", fontWeight: 700,
                        background: "rgba(180,240,0,0.15)", color: "#B4F000",
                        borderRadius: "4px", padding: "1px 6px", letterSpacing: "0.04em",
                      }}>
                        CONNECTED
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0 }}>
                    {gmail?.connected && gmail.account_email
                      ? gmail.account_email
                      : t.settings.gmailDesc}
                  </p>
                </div>
                <a
                  href="/api/integrations/google/start"
                  style={{
                    flexShrink: 0, padding: "8px 18px", borderRadius: "8px",
                    border: "1px solid var(--border)", background: "transparent",
                    color: "var(--text)", fontSize: "13px", fontWeight: 500,
                    cursor: "pointer", textDecoration: "none", display: "inline-block",
                  }}
                >
                  {gmail?.connected ? "Reconnect" : t.settings.connectGmail}
                </a>
              </div>
            );
          })()}

          {/* Bol.com */}
          <div
            className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px 24px", opacity: 0.6 }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text)", margin: 0 }}>
                  {t.settings.bolTitle}
                </p>
                <span style={{
                  fontSize: "10px", fontWeight: 700,
                  background: "var(--border)", color: "var(--muted)",
                  borderRadius: "4px", padding: "1px 5px", letterSpacing: "0.04em",
                }}>
                  SOON
                </span>
              </div>
              <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0 }}>
                {t.settings.bolDesc}
              </p>
            </div>
            <button
              disabled
              style={{
                flexShrink: 0, padding: "8px 18px", borderRadius: "8px",
                border: "1px solid var(--border)", background: "transparent",
                color: "var(--muted)", fontSize: "13px", fontWeight: 500,
                cursor: "not-allowed", opacity: 0.5,
              }}
            >
              Connect
            </button>
          </div>

        </div>
      )}

      {/* ── Team tab ── */}
      {activeTab === "team" && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", overflow: "hidden" }}>
          <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase", margin: 0, display: "block", padding: "14px 20px 0" }}>
            {t.settings.teamMembers}
          </p>

          <div className="overflow-x-auto">
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
              padding: "10px 20px", borderBottom: "1px solid var(--border)", minWidth: "360px",
            }}>
              {[t.settings.colName, t.settings.colEmail, t.settings.colRole].map((h) => (
                <span key={h} style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  {h}
                </span>
              ))}
            </div>
          </div>

          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
              {t.settings.noTeamMembers}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
