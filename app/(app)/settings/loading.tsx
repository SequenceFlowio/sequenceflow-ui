const shimmerStyle = {
  background: "linear-gradient(90deg, var(--sf-surface) 25%, var(--sf-surface-2) 50%, var(--sf-surface) 75%)",
  backgroundSize: "400% 100%",
  animation: "shimmer 1.5s ease-in-out infinite",
  borderRadius: 10,
};

export default function SettingsLoading() {
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 24px 56px" }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @media (max-width: 768px) {
          .settings-loading-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <div style={{ maxWidth: 680, marginBottom: 28 }}>
        <div style={{ ...shimmerStyle, width: 86, height: 12, marginBottom: 12 }} />
        <div style={{ ...shimmerStyle, width: 240, height: 32, marginBottom: 12 }} />
        <div style={{ ...shimmerStyle, width: 520, height: 14, marginBottom: 8 }} />
        <div style={{ ...shimmerStyle, width: 460, height: 14 }} />
      </div>

      <div style={{ display: "inline-flex", gap: 4, padding: 4, borderRadius: 16, border: "1px solid var(--sf-border)", background: "var(--sf-surface)", marginBottom: 26 }}>
        {[112, 132, 110, 118].map((width) => (
          <div key={width} style={{ ...shimmerStyle, width, height: 40, borderRadius: 12 }} />
        ))}
      </div>

      <div className="settings-loading-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 0.8fr)", gap: 18 }}>
        <div style={{ display: "grid", gap: 18 }}>
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} style={{ border: "1px solid var(--sf-border)", borderRadius: 18, background: "var(--sf-surface)", overflow: "hidden", boxShadow: "0 16px 36px rgba(15,23,42,0.04)" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--sf-border)" }}>
                <div style={{ ...shimmerStyle, width: 140, height: 12, marginBottom: 8 }} />
                <div style={{ ...shimmerStyle, width: 220, height: 12 }} />
              </div>
              <div style={{ padding: 18, display: "grid", gap: 14 }}>
                <div style={{ ...shimmerStyle, width: "32%", height: 12 }} />
                <div style={{ ...shimmerStyle, width: "100%", height: 44, borderRadius: 10 }} />
                <div style={{ ...shimmerStyle, width: "46%", height: 12 }} />
                <div style={{ ...shimmerStyle, width: "100%", height: 44, borderRadius: 10 }} />
                <div style={{ ...shimmerStyle, width: 132, height: 48, borderRadius: 14 }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gap: 18, alignContent: "start" }}>
          <div style={{ border: "1px solid var(--sf-border)", borderRadius: 18, background: "var(--sf-surface)", overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--sf-border)" }}>
              <div style={{ ...shimmerStyle, width: 150, height: 12, marginBottom: 8 }} />
              <div style={{ ...shimmerStyle, width: 200, height: 12 }} />
            </div>
            <div style={{ padding: 18, display: "grid", gap: 12 }}>
              <div style={{ ...shimmerStyle, width: "100%", height: 42, borderRadius: 10 }} />
              <div style={{ ...shimmerStyle, width: "82%", height: 42, borderRadius: 10 }} />
              <div style={{ ...shimmerStyle, width: "100%", height: 80, borderRadius: 12 }} />
            </div>
          </div>
          <div style={{ border: "1px solid var(--sf-border)", borderRadius: 18, background: "var(--sf-surface)", padding: 18, display: "grid", gap: 12 }}>
            <div style={{ ...shimmerStyle, width: 116, height: 12 }} />
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} style={{ ...shimmerStyle, width: "100%", height: 54, borderRadius: 14 }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
