const shimmer = {
  background: "linear-gradient(90deg,var(--surface-subtle),var(--surface-subtle-strong),var(--surface-subtle))",
  backgroundSize: "200% 100%",
  animation: "lumen-loading 1.5s linear infinite",
  borderRadius: 6,
};

export default function LumenLoading() {
  return (
    <main style={{ width: "min(100%,1120px)", margin: "0 auto", padding: "40px 24px 56px" }} role="status" aria-label="Lumen laden">
      <style>{`@keyframes lumen-loading{to{background-position:-200% 0}}`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <div style={{ ...shimmer, width: 52, height: 52 }} />
        <div style={{ flex: 1 }}>
          <div style={{ ...shimmer, width: 170, height: 30, marginBottom: 10 }} />
          <div style={{ ...shimmer, width: "min(100%,520px)", height: 13 }} />
        </div>
      </div>
      <div style={{ ...shimmer, width: "100%", height: 72, marginBottom: 16, border: "1px solid var(--border)" }} />
      <div style={{ height: 590, border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", padding: 24 }}>
        <div style={{ ...shimmer, width: 220, height: 18, margin: "120px auto 12px" }} />
        <div style={{ ...shimmer, width: "min(100%,420px)", height: 12, margin: "0 auto 28px" }} />
        <div style={{ ...shimmer, width: "min(100%,640px)", height: 52, margin: "0 auto" }} />
      </div>
    </main>
  );
}
