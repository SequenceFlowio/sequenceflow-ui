import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SequenceFlow",
  description: "AI-powered customer support inbox — automatically triage, draft and resolve customer emails with confidence.",
  metadataBase: new URL("https://supportflow.sequenceflow.io"),
  openGraph: {
    title: "SequenceFlow",
    description: "AI-powered customer support inbox — automatically triage, draft and resolve customer emails with confidence.",
    url: "https://supportflow.sequenceflow.io",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
