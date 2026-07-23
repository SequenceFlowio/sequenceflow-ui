export default function AgentProfileLoading() {
  return (
    <main style={{ width: "min(100%, 1120px)", margin: "0 auto", padding: "40px 24px 72px" }}>
      <div style={{ width: 230, height: 34, borderRadius: 8, background: "var(--sf-surface-2)" }} />
      <div style={{ width: "min(680px, 100%)", height: 18, marginTop: 10, borderRadius: 6, background: "var(--sf-surface-2)" }} />
      <div style={{ display: "grid", gap: 16, marginTop: 24 }}>
        {[142, 104, 220].map((height) => (
          <div key={height} style={{ height, border: "1px solid var(--sf-border)", borderRadius: 8, background: "var(--sf-surface)" }} />
        ))}
      </div>
    </main>
  );
}
