import { Audio, interpolate, Sequence, staticFile } from "remotion";

/** Muziekbed plus geluidjes op vaste frames. Alles komt uit public/audio (zelf gesynthetiseerd, zie scripts/make-audio.py). */

export type Sfx = "pop" | "click" | "whoosh" | "ding" | "tick" | "typing";
export type Cue = [frame: number, sound: Sfx, volume?: number, frames?: number];

const DEFAULT_VOLUME: Record<Sfx, number> = { pop: 0.35, click: 0.6, whoosh: 0.28, ding: 0.5, tick: 0.25, typing: 0.22 };

export function Soundtrack({ total, cues }: { total: number; cues: Cue[] }) {
  return (
    <>
      <Audio
        src={staticFile("audio/bed.wav")}
        volume={(f) => interpolate(f, [0, 15, total - 40, total], [0, 0.32, 0.32, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
      />
      {cues.map(([at, sound, volume, frames], i) => (
        <Sequence key={`${sound}-${at}-${i}`} from={at} durationInFrames={frames ?? 45} layout="none">
          <Audio src={staticFile(`audio/${sound}.wav`)} volume={volume ?? DEFAULT_VOLUME[sound]} />
        </Sequence>
      ))}
    </>
  );
}

/** Reeks van hetzelfde geluid, bijvoorbeeld binnenkomende kaartjes. */
export function series(start: number, step: number, count: number, sound: Sfx, volume?: number): Cue[] {
  return Array.from({ length: count }, (_, i) => [start + i * step, sound, volume] as Cue);
}
