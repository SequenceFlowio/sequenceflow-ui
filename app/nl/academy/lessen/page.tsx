import type { Metadata } from "next";

import { AcademyLibrary } from "@/components/marketing/AcademyLibrary";
import { SitePage } from "@/components/marketing/SitePage";

/** De lessen zelf, na aanmelden op /nl/academy. Niet in zoekmachines. */
export const metadata: Metadata = {
  title: "Alle lessen · SequenceFlow Academy",
  robots: { index: false, follow: false },
};

export default function AcademyLessonsPage() {
  return <SitePage><AcademyLibrary lang="nl" /></SitePage>;
}
