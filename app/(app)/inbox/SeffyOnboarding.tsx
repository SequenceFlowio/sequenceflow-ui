"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, Loader2, MessageCircle } from "lucide-react";

import Link from "@/components/shopify/AppLink";
import { SequenceMark } from "@/components/marketing/SequenceMark";
import { ASK_TEAM_EVENT } from "@/lib/assistants/team";
import { appFetch } from "@/lib/shopify/client";

import { ONBOARDING_CSS } from "../inventory/OtisOnboarding";

/**
 * Kennismaking met Seffy bij het eerste bezoek aan de inbox, in dezelfde vorm
 * als die van Otis: vijf korte stappen. De antwoorden gaan naar de bestaande
 * antwoordstijl (/api/agent-config) en zijn later te wijzigen onder
 * Instellingen. "Later" laat alles staan zoals het is.
 */

type Tone = "friendly_informal" | "warm" | "professional" | "concise";
type Pronoun = "informal" | "formal";
type Language = "nl" | "en" | "de" | "fr";
type Start = { replyTone: Tone; replyPronounPreference: Pronoun; languageDefault: Language; senderName: string; signature: string; allowDiscount: boolean; maxDiscountAmount: number | null };

const STEPS = 4;

const TONE_EXAMPLE: Record<Tone, { je: string; u: string; en: string }> = {
  friendly_informal: { je: "Hoi Sanne, goed dat je het even meldt! Je pakket ligt bij PostNL en komt morgen.", u: "Hallo Sanne, goed dat u het even meldt! Uw pakket ligt bij PostNL en komt morgen.", en: "Hi Sanne, thanks for letting us know! Your parcel is with the carrier and arrives tomorrow." },
  warm: { je: "Hoi Sanne, wat vervelend dat je nog moet wachten. Ik heb het voor je nagekeken: je pakket komt morgen.", u: "Beste Sanne, wat vervelend dat u nog moet wachten. Ik heb het voor u nagekeken: uw pakket komt morgen.", en: "Hi Sanne, sorry you're still waiting. I checked for you: your parcel arrives tomorrow." },
  professional: { je: "Beste Sanne, dank voor je bericht. Je bestelling is verzonden en wordt morgen bezorgd.", u: "Beste Sanne, dank voor uw bericht. Uw bestelling is verzonden en wordt morgen bezorgd.", en: "Dear Sanne, thank you for your message. Your order has shipped and will be delivered tomorrow." },
  concise: { je: "Hoi Sanne, je pakket is onderweg en komt morgen.", u: "Beste Sanne, uw pakket is onderweg en komt morgen.", en: "Hi Sanne, your parcel is on its way and arrives tomorrow." },
};

export function SeffyOnboarding({ nl, start, imapActive, knowledgeDocs, onDone }: { nl: boolean; start: Start; imapActive: boolean; knowledgeDocs: number; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [tone, setTone] = useState<Tone>(start.replyTone);
  const [pronoun, setPronoun] = useState<Pronoun>(start.replyPronounPreference);
  const [language, setLanguage] = useState<Language>(start.languageDefault);
  const [senderName, setSenderName] = useState(start.senderName === "Customer Support" ? "" : start.senderName);
  const [signature, setSignature] = useState(start.signature);
  const [discount, setDiscount] = useState(start.allowDiscount);
  const [maxDiscount, setMaxDiscount] = useState(start.maxDiscountAmount ? String(start.maxDiscountAmount) : "10");
  const [learn, setLearn] = useState(imapActive);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [learning, setLearning] = useState(false);

  const max = Number(maxDiscount);
  const stepValid = step === 2 ? signature.trim().length > 0
    : step === 3 ? !discount || (Number.isFinite(max) && max > 0 && max <= 1000)
    : true;

  async function finish() {
    await appFetch("/api/agent-config/onboarding", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: true }) }).catch(() => undefined);
  }

  async function skip() {
    setBusy(true);
    await finish();
    setBusy(false);
    onDone();
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const response = await appFetch("/api/agent-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replyTone: tone, replyPronounPreference: pronoun, languageDefault: language,
          signature: signature.trim(), ...(senderName.trim() ? { senderName: senderName.trim() } : {}),
          allowDiscount: discount, maxDiscountAmount: discount ? max : null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || (nl ? "Opslaan lukte niet." : "Saving failed."));
      if (learn && imapActive) {
        const mined = await appFetch("/api/onboarding/mine", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ monthsBack: 12 }) }).catch(() => null);
        setLearning(Boolean(mined?.ok));
      }
      await finish();
      setStep(5);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  function talk() {
    window.dispatchEvent(new CustomEvent(ASK_TEAM_EVENT, { detail: { send: true, text: nl ? "Seffy, ik heb de kennismaking afgerond. Wat moet je nog weten om goede antwoorden te schrijven?" : "Seffy, I finished the introduction. What else do you need to know to write good replies?" } }));
    onDone();
  }

  const chips = <T extends string>(value: T, set: (next: T) => void, options: ReadonlyArray<readonly [T, string]>) => (
    <div className="otis-chips" role="radiogroup">
      {options.map(([key, label]) => <button key={key} type="button" role="radio" aria-checked={value === key} className={value === key ? "is-active" : ""} onClick={() => set(key)}>{label}</button>)}
    </div>
  );

  return (
    <section className="otis-onboarding seffy-onboarding" aria-label={nl ? "Kennismaken met Seffy" : "Meet Seffy"}>
      <style>{ONBOARDING_CSS + SEFFY_CSS}</style>
      <div className="otis-onboarding-head">
        <span className="otis-onboarding-mark"><SequenceMark size={64} gear="headset" state={busy ? "thinking" : "reading"} title="" /></span>
        <div>
          <span className="otis-eyebrow">SEFFY · {nl ? "JE KLANTENSERVICE-AGENT" : "YOUR SUPPORT AGENT"}</span>
          {step < 5 ? <div className="otis-progress" aria-label={nl ? `Stap ${Math.max(1, step)} van ${STEPS}` : `Step ${Math.max(1, step)} of ${STEPS}`}>{Array.from({ length: STEPS }, (_, index) => <i key={index} className={index < step ? "is-done" : ""} />)}</div> : null}
        </div>
      </div>

      {step === 0 ? (
        <div className="otis-step">
          <h2>{nl ? "Hoi, ik ben Seffy." : "Hi, I'm Seffy."}</h2>
          <p>{nl ? "Ik lees je klantmails, zoek het antwoord op in je kennis en je bestellingen, en schrijf een concept in jouw stijl. Jij kijkt het na en verstuurt het. Vier korte vragen, dan klink ik zoals jouw winkel. Duurt twee minuten." : "I read your customer emails, look up the answer in your knowledge and orders, and write a draft in your style. You check it and send it. Four short questions so I sound like your shop. Takes two minutes."}</p>
          <div className="otis-actions">
            <button type="button" className="settings-btn primary" onClick={() => setStep(1)}>{nl ? "Kennismaken" : "Get started"}<ArrowRight size={14} /></button>
            <button type="button" className="otis-link" disabled={busy} onClick={() => void skip()}>{nl ? "Later, gebruik de standaard" : "Later, use the defaults"}</button>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="otis-step">
          <h2>{nl ? "Hoe klinkt je winkel?" : "How does your shop sound?"}</h2>
          <span className="otis-label">{nl ? "Toon" : "Tone"}</span>
          {chips(tone, setTone, [["friendly_informal", nl ? "Vriendelijk" : "Friendly"], ["warm", nl ? "Warm en meelevend" : "Warm"], ["professional", nl ? "Zakelijk" : "Professional"], ["concise", nl ? "Kort en bondig" : "Short"]] as const)}
          <span className="otis-label">{nl ? "Je of u?" : "Informal or formal?"}</span>
          {chips(pronoun, setPronoun, [["informal", nl ? "Je" : "Informal"], ["formal", nl ? "U" : "Formal"]] as const)}
          <blockquote className="seffy-example"><span>{nl ? "Zo klinkt dat ongeveer" : "Roughly like this"}</span>{nl ? TONE_EXAMPLE[tone][pronoun === "formal" ? "u" : "je"] : TONE_EXAMPLE[tone].en}</blockquote>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="otis-step">
          <h2>{nl ? "Hoe sluit je af?" : "How do you sign off?"}</h2>
          <div className="otis-fields">
            <label><span>{nl ? "Naam als afzender" : "Sender name"}</span><input type="text" maxLength={80} value={senderName} onChange={(event) => setSenderName(event.target.value)} placeholder={nl ? "bijv. Team Studio Lume" : "e.g. Team Studio Lume"} /><small>{nl ? "Dit zien klanten bij wie de mail komt." : "Customers see this as the sender."}</small></label>
            <label><span>{nl ? "Taal als ik het niet zeker weet" : "Language when I'm not sure"}</span>
              <select className="seffy-select" value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
                <option value="nl">Nederlands</option><option value="en">English</option><option value="de">Deutsch</option><option value="fr">Français</option>
              </select>
              <small>{nl ? "Normaal antwoord ik in de taal van de klant." : "Normally I reply in the customer's language."}</small></label>
            <label className="otis-wide"><span>{nl ? "Handtekening onder elk antwoord" : "Signature under every reply"}</span><textarea rows={4} maxLength={600} value={signature} onChange={(event) => setSignature(event.target.value)} placeholder={nl ? "Groetjes,\nSanne van Studio Lume" : "Best,\nSanne from Studio Lume"} /><small>{nl ? "Verplicht: zonder handtekening onderteken ik niet." : "Required: I don't sign without one."}</small></label>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="otis-step">
          <h2>{nl ? "Mag ik een klant iets aanbieden?" : "May I offer a customer something?"}</h2>
          <div className="otis-choices">
            <label className={`otis-choice${!discount ? " is-active" : ""}`}><input type="radio" name="seffy-discount" checked={!discount} onChange={() => setDiscount(false)} /><span className="otis-choice-body"><strong>{nl ? "Nee, nooit zelf een korting voorstellen" : "No, never suggest a discount myself"}<em>{nl ? "Aanbevolen" : "Recommended"}</em></strong><small>{nl ? "Is iemand boos, dan bied ik excuses en een oplossing, geen geld. Jij beslist over compensatie." : "If someone is upset, I apologise and offer a fix, not money. You decide on compensation."}</small></span></label>
            <label className={`otis-choice${discount ? " is-active" : ""}`}><input type="radio" name="seffy-discount" checked={discount} onChange={() => setDiscount(true)} /><span className="otis-choice-body"><strong>{nl ? "Ja, als het past, tot een maximum" : "Yes, when it fits, up to a limit"}</strong>
              <span className="otis-inline-input">€<input type="number" inputMode="decimal" min={1} max={1000} value={maxDiscount} onFocus={() => setDiscount(true)} onChange={(event) => setMaxDiscount(event.target.value)} aria-label={nl ? "Maximale korting in euro" : "Maximum discount in euros"} /></span>
              <small>{nl ? "Alleen in een concept: jij ziet het voordat het verstuurd wordt." : "Only in a draft: you see it before it goes out."}</small></span></label>
          </div>
          <p className="otis-note">{nl ? "Ik voer zelf geen terugbetalingen of retouren uit. Automatisch versturen staat uit; dat zet je later aan onder Instellingen als je me vertrouwt." : "I never run refunds or returns myself. Auto-send is off; switch it on later under Settings once you trust me."}</p>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="otis-step">
          <h2>{nl ? "Waar haal ik mijn antwoorden vandaan?" : "Where do I get my answers?"}</h2>
          <p>{nl ? "Uit je kennis (retourbeleid, verzending, maten) en uit je bestellingen als je winkel gekoppeld is. Hoe meer ik weet, hoe minder je hoeft aan te passen." : "From your knowledge (returns, shipping, sizes) and from your orders when your shop is connected. The more I know, the less you need to edit."}</p>
          <div className="otis-choices">
            {imapActive ? (
              <label className={`otis-choice${learn ? " is-active" : ""}`}><input type="checkbox" checked={learn} onChange={(event) => setLearn(event.target.checked)} /><span className="otis-choice-body"><strong>{nl ? "Leer van mijn antwoorden van het afgelopen jaar" : "Learn from my replies of the past year"}</strong><small>{nl ? "Ik lees je verzonden mail en haal er je afspraken en schrijfstijl uit. Je ziet alles terug onder Agentprofiel en kunt het wissen." : "I read your sent mail and pick up your policies and writing style. You see it all under Agent profile and can remove it."}</small></span></label>
            ) : null}
            <div className="otis-choice seffy-knowledge"><BookOpen size={18} aria-hidden /><span className="otis-choice-body"><strong>{knowledgeDocs ? (nl ? `${knowledgeDocs} ${knowledgeDocs === 1 ? "kennisbron" : "kennisbronnen"} toegevoegd` : `${knowledgeDocs} knowledge ${knowledgeDocs === 1 ? "source" : "sources"} added`) : (nl ? "Nog geen kennis toegevoegd" : "No knowledge added yet")}</strong><small>{nl ? "Begin met je retourbeleid en je verzendinformatie. Dat zijn de vragen die het vaakst komen." : "Start with your returns policy and shipping info. Those are the questions that come most."}</small></span></div>
          </div>
        </div>
      ) : null}

      {step === 5 ? (
        <div className="otis-step">
          <h2>{nl ? "Dank je, ik kan aan de slag." : "Thanks, I'm ready to go."}</h2>
          <p>{learning
            ? (nl ? "Ik lees nu je verzonden mail door; dat duurt even. Nieuwe klantmails krijgen meteen een concept in jouw stijl." : "I'm reading your sent mail now; that takes a while. New customer emails get a draft in your style right away.")
            : (nl ? "Nieuwe klantmails krijgen vanaf nu een concept in jouw stijl. Pas je een concept aan, dan leer ik daarvan." : "New customer emails now get a draft in your style. When you edit a draft, I learn from it.")}</p>
          <div className="otis-actions">
            <Link href="/knowledge" className="settings-btn primary" onClick={onDone}><BookOpen size={14} />{nl ? "Kennis toevoegen" : "Add knowledge"}</Link>
            <button type="button" className="settings-btn" onClick={talk}><MessageCircle size={14} />{nl ? "Vertel Seffy meer" : "Tell Seffy more"}</button>
            <button type="button" className="otis-link" onClick={onDone}>{nl ? "Naar mijn inbox" : "Go to my inbox"}</button>
          </div>
        </div>
      ) : null}

      {error ? <p className="otis-error" role="alert">{error}</p> : null}

      {step >= 1 && step <= 4 ? (
        <div className="otis-actions otis-nav">
          <button type="button" className="otis-link" onClick={() => setStep(step - 1)} disabled={busy}><ArrowLeft size={14} />{nl ? "Terug" : "Back"}</button>
          {step < 4
            ? <button type="button" className="settings-btn primary" disabled={!stepValid} onClick={() => setStep(step + 1)}>{nl ? "Volgende" : "Next"}<ArrowRight size={14} /></button>
            : <button type="button" className="settings-btn primary" disabled={busy} onClick={() => void save()}>{busy ? <Loader2 size={14} className="settings-spin" /> : <Check size={14} />}{nl ? "Opslaan" : "Save"}</button>}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Laat de kennismaking zien als die nog niet gedaan is, alleen aan een
 * beheerder, en alleen als de database er klaar voor is (migratie 075).
 */
export function SeffyOnboardingGate({ nl }: { nl: boolean }) {
  const [state, setState] = useState<{ start: Start; imapActive: boolean; knowledgeDocs: number } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const status = await appFetch("/api/agent-config/onboarding", { cache: "no-store", signal: controller.signal }).then((res) => (res.ok ? res.json() : null));
        if (!status?.ready || status.onboardedAt || !status.canManage) return;
        const [config, setup] = await Promise.all([
          appFetch("/api/agent-config", { cache: "no-store", signal: controller.signal }).then((res) => (res.ok ? res.json() : null)),
          appFetch("/api/integrations/email/setup", { cache: "no-store", signal: controller.signal }).then((res) => (res.ok ? res.json() : null)).catch(() => null),
        ]);
        if (!config?.config || controller.signal.aborted) return;
        const c = config.config;
        setState({
          start: { replyTone: c.replyTone, replyPronounPreference: c.replyPronounPreference, languageDefault: c.languageDefault, senderName: c.senderName ?? "", signature: c.signature ?? "", allowDiscount: Boolean(c.allowDiscount), maxDiscountAmount: c.maxDiscountAmount ?? null },
          imapActive: Boolean(setup?.isImapActive),
          knowledgeDocs: Number(setup?.knowledgeDocCount ?? 0),
        });
      } catch {
        // Geen kennismaking is beter dan een kapotte inbox.
      }
    })();
    return () => controller.abort();
  }, []);

  if (!state) return null;
  return <div style={{ marginBottom: 24 }}><SeffyOnboarding nl={nl} start={state.start} imapActive={state.imapActive} knowledgeDocs={state.knowledgeDocs} onDone={() => setState(null)} /></div>;
}

const SEFFY_CSS = `
.seffy-onboarding .otis-fields textarea,.seffy-select{padding:10px 12px;border:1px solid color-mix(in srgb,var(--text) 20%,transparent);border-radius:10px;background:transparent;color:var(--text);font:inherit;font-size:14px;line-height:1.5;resize:vertical}
.seffy-select{height:42px;padding:0 10px}
.seffy-select option{color:#111}
.seffy-example{margin:4px 0 0;padding:14px 16px;border-left:3px solid var(--tone-success,#C7F56F);border-radius:0 12px 12px 0;background:color-mix(in srgb,var(--text) 4%,transparent);color:var(--text);font-size:14px;line-height:1.6}
.seffy-example span{display:block;margin-bottom:4px;color:var(--muted);font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase}
.seffy-knowledge{cursor:default;align-items:flex-start}
.seffy-knowledge>svg{flex:none;margin-top:2px;color:var(--tone-success,#C7F56F)}
.seffy-onboarding a.settings-btn{text-decoration:none}
`;
