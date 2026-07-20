"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { useTranslation } from "@/lib/i18n/LanguageProvider";

type SenderFilter = { id: string; email: string; createdAt: string };

const controlStyle: React.CSSProperties = {
  minHeight: 42,
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  padding: "9px 12px",
  fontSize: 13,
};

export default function SenderFiltersSettings() {
  const { t } = useTranslation();
  const ts = t.settings;
  const [filters, setFilters] = useState<SenderFilter[]>([]);
  const [email, setEmail] = useState("");
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : ts.senderFiltersError);
    } finally {
      setBusy(null);
    }
  }

  async function removeFilter(id: string) {
    setBusy(id);
    setError(null);
    try {
      const response = await fetch(`/api/sender-filters?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || ts.senderFiltersError);
      setFilters((current) => current.filter((filter) => filter.id !== id));
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : ts.senderFiltersError);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section style={{ border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "grid", gap: 5, background: "var(--surface-subtle)" }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{ts.senderFiltersTitle}</p>
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: "var(--muted)" }}>{ts.senderFiltersDesc}</p>
      </div>
      <div style={{ padding: 18, display: "grid", gap: 14 }}>
        <form onSubmit={addFilter} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8 }}>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
            placeholder={ts.senderFiltersPlaceholder}
            aria-label={ts.senderFiltersPlaceholder}
            style={controlStyle}
          />
          <button type="submit" disabled={Boolean(busy) || !email.trim()} style={{ ...controlStyle, border: "none", background: "#C7F56F", color: "#0f1a00", fontWeight: 800, cursor: busy ? "wait" : "pointer", opacity: busy || !email.trim() ? 0.6 : 1 }}>
            {busy === "add" ? ts.stateSaving : ts.senderFiltersAdd}
          </button>
        </form>
        <p style={{ margin: 0, fontSize: 11, lineHeight: 1.55, color: "var(--muted)" }}>{ts.senderFiltersRetentionHint}</p>
        {filters.length ? (
          <div style={{ display: "grid", borderTop: "1px solid var(--border)" }}>
            {filters.map((filter) => (
              <div key={filter.id} style={{ minWidth: 0, padding: "10px 0", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span style={{ minWidth: 0, overflowWrap: "anywhere", fontSize: 13, fontWeight: 650, color: "var(--text)" }}>{filter.email}</span>
                <button type="button" onClick={() => void removeFilter(filter.id)} disabled={Boolean(busy)} style={{ border: "none", background: "transparent", color: "#f87171", padding: "6px 0", fontSize: 12, fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>
                  {ts.senderFiltersRemove}
                </button>
              </div>
            ))}
          </div>
        ) : <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>{ts.senderFiltersEmpty}</p>}
        {error ? <p role="alert" style={{ margin: 0, fontSize: 12, color: "#f87171" }}>{error}</p> : null}
      </div>
    </section>
  );
}
