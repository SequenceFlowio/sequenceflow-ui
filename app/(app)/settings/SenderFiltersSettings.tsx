"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Ban, Loader2, Plus, Trash2 } from "lucide-react";

import { Notice, Section } from "./SettingsUi";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

type SenderFilter = { id: string; email: string; createdAt: string };

export default function SenderFiltersSettings() {
  const { t, language } = useTranslation();
  const ts = t.settings;
  const [filters, setFilters] = useState<SenderFilter[]>([]);
  const [email, setEmail] = useState("");
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/sender-filters", { cache: "no-store" });
    if (!response.ok) {
      setAuthorized(false);
      return;
    }
    const data = await response.json() as { filters?: SenderFilter[] };
    setAuthorized(true);
    setFilters(data.filters ?? []);
  }, []);

  useEffect(() => { void load(); }, [load]);
  if (authorized !== true) return null;

  async function addFilter(event: FormEvent) {
    event.preventDefault();
    setBusy("add");
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/sender-filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || ts.senderFiltersError);
      setEmail("");
      await load();
      setNotice(language === "nl" ? "Afzender toegevoegd aan de filterlijst." : "Sender added to the filter list.");
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : ts.senderFiltersError);
    } finally {
      setBusy(null);
    }
  }

  async function removeFilter(id: string) {
    setBusy(id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/sender-filters?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || ts.senderFiltersError);
      setFilters((current) => current.filter((filter) => filter.id !== id));
      setNotice(language === "nl" ? "Afzender verwijderd uit de filterlijst." : "Sender removed from the filter list.");
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : ts.senderFiltersError);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Section icon={<Ban size={18} />} title={ts.senderFiltersTitle} description={ts.senderFiltersDesc} status={<span className={`settings-status ${filters.length ? "success" : ""}`}>{filters.length}</span>}>
        {notice ? <Notice tone="success" onClose={() => setNotice(null)}>{notice}</Notice> : null}
        {error ? <Notice tone="error" onClose={() => setError(null)}>{error}</Notice> : null}
        <form onSubmit={addFilter} className="settings-compact-form">
          <input
            className="settings-control"
            type="email"
            required
            value={email}
            onChange={(event) => { setEmail(event.currentTarget.value); setError(null); }}
            placeholder={ts.senderFiltersPlaceholder}
            aria-label={ts.senderFiltersPlaceholder}
          />
          <button type="submit" className="settings-btn primary" disabled={Boolean(busy) || !email.trim()}>
            {busy === "add" ? <Loader2 className="settings-spin" size={14} /> : <Plus size={14} />}
            {busy === "add" ? ts.stateSaving : ts.senderFiltersAdd}
          </button>
        </form>
        <p className="settings-hint">{ts.senderFiltersRetentionHint}</p>
        {filters.length ? (
          <div className="settings-list">
            {filters.map((filter) => (
              <div key={filter.id} className="settings-list-row">
                <div className="settings-row-copy"><strong>{filter.email}</strong></div>
                <button type="button" className="settings-btn danger icon" title={ts.senderFiltersRemove} aria-label={`${ts.senderFiltersRemove}: ${filter.email}`} onClick={() => void removeFilter(filter.id)} disabled={Boolean(busy)}>
                  {busy === filter.id ? <Loader2 className="settings-spin" size={14} /> : <Trash2 size={14} />}
                </button>
              </div>
            ))}
          </div>
        ) : <div className="settings-empty"><Ban size={18} /><strong>{ts.senderFiltersEmpty}</strong></div>}
    </Section>
  );
}
