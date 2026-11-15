import type { NextConfig } from 'next';

const developmentScriptSource = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";

// Meet-tags krijgen alleen ruimte in de CSP als ze aanstaan. Tag Manager staat
// standaard aan (lib/marketing/tags.ts) en kan zelf GA4 en de Meta-pixel laden,
// dus met de container aan mogen beide.
const gtmOn = process.env.NEXT_PUBLIC_GTM_ID !== "off";
const gaOn = gtmOn || Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);
const pixelOn = gtmOn || Boolean(process.env.NEXT_PUBLIC_META_PIXEL_ID);
const trackingScriptSources = `${gaOn ? " https://www.googletagmanager.com https://*.googletagmanager.com" : ""}${pixelOn ? " https://connect.facebook.net" : ""}`;
const trackingConnectSources = `${gaOn ? " https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com" : ""}${pixelOn ? " https://www.facebook.com https://connect.facebook.net" : ""}`;

const nextConfig: NextConfig = {
  // De slide-renderer van de Content Calendar leest fonts en logo's van schijf.
  outputFileTracingIncludes: {
    "/api/contentcalender/render/[id]/[slide]": ["./lib/contentCalendar/fonts/**", "./public/logo-black.png", "./public/logo-white.png"],
  },
  // Pages of the old sequenceflow.io that no longer exist; links to them keep working.
  async redirects() {
    return [
      { source: "/oplossingen", destination: "/support-one", permanent: true },
      // Email Reply en Support Flow heten nu Support One.
      { source: "/email-reply", destination: "/support-one", permanent: true },
      { source: "/oplossingen/support-flow", destination: "/support-one", permanent: true },
      { source: "/oplossingen/:path*", destination: "/support-one", permanent: true },
      // De testvariant en de doelgroeppagina's zijn opgegaan in /support-one.
      { source: "/s1", destination: "/support-one", permanent: true },
      { source: "/for/:path*", destination: "/support-one", permanent: true },
      // De Engelse Support One-pagina is een kopie van /support-one op /support-one/en.
      { source: "/en", destination: "/support-one/en", permanent: true },
      { source: "/en/support-one", destination: "/support-one/en", permanent: true },
      // Content One en de bedrijfspagina zijn gearchiveerd tot er een tweede app
      // is (archive/content-one/README.md). Tijdelijk, want ze komen terug.
      { source: "/content", destination: "/support-one", permanent: false },
      { source: "/content/:path*", destination: "/support-one", permanent: false },
      { source: "/content-gen", destination: "/support-one", permanent: false },
      { source: "/home", destination: "/support-one", permanent: false },
      { source: "/h1", destination: "/support-one", permanent: false },
      { source: "/prijzen", destination: "/pricing", permanent: true },
      // Blogs over het oude aanbod (Lead, Operations en Support Flow) zijn op 8 nov 2026 vervangen.
      { source: "/blog/support-flow", destination: "/blog/waar-blijft-mijn-pakket", permanent: true },
      { source: "/blog/hoeveel-geld-kost-handmatige-emailverwerking-je-per-maand", destination: "/blog/wat-kost-een-klantmail", permanent: true },
      { source: "/blog/lead-flow", destination: "/blog", permanent: true },
      { source: "/blog/operations-flow", destination: "/blog", permanent: true },
      { source: "/blog/waarom-2026-het-jaar-wordt-van-autonome-workflows", destination: "/blog", permanent: true },
      { source: "/flow-bouwen", destination: "/contact", permanent: true },
    ];
  },
  async headers() {
    const securityHeaders = [
      { key: "Content-Security-Policy", value: [
        "default-src 'self'",
        "base-uri 'self'",
        `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://accounts.google.com${trackingConnectSources}`,
        "font-src 'self' data:",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "frame-src https://accounts.google.com",
        "img-src 'self' data: blob: https:",
        "object-src 'none'",
        `script-src 'self' 'unsafe-inline'${developmentScriptSource}${trackingScriptSources}`,
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
        source: "/shopify/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          // Content-Security-Policy for /shopify is set per shop in proxy.ts.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        source: "/oauth/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          // Content-Security-Policy for the consent page is set in proxy.ts.
          ...securityHeaders.filter((header) => header.key !== "Content-Security-Policy"),
        ],
      },
      {
        // Foto's en video's van de site (public/media) mogen in de CDN en de
        // browser blijven staan; anders downloadt elke bezoeker de video
        // opnieuw. Geen hash in de bestandsnaam: vervang je een bestand,
        // geef het dan een nieuwe naam (bijvoorbeeld -v2).
        source: "/media/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" },
          ...securityHeaders,
        ],
      },
      {
        source: "/((?!_next/static|_next/image|favicon.ico|media/|shopify(?:/|$)|oauth(?:/|$)).*)",
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
