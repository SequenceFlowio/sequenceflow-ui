export default function CommerceLoading() {
  const block = { borderRadius: 8, background: "var(--surface-2)" };
  return (
    <main style={{ width: "min(100%,1080px)", margin: "0 auto", padding: "40px 24px 56px", display: "grid", gap: 18 }} role="status" aria-label="Bestelgegevens laden">
      <div style={{ ...block, width: 110, height: 14 }} />
      <div style={{ ...block, width: 220, height: 34 }} />
      <div style={{ ...block, width: "min(100%,620px)", height: 14 }} />
      <div style={{ height: 320, border: "1px solid var(--border)", borderRadius: 20, background: "var(--surface)" }} />
      <div style={{ height: 56, border: "1px solid var(--border)", borderRadius: 20, background: "var(--surface)" }} />
    </main>
  );
}
