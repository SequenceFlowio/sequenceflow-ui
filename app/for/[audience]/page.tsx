import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LandingPage } from "@/components/marketing/LandingPage";
import { LANDING_PAGES } from "@/lib/marketing/landingPages";

export function generateStaticParams() {
  return Object.keys(LANDING_PAGES)
    .filter((key) => key !== "general")
    .map((audience) => ({ audience }));
}

export async function generateMetadata({ params }: { params: Promise<{ audience: string }> }): Promise<Metadata> {
  const { audience } = await params;
  const content = LANDING_PAGES[audience];
  if (!content) return {};
  return {
    title: `${content.eyebrow} | SequenceFlow`,
    description: content.description,
  };
}

export default async function AudiencePage({ params }: { params: Promise<{ audience: string }> }) {
  const { audience } = await params;
  const content = LANDING_PAGES[audience];
  if (!content || audience === "general") notFound();
  return <LandingPage content={content} />;
}
