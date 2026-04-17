const shimmerStyle = {
  background: "linear-gradient(90deg, var(--sf-surface) 25%, var(--sf-surface-2) 50%, var(--sf-surface) 75%)",
  backgroundSize: "400% 100%",
  animation: "shimmer 1.5s ease-in-out infinite",
  borderRadius: 10,
};

export default function AnalyticsLoading() {
  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: "40px 24px 56px" }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @media (max-width: 920px) {
          .analytics-loading-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
        @media (max-width: 640px) {
          .analytics-loading-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <div style={{ maxWidth: 620, marginBottom: 28 }}>
        <div style={{ ...shimmerStyle, width: 86, height: 12, marginBottom: 12 }} />
        <div style={{ ...shimmerStyle, width: 240, height: 32, marginBottom: 12 }} />
        <div style={{ ...shimmerStyle, width: 420, height: 14, marginBottom: 8 }} />
        <div style={{ ...shimmerStyle, width: 360, height: 14 }} />
      </div>

      <div className="analytics-loading-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, marginBottom: 24 }}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} style={{ border: "1px solid var(--sf-border)", borderRadius: 18, background: "var(--sf-surface)", padding: 20, boxShadow: "0 16px 34px rgba(15,23,42,0.03)" }}>
            <div style={{ ...shimmerStyle, width: 120, height: 12, marginBottom: 14 }} />
            <div style={{ ...shimmerStyle, width: 90, height: 36, marginBottom: 12 }} />
            <div style={{ ...shimmerStyle, width: "72%", height: 12 }} />
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gap: 18 }}>
        <div style={{ border: "1px solid var(--sf-border)", borderRadius: 18, background: "var(--sf-surface)", padding: 20 }}>
          <div style={{ ...shimmerStyle, width: 180, height: 12, marginBottom: 18 }} />
          <div style={{ ...shimmerStyle, width: "100%", height: 260, borderRadius: 14 }} />
        </div>

        <div style={{ border: "1px solid var(--sf-border)", borderRadius: 18, background: "var(--sf-surface)", padding: 20 }}>
          <div style={{ ...shimmerStyle, width: 190, height: 12, marginBottom: 18 }} />
          <div style={{ display: "grid", gap: 14 }}>
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ ...shimmerStyle, width: 140, height: 12 }} />
                  <div style={{ ...shimmerStyle, width: 70, height: 12 }} />
                </div>
                <div style={{ ...shimmerStyle, width: "100%", height: 6, borderRadius: 999 }} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ border: "1px solid var(--sf-border)", borderRadius: 18, background: "var(--sf-surface)", padding: 20 }}>
          <div style={{ ...shimmerStyle, width: 220, height: 12, marginBottom: 18 }} />
          <div style={{ display: "grid", gap: 12 }}>
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} style={{ border: "1px solid var(--sf-border)", borderRadius: 16, padding: 16 }}>
                <div style={{ ...shimmerStyle, width: "58%", height: 14, marginBottom: 10 }} />
                <div style={{ ...shimmerStyle, width: "90%", height: 12, marginBottom: 8 }} />
                <div style={{ ...shimmerStyle, width: "75%", height: 12 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
