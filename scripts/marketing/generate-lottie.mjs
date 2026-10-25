// Genereert de Lottie-animaties van de website in public/lottie/.
// Draai opnieuw na een wijziging: node scripts/marketing/generate-lottie.mjs
//
// Ze zijn met de hand opgebouwd uit vormen in de huisstijl (zwart, limoen),
// zodat ze zonder externe bestanden kloppen. Een eigen animatie uit
// LottieFiles mag een bestand hier gewoon vervangen: zelfde naam, zelfde map.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../../public/lottie");
const FPS = 60;

const hex = (value) => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16) / 255).concat(1);
const LIME = hex("#c7f56f");
const INK = hex("#ffffff");
const LINE = hex("#2a2e35");
const SURFACE = hex("#161616");
const MUTED = hex("#3a3f46");

const EASE = { o: { x: [0.4], y: [0] }, i: { x: [0.2], y: [1] } };
const still = (k) => ({ a: 0, k });
/** Keyframes als [frame, waarde]; de laatste houdt zijn waarde vast. */
function anim(frames) {
  return {
    a: 1,
    k: frames.map(([t, v], index) => {
      const s = Array.isArray(v) ? v : [v];
      if (index === frames.length - 1) return { t, s };
      const n = s.length;
      return { t, s, o: { x: Array(n).fill(EASE.o.x[0]), y: Array(n).fill(EASE.o.y[0]) }, i: { x: Array(n).fill(EASE.i.x[0]), y: Array(n).fill(EASE.i.y[0]) } };
    }),
  };
}
/** Positie-keyframes (ruimtelijk) gebruiken enkelvoudige easing in lottie-web. */
function move(frames) {
  return {
    a: 1,
    k: frames.map(([t, v], index) => (index === frames.length - 1
      ? { t, s: [...v, 0] }
      : { t, s: [...v, 0], o: { x: 0.4, y: 0 }, i: { x: 0.2, y: 1 }, to: [0, 0, 0], ti: [0, 0, 0] })),
  };
}

const transform = () => ({ ty: "tr", p: still([0, 0]), a: still([0, 0]), s: still([100, 100]), r: still(0), o: still(100) });
const group = (...items) => ({ ty: "gr", it: [...items, transform()] });
const ellipse = (size) => ({ ty: "el", p: still([0, 0]), s: typeof size === "number" ? still([size, size]) : size, d: 1 });
const rect = (w, h, r, p = [0, 0]) => ({ ty: "rc", p: still(p), s: still([w, h]), r: still(r), d: 1 });
const fill = (color, o = still(100)) => ({ ty: "fl", c: still(color), o, r: 1 });
const stroke = (color, width, o = still(100)) => ({ ty: "st", c: still(color), o, w: still(width), lc: 2, lj: 2 });
const path = (points, closed = false) => ({
  ty: "sh",
  ks: still({ i: points.map(() => [0, 0]), o: points.map(() => [0, 0]), v: points, c: closed }),
});
const trim = (end) => ({ ty: "tm", s: still(0), e: end, o: still(0), m: 1 });

let index = 0;
function layer(name, shapes, { p = [0, 0], o = still(100), s = still([100, 100, 100]), r = still(0), op }) {
  index += 1;
  return {
    ddd: 0, ind: index, ty: 4, nm: name, sr: 1,
    ks: { o, r, p: Array.isArray(p) ? still([...p, 0]) : p, a: still([0, 0, 0]), s },
    ao: 0, shapes, ip: 0, op, st: 0, bm: 0,
  };
}

function file(name, w, h, seconds, build) {
  index = 0;
  const op = Math.round(seconds * FPS);
  // lottie-web tekent de eerste laag bovenop; build() levert van achter naar voor.
  // Binnen een laag geldt hetzelfde: de eerste vorm ligt bovenop.
  const layers = build(op).reverse();
  const json = { v: "5.7.4", fr: FPS, ip: 0, op, w, h, nm: name, ddd: 0, assets: [], layers };
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(json));
  console.log(`public/lottie/${name}.json`);
}

mkdirSync(OUT, { recursive: true });

/* Pulse: een limoen stip met ringen die uitdijen. "Je agent staat aan." */
file("pulse", 200, 200, 2.4, (op) => [
  ...[0, 48, 96].map((delay, i) => layer(`ring ${i + 1}`, [group(ellipse(anim([[delay, [24, 24]], [delay + 96, [176, 176]]])), stroke(LIME, 2, anim([[delay, 70], [delay + 96, 0]])))], { p: [100, 100], op })),
  layer("dot", [group(ellipse(anim([[0, [26, 26]], [36, [32, 32]], [72, [26, 26]], [op, [26, 26]]])), fill(LIME))], { p: [100, 100], op }),
]);

/* Hub flow: je webshop in het midden, twee agents eromheen. Signalen lopen
   heen en weer en de agents lichten op als er iets aankomt. */
file("hub-flow", 480, 320, 4, (op) => {
  const shop = [240, 92];
  const support = [104, 236];
  const content = [376, 236];
  const lines = [support, content].map((end, i) => layer(`lijn ${i + 1}`, [group(path([shop, end]), stroke(LINE, 2))], { op }));
  const draw = [support, content].map((end, i) => layer(`spoor ${i + 1}`, [group(path([shop, end]), stroke(LIME, 2, still(55)), trim(anim([[i * 30, 0], [i * 30 + 50, 100]])))], { op }));
  const pulseOut = (end, start) => layer("signaal", [group(ellipse(10), fill(LIME))], {
    p: move([[start, shop], [start + 46, end], [op, end]]),
    o: anim([[start - 1, 0], [start, 100], [start + 46, 100], [start + 54, 0]]),
    op,
  });
  const pulseBack = (from, start) => layer("antwoord", [group(ellipse(8), fill(INK))], {
    p: move([[start, from], [start + 46, shop], [op, shop]]),
    o: anim([[start - 1, 0], [start, 90], [start + 46, 90], [start + 54, 0]]),
    op,
  });
  const node = (name, at, size, hitFrames) => [
    layer(`${name} gloed`, [group(ellipse(size + 34), fill(LIME, anim(hitFrames.flatMap((t) => [[t, 0], [t + 8, 22], [t + 40, 0]]).concat([[op, 0]]))))], { p: at, op }),
    layer(name, [group(ellipse(size * 0.34), fill(LIME)), group(ellipse(size), fill(SURFACE), stroke(MUTED, 2))], {
      p: at,
      s: anim(hitFrames.flatMap((t) => [[t, [100, 100, 100]], [t + 10, [108, 108, 100]], [t + 34, [100, 100, 100]]]).concat([[op, [100, 100, 100]]])),
      op,
    }),
  ];
  return [
    ...lines,
    ...draw,
    pulseOut(support, 40), pulseOut(content, 70), pulseBack(support, 130), pulseBack(content, 160),
    ...node("support", support, 64, [86, 130]),
    ...node("content", content, 64, [116, 160]),
    layer("winkel", [group(rect(44, 6, 3, [0, -12]), fill(INK, still(80))), group(rect(28, 6, 3, [-8, 6]), fill(MUTED)), group(rect(96, 72, 18), fill(SURFACE), stroke(LIME, 2))], {
      p: shop,
      s: anim([[176, [100, 100, 100]], [186, [106, 106, 100]], [210, [100, 100, 100]], [op, [100, 100, 100]]]),
      op,
    }),
  ];
});

/* Content stack: drie posts schuiven binnen, waaieren uit en krijgen een
   like. "Van product naar post." */
file("content-stack", 320, 320, 4.2, (op) => {
  const card = (i) => {
    const start = i * 18;
    const angle = [-9, 0, 9][i];
    const x = [118, 160, 202][i];
    return layer(`post ${i + 1}`, [
      group(rect(26, 6, 3, [-27, 70]), fill(MUTED)),
      group(rect(58, 6, 3, [-11, 58]), fill(INK, still(70))),
      group(rect(108, 104, 12, [0, -12]), fill(hex(i === 1 ? "#24301a" : "#1d2026"))),
      group(rect(124, 176, 16), fill(SURFACE), stroke(LINE, 2)),
    ], {
      p: move([[start, [x, 360]], [start + 42, [x, 160]], [214, [x, 160]], [246, [x, 380]], [op, [x, 380]]]),
      r: anim([[start, 0], [start + 42, angle], [214, angle], [op, angle]]),
      o: anim([[start, 0], [start + 18, 100], [222, 100], [246, 0]]),
      op,
    });
  };
  const heart = layer("like", [group(ellipse(30), fill(LIME)), group(path([[-6, 0], [-1, 5], [7, -5]]), stroke(hex("#152000"), 3))], {
    p: [200, 108],
    s: anim([[86, [0, 0, 100]], [100, [118, 118, 100]], [112, [100, 100, 100]], [206, [100, 100, 100]], [222, [0, 0, 100]], [op, [0, 0, 100]]]),
    op,
  });
  return [card(0), card(2), card(1), heart];
});

/* Support check: drie berichtregels komen binnen, daarna tekent een vinkje
   zich: het concept staat klaar. */
file("support-check", 320, 240, 3.6, (op) => {
  const bubble = (i) => layer(`regel ${i + 1}`, [
    group(rect([160, 120, 140][i], 10, 5, [0, 0]), fill(i === 0 ? INK : MUTED, still(i === 0 ? 75 : 100))),
  ], {
    p: move([[i * 14, [140 - (i === 1 ? 20 : 10), 74 + i * 26 + 16]], [i * 14 + 30, [140 - (i === 1 ? 20 : 10), 74 + i * 26]], [op, [140 - (i === 1 ? 20 : 10), 74 + i * 26]]]),
    o: anim([[i * 14, 0], [i * 14 + 24, 100], [180, 100], [206, 0]]),
    op,
  });
  return [
    layer("kaart", [group(rect(236, 150, 18), fill(SURFACE), stroke(LINE, 2))], { p: [148, 120], o: anim([[0, 0], [20, 100], [190, 100], [212, 0]]), op }),
    bubble(0), bubble(1), bubble(2),
    layer("vink rond", [group(ellipse(anim([[60, [0, 0]], [80, [58, 58]], [190, [58, 58]], [210, [0, 0]]])), fill(LIME))], { p: [250, 168], op }),
    layer("vink", [group(path([[-11, 0], [-3, 8], [12, -8]]), stroke(hex("#152000"), 4), trim(anim([[78, 0], [100, 100], [op, 100]])))], { p: [250, 168], o: anim([[0, 100], [190, 100], [204, 0]]), op }),
  ];
});
