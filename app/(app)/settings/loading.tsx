export default function SettingsLoading() {
  return (
    <div style={{ padding: "52px 44px", maxWidth: "760px", margin: "0 auto" }}>
      <style>{`
        @keyframes shimmer {
          0% { opacity: 0.5; }
          50% { opacity: 1; }
          100% { opacity: 0.5; }
        }
        .sk { background: var(--border); border-radius: 6px; animation: shimmer 1.4s ease-in-out infinite; }
      `}</style>

      {/* Title */}
      <div className="sk" style={{ width: 120, height: 28, marginBottom: 24 }} />

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
        {[70, 100, 90, 60, 70].map((w, i) => (
          <div key={i} className="sk" style={{ width: w, height: 34, borderRadius: 20 }} />
        ))}
      </div>

      {/* Card skeleton */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 14, padding: "24px", marginBottom: 16,
          display: "flex", flexDirection: "column", gap: 16,
        }}>
          <div className="sk" style={{ width: 140, height: 14 }} />
          <div className="sk" style={{ width: "100%", height: 40, borderRadius: 8 }} />
          <div className="sk" style={{ width: 180, height: 12 }} />
        </div>
      ))}
    </div>
  );
}
