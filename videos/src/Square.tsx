import type { Lang } from "./i18n";
import { PainPoints } from "./PainPoints";
import { Stock } from "./Stock";
import { SupportOne } from "./SupportOne";

/**
 * 1:1-versie voor de feed: dezelfde video op een vierkant canvas van 1500x1500
 * (kaarten worden breder, animatie blijft gelijk). Renderen met --scale=0.72
 * levert 1080x1080 op, zie render:square in package.json.
 */

const VIDEOS = { SupportOne, PainPoints, Stock };
export const SQUARE = 1500;

export function SquareVideo({ video, lang }: { video: keyof typeof VIDEOS; lang: Lang }) {
  const Video = VIDEOS[video];
  return <Video lang={lang} />;
}
