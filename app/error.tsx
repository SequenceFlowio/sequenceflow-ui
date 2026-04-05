"use client";

import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[root-error]", error);
  }, [error]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 24px",
      fontFamily: "Inter, system-ui, -apple-system, sans-serif",
    }}>
      <div style={{ textAlign: "center", maxWidth: "440px" }}>
        <p style={{ fontSize: "48px", margin: "0 0 16px" }}>⚠️</p>
        <h1 style={{ fontSize: "22px", fontWeight: 600, color: "var(--text)", margin: "0 0 10px" }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: "14px", color: "var(--muted)", margin: "0 0 8px", lineHeight: 1.6 }}>
          An unexpected error occurred. You can try again or reload the page.
        </p>
        {error.digest && (
          <p style={{ fontSize: "11px", color: "var(--muted)", margin: "0 0 28px", fontFamily: "monospace" }}>
            Error ID: {error.digest}
          </p>
        )}
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={reset}
            style={{
              background: "#C7F56F",
              color: "#1a1a1a",
              fontWeight: 700,
              fontSize: "14px",
              padding: "10px 24px",
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <a
            href="/inbox"
            style={{
              background: "transparent",
              color: "var(--muted)",
              fontWeight: 500,
              fontSize: "14px",
              padding: "10px 24px",
              borderRadius: "10px",
              border: "1px solid var(--border)",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Go to inbox
          </a>
        </div>
      </div>
    </div>
  );
}
