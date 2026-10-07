import { notFound } from "next/navigation";
import EmbeddedSupport from "@/components/shopify/EmbeddedSupport";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function ShopifyPage({ params, searchParams }: { params: Promise<{ path?: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.SHOPIFY_PUBLIC_APP_ENABLED !== "true" || !process.env.SHOPIFY_API_KEY) notFound();
  const { path = [] } = await params;
  // Shopify passes the admin language as ?locale=nl-NL; Dutch stores get Dutch, everyone else English.
  const locale = String((await searchParams).locale ?? "");
  const language = locale.toLowerCase().startsWith("nl") ? "nl" as const : "en" as const;
  // App Bridge must load as a plain, blocking script (not async/deferred like
  // next/script), otherwise Shopify does not initialise window.shopify.
  return <>
    <meta name="shopify-api-key" content={process.env.SHOPIFY_API_KEY} />
    {/* eslint-disable-next-line @next/next/no-sync-scripts */}
    <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
    <EmbeddedSupport path={path} appHandle={process.env.SHOPIFY_APP_HANDLE ?? ""} language={language} />
  </>;
}
