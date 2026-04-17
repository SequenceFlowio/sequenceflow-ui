const shimmerStyle = {
  background: "linear-gradient(90deg, var(--sf-surface) 25%, var(--sf-surface-2) 50%, var(--sf-surface) 75%)",
  backgroundSize: "400% 100%",
  animation: "shimmer 1.5s ease-in-out infinite",
  borderRadius: 10,
};

export default function KnowledgeLoading() {
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 24px 56px" }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @media (max-width: 768px) {
          .knowledge-loading-head {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
        }
      `}</style>

      <div className="knowledge-loading-head" style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-start", marginBottom: 26 }}>
        <div style={{ maxWidth: 680 }}>
          <div style={{ ...shimmerStyle, width: 84, height: 12, marginBottom: 12 }} />
          <div style={{ ...shimmerStyle, width: 300, height: 32, marginBottom: 12 }} />
          <div style={{ ...shimmerStyle, width: 460, height: 14, marginBottom: 8 }} />
          <div style={{ ...shimmerStyle, width: 360, height: 14 }} />
        </div>
        <div style={{ ...shimmerStyle, width: 164, height: 48, borderRadius: 14, flexShrink: 0 }} />
      </div>

      <div style={{ border: "1px solid var(--sf-border)", borderRadius: 18, background: "var(--sf-surface)", padding: 18, marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
          <div style={{ ...shimmerStyle, width: 180, height: 12 }} />
          <div style={{ ...shimmerStyle, width: 88, height: 12 }} />
        </div>
        <div style={{ ...shimmerStyle, width: "100%", height: 4, borderRadius: 999 }} />
      </div>

      <div style={{ border: "1px dashed rgba(199,245,111,0.22)", borderRadius: 20, background: "linear-gradient(180deg, rgba(199,245,111,0.05), rgba(199,245,111,0.02))", padding: 20, marginBottom: 18 }}>
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <div style={{ ...shimmerStyle, width: "100%", height: 42, borderRadius: 10 }} />
            <div style={{ ...shimmerStyle, width: "100%", height: 42, borderRadius: 10 }} />
          </div>
          <div style={{ ...shimmerStyle, width: "100%", height: 112, borderRadius: 16 }} />
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 160px", gap: 12 }}>
            <div style={{ ...shimmerStyle, width: "100%", height: 42, borderRadius: 10 }} />
            <div style={{ ...shimmerStyle, width: "100%", height: 42, borderRadius: 10 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div style={{ ...shimmerStyle, width: 180, height: 12 }} />
            <div style={{ ...shimmerStyle, width: 154, height: 48, borderRadius: 14 }} />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {[80, 112, 126, 100].map((width) => (
          <div key={width} style={{ ...shimmerStyle, width, height: 32, borderRadius: 12 }} />
        ))}
      </div>

      <div style={{ ...shimmerStyle, width: "100%", height: 42, borderRadius: 12, marginBottom: 14 }} />

      <div style={{ display: "grid", gap: 12 }}>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} style={{ border: "1px solid var(--sf-border)", borderRadius: 18, background: "var(--sf-surface)", padding: 18, boxShadow: "0 16px 36px rgba(15,23,42,0.03)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 16, alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                  <div style={{ ...shimmerStyle, width: 44, height: 44, borderRadius: 12 }} />
                  <div style={{ ...shimmerStyle, width: 220, height: 16 }} />
                  <div style={{ ...shimmerStyle, width: 78, height: 24, borderRadius: 6 }} />
                </div>
                <div style={{ ...shimmerStyle, width: "62%", height: 12, marginBottom: 8 }} />
                <div style={{ ...shimmerStyle, width: "48%", height: 12, marginBottom: 10 }} />
                <div style={{ display: "flex", gap: 6 }}>
                  <div style={{ ...shimmerStyle, width: 70, height: 22, borderRadius: 6 }} />
                  <div style={{ ...shimmerStyle, width: 96, height: 22, borderRadius: 6 }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ ...shimmerStyle, width: 90, height: 40, borderRadius: 12 }} />
                <div style={{ ...shimmerStyle, width: 84, height: 40, borderRadius: 12 }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
