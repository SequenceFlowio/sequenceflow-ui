export default function CommerceLoading() {
  const block = { borderRadius: 8, background: "var(--surface-subtle)" };
  return (
    <main style={{ width: "min(100%,1180px)", margin: "0 auto", padding: "40px 24px 56px", display: "grid", gap: 18 }} role="status" aria-label="Commerce laden">
      <div style={{ ...block, width: 190, height: 34 }} />
      <div style={{ ...block, width: "min(100%,650px)", height: 14 }} />
      <div style={{ ...block, height: 120, border: "1px solid var(--border)" }} />
      <div style={{ ...block, height: 240, border: "1px solid var(--border)" }} />
      <div style={{ ...block, height: 240, border: "1px solid var(--border)" }} />
    </main>
  );
}
