import type { CSSProperties } from "react";

const shimmer: CSSProperties = {
  display: "block",
  background: "linear-gradient(90deg, var(--sf-surface) 25%, var(--sf-surface-2) 50%, var(--sf-surface) 75%)",
  backgroundSize: "400% 100%",
  animation: "inbox-shimmer 1.5s ease-in-out infinite",
  borderRadius: 999,
};

// Zelfde vorm als de inbox zelf: kop, tabbladen en compacte rijen.
export default function InboxLoading() {
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 24px 56px" }} role="status" aria-label="Inbox laden">
      <style>{`@keyframes inbox-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      <div style={{ ...shimmer, width: 120, height: 32, borderRadius: 10, marginBottom: 12 }} />
      <div style={{ ...shimmer, width: "min(100%, 440px)", height: 14, marginBottom: 28 }} />
      <div style={{ display: "inline-flex", gap: 6, padding: 4, border: "1px solid var(--sf-border)", borderRadius: 14, background: "var(--sf-surface)", marginBottom: 18 }}>
        {[118, 96, 104].map((width) => <div key={width} style={{ ...shimmer, width, height: 34, borderRadius: 10 }} />)}
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} style={{ display: "grid", gridTemplateColumns: "36px minmax(0,1fr) auto", gap: 14, alignItems: "start", border: "1px solid var(--sf-border)", borderRadius: 16, background: "var(--sf-surface)", padding: "16px 18px" }}>
            <div style={{ ...shimmer, width: 36, height: 36 }} />
            <div style={{ display: "grid", gap: 9, paddingTop: 2 }}>
              <div style={{ ...shimmer, width: 140, height: 12 }} />
              <div style={{ ...shimmer, width: "55%", height: 14 }} />
              <div style={{ ...shimmer, width: "80%", height: 12 }} />
            </div>
            <div style={{ ...shimmer, width: 96, height: 24 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
