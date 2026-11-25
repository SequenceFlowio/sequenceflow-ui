"use client";

import { Clock, PlayCircle, X } from "lucide-react";
import { useEffect, useState } from "react";

/** Eén les in de lessenlijst: met video opent een klik de speler, zonder video staat er "binnenkort". */
export function AcademyLesson({ index, title, description, minutes, video, poster, lang }: {
  index: number; title: string; description: string; minutes: number; video?: string; poster?: string; lang: "nl" | "en";
}) {
  const nl = lang === "nl";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!video) {
    return (
      <li className="is-soon">
        <span className="ac-thumb" aria-hidden><span>{index + 1}</span></span>
        <div><strong>{title}</strong><small>{description}</small></div>
        <span className="ac-meta"><Clock size={11} aria-hidden /> {nl ? "Binnenkort" : "Soon"}</span>
      </li>
    );
  }

  return (
    <li className="is-ready">
      <button type="button" className="ac-play" onClick={() => setOpen(true)} aria-label={nl ? `Bekijk: ${title}` : `Watch: ${title}`}>
        <span className="ac-thumb" aria-hidden><PlayCircle size={22} /></span>
        <div><strong>{title}</strong><small>{description}</small></div>
        <span className="ac-meta">{minutes} min</span>
      </button>
      {open ? (
        <div className="ac-player" role="dialog" aria-modal="true" aria-label={title} onClick={() => setOpen(false)}>
          <div className="ac-player-box" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="ac-player-close" onClick={() => setOpen(false)} aria-label={nl ? "Sluiten" : "Close"}><X size={20} /></button>
            <video src={video} poster={poster} controls autoPlay playsInline preload="metadata" />
            <p><strong>{title}</strong> · {minutes} min</p>
          </div>
        </div>
      ) : null}
    </li>
  );
}
