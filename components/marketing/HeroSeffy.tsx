import { HeroMilo } from "./HeroMilo";

/** Milo's motion language, with Seffy's existing headset and no antenna. */
export function HeroSeffy({ className }: { className?: string }) {
  return <HeroMilo gear="headset" className={className} />;
}
