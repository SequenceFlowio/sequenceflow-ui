"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, Lock, RefreshCw, Sparkles, Target } from "lucide-react";

import type { AnalyticsDays } from "@/lib/analytics/core";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

/**
 * Pijnpunten: waar klanten tegenaan lopen. De AI bundelt de klantvragen van
 * de gekozen periode tot thema's, met aantal, aandeel, uitleg en advies.
 * Growth en hoger; andere pakketten zien een voorbeeld en hoe ze het krijgen.
 */

type PainPoint = { category: string; count: number; percentage: number; description: string; recommended_action: string };
type Analysis = {
  intro: string;
  pain_points: PainPoint[];
  generated_at: string;
  ticket_count: number;
  sampled_ticket_count: number;
  canRefresh: boolean;
};
type State =
  | { kind: "loading" }
  | { kind: "locked" }
  | { kind: "insufficient"; count: number; minimum: number }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: Analysis };

const DAYS: AnalyticsDays[] = [7, 30, 90];
const PERIOD: Record<AnalyticsDays, "weekly" | "monthly" | "quarterly"> = { 7: "weekly", 30: "monthly", 90: "quarterly" };

/** Wat een Starter-account te zien krijgt: hoe het eruitziet, met een voorbeeldwinkel. */
const EXAMPLE: Analysis = {
  intro: "Deze maand gaat bijna de helft van de klantvragen over ontbrekende wieltjes bij de speelgoedauto. Daarnaast vragen klanten vaak naar de levertijd naar België.",
  generated_at: "2026-11-06T12:00:00.000Z",
  ticket_count: 31,
  sampled_ticket_count: 31,
  canRefresh: false,
  pain_points: [
    { category: "Wieltjes ontbreken bij de speelgoedauto", count: 14, percentage: 45, description: "Klanten melden dat er bij levering één of meer wieltjes missen.", recommended_action: "Open steekproefsgewijs een paar dozen en vraag je leverancier de volgende levering extra te controleren." },
    { category: "Levertijd naar België", count: 9, percentage: 29, description: "Klanten weten niet hoe lang verzending naar België duurt.", recommended_action: "Zet de levertijd per land op de productpagina en in de bevestigingsmail." },
    { category: "Batterijen niet meegeleverd", count: 8, percentage: 26, description: "Klanten verwachten dat de batterijen in de doos zitten.", recommended_action: "Vermeld in de productbeschrijving welke batterijen nodig zijn." },
  ],
};

export default function PainPointsPage() {
  const { language } = useTranslation();
  const nl = language === "nl";
  const [days, setDays] = useState<AnalyticsDays>(30);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: "loading" });
    load("GET", controller.signal).then((next) => { if (next) setState(next); });
    return () => controller.abort();
  }, [days, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load(method: "GET" | "POST", signal?: AbortSignal): Promise<State | null> {
    const failed = nl ? "Pijnpunten konden niet laden." : "Pain points could not load.";
    try {
      const response = await fetch(`/api/analytics/pain-points?period=${PERIOD[days]}`, { method, cache: "no-store", signal });
      const body = await response.json().catch(() => ({}));
      if (response.status === 403 && body.upgrade) return { kind: "locked" };
      if (!response.ok) return { kind: "error", message: body.error || failed };
      if (body.insufficient) return { kind: "insufficient", count: body.ticketCount ?? 0, minimum: body.minimum ?? 5 };
      return { kind: "ready", data: body as Analysis };
    } catch (error) {
      if ((error as Error).name === "AbortError") return null;
      return { kind: "error", message: failed };
    }
  }

  async function refresh() {
    setRefreshing(true);
    const next = await load("POST");
    if (next) setState(next);
    setRefreshing(false);
  }

  return (
    <main className="ppg">
      <PageStyles />
      <header className="ppg-head">
        <div>
          <p className="ppg-kicker"><Target size={14} /> {nl ? "Pijnpunten" : "Pain points"}</p>
          <h1>{nl ? "Waar lopen je klanten tegenaan?" : "Where do your customers get stuck?"}</h1>
          <p>{nl ? "Support One bundelt je klantvragen tot thema's en zegt wat je bij de bron kunt verbeteren. Los je dat op, dan komt dezelfde vraag minder vaak binnen." : "Support One groups your customer questions into themes and tells you what to fix at the source, so the same question comes in less often."}</p>
        </div>
        <div className="ppg-controls">
          {state.kind !== "locked" ? (
            <div className="ppg-period" aria-label={nl ? "Periode" : "Period"}>
              {DAYS.map((value) => (
                <button type="button" key={value} className={days === value ? "active" : ""} aria-pressed={days === value} onClick={() => setDays(value)}>{nl ? `${value} dagen` : `${value} days`}</button>
              ))}
            </div>
          ) : null}
          {state.kind === "ready" && state.data.canRefresh ? (
            <button type="button" className="ppg-refresh" onClick={refresh} disabled={refreshing}>
              <RefreshCw size={14} className={refreshing ? "ppg-spin" : ""} /> {nl ? "Opnieuw analyseren" : "Analyse again"}
            </button>
          ) : null}
        </div>
      </header>

      {state.kind === "loading" ? (
        <div className="ppg-loading">
          <div className="ppg-skel" style={{ height: 120 }} />
          <div className="ppg-skel" style={{ height: 220 }} />
          <p>{nl ? "Klantvragen worden geanalyseerd… De eerste keer duurt dit een paar seconden." : "Analysing customer questions… The first time takes a few seconds."}</p>
        </div>
      ) : state.kind === "locked" ? (
        <div className="ppg-locked">
          <div className="ppg-locked-preview" aria-hidden="true"><Result data={EXAMPLE} nl={nl} example /></div>
          <div className="ppg-locked-card">
            <span><Lock size={18} /></span>
            <h2>{nl ? "Pijnpunten zit in Growth en Scale" : "Pain points are included in Growth and Scale"}</h2>
            <p>{nl ? "Zie welk probleem het vaakst terugkomt en krijg AI-advies om het bij de bron op te lossen. Op de achtergrond zie je een voorbeeld van een speelgoedwinkel." : "See which problem comes back most and get AI advice to fix it at the source. In the background is an example from a toy store."}</p>
            <Link href="/settings?tab=billing" className="ppg-cta">{nl ? "Bekijk plannen" : "View plans"} <ArrowUpRight size={14} /></Link>
          </div>
        </div>
      ) : state.kind === "insufficient" ? (
        <div className="ppg-empty">
          <span><Target size={20} /></span>
          <h2>{nl ? "Nog te weinig klantvragen" : "Not enough customer questions yet"}</h2>
          <p>{nl ? `Voor een betrouwbaar beeld zijn er minstens ${state.minimum} klantvragen nodig in deze periode; nu zijn het er ${state.count}. Kies een langere periode of kom later terug.` : `A reliable picture needs at least ${state.minimum} customer questions in this period; there are ${state.count}. Pick a longer period or come back later.`}</p>
        </div>
      ) : state.kind === "error" ? (
        <div className="ppg-error"><AlertCircle size={18} /><div><strong>{state.message}</strong><button type="button" onClick={() => setReloadKey((value) => value + 1)}>{nl ? "Opnieuw proberen" : "Try again"}</button></div></div>
      ) : (
        <Result data={state.data} nl={nl} />
      )}
    </main>
  );
}

function Result({ data, nl, example = false }: { data: Analysis; nl: boolean; example?: boolean }) {
  const points = [...data.pain_points].sort((a, b) => b.count - a.count);
  const [top, ...rest] = points;
  const when = new Date(data.generated_at).toLocaleString(nl ? "nl-NL" : "en-GB", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  const questions = (count: number) => (nl ? (count === 1 ? "vraag" : "vragen") : (count === 1 ? "question" : "questions"));

  return (
    <div className="ppg-result">
      <section className="ppg-summary">
        <p className="ppg-label"><Sparkles size={14} /> {example ? (nl ? "Voorbeeld" : "Example") : (nl ? "Samenvatting" : "Summary")}</p>
        <p className="ppg-intro">{data.intro}</p>
        <div className="ppg-stats">
          <span><b>{data.ticket_count}</b> {nl ? "klantvragen" : "customer questions"}</span>
          <span><b>{points.length}</b> {nl ? (points.length === 1 ? "thema" : "thema's") : (points.length === 1 ? "theme" : "themes")}</span>
          {!example ? <span>{nl ? `Geanalyseerd ${when}` : `Analysed ${when}`}</span> : null}
        </div>
      </section>

      {top ? (
        <section className="ppg-top">
          <div className="ppg-top-main">
            <p className="ppg-rank-label">{nl ? "Grootste pijnpunt" : "Biggest pain point"}</p>
            <h2>{top.category}</h2>
            <p className="ppg-desc">{top.description}</p>
            <div className="ppg-advice"><b>✦ {nl ? "Advies" : "Advice"}</b><p>{top.recommended_action}</p></div>
          </div>
          <div className="ppg-top-count">
            <Ring value={top.percentage} />
            <strong>{top.count}</strong>
            <small>{questions(top.count)}</small>
          </div>
        </section>
      ) : null}

      {rest.length ? (
        <section className="ppg-grid">
          {rest.map((point, index) => (
            <article key={point.category}>
              <div className="ppg-card-head">
                <span className="ppg-num">{index + 2}</span>
                <h3>{point.category}</h3>
              </div>
              <div className="ppg-bar"><i style={{ width: `${Math.max(4, point.percentage)}%` }} /></div>
              <p className="ppg-count"><b>{point.count}</b> {questions(point.count)} · {point.percentage}%</p>
              <p className="ppg-desc">{point.description}</p>
              <div className="ppg-advice"><b>✦ {nl ? "Advies" : "Advice"}</b><p>{point.recommended_action}</p></div>
            </article>
          ))}
        </section>
      ) : null}

      {!example ? (
        <p className="ppg-meta">{nl ? `Gebaseerd op ${data.sampled_ticket_count} van ${data.ticket_count} klantvragen. Spam en mail die geen klantvraag is tellen niet mee.` : `Based on ${data.sampled_ticket_count} of ${data.ticket_count} customer questions. Spam and mail that isn't a customer question are left out.`}</p>
      ) : null}
    </div>
  );
}

/** Aandeel van alle klantvragen, als ring. */
function Ring({ value }: { value: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ppg-ring" viewBox="0 0 84 84" width="84" height="84" aria-label={`${value}%`}>
      <circle cx="42" cy="42" r={r} fill="none" stroke="var(--sf-border)" strokeWidth="7" />
      <circle cx="42" cy="42" r={r} fill="none" stroke="var(--sf-green)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 42 42)" />
      <text x="42" y="47" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--sf-text)">{value}%</text>
    </svg>
  );
}

function PageStyles() {
  return <style>{`
    .ppg{width:min(100%,1120px);margin:0 auto;padding:40px 24px 72px;color:var(--sf-text)}
    .ppg-head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:24px}
    .ppg-head h1{margin:6px 0 0;font-size:30px;font-weight:500;line-height:1.15;letter-spacing:-.02em}
    .ppg-head>div>p:last-child{max-width:640px;margin:8px 0 0;color:var(--sf-text-muted);font-size:14px;line-height:1.6}
    .ppg-kicker{display:flex;align-items:center;gap:6px;margin:0;color:var(--tone-success);font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
    .ppg-controls{display:flex;flex-direction:column;align-items:flex-end;gap:10px;flex:none}
    .ppg-period{display:flex;gap:3px;padding:4px;border:1px solid var(--sf-border);border-radius:8px;background:var(--sf-surface)}
    .ppg-period button{height:34px;padding:0 13px;border:0;border-radius:6px;background:transparent;color:var(--sf-text-muted);font:750 12px inherit;cursor:pointer}
    .ppg-period button.active{background:var(--sf-surface-2);color:var(--sf-text)}
    .ppg-refresh{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border:1px solid var(--sf-border);border-radius:8px;background:transparent;color:var(--sf-text-muted);font:700 12px inherit;cursor:pointer}
    .ppg-refresh:hover{color:var(--sf-text)}.ppg-refresh:disabled{opacity:.6;cursor:not-allowed}
    .ppg-spin{animation:ppgSpin .8s linear infinite}@keyframes ppgSpin{to{transform:rotate(360deg)}}

    .ppg-result{display:grid;gap:16px}
    .ppg-summary{padding:20px 22px;border:1px solid rgba(199,245,111,.25);border-radius:18px;background:linear-gradient(135deg,rgba(199,245,111,.09),rgba(199,245,111,.02))}
    .ppg-label{display:flex;align-items:center;gap:6px;margin:0 0 8px;color:var(--tone-success);font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
    .ppg-intro{margin:0;max-width:820px;font-size:16px;line-height:1.6;color:var(--sf-text)}
    .ppg-stats{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
    .ppg-stats span{padding:5px 10px;border:1px solid var(--sf-border);border-radius:999px;background:var(--sf-surface);color:var(--sf-text-muted);font-size:12px}
    .ppg-stats b{color:var(--sf-text);font-variant-numeric:tabular-nums}

    .ppg-top{display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center;padding:24px;border:1px solid var(--sf-border);border-radius:18px;background:var(--sf-surface)}
    .ppg-rank-label{margin:0;color:var(--tone-warning);font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
    .ppg-top h2{margin:6px 0 0;font-size:22px;font-weight:600;line-height:1.3;letter-spacing:-.01em}
    .ppg-top-count{display:grid;justify-items:center;gap:2px;min-width:120px}
    .ppg-top-count strong{margin-top:6px;font-size:30px;font-weight:650;line-height:1;color:var(--tone-success);font-variant-numeric:tabular-nums}
    .ppg-top-count small{color:var(--sf-text-muted);font-size:12px}
    .ppg-desc{margin:8px 0 0;color:var(--sf-text-muted);font-size:13px;line-height:1.6}
    .ppg-advice{margin-top:14px;padding:12px 14px;border-radius:12px;border:1px solid rgba(199,245,111,.2);background:rgba(199,245,111,.06)}
    .ppg-advice b{display:block;margin-bottom:4px;color:var(--tone-success);font-size:12px}
    .ppg-advice p{margin:0;font-size:13px;line-height:1.6;color:var(--sf-text-secondary)}

    .ppg-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
    .ppg-grid article{padding:20px;border:1px solid var(--sf-border);border-radius:18px;background:var(--sf-surface)}
    .ppg-card-head{display:flex;align-items:flex-start;gap:10px}
    .ppg-num{width:26px;height:26px;display:grid;place-items:center;flex:none;border-radius:7px;background:var(--sf-surface-2);color:var(--sf-text-muted);font-size:11px;font-weight:800}
    .ppg-grid h3{margin:2px 0 0;font-size:15px;font-weight:600;line-height:1.35}
    .ppg-bar{height:6px;margin-top:14px;border-radius:999px;background:var(--sf-border);overflow:hidden}
    .ppg-bar i{display:block;height:100%;border-radius:inherit;background:var(--sf-green);opacity:.75}
    .ppg-count{margin:8px 0 0;color:var(--sf-text-muted);font-size:12px}.ppg-count b{color:var(--sf-text)}
    .ppg-meta{margin:4px 0 0;color:var(--sf-text-muted);font-size:12px}

    .ppg-loading{display:grid;gap:16px}.ppg-loading p{margin:0;color:var(--sf-text-muted);font-size:12px}
    .ppg-skel{border-radius:18px;background:linear-gradient(90deg,var(--sf-surface-2) 20%,var(--sf-bg) 50%,var(--sf-surface-2) 80%);background-size:220% 100%;animation:ppgSkel 1.2s infinite}@keyframes ppgSkel{to{background-position:-20% 0}}
    .ppg-empty{display:grid;justify-items:center;gap:8px;padding:56px 24px;border:1px solid var(--sf-border);border-radius:18px;background:var(--sf-surface);text-align:center}
    .ppg-empty>span{width:42px;height:42px;display:grid;place-items:center;border-radius:10px;background:var(--sf-surface-2);color:var(--sf-text-muted)}
    .ppg-empty h2{margin:6px 0 0;font-size:16px;font-weight:600}.ppg-empty p{max-width:460px;margin:0;color:var(--sf-text-muted);font-size:13px;line-height:1.6}
    .ppg-error{display:flex;gap:10px;padding:14px;border:1px solid rgba(248,113,113,.32);border-radius:12px;background:rgba(248,113,113,.1);color:var(--tone-danger);font-size:13px}
    .ppg-error button{display:block;margin-top:6px;padding:0;border:0;background:transparent;color:inherit;font:800 12px inherit;cursor:pointer}

    .ppg-locked{position:relative}
    .ppg-locked-preview{filter:blur(1.5px);opacity:.45;pointer-events:none;user-select:none;max-height:520px;overflow:hidden;-webkit-mask-image:linear-gradient(#000 55%,transparent);mask-image:linear-gradient(#000 55%,transparent)}
    .ppg-locked-card{position:absolute;left:50%;top:200px;transform:translateX(-50%);width:min(440px,calc(100% - 32px));padding:24px;border:1px solid var(--sf-border);border-radius:18px;background:var(--sf-surface);box-shadow:0 24px 60px rgba(0,0,0,.45);text-align:center}
    .ppg-locked-card>span{width:42px;height:42px;display:inline-grid;place-items:center;border-radius:10px;background:rgba(245,196,88,.12);color:var(--tone-warning)}
    .ppg-locked-card h2{margin:12px 0 0;font-size:17px;font-weight:600}.ppg-locked-card p{margin:8px 0 0;color:var(--sf-text-muted);font-size:13px;line-height:1.6}
    .ppg-cta{display:inline-flex;align-items:center;gap:6px;margin-top:16px;padding:10px 16px;border-radius:10px;background:var(--sf-green);color:#142000;font-size:13px;font-weight:700;text-decoration:none}

    @media(max-width:900px){.ppg-grid{grid-template-columns:1fr}}
    @media(max-width:640px){.ppg{padding:28px 16px 56px}.ppg-head{flex-direction:column;align-items:stretch}.ppg-controls{align-items:stretch}.ppg-period button{flex:1}.ppg-top{grid-template-columns:1fr}.ppg-top-count{grid-template-columns:auto auto auto;align-items:center;justify-content:start;gap:10px}.ppg-top-count strong{margin:0}.ppg-locked-card{top:120px}}
  `}</style>;
}
