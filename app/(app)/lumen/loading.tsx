const shimmer = {
  background: "linear-gradient(90deg,var(--surface),var(--surface-2),var(--surface))",
  backgroundSize: "200% 100%",
  animation: "lumen-loading 1.5s linear infinite",
  borderRadius: 6,
};

export default function LumenLoading() {
  return (
    <main style={{ width: "min(100%,1080px)", margin: "0 auto", padding: "40px 24px 56px" }} role="status" aria-label="Vraag het Support One laden">
      <style>{`@keyframes lumen-loading{to{background-position:-200% 0}}`}</style>
      <div style={{ marginBottom: 18 }}>
        <div style={{ ...shimmer, width: 260, height: 32, marginBottom: 10 }} />
        <div style={{ ...shimmer, width: "min(100%,460px)", height: 14 }} />
      </div>
      <div style={{ height: 610, border: "1px solid var(--border)", borderRadius: 20, background: "var(--surface)", padding: 24 }}>
        <div style={{ ...shimmer, width: 220, height: 18, margin: "120px auto 12px" }} />
        <div style={{ ...shimmer, width: "min(100%,420px)", height: 12, margin: "0 auto 28px" }} />
        <div style={{ ...shimmer, width: "min(100%,640px)", height: 52, margin: "0 auto" }} />
      </div>
    </main>
  );
}
