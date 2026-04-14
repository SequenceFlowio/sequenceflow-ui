/**
 * Email filter gate — shared between the inbound webhook and (legacy) cron.
 * Blocks newsletters, auto-replies, marketing, and system notifications.
 */

export interface EmailForFilter {
  subject:      string;
  from:         string;   // raw From header or extracted email address
  text:         string;   // plain-text body
  snippet?:     string;
  listId?:      string;   // List-Id header
  to?:          string;
  accountEmail?: string;  // tenant's own email — used for self-email check
}

export function filterGate(p: EmailForFilter): { allowed: boolean; reason: string } {
  const norm      = (s: string) => s.toLowerCase().trim();
  const extrEmail = (raw: string) => {
    const m = raw.trim().match(/<([^>]+)>/);
    return m ? m[1].toLowerCase() : raw.toLowerCase();
  };
  const includesAny = (hay: string, needles: string[]) =>
    needles.some(n => norm(hay).includes(n));

  const subject   = p.subject.trim();
  const fromEmail = extrEmail(p.from);
  const bodyText  = (p.text || p.snippet || "").trim();
  const fullText  = `${subject}\n\n${p.snippet ?? ""}\n\n${p.text}\n\n${p.to ?? ""}\n\n${p.listId ?? ""}`.toLowerCase();

  // Newsletter List-Id
  if (p.listId?.trim())
    return { allowed: false, reason: "Has List-Id (newsletter)" };

  // Self-email (tenant's own account emailing itself)
  if (p.accountEmail && fromEmail === p.accountEmail.toLowerCase())
    return { allowed: false, reason: "Self-email from account" };

  // Minimum body length — notifications/pings are usually tiny
  if (bodyText.length < 20)
    return { allowed: false, reason: "Body too short (notification)" };

  // Blocked senders
  const BLOCK_FROM = [
    "no-reply","noreply","donotreply","do-not-reply","mailer-daemon",
    "postmaster","bounce","notifications@","notification@","news@","newsletter@",
    "support@webshare.io","followsuggestions@mail.instagram.com",
    "mail.instagram.com","facebookmail.com","accounts.google.com",
  ];
  if (includesAny(fromEmail, BLOCK_FROM))
    return { allowed: false, reason: `Blocked sender: ${fromEmail}` };

  // Blocked domains — social, auth, known bulk-send services
  const BLOCK_DOMAINS = [
    "instagram.com","facebookmail.com","accounts.google.com","noreply.google.com",
    "sendgrid.net","mailchimp.com","list-manage.com",
    "klaviyo.com","linkedin.com",
    "constantcontact.com","mailjet.com","sendinblue.com","brevo.com",
    "mail.warmupinbox.com","tradingview.com","ancestry.com",
    "patreon.com","twitter.com","x.com","youtube.com","tiktok.com",
    "twitch.tv","discord.com","reddit.com","medium.com","substack.com",
    "spotify.com","soundcloud.com","bandcamp.com","vimeo.com",
    "airbnb.com","booking.com","tripadvisor.com","eventbrite.com","meetup.com",
    "etsy.com","ebay.com","amazon.com",
    "github.com","gitlab.com","jira.atlassian.com","trello.com","slack.com",
    "notion.so","figma.com","dropbox.com",
  ];
  if (BLOCK_DOMAINS.some(d => fromEmail.includes(d)))
    return { allowed: false, reason: `Blocked domain: ${fromEmail}` };

  // Blocked subjects
  const BLOCK_SUBJECT = [
    "receipt","invoice","payment","paid","billing","order confirmation",
    "bevestiging","bevestigingsmail","factuur","betaal","betaling",
    "abonnee","subscription","trial","security alert","login alert","new login",
    "verification","verify your email","confirm your email",
    "password reset","reset your password","two-factor","2fa","otp",
    "welcome to","thanks for signing up","your webshare software receipt",
    "out of office","automatisch antwoord","afwezig","vakantiebericht",
    "auto-reply","auto reply","i am out","ik ben afwezig","absence",
    "loved your","liked your","commented on","started following","shared your",
    "mentioned you","tagged you","new follower","new message from",
    "just posted","is now live","going live",
  ];
  if (includesAny(subject, BLOCK_SUBJECT))
    return { allowed: false, reason: "Blocked subject keyword" };

  // Marketing markers in body / full text
  const BLOCK_MARKETING = [
    "unsubscribe","afmelden","view in browser","bekijk in browser",
    "marketing","promotion","promotie","advertisement",
    "response rate","open rate","deliverability","email warmup","warm up",
    "warmup","upgrade now","upgrade to our","pro plan","case study",
    "click here to","add your inbox","get started on your",
    "linkedin premium","netwerk slimmer","ontgrendel vandaag",
    "upgrade to premium","getting started with",
  ];
  if (includesAny(fullText, BLOCK_MARKETING))
    return { allowed: false, reason: "Marketing/newsletter markers" };

  // Regex checks
  const BLOCK_REGEX = [
    /unsubscribe/i, /afmelden/i, /do-?not-?reply/i, /no-?reply/i,
    /mailer-daemon/i, /password\s*reset/i, /verify\s*your\s*email/i,
    /\bsecurity\s*alert\b/i, /\blogin\s*alert\b/i,
    /\bauto-?repl(y|ied)\b/i, /\bout\s+of\s+office\b/i,
  ];
  if (BLOCK_REGEX.some(r => r.test(fullText)))
    return { allowed: false, reason: "Automated email regex match" };

  return { allowed: true, reason: "OK" };
}
