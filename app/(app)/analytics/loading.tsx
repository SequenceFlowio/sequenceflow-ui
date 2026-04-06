export default function AnalyticsLoading() {
  return (
    <div style={{ padding: "52px 44px", maxWidth: "1100px", margin: "0 auto" }}>
      <style>{`
        @keyframes shimmer {
          0% { opacity: 0.5; }
          50% { opacity: 1; }
          100% { opacity: 0.5; }
        }
        .sk { background: var(--border); border-radius: 6px; animation: shimmer 1.4s ease-in-out infinite; }
      `}</style>

      {/* Title */}
      <div className="sk" style={{ width: 160, height: 28, marginBottom: 8 }} />
      <div className="sk" style={{ width: 280, height: 14, marginBottom: 32 }} />

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 14, padding: "20px 24px",
          }}>
            <div className="sk" style={{ width: 80, height: 12, marginBottom: 12 }} />
            <div className="sk" style={{ width: 60, height: 28 }} />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 14, padding: "24px", marginBottom: 32,
      }}>
        <div className="sk" style={{ width: 140, height: 14, marginBottom: 20 }} />
        <div className="sk" style={{ width: "100%", height: 220, borderRadius: 10 }} />
      </div>

      {/* Breakdown skeleton */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 14, padding: "24px",
      }}>
        <div className="sk" style={{ width: 160, height: 14, marginBottom: 20 }} />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <div className="sk" style={{ width: 100, height: 12 }} />
              <div className="sk" style={{ width: 50, height: 12 }} />
            </div>
            <div className="sk" style={{ width: "100%", height: 6, borderRadius: 3 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
