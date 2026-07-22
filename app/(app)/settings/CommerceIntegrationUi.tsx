"use client";

import { AlertCircle, Check, X } from "lucide-react";
import type { ReactNode } from "react";

export type CommerceFeedback = {
  tone: "success" | "error";
  title: string;
  text: string;
  detail?: string | null;
};

export const commerceInputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 42,
  borderRadius: 7,
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  padding: "9px 11px",
  fontSize: 13,
  outline: "none",
};

export const commerceButtonStyle: React.CSSProperties = {
  minHeight: 38,
  borderRadius: 7,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  padding: "0 12px",
  fontSize: 12,
  fontWeight: 750,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  whiteSpace: "nowrap",
};

export function StatusPill({
  tone,
  label,
}: {
  tone: "success" | "warning" | "error" | "neutral";
  label: string;
}) {
  const colors = {
    success: { dot: "#70b900", bg: "rgba(124,207,0,.10)", color: "var(--tone-success-strong)" },
    warning: { dot: "#d69e00", bg: "rgba(251,191,36,.11)", color: "#9a6700" },
    error: { dot: "#ef4444", bg: "rgba(239,68,68,.09)", color: "#dc2626" },
    neutral: { dot: "#94a3b8", bg: "var(--surface-subtle)", color: "var(--muted)" },
  }[tone];

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, flexShrink: 0, borderRadius: 999, padding: "6px 9px", background: colors.bg, color: colors.color, fontSize: 10, fontWeight: 800 }}>
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: colors.dot }} />
      {label}
    </span>
  );
}

export function CommerceMetric({ label, value, detail, icon }: { label: string; value: string; detail?: string; icon?: ReactNode }) {
  return (
    <div style={{ minWidth: 0, padding: "2px 16px 2px 0", display: "grid", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted)" }}>
        {icon}
        <span style={{ fontSize: 10, fontWeight: 750, textTransform: "uppercase" }}>{label}</span>
      </div>
      <p style={{ margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)", fontSize: 13, fontWeight: 750 }}>{value}</p>
      {detail ? <p style={{ margin: 0, color: "var(--muted)", fontSize: 10, lineHeight: 1.45 }}>{detail}</p> : null}
    </div>
  );
}

export function FeedbackNotice({ notice, closeLabel, onClose }: { notice: CommerceFeedback; closeLabel: string; onClose: () => void }) {
  const success = notice.tone === "success";
  const Icon = success ? Check : AlertCircle;
  return (
    <div role={success ? "status" : "alert"} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "10px 0", color: success ? "var(--tone-success-strong)" : "#dc2626" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 9, minWidth: 0 }}>
        <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: "50%", background: success ? "rgba(124,207,0,.13)" : "rgba(239,68,68,.10)", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Icon size={13} strokeWidth={2.5} />
        </span>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, color: "var(--text)", fontSize: 12, fontWeight: 800 }}>{notice.title}</p>
          <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: 11, lineHeight: 1.5 }}>{notice.text}</p>
          {notice.detail ? <p style={{ margin: "3px 0 0", fontSize: 10, fontWeight: 750 }}>{notice.detail}</p> : null}
        </div>
      </div>
      <button type="button" aria-label={closeLabel} title={closeLabel} onClick={onClose} style={{ width: 26, height: 26, border: 0, background: "transparent", color: "var(--muted)", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>
        <X size={15} />
      </button>
    </div>
  );
}

export function ApprovalSwitch({ checked, disabled, label, onChange }: { checked: boolean; disabled?: boolean; label: string; onChange: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} title={label} disabled={disabled} onClick={onChange} style={{ width: 38, height: 22, borderRadius: 999, border: 0, padding: 2, background: checked ? "#C7F56F" : "var(--border)", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1, transition: "background 140ms ease", flexShrink: 0 }}>
      <span style={{ display: "block", width: 18, height: 18, borderRadius: "50%", background: checked ? "#172300" : "#fff", transform: checked ? "translateX(16px)" : "translateX(0)", transition: "transform 140ms ease", boxShadow: "0 1px 3px rgba(15,23,42,.18)" }} />
    </button>
  );
}
