/**
 * Stiltebewaking (docs/plan-werkstroomkern.md, fase 0d): wat had moeten gebeuren
 * maar uitbleef. Puur: krijgt een momentopname van de database en geeft terug wat
 * er stil is, met de waarschijnlijke oorzaak. Geen imports met een alias, zodat het
 * los te testen is.
 */

export type SilenceSnapshot = {
  /** Laatste datum (YYYY-MM-DD) met een goedgekeurde, nog niet geplaatste post. */
  lastApprovedPostDate: string | null;
  /** Goedgekeurde posts waarvan het tijdstip meer dan 30 minuten voorbij is. */
  overduePosts: number;
  /** Geplaatste posts van 2 tot 14 dagen oud, en hoeveel daarvan cijfers hebben. */
  postedRecent: number;
  postedRecentWithMetrics: number;
  /** Mailkoppelingen van werkruimtes met een lopend pakket die een fout melden. */
  failingMailboxes: Array<{ tenantId: string; workspace: string | null; channel: string; error: string | null }>;
  /** Werkruimtes met een lopend pakket en een gekoppelde mailbox. */
  connectedActiveTenants: number;
  lastInboundAt: string | null;
  /** Gesprekken die al meer dan 2 uur over hun verzendmoment heen zijn. */
  stuckAutosend: number;
};

export type SilenceAlert = {
  id: string;
  title: string;
  detail: string;
  likelyCause: string;
  tenantId?: string;
  workspace?: string | null;
};

const DAY = 24 * 60 * 60 * 1000;

function addDays(isoDate: string, days: number) {
  return new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

const POST_ZONES: Record<string, string> = { nl: "Europe/Amsterdam", en: "America/New_York" };

/** Lokale datum en tijd in een tijdzone als UTC-tijdstip (ms). */
export function zonedToUtc(date: string, time: string, timeZone: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const wanted = Date.UTC(y, m - 1, d, h, min);
  let guess = wanted;
  for (let i = 0; i < 2; i++) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
    guess += wanted - Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  }
  return guess;
}

/**
 * Goedgekeurde posts die meer dan 30 minuten over hun tijd zijn. Datum en tijd zijn de lokale tijd
 * van de taal (Engels = New York); geparkeerde posts staan bewust stil en tellen niet mee.
 */
export function countOverduePosts(rows: Array<{ date: string; time: string | null; locale?: string | null; parked?: boolean | null }>, now: Date) {
  const limit = now.getTime() - 30 * 60 * 1000;
  return rows.filter((row) => !row.parked && zonedToUtc(row.date, (row.time ?? "00:00").slice(0, 5), POST_ZONES[row.locale ?? "nl"] ?? POST_ZONES.nl) < limit).length;
}

/** Datum in Amsterdam, want de contentkalender plant in Nederlandse tijd. */
export function amsterdamDate(now: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function evaluateSilence(snapshot: SilenceSnapshot, now: Date): SilenceAlert[] {
  const alerts: SilenceAlert[] = [];
  const today = amsterdamDate(now);

  const bufferUntil = addDays(today, 5);
  if (!snapshot.lastApprovedPostDate || snapshot.lastApprovedPostDate < bufferUntil) {
    alerts.push({
      id: "content-buffer",
      title: "Minder dan 5 dagen posts ingepland",
      detail: snapshot.lastApprovedPostDate ? `Laatste goedgekeurde post: ${snapshot.lastApprovedPostDate}.` : "Er staat geen enkele goedgekeurde post klaar.",
      likelyCause: "De wekelijkse generatie draaide niet (Mac uit op donderdag?) of de posts staan nog op review.",
    });
  }

  if (snapshot.overduePosts > 0) {
    alerts.push({
      id: "content-overdue",
      title: `${snapshot.overduePosts} post(s) niet geplaatst op het geplande tijdstip`,
      detail: "Goedgekeurde posts staan meer dan 30 minuten over hun tijd.",
      likelyCause: "De content-cron faalt, of de koppeling met Instagram of Facebook is verlopen.",
    });
  }

  if (snapshot.postedRecent >= 3 && snapshot.postedRecentWithMetrics === 0) {
    alerts.push({
      id: "content-metrics",
      title: "Geen cijfers bij geplaatste posts",
      detail: `${snapshot.postedRecent} posts van 2 tot 14 dagen oud, geen enkele met bereik of likes.`,
      likelyCause: "Het recht voor inzichten (instagram_manage_insights) ontbreekt of het token is verlopen.",
    });
  }

  for (const mailbox of snapshot.failingMailboxes) {
    alerts.push({
      id: `mailbox:${mailbox.tenantId}:${mailbox.channel}`,
      title: `Mailbox faalt (${mailbox.channel})`,
      detail: mailbox.error ? `Laatste fout: ${mailbox.error.slice(0, 160)}` : "De koppeling staat niet meer op actief.",
      likelyCause: "Wachtwoord of toegang ingetrokken; de winkel moet de mailbox opnieuw koppelen.",
      tenantId: mailbox.tenantId,
      workspace: mailbox.workspace,
    });
  }

  if (snapshot.connectedActiveTenants > 0) {
    const silentSince = snapshot.lastInboundAt ? Date.parse(snapshot.lastInboundAt) : 0;
    if (now.getTime() - silentSince > 3 * DAY) {
      alerts.push({
        id: "inbound-silent",
        title: "Al 3 dagen geen enkele klantmail binnen",
        detail: `${snapshot.connectedActiveTenants} werkruimte(s) met een lopend pakket en een gekoppelde mailbox; laatste binnenkomende mail: ${snapshot.lastInboundAt ?? "nooit"}.`,
        likelyCause: "Doorsturen of de mailcron is stuk, of de winkels hebben echt geen mail. Test met ons eigen testaccount.",
      });
    }
  }

  if (snapshot.stuckAutosend > 0) {
    alerts.push({
      id: "autosend-stuck",
      title: `${snapshot.stuckAutosend} automatisch te versturen antwoord(en) blijven hangen`,
      detail: "Meer dan 2 uur over het geplande verzendmoment.",
      likelyCause: "De auto-send-cron faalt of de verzendkoppeling (Gmail, Outlook, SMTP) weigert.",
    });
  }

  return alerts;
}
