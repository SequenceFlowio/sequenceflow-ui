"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { SettingsStyles } from "../settings/SettingsUi";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { categoryLabel, inventoryEnabled, visibleEntries, WHATS_NEW, type WhatsNewCategory, type WhatsNewEntry } from "@/lib/whatsNew";
import { markWhatsNewSeen, useSeenWhatsNew } from "@/lib/whatsNewSeen";

const CATEGORY_TONE: Record<WhatsNewCategory, string> = { new: "success", improved: "", fixed: "warning" };

function WhatsNewStyles() {
  return <style>{`
    .whats-new-month{margin:8px 0 -6px;color:var(--muted);font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase}
    .whats-new-entry{position:relative;display:grid;gap:8px;padding:18px 20px;border:1px solid var(--border);border-radius:20px;background:var(--surface)}
    .whats-new-entry.unseen{border-color:rgba(199,245,111,.35)}
    .whats-new-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;color:var(--muted);font-size:12px}
    .whats-new-dot{width:7px;height:7px;border-radius:50%;background:#c7f56f}
    .whats-new-entry h2{margin:0;color:var(--text);font-size:16px;font-weight:500;letter-spacing:-.01em}
    .whats-new-entry p{max-width:680px;margin:0;color:var(--muted);font-size:13px;line-height:1.6}
    .whats-new-entry .settings-btn{justify-self:start;margin-top:4px}
    @media(max-width:700px){.whats-new-entry{padding:16px}}
  `}</style>;
}

export default function WhatsNewClient() {
  const { language } = useTranslation();
  const nl = language === "nl";
  const seen = useSeenWhatsNew();
  const entries = useMemo(() => visibleEntries(WHATS_NEW, { inventory: inventoryEnabled() }), []);
  // Wat bij binnenkomst nog nieuw was, blijft gemarkeerd tot je weggaat.
  const [unseenOnArrival, setUnseenOnArrival] = useState<ReadonlySet<string> | null>(null);

  if (seen && !unseenOnArrival) setUnseenOnArrival(new Set(entries.filter((entry) => !seen.has(entry.id)).map((entry) => entry.id)));

  useEffect(() => {
    if (unseenOnArrival) markWhatsNewSeen(entries.map((entry) => entry.id));
  }, [unseenOnArrival, entries]);

  const months = useMemo(() => {
    const format = new Intl.DateTimeFormat(nl ? "nl-NL" : "en-GB", { month: "long", year: "numeric", timeZone: "Europe/Amsterdam" });
    const groups: Array<{ key: string; label: string; entries: WhatsNewEntry[] }> = [];
    for (const entry of entries) {
      const key = entry.date.slice(0, 7);
      if (groups.at(-1)?.key !== key) groups.push({ key, label: format.format(new Date(`${entry.date}T12:00:00Z`)), entries: [] });
      groups.at(-1)!.entries.push(entry);
    }
    return groups;
  }, [entries, nl]);

  const day = (value: string) => new Intl.DateTimeFormat(nl ? "nl-NL" : "en-GB", { day: "numeric", month: "long", timeZone: "Europe/Amsterdam" }).format(new Date(`${value}T12:00:00Z`));

  return (
    <div className="settings-page">
      <SettingsStyles />
      <WhatsNewStyles />
      <header className="settings-heading">
        <h1>{nl ? "Wat is nieuw" : "What's new"}</h1>
        <p>{nl ? "Nieuwe functies en verbeteringen in Support One, de nieuwste bovenaan." : "New features and improvements in Support One, newest first."}</p>
      </header>
      <div className="settings-stack" style={{ marginTop: 24 }}>
        {months.map((month) => (
          <section key={month.key} className="settings-stack" aria-label={month.label}>
            <h2 className="whats-new-month">{month.label}</h2>
            {month.entries.map((entry) => {
              const isNew = unseenOnArrival?.has(entry.id) ?? false;
              return (
                <article key={entry.id} className={`whats-new-entry${isNew ? " unseen" : ""}`}>
                  <div className="whats-new-meta">
                    <span className={`settings-status ${CATEGORY_TONE[entry.category]}`}>{categoryLabel(entry.category, nl)}</span>
                    <time dateTime={entry.date}>{day(entry.date)}</time>
                    {isNew ? <span className="whats-new-dot" aria-label={nl ? "Nog niet gezien" : "Not seen yet"} /> : null}
                  </div>
                  <h2>{nl ? entry.title.nl : entry.title.en}</h2>
                  <p>{nl ? entry.body.nl : entry.body.en}</p>
                  {entry.link ? <Link href={entry.link.href} className="settings-btn">{nl ? entry.link.label.nl : entry.link.label.en}<ArrowRight size={14} /></Link> : null}
                </article>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
