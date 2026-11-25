import { OverviewDemo } from "./OverviewDemo";

export const metadata = { title: "Overzicht met Otis — demo", robots: { index: false, follow: false } };

/** Het Otis-blok van het overzicht, zonder login: op slot (onder Scale) en met cijfers (Scale). */
export default function OverviewDemoPage() {
  return <OverviewDemo />;
}
