import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shopify koppelen | SequenceFlow Support One",
  robots: { index: false, follow: false },
};

export default function LinkShopifyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
