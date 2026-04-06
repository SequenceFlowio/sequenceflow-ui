import Link from "next/link";

export default function NotFound() {
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
      <div style={{ textAlign: "center", maxWidth: "400px" }}>
        <p style={{ fontSize: "72px", fontWeight: 800, color: "#C7F56F", margin: "0 0 8px", lineHeight: 1 }}>
          404
        </p>
        <h1 style={{ fontSize: "22px", fontWeight: 600, color: "var(--text)", margin: "0 0 10px" }}>
          Page not found
        </h1>
        <p style={{ fontSize: "14px", color: "var(--muted)", margin: "0 0 32px", lineHeight: 1.6 }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
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
          Go to inbox
        </Link>
      </div>
    </div>
  );
}
