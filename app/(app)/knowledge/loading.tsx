const shimmer = {
  background: "linear-gradient(90deg, var(--surface) 25%, var(--surface-2) 50%, var(--surface) 75%)",
  backgroundSize: "400% 100%",
  animation: "knowledge-loading-shimmer 1.5s ease-in-out infinite",
};

export default function KnowledgeLoading() {
  return (
    <div className="knowledge-loading-page">
      <style>{`
        .knowledge-loading-page {
          width: min(1120px, 100%);
          min-height: 100vh;
          margin: 0 auto;
          padding: 36px 28px 56px;
          box-sizing: border-box;
        }
        .knowledge-loading-page * { box-sizing: border-box; }
        .knowledge-loading-header {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: flex-start;
          margin-bottom: 22px;
        }
        .knowledge-loading-card {
          overflow: hidden;
          margin-bottom: 16px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
        }
        .knowledge-loading-status {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) repeat(4, minmax(100px, .6fr));
        }
        .knowledge-loading-status > div {
          min-height: 78px;
          padding: 16px;
          border-right: 1px solid var(--border);
        }
        .knowledge-loading-status > div:last-child { border-right: 0; }
        .knowledge-loading-section-head {
          height: 66px;
          padding: 15px 16px;
          border-bottom: 1px solid var(--border);
          background: var(--surface-2);
        }
        .knowledge-loading-body { padding: 16px; }
        .knowledge-loading-row {
          height: 72px;
          border-bottom: 1px solid var(--border);
        }
        .knowledge-loading-row:last-child { border-bottom: 0; }
        @keyframes knowledge-loading-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @media (max-width: 760px) {
          .knowledge-loading-page { padding: 26px 18px 44px; }
          .knowledge-loading-status { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .knowledge-loading-status > div { border-bottom: 1px solid var(--border); }
          .knowledge-loading-header { flex-direction: column; }
        }
      `}</style>

      <div className="knowledge-loading-header">
        <div>
          <div style={{ ...shimmer, width: 210, height: 32, borderRadius: 7, marginBottom: 10 }} />
          <div style={{ ...shimmer, width: "min(520px, 78vw)", height: 14, borderRadius: 6 }} />
        </div>
        <div style={{ ...shimmer, width: 164, height: 40, borderRadius: 8 }} />
      </div>

      <div className="knowledge-loading-card">
        <div className="knowledge-loading-status">
          {[180, 62, 62, 62, 92].map((width, index) => (
            <div key={`${width}-${index}`}>
              <div style={{ ...shimmer, width, maxWidth: "100%", height: 14, borderRadius: 6, marginBottom: 9 }} />
              <div style={{ ...shimmer, width: "70%", height: 10, borderRadius: 5 }} />
            </div>
          ))}
        </div>
      </div>

      {[1, 2].map((section) => (
        <div className="knowledge-loading-card" key={section}>
          <div className="knowledge-loading-section-head">
            <div style={{ ...shimmer, width: 190, height: 14, borderRadius: 6, marginBottom: 8 }} />
            <div style={{ ...shimmer, width: "min(440px, 70vw)", height: 10, borderRadius: 5 }} />
          </div>
          <div className="knowledge-loading-body">
            {section === 1 ? (
              <div style={{ ...shimmer, width: "100%", height: 42, borderRadius: 8 }} />
            ) : (
              <div style={{ ...shimmer, width: "100%", height: 38, borderRadius: 8 }} />
            )}
          </div>
          {section === 2 ? [1, 2, 3].map((row) => <div className="knowledge-loading-row" style={shimmer} key={row} />) : null}
        </div>
      ))}
    </div>
  );
}
