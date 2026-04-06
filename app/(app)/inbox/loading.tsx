export default function InboxLoading() {
  return (
    <div style={{ padding: "40px 44px", maxWidth: "1100px", margin: "0 auto" }}>
      <style>{`
        @keyframes shimmer {
          0% { opacity: 0.5; }
          50% { opacity: 1; }
          100% { opacity: 0.5; }
        }
        .sk { background: var(--border); border-radius: 6px; animation: shimmer 1.4s ease-in-out infinite; }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div className="sk" style={{ width: 100, height: 28 }} />
        <div className="sk" style={{ width: 140, height: 34, borderRadius: 10 }} />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[80, 60, 80].map((w, i) => (
          <div key={i} className="sk" style={{ width: w, height: 32, borderRadius: 20 }} />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 12, padding: "16px 20px", marginBottom: 8,
          display: "flex", alignItems: "center", gap: 16,
        }}>
          <div className="sk" style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0 }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div className="sk" style={{ width: 120, height: 13 }} />
              <div className="sk" style={{ width: 70, height: 18, borderRadius: 6 }} />
            </div>
            <div className="sk" style={{ width: "60%", height: 12 }} />
          </div>
          <div className="sk" style={{ width: 60, height: 12, flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}
