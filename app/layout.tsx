import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SequenceFlow | AI-klantenservice voor e-commerce",
  description: "SequenceFlow maakt supportantwoorden vanuit je eigen beleid. Je team houdt controle en automatiseert alleen wat het vertrouwt.",
  metadataBase: new URL("https://emailreply.sequenceflow.io"),
  openGraph: {
    title: "SequenceFlow | Elke klantmail goed afgehandeld",
    description: "AI-klantenservice voor e-commerce, met je eigen beleid en menselijke controle.",
    url: "https://emailreply.sequenceflow.io",
    siteName: "SequenceFlow",
    locale: "nl_NL",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SequenceFlow | Elke klantmail goed afgehandeld",
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
