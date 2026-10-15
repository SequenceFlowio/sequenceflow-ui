"use client";

import { useId, useRef, useState } from "react";
import { Play, X } from "lucide-react";
import guide from "@/lib/email/setup/gmail-app-password.json";

type Props = { language: "nl" | "en" };

export default function GmailSetupVideo({ language }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const id = useId();
  const nl = language === "nl";
  const content = guide[language];
  const asset = `/media/setup/gmail-app-password-${language}`;

  function show() {
    setFailed(false);
    dialogRef.current?.showModal();
    setOpen(true);
  }

  return <>
    <button type="button" className="gmail-video-trigger" onClick={show} aria-haspopup="dialog">
      <span className="gmail-video-play"><Play size={16} aria-hidden="true" /></span>
      <span><strong>{nl ? "Gmail koppelen? Bekijk de uitleg" : "Connecting Gmail? Watch the guide"}</strong><small>{nl ? "Met een app-wachtwoord · 56 seconden · zonder geluid" : "With an app password · 56 seconds · no sound"}</small></span>
    </button>
    <dialog ref={dialogRef} className="gmail-video-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-note`} onClose={() => setOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current?.close(); }}>
      <div className="gmail-video-content">
        <header><div><h3 id={`${id}-title`}>{content.title}</h3><p id={`${id}-note`}>{content.note}</p></div><button type="button" aria-label={nl ? "Video sluiten" : "Close video"} onClick={() => dialogRef.current?.close()}><X size={20} aria-hidden="true" /></button></header>
        {open && !failed ? <video key={language} controls playsInline autoPlay muted preload="none" poster={`${asset}.png`} onError={() => setFailed(true)} aria-label={content.title}>
          <source src={`${asset}.mp4`} type="video/mp4" onError={() => setFailed(true)} />
          {nl ? "Je browser kan deze video niet afspelen. Lees de stappen hieronder." : "Your browser cannot play this video. Read the steps below."}
        </video> : null}
        {failed ? <p role="alert" className="gmail-video-error">{nl ? "De video kon niet laden. Hieronder staan dezelfde stappen." : "The video could not load. The same steps are available below."}</p> : null}
        <details open={failed}><summary>{nl ? "Liever lezen? Bekijk alle stappen" : "Prefer reading? View all steps"}</summary><ol>{content.steps.map((step) => <li key={step.title}><strong>{step.title}</strong><p>{step.instruction} {step.caption}</p></li>)}</ol></details>
        <footer><a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer">{nl ? "Open Google App-wachtwoorden" : "Open Google App passwords"} ↗</a><span>{nl ? "Geen App-wachtwoorden beschikbaar? Vraag hulp via ‘Hulp van ons team’." : "App passwords unavailable? Contact us through ‘Help from our team’."}</span></footer>
      </div>
    </dialog>
    <style>{`
      .gmail-video-trigger{display:flex;align-items:center;gap:12px;width:100%;padding:14px 16px;text-align:left;border:1px solid var(--border);border-radius:12px;background:var(--surface-2);color:var(--text);cursor:pointer;font:inherit}
      .gmail-video-trigger:hover{border-color:var(--tone-success)}.gmail-video-trigger:focus-visible,.gmail-video-content button:focus-visible,.gmail-video-content summary:focus-visible{outline:2px solid var(--tone-success);outline-offset:3px}
      .gmail-video-play{display:grid;place-items:center;width:36px;height:36px;flex:none;border-radius:50%;background:rgba(199,245,111,.12);color:var(--tone-success)}.gmail-video-trigger strong{display:block;font-size:13px;font-weight:600}.gmail-video-trigger small{display:block;margin-top:4px;font-size:12px;color:var(--muted)}
      .gmail-video-dialog{width:min(900px,calc(100vw - 32px));max-width:900px;max-height:calc(100dvh - 32px);padding:0;border:1px solid var(--border);border-radius:18px;background:var(--surface);color:var(--text);overflow:auto;box-shadow:0 24px 100px rgba(0,0,0,.4)}.gmail-video-dialog::backdrop{background:rgba(0,0,0,.78)}
      .gmail-video-content header{display:flex;align-items:flex-start;gap:16px;padding:20px}.gmail-video-content header>div{flex:1;min-width:0}.gmail-video-content h3{margin:0;font-size:18px;font-weight:500}.gmail-video-content header p{margin:7px 0 0;max-width:650px;color:var(--muted);font-size:12px;line-height:1.6}.gmail-video-content header button{display:grid;place-items:center;flex:none;width:36px;height:36px;border:1px solid var(--border);border-radius:9px;background:var(--surface-2);color:var(--text);cursor:pointer}
      .gmail-video-content video{display:block;width:100%;aspect-ratio:16/9;background:#0a0a0a}.gmail-video-content details{padding:18px 20px;border-top:1px solid var(--border);font-size:13px;line-height:1.6}.gmail-video-content summary{cursor:pointer;font-weight:600}.gmail-video-content ol{padding-left:22px;margin:16px 0 0}.gmail-video-content li{padding:0 0 12px 4px}.gmail-video-content li p{margin:4px 0 0;color:var(--muted)}.gmail-video-content footer{display:grid;gap:8px;padding:0 20px 20px;font-size:12px;line-height:1.6}.gmail-video-content footer a{color:var(--tone-success);text-decoration:underline;text-underline-offset:3px}.gmail-video-content footer span{color:var(--muted)}.gmail-video-error{padding:20px;color:var(--muted)}
      @media(max-width:560px){.gmail-video-content header{padding:16px}.gmail-video-content h3{font-size:16px}.gmail-video-dialog{width:calc(100vw - 20px);max-height:calc(100dvh - 20px)}}
    `}</style>
  </>;
}
