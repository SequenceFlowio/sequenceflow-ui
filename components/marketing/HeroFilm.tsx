"use client";

import Image from "next/image";
import { CalendarDays, Check, Heart, Mail, Package, Pause, Play, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PRODUCTS } from "@/lib/marketing/products";

import { SequenceMark } from "./SequenceMark";
import { useReducedMotion } from "./useReducedMotion";

/**
 * HeroFilm — de hero van sequenceflow.io als korte, loopende productfilm.
 *
 * Bewust in code in plaats van een videobestand: haarscherp op elk scherm,
 * een fractie van de bestandsgrootte, en teksten zijn gewoon aan te passen.
 * De beelden zijn verzonnen demoschermen, geen echte app-UI, zodat de site
 * niet meeveranderen hoeft als de app dat doet.
 *
 * Elke scène is een laag die met .is-active binnenkomt; de animaties binnen
 * een scène hangen aan die klasse en starten dus bij elke beurt opnieuw.
 * Buiten beeld staat de film stil, en bij reduced motion toont hij alleen
 * de slotscène.
 */

const SCENES = [
  { id: "intro", label: "SequenceFlow", ms: 3600 },
  { id: "support", label: PRODUCTS.support.name, ms: 5600 },
  { id: "content", label: PRODUCTS.content.name, ms: 5600 },
  { id: "outro", label: "Samen", ms: 4200 },
] as const;

const REPLY = "Hoi Sanne, je bestelling #4521 is onderweg met PostNL en wordt morgen bezorgd. Via de track & trace volg je je pakket.";
const TICK_MS = 50;

export function HeroFilm() {
  const ref = useRef<HTMLDivElement | null>(null);
  const reducedMotion = useReducedMotion();
  // Scène en verstreken tijd samen in één state: zo kan een tik nooit twee
  // scènes tegelijk doorschuiven.
  const [{ scene, elapsed }, setClock] = useState({ scene: 0, elapsed: 0 });
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.2 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const running = !paused && visible && !reducedMotion;

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setClock((clock) => {
        const next = clock.elapsed + TICK_MS;
        return next < SCENES[clock.scene].ms
          ? { scene: clock.scene, elapsed: next }
          : { scene: (clock.scene + 1) % SCENES.length, elapsed: 0 };
      });
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [running]);

  // Bij reduced motion: één rustig eindbeeld, volledig uitgeschreven.
  const active = reducedMotion ? SCENES.length - 1 : scene;
  const at = reducedMotion ? Number.POSITIVE_INFINITY : elapsed;
  const typed = active === 1 ? REPLY.slice(0, Math.max(0, Math.floor((at - 1700) / 26))) : REPLY;
  const count = (to: number, from = 900, duration = 1400) => Math.round(Math.min(1, Math.max(0, (at - from) / duration)) * to);

  const jump = (index: number) => setClock({ scene: index, elapsed: 0 });

  return (
    <div className="hf" ref={ref}>
      <div className="hf-screen" aria-label={`Korte film: hoe ${PRODUCTS.support.name} en ${PRODUCTS.content.name} je webshop helpen`} role="img">
        <div className="hf-grid" aria-hidden="true" />
        <div className="hf-glow" aria-hidden="true" />

        {/* 1 · Intro: logo en belofte */}
        <div className={`hf-scene hf-intro${active === 0 ? " is-active" : ""}`} aria-hidden="true">
          <SequenceMark className="hf-intro-mark" size={120} state="happy" title="" />
          <Image className="hf-intro-logo" src="/logo-white.png" alt="" width={420} height={100} />
          <p>AI-agents voor je webshop</p>
        </div>

        {/* 2 · Support One: klantvraag → bestelling → concept */}
        <div className={`hf-scene hf-support${active === 1 ? " is-active" : ""}`} aria-hidden="true">
          <div className="hf-tag"><span />{PRODUCTS.support.name}</div>
          <div className="hf-support-stage">
            <div className="hf-support-left">
            <div className="hf-card hf-mail">
              <div className="hf-card-head"><span className="hf-avatar">S</span><div><strong>Sanne de Vries</strong><small>2 min geleden</small></div><Mail className="hf-head-icon" size={16} /></div>
              <h4>Waar blijft mijn bestelling?</h4>
              <p>Ik had hem vrijdag verwacht, maar heb nog niks gezien…</p>
            </div>
            <div className="hf-card hf-order">
              <Package size={18} />
              <div><strong>Bestelling #4521</strong><small>Onderweg · PostNL</small></div>
              <div className="hf-track"><i className="is-done" /><i className="is-done" /><i /></div>
            </div>
            </div>
            <div className="hf-card hf-reply">
              <div className="hf-card-head"><SequenceMark size={26} title="" /><div><strong>Antwoordconcept</strong><small>Op basis van jouw beleid</small></div></div>
              <p>{typed}<span className="hf-caret" /></p>
              <div className="hf-ready"><Check size={14} /> Klaar om te checken</div>
            </div>
          </div>
        </div>

        {/* 3 · Content One: product → posts → kalender */}
        <div className={`hf-scene hf-content${active === 2 ? " is-active" : ""}`} aria-hidden="true">
          <div className="hf-tag"><span />{PRODUCTS.content.name}</div>
          <div className="hf-content-stage">
            <div className="hf-card hf-product">
              <div className="hf-photo"><Image src="/media/site/content-product.jpg" alt="" fill sizes="220px" loading="eager" /></div>
              <strong>Classic leather sneaker</strong><small>Uit je webshop</small>
            </div>
            <div className="hf-spark"><Sparkles size={22} /></div>
            <div className="hf-posts">
              {(["content-post", "content-example-carousel", "content-example-ugc"] as const).map((photo, index) => (
                <div className={`hf-card hf-post hf-post--${index + 1}`} key={photo}>
                  <div className="hf-photo"><Image src={`/media/site/${photo}.jpg`} alt="" fill sizes="200px" loading="eager" /></div>
                  <div className="hf-post-foot"><Heart size={13} /><span>{["Post", "Carrousel", "Reel"][index]}</span></div>
                </div>
              ))}
            </div>
            <div className="hf-card hf-calendar">
              <CalendarDays size={15} />
              {["ma", "di", "wo", "do", "vr"].map((day, index) => <span key={day} className={`hf-day hf-day--${index + 1}`}>{day}</span>)}
            </div>
          </div>
        </div>

        {/* 4 · Outro: wat het oplevert */}
        <div className={`hf-scene hf-outro${active === 3 ? " is-active" : ""}`} aria-hidden="true">
          <div className="hf-stats">
            <div className="hf-card hf-stat"><span className="hf-stat-icon"><Mail size={18} /></span><strong>{count(12)}</strong><small>klantvragen voorbereid</small><em>{PRODUCTS.support.name}</em></div>
            <div className="hf-card hf-stat"><span className="hf-stat-icon"><CalendarDays size={18} /></span><strong>{count(5, 1150)}</strong><small>posts ingepland</small><em>{PRODUCTS.content.name}</em></div>
          </div>
          <h3>Jij bouwt het merk.<br /><span>Wij doen de rest.</span></h3>
          <Image className="hf-outro-logo" src="/logo-white.png" alt="" width={260} height={62} />
        </div>
      </div>

      <div className="hf-controls">
        <button type="button" className="hf-play" onClick={() => setPaused((value) => !value)} aria-label={paused ? "Film afspelen" : "Film pauzeren"} disabled={reducedMotion}>
          {paused || reducedMotion ? <Play size={14} /> : <Pause size={14} />}
        </button>
        <div className="hf-chapters">
          {SCENES.map((item, index) => {
            const fill = reducedMotion ? 100 : index < active ? 100 : index === active ? (elapsed / item.ms) * 100 : 0;
            return (
              <button type="button" key={item.id} className={index === active ? "is-active" : ""} onClick={() => jump(index)} disabled={reducedMotion}>
                <i><b style={{ width: `${fill}%` }} /></i>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
