import { notFound } from "next/navigation";
import EmbeddedSupport from "@/components/shopify/EmbeddedSupport";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function ShopifyPage({ params }: { params: Promise<{ path?: string[] }> }) {
  if (process.env.SHOPIFY_PUBLIC_APP_ENABLED !== "true" || !process.env.SHOPIFY_API_KEY) notFound();
  const { path = [] } = await params;
  // App Bridge must load as a plain, blocking script (not async/deferred like
  // next/script), otherwise Shopify does not initialise window.shopify.
  return <>
    <meta name="shopify-api-key" content={process.env.SHOPIFY_API_KEY} />
    {/* eslint-disable-next-line @next/next/no-sync-scripts */}
    <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
    <EmbeddedSupport path={path} appHandle={process.env.SHOPIFY_APP_HANDLE ?? ""} />
  </>;
}
