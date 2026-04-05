import Link from "next/link";

export default function AppNotFound() {
  return (
    <div style={{
      padding: "80px 44px",
      maxWidth: "600px",
      margin: "0 auto",
      textAlign: "center",
    }}>
      <p style={{ fontSize: "64px", fontWeight: 800, color: "#C7F56F", margin: "0 0 8px", lineHeight: 1 }}>
        404
      </p>
      <h1 style={{ fontSize: "22px", fontWeight: 600, color: "var(--text)", margin: "0 0 10px" }}>
        Page not found
      </h1>
      <p style={{ fontSize: "14px", color: "var(--muted)", margin: "0 0 32px", lineHeight: 1.6 }}>
        This page doesn&apos;t exist. You may have followed a broken link.
      </p>
      <Link
        href="/inbox"
        style={{
          display: "inline-block",
          background: "#C7F56F",
          color: "#1a1a1a",
          fontWeight: 700,
          fontSize: "14px",
          padding: "10px 24px",
          borderRadius: "10px",
          textDecoration: "none",
        }}
      >
        Back to inbox
      </Link>
    </div>
  );
}
