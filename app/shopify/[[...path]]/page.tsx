import { notFound } from "next/navigation";
import EmbeddedSupport from "@/components/shopify/EmbeddedSupport";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function ShopifyPage({ params }: { params: Promise<{ path?: string[] }> }) {
  if (process.env.SHOPIFY_PUBLIC_APP_ENABLED !== "true" || !process.env.SHOPIFY_API_KEY) notFound();
  const { path = [] } = await params;
  return <><meta name="shopify-api-key" content={process.env.SHOPIFY_API_KEY} /><EmbeddedSupport path={path} appHandle={process.env.SHOPIFY_APP_HANDLE ?? ""} /></>;
}
