/**
 * Wat Support One oplevert, eerlijk geschat: elk antwoord dat via Support One
 * de deur uit ging, scheelt het team typen en opzoeken. We rekenen met een
 * vaste, zichtbare aanname per antwoord en een uurtarief; geen "geredde
 * omzet" zolang we die niet echt meten.
 */
export const VALUE_ASSUMPTIONS = { minutesPerReply: 5, hourlyEur: 25 } as const;

export function estimateValue(replies: number, assumptions: { minutesPerReply: number; hourlyEur: number } = VALUE_ASSUMPTIONS) {
  const minutes = Math.max(0, replies) * assumptions.minutesPerReply;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return { hours, euros: Math.round((minutes / 60) * assumptions.hourlyEur) };
}
