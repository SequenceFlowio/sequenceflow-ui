import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { DEFAULT_APP_ORIGIN, FULL_PRODUCT_NAME } from "@/lib/brand";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: `${FULL_PRODUCT_NAME} | AI-klantenservice voor e-commerce`,
  description: "Support maakt klantantwoorden vanuit je eigen beleid en commerce-data. Je team houdt controle en automatiseert alleen wat het vertrouwt.",
  metadataBase: new URL(DEFAULT_APP_ORIGIN),
  applicationName: FULL_PRODUCT_NAME,
  openGraph: {
    title: `${FULL_PRODUCT_NAME} | Elke klantmail goed afgehandeld`,
    description: "AI-klantenservice voor e-commerce, met je eigen beleid en menselijke controle.",
    url: DEFAULT_APP_ORIGIN,
    siteName: FULL_PRODUCT_NAME,
    locale: "nl_NL",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${FULL_PRODUCT_NAME} | Elke klantmail goed afgehandeld`,
    description: "AI-klantenservice voor e-commerce, met je eigen beleid en menselijke controle.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
