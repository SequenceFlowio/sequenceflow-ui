"use client";

import { Pause, Play, Volume2, VolumeX, Maximize, Minimize } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SequenceMark } from "./SequenceMark";

/**
 * De Support One-video onder de hero. Geen autoplay: dan mis je het begin en
 * het geluid. Je start hem zelf met de grote knop in het midden, vanaf het
 * begin en met geluid. Daarna staan onderin een witte spoelbalk en rechts de
 * pauze- en geluidsknop.
 *
 * Bestanden in public/media/video/, gemaakt uit de 27 MB-HEVC-master:
 * WebM (VP9) voor de meeste browsers, MP4 (H.264) als terugval en voor Safari,
 * en een lichtere 720p-MP4 voor telefoons. Tot de klik laadt alleen de poster
 * en de metadata, dus de video vertraagt de pagina niet.
 */

const BASE = "/media/video/support-one";

function clock(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");
  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === container.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  async function toggleFullscreen() {
    setFullscreenError("");
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (container.current?.requestFullscreen) await container.current.requestFullscreen();
      else {
        const video = ref.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
        if (video?.webkitEnterFullscreen) video.webkitEnterFullscreen();
        else setFullscreenError("Volledig scherm is niet beschikbaar in deze browser.");
      }
    } catch {
      setFullscreenError("Volledig scherm kon niet worden geopend. Probeer het opnieuw.");
    }
  }
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  function start() {
    const video = ref.current;
    if (!video) return;
    video.currentTime = 0;
    video.muted = false;
    setStarted(true);
    video.play().catch(() => {
      // Mag het niet met geluid (sommige browsers), dan zonder: de knop staat er.
      video.muted = true;
      video.play().catch(() => {});
    });
  }

  function togglePlay() {
    const video = ref.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }

  function toggleMute() {
    const video = ref.current;
    if (video) video.muted = !video.muted;
  }

  function seek(value: number) {
    const video = ref.current;
    if (!video) return;
    video.currentTime = value;
    setTime(value);
  }

  const progress = duration ? (time / duration) * 100 : 0;

  return (
    <div ref={container} className={`s1-video${started ? " is-started" : ""}`}>
      <video
        ref={ref}
        playsInline
        preload="metadata"
        poster={`${BASE}-poster.jpg`}
        aria-label="Video: Seffy en Otis van Support One aan het werk"
        onClick={started ? togglePlay : start}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
        // Metadata kan al binnen zijn voordat React luistert; daarom ook bij
        // elke tijdsupdate de duur meenemen.
        onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => { setTime(event.currentTarget.currentTime); setDuration(event.currentTarget.duration || 0); }}
      >
        <source src={`${BASE}-720.mp4`} type="video/mp4" media="(max-width: 760px)" />
        <source src={`${BASE}-1080.webm`} type="video/webm" />
        <source src={`${BASE}-1080.mp4`} type="video/mp4" />
      </video>

      {!started && <div className="s1-video-cover" aria-hidden="true">
        <div className="s1-cover-copy"><span className="s1-cover-kicker">SUPPORT ONE · PRODUCTTOUR</span><h2>Je nieuwe collega’s.<br /><em>Aan het werk.</em></h2><p>Klantmails en voorraad.<br />Jij houdt de controle.</p></div>
        <div className="s1-cover-preview">
          <div className="s1-cover-mail"><div><SequenceMark size={34} title="" state="observing" /><span>Seffy <small>Antwoord klaar</small></span></div><p>Waar blijft mijn bestelling?</p><blockquote>Hoi Sanne, je bestelling is onderweg. Hier vind je de laatste verzendstatus.</blockquote><span className="s1-cover-ready">Klaar voor jouw controle</span></div>
          <div className="s1-cover-stock"><SequenceMark size={32} gear="analyst" state="observing" title="" /><span>Otis <small>Voorraad vraagt aandacht</small></span><strong>6 dagen<small>tot deze variant op is</small></strong></div>
        </div>
      </div>}
      <button type="button" className="s1-video-fullscreen" onClick={toggleFullscreen} aria-label={fullscreen ? "Volledig scherm sluiten" : "Volledig scherm openen"}>
        {fullscreen ? <Minimize size={19} /> : <Maximize size={19} />}
      </button>
      {fullscreenError && <p role="status" className="s1-video-error">{fullscreenError}</p>}
      {!started && (
        <button type="button" className="s1-video-start" onClick={start} aria-label="Video afspelen, met geluid">
          <Play size={30} fill="currentColor" strokeWidth={0} />
        </button>
      )}

      {started && (
        <div className="s1-video-bar">
          <span className="s1-video-time">{clock(time)}</span>
          <input
            type="range"
            className="s1-video-seek"
            min={0}
            max={duration || 0}
            step={0.1}
            value={time}
            onChange={(event) => seek(Number(event.target.value))}
            aria-label="Spoelen"
            aria-valuetext={`${clock(time)} van ${clock(duration)}`}
            style={{ "--p": `${progress}%` } as React.CSSProperties}
          />
          <span className="s1-video-time">{clock(duration)}</span>
          <button type="button" onClick={togglePlay} aria-label={playing ? "Video pauzeren" : "Video afspelen"}>
            {playing ? <Pause size={17} fill="currentColor" strokeWidth={0} /> : <Play size={17} fill="currentColor" strokeWidth={0} />}
          </button>
          <button type="button" onClick={toggleMute} aria-label={muted ? "Geluid aan" : "Geluid uit"} aria-pressed={!muted}>
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      )}
    </div>
  );
}
