import { SeffyMotion } from "./SeffyMotion";

/** Milo's motion language, with Seffy's existing headset and no antenna. */
export function HeroSeffy({ className }: { className?: string }) {
  return <SeffyMotion gear="headset" className={className} />;
}
