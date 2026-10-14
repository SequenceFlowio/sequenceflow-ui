/**
 * Text of the "your mailbox stopped working" email. Pure, so it is testable
 * without a database or mail provider.
 */

export type MailboxAlertLanguage = "nl" | "en";

export function isAuthFailure(error: string) {
  return /AUTHENTICATIONFAILED|authentication failed|invalid credentials|login failed|535[ -]/i.test(error);
}

export function mailboxAlertText(input: {
  language: MailboxAlertLanguage;
  address: string | null;
  error: string;
  since: string | null;
  reconnectUrl: string;
  shopify: boolean;
  /** "fetch": reading incoming mail fails; "send": sending replies through the mailbox fails. */
  direction?: "fetch" | "send";
}) {
  if (input.direction === "send") return sendAlertText(input);
  const address = input.address || (input.language === "nl" ? "je supportmailbox" : "your support mailbox");
  const auth = isAuthFailure(input.error);
  const since = input.since ? new Date(input.since) : null;
  const sinceText = since && !Number.isNaN(since.getTime())
    ? since.toLocaleString(input.language === "nl" ? "nl-NL" : "en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Amsterdam" })
    : null;
  const where = input.shopify
    ? (input.language === "nl" ? "Open Support One in Shopify en ga naar Mailbox." : "Open Support One in Shopify and go to Mailbox.")
    : (input.language === "nl" ? `Open ${input.reconnectUrl} en ga naar Mailbox.` : `Open ${input.reconnectUrl} and go to Mailbox.`);

  if (input.language === "nl") {
    return {
      subject: `Actie nodig: Support One haalt geen mail meer op van ${address}`,
      text: [
        "Hoi,",
        "",
        `Support One kan geen nieuwe klantmails meer ophalen van ${address}.${sinceText ? ` De laatste klantmail kwam binnen op ${sinceText}.` : ""}`,
        auth
          ? "De mailserver weigert het wachtwoord. Meestal is het wachtwoord van de mailbox veranderd of is het app-wachtwoord ingetrokken."
          : `De mailserver gaf deze melding: ${input.error.slice(0, 200)}`,
        "",
        "Zolang dit zo is, komen nieuwe klantvragen niet in Support One binnen. Je mailbox zelf werkt gewoon; er gaat geen mail verloren.",
        "",
        `Zo los je het op: ${where} Vul daar het huidige wachtwoord (of een nieuw app-wachtwoord) in en klik op "Opslaan en verbinding testen". Daarna halen we de gemiste mails automatisch op.`,
        "",
        "Lukt het niet? Antwoord op deze mail, dan helpen we je.",
        "",
        "Team SequenceFlow",
      ].join("\n"),
    };
  }
  return {
    subject: `Action needed: Support One can no longer fetch email from ${address}`,
    text: [
      "Hi,",
      "",
      `Support One can no longer fetch new customer emails from ${address}.${sinceText ? ` The last customer email arrived on ${sinceText}.` : ""}`,
      auth
        ? "The mail server rejects the password. Usually the mailbox password changed or the app password was revoked."
        : `The mail server said: ${input.error.slice(0, 200)}`,
      "",
      "Until this is fixed, new customer questions do not reach Support One. Your mailbox itself keeps working; no email is lost.",
      "",
      `How to fix it: ${where} Enter the current password (or a new app password) and click "Save and test connection". We then fetch the missed emails automatically.`,
      "",
      "Need help? Reply to this email.",
      "",
      "The SequenceFlow team",
    ].join("\n"),
  };
}

function sendAlertText(input: { language: MailboxAlertLanguage; address: string | null; error: string; reconnectUrl: string; shopify: boolean }) {
  const address = input.address || (input.language === "nl" ? "je supportmailbox" : "your support mailbox");
  const auth = isAuthFailure(input.error);
  const where = input.shopify
    ? (input.language === "nl" ? "Open Support One in Shopify en ga naar Mailbox." : "Open Support One in Shopify and go to Mailbox.")
    : (input.language === "nl" ? `Open ${input.reconnectUrl} en ga naar Mailbox.` : `Open ${input.reconnectUrl} and go to Mailbox.`);
  if (input.language === "nl") {
    return {
      subject: `Actie nodig: Support One kan niet versturen via ${address}`,
      text: [
        "Hoi,",
        "",
        `Support One kon net een antwoord niet via ${address} versturen.`,
        auth ? "De mailserver weigert het wachtwoord." : `De mailserver gaf deze melding: ${input.error.slice(0, 200)}`,
        "",
        "Het antwoord is wel aangekomen, maar via het algemene adres van Support One in plaats van jouw eigen adres. Dat blijft zo tot de koppeling hersteld is.",
        "",
        `Zo los je het op: ${where} Vul daar het huidige wachtwoord (of een nieuw app-wachtwoord) in en klik op "Opslaan en verbinding testen".`,
        "",
        "Lukt het niet? Antwoord op deze mail, dan helpen we je.",
        "",
        "Team SequenceFlow",
      ].join("\n"),
    };
  }
  return {
    subject: `Action needed: Support One cannot send through ${address}`,
    text: [
      "Hi,",
      "",
      `Support One just could not send a reply through ${address}.`,
      auth ? "The mail server rejects the password." : `The mail server said: ${input.error.slice(0, 200)}`,
      "",
      "The reply did go out, but from Support One's general address instead of your own. That stays so until the connection is fixed.",
      "",
      `How to fix it: ${where} Enter the current password (or a new app password) and click "Save and test connection".`,
      "",
      "Need help? Reply to this email.",
      "",
      "The SequenceFlow team",
    ].join("\n"),
  };
}
