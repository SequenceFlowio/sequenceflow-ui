import type { Metadata } from "next";

import { AcademyLibrary } from "@/components/marketing/AcademyLibrary";
import { SitePage } from "@/components/marketing/SitePage";

/** The lessons themselves, after signing up on /en/academy. Not indexed. */
export const metadata: Metadata = {
  title: "All lessons · SequenceFlow Academy",
  robots: { index: false, follow: false },
};

export default function AcademyLessonsPage() {
  return <SitePage lang="en"><AcademyLibrary lang="en" /></SitePage>;
}
