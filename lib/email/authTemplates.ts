/**
 * Mails rond inloggen bij Support One (via de Supabase "Send Email Hook",
 * app/api/auth/send-email): inlogcode, uitnodiging voor een team, nieuw
 * wachtwoord, e-mailadres wijzigen en bevestigingscode. In het Nederlands of
 * Engels, afhankelijk van waar iemand inlogt. Zonder imports met een alias.
 */

import { renderBrandedEmail } from "./branded.ts";
import type { MailLanguage } from "./templates.ts";

export type AuthMailKind = "login" | "invite" | "recovery" | "email_change" | "reauthentication";

export function authEmail(input: { kind: AuthMailKind; language: MailLanguage; code?: string; link?: string; workspace?: string | null }) {
  const en = input.language === "en";
  const code = input.code ?? "";
  const copy = {
    login: en ? {
      subject: `${code} is your Support One sign-in code`, eyebrow: "Support One", title: "Your sign-in code",
      intro: "Enter this code on the sign-in screen, or use the button below.", button: "Sign in",
      note: "The code works once and expires within an hour. Didn't request this? You can ignore this email.",
    } : {
      subject: `${code} is je inlogcode voor Support One`, eyebrow: "Support One", title: "Je inlogcode",
      intro: "Vul deze code in op het inlogscherm, of gebruik de knop hieronder.", button: "Inloggen",
      note: "De code werkt één keer en verloopt binnen een uur. Heb je dit niet aangevraagd? Dan kun je deze mail negeren.",
    },
    invite: en ? {
      subject: input.workspace ? `You've been invited to ${input.workspace} on Support One` : "You've been invited to Support One",
      eyebrow: "Support One", title: "You've been invited",
      intro: input.workspace ? `A colleague invited you to the ${input.workspace} workspace on Support One, the AI colleague for the support inbox.` : "A colleague invited you to their workspace on Support One, the AI colleague for the support inbox.",
      button: "Accept invitation", note: "This link works once. Not expecting this invitation? You can ignore this email.",
    } : {
      subject: input.workspace ? `Je bent uitgenodigd voor ${input.workspace} in Support One` : "Je bent uitgenodigd voor Support One",
      eyebrow: "Support One", title: "Je bent uitgenodigd",
      intro: input.workspace ? `Een collega heeft je uitgenodigd voor de werkruimte ${input.workspace} in Support One, de AI-collega voor de supportinbox.` : "Een collega heeft je uitgenodigd voor zijn werkruimte in Support One, de AI-collega voor de supportinbox.",
      button: "Uitnodiging accepteren", note: "Deze link werkt één keer. Verwacht je deze uitnodiging niet? Dan kun je deze mail negeren.",
    },
    recovery: en ? {
      subject: "Reset your Support One password", eyebrow: "Support One", title: "Reset your password",
      intro: "Use the button below to choose a new password.", button: "Choose a new password",
      note: "Didn't request this? You can ignore this email; your password stays the same.",
    } : {
      subject: "Nieuw wachtwoord voor Support One", eyebrow: "Support One", title: "Kies een nieuw wachtwoord",
      intro: "Gebruik de knop hieronder om een nieuw wachtwoord te kiezen.", button: "Nieuw wachtwoord kiezen",
      note: "Heb je dit niet aangevraagd? Dan kun je deze mail negeren; je wachtwoord blijft hetzelfde.",
    },
    email_change: en ? {
      subject: "Confirm your new email address for Support One", eyebrow: "Support One", title: "Confirm your email address",
      intro: "Confirm that you want to use this email address for Support One.", button: "Confirm email address",
      note: "Didn't request this? Then reply to this email so we can take a look.",
    } : {
      subject: "Bevestig je nieuwe e-mailadres voor Support One", eyebrow: "Support One", title: "Bevestig je e-mailadres",
      intro: "Bevestig dat je dit e-mailadres wilt gebruiken voor Support One.", button: "E-mailadres bevestigen",
      note: "Heb je dit niet aangevraagd? Antwoord dan op deze mail, dan kijken we mee.",
    },
    reauthentication: en ? {
      subject: `${code} is your Support One confirmation code`, eyebrow: "Support One", title: "Your confirmation code",
      intro: "Enter this code to confirm it's you.", button: "", note: "Didn't request this? You can ignore this email.",
    } : {
      subject: `${code} is je bevestigingscode voor Support One`, eyebrow: "Support One", title: "Je bevestigingscode",
      intro: "Vul deze code in om te bevestigen dat jij het bent.", button: "", note: "Heb je dit niet aangevraagd? Dan kun je deze mail negeren.",
    },
  }[input.kind];

  const showCode = Boolean(code) && (input.kind === "login" || input.kind === "reauthentication");
  const text = [
    copy.title, "",
    copy.intro,
    ...(showCode ? ["", `${en ? "Code" : "Code"}: ${code}`] : []),
    ...(input.link && copy.button ? ["", `${copy.button}: ${input.link}`] : []),
    "", copy.note, "", "Support One · SequenceFlow",
  ].join("\n");
  const html = renderBrandedEmail({
    language: en ? "en" : "nl",
    eyebrow: copy.eyebrow,
    title: copy.title,
    preheader: showCode ? copy.subject : copy.intro,
    blocks: [
      { type: "paragraph", text: copy.intro },
      ...(showCode ? [{ type: "code" as const, value: code }] : []),
      ...(input.link && copy.button ? [{ type: "button" as const, label: copy.button, href: input.link }] : []),
      { type: "note", text: copy.note },
    ],
    signature: "Support One",
  });
  return { subject: copy.subject, text, html };
}
