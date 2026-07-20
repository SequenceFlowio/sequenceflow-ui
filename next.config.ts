import type { NextConfig } from 'next';

const developmentScriptSource = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";

const nextConfig: NextConfig = {
  async headers() {
    const securityHeaders = [
      { key: "Content-Security-Policy", value: [
        "default-src 'self'",
        "base-uri 'self'",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://accounts.google.com",
        "font-src 'self' data:",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "frame-src https://accounts.google.com",
        "img-src 'self' data: blob: https:",
        "object-src 'none'",
        `script-src 'self' 'unsafe-inline'${developmentScriptSource}`,
        "style-src 'self' 'unsafe-inline'",
        "upgrade-insecure-requests",
      ].join("; ") },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
    ];

    return [
      {
        source: "/((?!_next/static|_next/image|favicon.ico).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          ...securityHeaders,
        ],
      },
    ];
  },
};

export default nextConfig;
