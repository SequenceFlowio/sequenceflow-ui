/**
 * Reelgenerator: rendert alle reels uit een weekbestand (video + cover), zet het geluid
 * op -14 LUFS en plant ze in de Content Calendar (goedgekeurd, cron publiceert ze).
 * Met "story": "HH:MM" gaat dezelfde video die dag ook als Instagram-story.
 *
 * node scripts/batch.mjs weeks/2026-11-17.json [--dry]   (vanuit videos/)
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const file = process.argv[2];
const dry = process.argv.includes("--dry");
const week = JSON.parse(readFileSync(file, "utf8"));
const out = resolve("out/batch");
mkdirSync(out, { recursive: true });
const repo = resolve("..");

const run = (cmd, args, cwd = process.cwd()) => execFileSync(cmd, args, { cwd, stdio: ["ignore", "ignore", "inherit"] });

for (const reel of week.reels) {
  const mp4 = `${out}/${reel.id}.mp4`;
  const jpg = `${out}/${reel.id}-cover.jpg`;
  if (!existsSync(mp4)) {
    run("npx", ["remotion", "render", "src/index.ts", reel.template, `${out}/${reel.id}.raw.mp4`, `--props=${JSON.stringify({ lang: "nl", content: reel.content })}`, "--log=error"]);
    run("ffmpeg", ["-y", "-loglevel", "error", "-i", `${out}/${reel.id}.raw.mp4`, "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", mp4]);
    run("rm", [`${out}/${reel.id}.raw.mp4`]);
  }
  if (!existsSync(jpg)) {
    run("npx", ["remotion", "still", "src/index.ts", "CoverSupportOne", jpg, `--props=${JSON.stringify({ video: "SupportOne", lang: "nl", square: false, override: reel.cover })}`, "--image-format=jpeg", "--jpeg-quality=92", "--log=error"]);
  }
  console.log(`gerenderd: ${reel.id}`);
  if (dry) continue;
  const spec = `${out}/${reel.id}.json`;
  writeFileSync(spec, JSON.stringify({
    id: reel.id, date: reel.date, time: reel.time, video: mp4, cover: jpg, pillar: reel.pillar ?? "klantcontact",
    headline: `${reel.cover.l1} ${reel.cover.l2}`, subline: "", caption: reel.caption, hashtags: reel.hashtags ?? week.hashtags ?? [], status: "approved",
  }));
  run("node", ["--env-file=.env.local", "scripts/content-add-reel.mjs", spec], repo);
  console.log(`ingepland: ${reel.id} ${reel.date} ${reel.time}`);
  if (reel.story) {
    // Dezelfde video als story, een uur later (alleen Instagram, zonder caption)
    const storySpec = `${out}/${reel.id}-story.json`;
    writeFileSync(storySpec, JSON.stringify({ ...JSON.parse(readFileSync(spec, "utf8")), id: `${reel.id}-story`, time: reel.story, kind: "story" }));
    run("node", ["--env-file=.env.local", "scripts/content-add-reel.mjs", storySpec], repo);
    console.log(`story ingepland: ${reel.id} ${reel.date} ${reel.story}`);
  }
}
