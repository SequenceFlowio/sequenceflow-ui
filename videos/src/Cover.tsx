import { AbsoluteFill } from "remotion";

import type { Lang } from "./i18n";
import { Mascot, type Gear } from "./Mascot";
import { Bg, Label } from "./parts";
import { C } from "./theme";

/**
 * Cover (thumbnail) per video. De belangrijke inhoud staat in het midden, zodat
 * hij ook goed staat in het 3:4-raster van het Instagram-profiel en in 1:1.
 */

const COVERS: Record<string, { gear: Gear; product: Record<Lang, string>; l1: Record<Lang, string>; l2: Record<Lang, string> }> = {
  SupportOne: { gear: "headset", product: { nl: "Support One", en: "Support One" }, l1: { nl: "Elke dag dezelfde", en: "The same customer" }, l2: { nl: "klantvragen?", en: "questions every day?" } },
  PainPoints: { gear: "antenna", product: { nl: "Pijnpunten", en: "Pain points" }, l1: { nl: "Waar lopen je", en: "Where do your" }, l2: { nl: "klanten tegenaan?", en: "customers get stuck?" } },
  Stock: { gear: "analyst", product: { nl: "Voorraad met Otis", en: "Stock with Otis" }, l1: { nl: "Weet jij wat er", en: "Know what's about" }, l2: { nl: "bijna op is?", en: "to run out?" } },
};

export type CoverOverride = { gear?: Gear; product?: string; l1?: string; l2?: string };

export function Cover({ video, lang, square = false, override }: { video: keyof typeof COVERS; lang: Lang; square?: boolean; override?: CoverOverride }) {
  const base = COVERS[video];
  const c = {
    gear: override?.gear ?? base.gear,
    product: { ...base.product, ...(override?.product ? { [lang]: override.product } : {}) },
    l1: { ...base.l1, ...(override?.l1 ? { [lang]: override.l1 } : {}) },
    l2: { ...base.l2, ...(override?.l2 ? { [lang]: override.l2 } : {}) },
  };
  const s = square ? 0.8 : 1;
  return (
    <Bg>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center", padding: 80, gap: 40 * s }}>
        <Mascot size={340 * s} gear={c.gear} happyFrom={0} />
        <h1 style={{ margin: 0, fontSize: 112 * s, fontWeight: 650, letterSpacing: "-0.035em", lineHeight: 1.02, color: C.text }}>
          {c.l1[lang]}<br /><span style={{ color: C.lime }}>{c.l2[lang]}</span>
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "18px 34px", borderRadius: 999, border: `2px solid ${C.lineLime}`, background: C.surface }}>
          <Label>SequenceFlow</Label>
          <span style={{ fontSize: 38 * s, fontWeight: 700, color: C.text }}>{c.product[lang]}</span>
        </div>
      </AbsoluteFill>
    </Bg>
  );
}
