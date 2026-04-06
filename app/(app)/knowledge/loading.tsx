export default function KnowledgeLoading() {
  return (
    <div style={{ padding: "52px 44px", maxWidth: "960px", margin: "0 auto" }}>
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
      <div className="sk" style={{ width: 300, height: 14, marginBottom: 24 }} />

      {/* Usage bar */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 10, padding: "12px 16px", marginBottom: 16,
      }}>
        <div className="sk" style={{ width: 120, height: 12, marginBottom: 8 }} />
        <div className="sk" style={{ width: "100%", height: 4, borderRadius: 2 }} />
      </div>

      {/* Upload card */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 14, padding: "18px 22px", marginBottom: 20,
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="sk" style={{ height: 38, borderRadius: 8 }} />
          <div className="sk" style={{ height: 38, borderRadius: 8 }} />
        </div>
        <div className="sk" style={{ height: 46, borderRadius: 10 }} />
        <div className="sk" style={{ width: 100, height: 34, borderRadius: 8, alignSelf: "flex-end" }} />
      </div>

      {/* Doc rows */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 10, padding: "14px 18px", marginBottom: 6,
          display: "flex", alignItems: "center", gap: 16,
        }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <div className="sk" style={{ width: 80, height: 18, borderRadius: 6 }} />
              <div className="sk" style={{ width: 140, height: 13 }} />
            </div>
            <div className="sk" style={{ width: "50%", height: 12 }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div className="sk" style={{ width: 70, height: 28, borderRadius: 6 }} />
            <div className="sk" style={{ width: 56, height: 28, borderRadius: 6 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
