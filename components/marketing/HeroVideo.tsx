"use client";

import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useReducedMotion } from "./useReducedMotion";

/**
 * De Support One-video onder de hero. Speelt vanzelf en zonder geluid (anders
 * blokkeren browsers autoplay); rechtsonder een pauze- en een geluidsknop.
 *
 * Bestanden in public/media/video/, gemaakt uit de 27 MB-HEVC-master:
 * WebM (VP9) voor de meeste browsers, MP4 (H.264) als terugval en voor Safari,
 * en een lichtere 720p-MP4 voor telefoons. De poster staat er meteen, dus de
 * video vertraagt het eerste beeld van de pagina niet.
 *
 * Buiten beeld pauzeert hij (scheelt batterij en data); terug in beeld speelt
 * hij weer, tenzij de bezoeker zelf op pauze drukte. Wie minder beweging wil
 * (prefers-reduced-motion), krijgt geen autoplay maar de poster met een knop.
 */

const BASE = "/media/video/support-one";

export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const userPaused = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const reduced = useReducedMotion();

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (reduced) {
      userPaused.current = true;
      video.pause();
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) video.pause();
      else if (!userPaused.current) video.play().catch(() => {});
    }, { threshold: 0.25 });
    observer.observe(video);
    return () => observer.disconnect();
  }, [reduced]);

  function togglePlay() {
    const video = ref.current;
    if (!video) return;
    if (video.paused) {
      userPaused.current = false;
      video.play().catch(() => {});
    } else {
      userPaused.current = true;
      video.pause();
    }
  }

  function toggleMute() {
    const video = ref.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    // Geluid aan betekent dat iemand wil kijken: dan ook afspelen.
    if (!video.muted && video.paused) togglePlay();
  }

  return (
    <div className="s1-video">
      <video
        ref={ref}
        autoPlay={!reduced}
        muted
        loop
        playsInline
        preload="metadata"
        poster={`${BASE}-poster.jpg`}
        aria-label="Video: Seffy en Otis van Support One aan het werk"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
      >
        <source src={`${BASE}-720.mp4`} type="video/mp4" media="(max-width: 760px)" />
        <source src={`${BASE}-1080.webm`} type="video/webm" />
        <source src={`${BASE}-1080.mp4`} type="video/mp4" />
      </video>
      <div className="s1-video-controls">
        <button type="button" onClick={togglePlay} aria-label={playing ? "Video pauzeren" : "Video afspelen"}>
          {playing ? <Pause size={17} fill="currentColor" strokeWidth={0} /> : <Play size={17} fill="currentColor" strokeWidth={0} />}
        </button>
        <button type="button" onClick={toggleMute} aria-label={muted ? "Geluid aan" : "Geluid uit"} aria-pressed={!muted}>
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>
    </div>
  );
}
