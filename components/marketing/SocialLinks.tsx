/**
 * De social-media-accounts van SequenceFlow, voor de footers van de site. Eigen
 * iconen: lucide heeft geen merklogo's meer.
 */

// Instagram heeft per taal een eigen account: @sequenceflownl en @sequenceflowio.
const INSTAGRAM = {
  nl: "https://www.instagram.com/sequenceflownl/",
  en: "https://www.instagram.com/sequenceflowio/",
} as const;

export const SOCIAL_ACCOUNTS = [
  { name: "Instagram", href: INSTAGRAM.nl },
  { name: "TikTok", href: "https://www.tiktok.com/@sequenceflowio" },
  { name: "Facebook", href: "https://www.facebook.com/Sequenceflow/" },
] as const;

function Icon({ name }: { name: (typeof SOCIAL_ACCOUNTS)[number]["name"] }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", "aria-hidden": true as const, focusable: false as const };
  if (name === "Instagram") {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4.2" />
        <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (name === "TikTok") {
    return (
      <svg {...common} fill="currentColor">
        <path d="M16.6 3c.3 2.2 1.6 3.7 3.9 3.9v3a7 7 0 0 1-3.9-1.2v6.1a5.8 5.8 0 1 1-5.8-5.8c.3 0 .6 0 .9.1v3.1a2.8 2.8 0 1 0 1.9 2.6V3h3Z" />
      </svg>
    );
  }
  return (
    <svg {...common} fill="currentColor">
      <path d="M13.5 21v-7.6h2.6l.4-3h-3V8.5c0-.9.3-1.5 1.5-1.5h1.6V4.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21h3.1Z" />
    </svg>
  );
}

export function SocialLinks({ className, label, lang = "nl" }: { className?: string; label?: string; lang?: "nl" | "en" }) {
  const en = lang === "en";
  const accounts = SOCIAL_ACCOUNTS.map((account) => account.name === "Instagram" ? { ...account, href: INSTAGRAM[lang] } : account);
  return (
    <ul className={className ?? "mk-social"} aria-label={label ?? (en ? "SequenceFlow on social media" : "SequenceFlow op social media")}>
      {accounts.map((account) => (
        <li key={account.name}>
          <a href={account.href} target="_blank" rel="noopener noreferrer" aria-label={`SequenceFlow ${en ? "on" : "op"} ${account.name}`} title={account.name}>
            <Icon name={account.name} />
          </a>
        </li>
      ))}
    </ul>
  );
}
