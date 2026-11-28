/**
 * Opvolging van proefaccounts: welke mail van Navaron er op dag 2, 7 en 12 klaar
 * moet staan, en wat erin staat, afhankelijk van hoe ver iemand is (mailbox
 * gekoppeld, eerste concept, eerste verstuurd). Geen netwerk of database.
 *
 * Er gaat nooit automatisch iets weg: dit maakt concepten, een beheerder verstuurt.
 */

export const TRIAL_STEPS = [2, 7, 12] as const;
export type TrialStep = (typeof TRIAL_STEPS)[number];
const DAY_MS = 24 * 60 * 60 * 1000;
/** Een stap die langer dan dit geleden had gemoeten, zetten we niet meer klaar. */
const STALE_DAYS = 4;

export type TrialState = {
  tenantId: string; createdAt: string; plan: string; trialEndsAt: string | null;
  connectedAt: string | null; firstDraftAt: string | null; firstSentAt: string | null;
  paying: boolean; internal: boolean;
};

export type FollowupDraft = { step: TrialStep; variant: string; dueAt: string; subject: string; body: string };

export type FollowupLinks = { upgradeUrl: string; demoUrl: string | null; knowledgeUrl: string };

const SIGN = "Groet,\nNavaron\nSequenceFlow";

function meet(links: FollowupLinks) {
  return links.demoUrl
    ? `Kies hier een moment dat je uitkomt (15 minuten, via je scherm): ${links.demoUrl}`
    : "Antwoord op deze mail met een moment dat je uitkomt, dan bel ik je (15 minuten).";
}

/** Tekst per stap en situatie. Kort, in de stem van de oprichter, met één vraag. */
export function followupContent(step: TrialStep, state: TrialState, links: FollowupLinks): { variant: string; subject: string; body: string } {
  if (step === 2) {
    if (!state.connectedAt) {
      return {
        variant: "geen-mailbox",
        subject: "Lukt het koppelen van je mailbox?",
        body: `Hoi,\n\nJe hebt twee dagen geleden Support One aangemaakt, maar je mailbox is nog niet gekoppeld. Daar loopt het vaak op vast, dus ik vraag het gewoon: waar bleef je hangen?\n\nAls je wilt, koppelen we het samen en zet ik meteen je retourbeleid en levertijden erin. ${meet(links)}\n\n${SIGN}`,
      };
    }
    if (!state.firstDraftAt) {
      return {
        variant: "geen-concept",
        subject: "Je mailbox is gekoppeld, nog geen concepten",
        body: `Hoi,\n\nJe mailbox is gekoppeld, maar er is nog geen enkel concept gemaakt. Meestal betekent dat dat er nog geen klantmail op dat adres binnenkwam, of dat een filter te streng staat.\n\nKomt je klantmail op een ander adres binnen? Laat het me weten, dan kijk ik met je mee. ${meet(links)}\n\n${SIGN}`,
      };
    }
    return {
      variant: "eerste-concepten",
      subject: "Wat vond je van de eerste concepten?",
      body: `Hoi,\n\nDe eerste concepten staan klaar in je inbox. Ik ben benieuwd: wat klopte er niet?\n\nPas je een concept aan voordat je het verstuurt, dan leert Support One van je correctie. En ontbreekt er iets in je beleid (retourtermijn, levertijd, verzendkosten), zet het dan in de kennisbank: ${links.knowledgeUrl}\n\n${SIGN}`,
    };
  }

  if (step === 7) {
    if (!state.firstSentAt) {
      return {
        variant: "nog-niets-verstuurd",
        subject: "Halverwege je proef",
        body: `Hoi,\n\nJe bent halverwege je proef en er is nog geen antwoord via Support One verstuurd. Wat houdt je tegen? Vaak missen de concepten nog een stuk beleid, en dan voelt het niet als jouw antwoord.\n\nZal ik je kennisbank samen met je vullen? Daarna kloppen de concepten meestal meteen een stuk beter. ${meet(links)}\n\n${SIGN}`,
      };
    }
    return {
      variant: "verstuurt-al",
      subject: "Halverwege: welke vragen wil je kwijt?",
      body: `Hoi,\n\nJe verstuurt al antwoorden via Support One, mooi. Welke vragen kosten je nu nog de meeste tijd? Dan kijk ik of we die beter kunnen voorbereiden, of dat Support One ze voor de vragen die je vertrouwt zelf mag versturen (alleen als jij dat aanzet).\n\n${SIGN}`,
    };
  }

  return {
    variant: state.firstSentAt ? "einde-proef-actief" : "einde-proef",
    subject: "Over twee dagen loopt je proef af",
    body: `Hoi,\n\nOver twee dagen loopt je proef van Support One af. ${state.firstSentAt ? "Wil je doorgaan" : "Wil je het langer proberen of doorgaan"}? Kies een pakket via ${links.upgradeUrl}. Starter is €49 per maand met 100 afgehandelde gesprekken inbegrepen; je zit nergens aan vast.\n\nTwijfel je nog, of past geen pakket? Vertel me waarom, dan zoeken we het samen uit. ${meet(links)}\n\n${SIGN}`,
  };
}

/**
 * Welke stappen nu klaar moeten staan. Alleen proefaccounts die niet betalen en niet van
 * het team zijn. Is iemand meerdere stappen achter (een ouder account), dan alleen de
 * laatste; de eerdere worden overgeslagen. Een stap die langer dan 4 dagen geleden had
 * gemoeten, komt niet meer.
 */
export function dueFollowups(state: TrialState, existingSteps: number[], now: string, links: FollowupLinks): { create: FollowupDraft[]; skip: TrialStep[] } {
  if (state.internal || state.paying || (state.plan !== "trial" && state.plan !== "expired")) return { create: [], skip: [] };
  const nowMs = Date.parse(now);
  const created = Date.parse(state.createdAt);
  const due = TRIAL_STEPS.filter((step) => created + step * DAY_MS <= nowMs);
  const latest = due.at(-1);
  if (latest === undefined) return { create: [], skip: [] };
  const skip = due.filter((step) => step !== latest && !existingSteps.includes(step));
  const dueAt = created + latest * DAY_MS;
  if (existingSteps.includes(latest) || nowMs - dueAt > STALE_DAYS * DAY_MS) return { create: [], skip };
  // Dag 12 heeft geen zin als de proef al voorbij is.
  if (latest === 12 && state.trialEndsAt && Date.parse(state.trialEndsAt) < nowMs) return { create: [], skip: [...skip, 12] };
  const content = followupContent(latest, state, links);
  return { create: [{ step: latest, dueAt: new Date(dueAt).toISOString(), ...content }], skip };
}

const FREEMAIL = /^(gmail|googlemail|hotmail|outlook|live|msn|icloud|me|mac|yahoo|ziggo|kpnmail|kpnplanet|planet|home|hetnet|casema|xs4all|zonnet|chello|telenet|skynet|proton|protonmail|gmx|web)\./;

/** Sleutel voor de lead van een aanmelding: het bedrijfsdomein, of bij gmail/hotmail het adres zelf. */
export function leadKeyForEmail(email: string) {
  const clean = email.trim().toLowerCase();
  const domain = clean.split("@")[1] ?? "";
  if (!domain) return null;
  return FREEMAIL.test(domain) ? { domain: clean, business: false } : { domain, business: true };
}
