import { SeffyDemo } from "./SeffyDemo";

export const metadata = { title: "Seffy kennismaking — demo", robots: { index: false, follow: false } };

/** De kennismaking met Seffy, zonder login te bekijken. Opslaan doet hier niets. */
export default function SeffyDemoPage() {
  return <SeffyDemo />;
}
