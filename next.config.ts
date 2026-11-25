import type { NextConfig } from 'next';

const developmentScriptSource = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";

// Meet-tags krijgen alleen ruimte in de CSP als ze aanstaan. Tag Manager staat
// standaard aan (lib/marketing/tags.ts) en kan zelf GA4 en de Meta-pixel laden,
// dus met de container aan mogen beide.
const gtmOn = process.env.NEXT_PUBLIC_GTM_ID !== "off";
const gaOn = gtmOn || Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);
// De Meta-pixel staat standaard aan (lib/marketing/tags.ts); alleen "off" zet hem uit.
const pixelOn = gtmOn || process.env.NEXT_PUBLIC_META_PIXEL_ID !== "off";
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
      { source: "/oplossingen", destination: "/nl", permanent: true },
      // Gratis tools heten sinds 23 nov 2026 de Academy; links in DM's en ManyChat blijven werken (incl. ?t= en utm).
      { source: "/nl/gratis", destination: "/nl/academy", permanent: true },
      { source: "/nl/gratis/antwoordenbank", destination: "/nl/academy", permanent: true },
      // De Antwoordenbank is per 23 nov 2026 weg (de Academy wordt video's): oude links naar de Academy.
      { source: "/nl/academy/antwoordenbank", destination: "/nl/academy", permanent: true },
      { source: "/en/academy/reply-bank", destination: "/en/academy", permanent: true },
      { source: "/en/free", destination: "/en/academy", permanent: true },
      { source: "/en/free/reply-bank", destination: "/en/academy", permanent: true },
      { source: "/academy", destination: "/nl/academy", permanent: false },
      // Email Reply en Support Flow heten nu Support One.
      { source: "/email-reply", destination: "/nl", permanent: true },
      { source: "/oplossingen/support-flow", destination: "/nl", permanent: true },
      { source: "/oplossingen/:path*", destination: "/nl", permanent: true },
      // De testvariant en de doelgroeppagina's zijn opgegaan in de Support One-pagina.
      { source: "/s1", destination: "/nl", permanent: true },
      { source: "/for/:path*", destination: "/nl", permanent: true },
      // De site heeft twee talen: /nl en /en. De oude adressen (en /eng) sturen
      // daar permanent naartoe, zodat links en lopende ads blijven werken.
      { source: "/support-one", destination: "/nl", permanent: true },
      { source: "/support-one/en", destination: "/en", permanent: true },
      { source: "/en/support-one", destination: "/en", permanent: true },
      { source: "/pricing", destination: "/nl/pricing", permanent: true },
      { source: "/eng", destination: "/en", permanent: true },
      // Affiliate, contact en de juridische pagina's staan sinds 19 nov 2026 ook
      // onder /nl en /en. Alleen het exacte /affiliate: het dashboard
      // (/affiliate/dashboard/...) blijft waar het is.
      { source: "/affiliate", destination: "/nl/affiliate", permanent: true },
      { source: "/contact", destination: "/nl/contact", permanent: true },
      // Juridische pagina's: zelfde lijst als LEGAL_PAGES in lib/site.ts.
      ...["privacyverklaring", "algemene-voorwaarden", "verwerkersovereenkomst", "service-level-agreement", "acceptable-use-policy", "ai-data-ethiek"]
        .map((slug) => ({ source: `/${slug}`, destination: `/nl/${slug}`, permanent: true })),
      { source: "/eng/:path*", destination: "/en/:path*", permanent: true },
      // Content One en de bedrijfspagina zijn gearchiveerd tot er een tweede app
      // is (archive/content-one/README.md). Tijdelijk, want ze komen terug.
      { source: "/content", destination: "/nl", permanent: false },
      { source: "/content/:path*", destination: "/nl", permanent: false },
      { source: "/content-gen", destination: "/nl", permanent: false },
      { source: "/home", destination: "/nl", permanent: false },
      { source: "/h1", destination: "/nl", permanent: false },
      { source: "/prijzen", destination: "/nl/pricing", permanent: true },
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
        "frame-src https://accounts.google.com https://challenges.cloudflare.com",
        "img-src 'self' data: blob: https:",
        "media-src 'self' blob: https://*.supabase.co https://media.sequenceflow.io",
        "object-src 'none'",
        `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${developmentScriptSource}${trackingScriptSources}`,
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
