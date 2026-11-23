import { brandedFromText } from "../email/branded.ts";

/** Mail van Milo bij 80% of 100% van het maandbudget, in de taal van de werkruimte. Zonder imports met een alias. */
export function budgetAlertEmail(input: { level: "near" | "reached"; used: string; budget: string; link: string; language: "nl" | "en" }) {
  const nl = input.language !== "en";
  const { used, budget, link } = input;
  const subject = input.level === "near"
    ? (nl ? `Je zit op 80% van je maandbudget (${used} van ${budget})` : `You're at 80% of your monthly budget (${used} of ${budget})`)
    : (nl ? `Je maandbudget is bereikt (${budget})` : `Your monthly budget is reached (${budget})`);
  const text = input.level === "near"
    ? (nl
      ? `Hoi,\n\nDeze maand is er voor ${used} aan afgehandelde gesprekken geteld. Je budget is ${budget}.\n\nBoven je budget betaal je niets en Support One blijft gewoon werken. Wil je het budget aanpassen? Dat kan hier: ${link}\n\nGroet,\nMilo van SequenceFlow`
      : `Hi,\n\nThis month ${used} in handled conversations has been counted. Your budget is ${budget}.\n\nAbove your budget you pay nothing and Support One keeps working. Want to change it? ${link}\n\nCheers,\nMilo from SequenceFlow`)
    : (nl
      ? `Hoi,\n\nJe maandbudget van ${budget} is bereikt. Support One werkt gewoon door; afgehandelde gesprekken boven je budget betaal je deze maand niet.\n\nBudget aanpassen kan hier: ${link}\n\nGroet,\nMilo van SequenceFlow`
      : `Hi,\n\nYour monthly budget of ${budget} is reached. Support One keeps working; handled conversations above your budget are free this month.\n\nChange your budget here: ${link}\n\nCheers,\nMilo from SequenceFlow`);
  const html = brandedFromText({
    text,
    language: nl ? "nl" : "en",
    eyebrow: nl ? "Milo · je budget" : "Milo · your budget",
    title: input.level === "near" ? (nl ? "80% van je maandbudget" : "80% of your monthly budget") : (nl ? "Je maandbudget is bereikt" : "Your monthly budget is reached"),
    action: { label: nl ? "Budget bekijken" : "View budget", href: link },
  });
  return { subject, text, html };
}
