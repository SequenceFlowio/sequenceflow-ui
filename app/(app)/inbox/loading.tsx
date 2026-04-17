import type { CSSProperties } from "react";

const shimmerStyle: CSSProperties = {
  background: "linear-gradient(90deg, var(--sf-surface) 25%, var(--sf-surface-2) 50%, var(--sf-surface) 75%)",
  backgroundSize: "400% 100%",
  animation: "shimmer 1.5s ease-in-out infinite",
  borderRadius: 10,
};

export default function InboxLoading() {
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 24px 56px" }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap", marginBottom: 28 }}>
        <div style={{ maxWidth: 720 }}>
          <div style={{ ...shimmerStyle, width: 70, height: 12, marginBottom: 12 }} />
          <div style={{ ...shimmerStyle, width: 280, height: 32, marginBottom: 12 }} />
          <div style={{ ...shimmerStyle, width: 520, height: 14, marginBottom: 8 }} />
          <div style={{ ...shimmerStyle, width: 480, height: 14 }} />
        </div>
        <div style={{ width: 340, border: "1px solid var(--sf-border)", borderRadius: 16, background: "var(--sf-surface)", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--sf-border)" }}>
            <div style={{ ...shimmerStyle, width: 160, height: 12 }} />
          </div>
          <div style={{ padding: 18, display: "grid", gap: 12 }}>
            <div style={{ ...shimmerStyle, width: "100%", height: 14 }} />
            <div style={{ ...shimmerStyle, width: "78%", height: 14 }} />
          </div>
        </div>
      </div>

      <div style={{ border: "1px solid var(--sf-border)", borderRadius: 20, background: "linear-gradient(180deg, rgba(199,245,111,0.06), rgba(199,245,111,0.02))", padding: 22, marginBottom: 28 }}>
        <div style={{ ...shimmerStyle, width: 120, height: 12, marginBottom: 12 }} />
        <div style={{ ...shimmerStyle, width: 260, height: 24, marginBottom: 12 }} />
        <div style={{ ...shimmerStyle, width: "72%", height: 14, marginBottom: 8 }} />
        <div style={{ ...shimmerStyle, width: "66%", height: 14, marginBottom: 18 }} />
        <div style={{ display: "grid", gap: 12 }}>
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} style={{ border: "1px solid var(--sf-border)", borderRadius: 16, background: "var(--sf-surface)", padding: "16px 18px", display: "flex", gap: 14, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 14, flex: 1, minWidth: 220 }}>
                <div style={{ ...shimmerStyle, width: 40, height: 40, borderRadius: 12 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                    <div style={{ ...shimmerStyle, width: 160, height: 14 }} />
                    <div style={{ ...shimmerStyle, width: 70, height: 20, borderRadius: 6 }} />
                  </div>
                  <div style={{ ...shimmerStyle, width: "90%", height: 12, marginBottom: 8 }} />
                  <div style={{ ...shimmerStyle, width: "76%", height: 12 }} />
                </div>
              </div>
              <div style={{ ...shimmerStyle, width: 100, height: 40, borderRadius: 12 }} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "inline-flex", gap: 8, padding: 4, border: "1px solid var(--sf-border)", borderRadius: 16, background: "var(--sf-surface)", marginBottom: 18 }}>
        {[102, 86, 118].map((width) => (
          <div key={width} style={{ ...shimmerStyle, width, height: 40, borderRadius: 12 }} />
        ))}
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} style={{ border: "1px solid var(--sf-border)", borderRadius: 18, background: "var(--sf-surface)", padding: 18, boxShadow: "0 16px 36px rgba(15, 23, 42, 0.03)" }}>
            <div style={{ ...shimmerStyle, width: "100%", height: 4, borderRadius: 999, marginBottom: 16 }} />
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 220px", gap: 18 }}>
              <div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
                  <div style={{ ...shimmerStyle, width: 120, height: 14 }} />
                  <div style={{ ...shimmerStyle, width: 4, height: 4, borderRadius: 999 }} />
                  <div style={{ ...shimmerStyle, width: 160, height: 12 }} />
                  <div style={{ ...shimmerStyle, width: 4, height: 4, borderRadius: 999 }} />
                  <div style={{ ...shimmerStyle, width: 84, height: 12 }} />
                </div>
                <div style={{ ...shimmerStyle, width: "52%", height: 18, marginBottom: 10 }} />
                <div style={{ ...shimmerStyle, width: "82%", height: 14, marginBottom: 8 }} />
                <div style={{ ...shimmerStyle, width: "68%", height: 12 }} />
              </div>
              <div style={{ display: "grid", gap: 12, justifyItems: "end" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ ...shimmerStyle, width: 84, height: 24, borderRadius: 6 }} />
                  <div style={{ ...shimmerStyle, width: 104, height: 24, borderRadius: 6 }} />
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ ...shimmerStyle, width: 90, height: 12 }} />
                  <div style={{ ...shimmerStyle, width: 92, height: 24, borderRadius: 6 }} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
