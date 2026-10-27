"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Check, Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";

import { ConfirmDialog, Notice, Section } from "./SettingsUi";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

type McpKey = { id: string; name: string; hint: string; createdAt: string; lastUsedAt: string | null };
type McpApp = { id: string; appName: string; createdAt: string; lastUsedAt: string | null };
type Revoking = { kind: "key" | "app"; id: string; name: string };

/**
 * Koppelingen → Claude en ChatGPT: connect Support One's MCP server, by
 * signing in from a connector (OAuth) or with a personal access key.
 */
export default function McpSettings() {
  const { language } = useTranslation();
  const nl = language === "nl";
  const [keys, setKeys] = useState<McpKey[]>([]);
  const [apps, setApps] = useState<McpApp[]>([]);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [name, setName] = useState("Claude Code");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string; token: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<Revoking | null>(null);
  const [endpoint, setEndpoint] = useState("https://support.sequenceflow.io/api/mcp");

  const load = useCallback(async () => {
    const response = await fetch("/api/mcp/tokens", { cache: "no-store" });
    if (!response.ok) {
      setAuthorized(false);
      return;
    }
    const data = await response.json() as { keys?: McpKey[]; apps?: McpApp[] };
    setAuthorized(true);
    setKeys(data.keys ?? []);
    setApps(data.apps ?? []);
  }, []);

  useEffect(() => {
    setEndpoint(`${window.location.origin}/api/mcp`);
    void load();
  }, [load]);
  if (authorized !== true) return null;

  async function copy(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      window.setTimeout(() => setCopied((current) => current === label ? null : current), 1800);
    } catch {
      setError(nl ? "Kopiëren lukte niet. Selecteer de tekst en kopieer hem zelf." : "Copy failed. Select the text and copy it yourself.");
    }
  }

  async function createKey(event: FormEvent) {
    event.preventDefault();
    setBusy("create");
    setError(null);
    setCreated(null);
    try {
      const response = await fetch("/api/mcp/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || (nl ? "Sleutel maken lukte niet." : "Could not create the key."));
      setCreated({ name: data.key.name, token: data.token });
      await load();
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : (nl ? "Sleutel maken lukte niet." : "Could not create the key."));
    } finally {
      setBusy(null);
    }
  }

  async function revoke(target: Revoking) {
    setBusy(target.id);
    setError(null);
    try {
      const param = target.kind === "app" ? "app" : "id";
      const response = await fetch(`/api/mcp/tokens?${param}=${encodeURIComponent(target.id)}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || (nl ? "Intrekken lukte niet." : "Could not revoke access."));
      if (target.kind === "app") setApps((current) => current.filter((item) => item.id !== target.id));
      else setKeys((current) => current.filter((item) => item.id !== target.id));
      setRevoking(null);
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : (nl ? "Intrekken lukte niet." : "Could not revoke access."));
    } finally {
      setBusy(null);
    }
  }

  const claudeCode = `claude mcp add --transport http support-one ${endpoint} --header "Authorization: Bearer ${created?.token ?? "sfmcp_…"}"`;
  const date = (value: string) => new Date(value).toLocaleDateString(nl ? "nl-NL" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
  const usage = (lastUsedAt: string | null) => lastUsedAt
    ? `${nl ? "laatst gebruikt" : "last used"} ${date(lastUsedAt)}`
    : (nl ? "nog niet gebruikt" : "not used yet");

  const copyButton = (label: string, text: string) => (
    <button type="button" className="settings-btn" onClick={() => void copy(label, text)}>
      {copied === label ? <Check size={14} /> : <Copy size={14} />}
      {copied === label ? (nl ? "Gekopieerd" : "Copied") : (nl ? "Kopieer" : "Copy")}
    </button>
  );

  const revokeButton = (target: Revoking) => (
    <button type="button" className="settings-btn danger icon" title={nl ? "Intrekken" : "Revoke"} aria-label={`${nl ? "Intrekken" : "Revoke"}: ${target.name}`} onClick={() => setRevoking(target)} disabled={Boolean(busy)}>
      {busy === target.id ? <Loader2 className="settings-spin" size={14} /> : <Trash2 size={14} />}
    </button>
  );

  return (
    <Section
      icon={<KeyRound size={18} />}
      title={nl ? "Claude en ChatGPT" : "Claude and ChatGPT"}
      description={nl
        ? "Praat vanuit Claude of ChatGPT met Support One: vraag wat klanten bezighoudt, welke concepten wachten, wat er speelt met bestellingen en voorraad, of wat je kennisbank zegt. Alleen lezen, alleen jouw winkel."
        : "Talk to Support One from Claude or ChatGPT: ask what customers are asking, which drafts are waiting, what is going on with orders and stock, or what your knowledge base says. Read-only, only your shop."}
    >
      <style>{`.mcp-code{margin:8px 0 0;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface-2);color:var(--text);font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;overflow-wrap:anywhere}.mcp-row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:14px}.mcp-row strong,.mcp-steps strong{color:var(--text);font-size:13px}.mcp-steps{margin:12px 0 0;padding-left:18px;color:var(--muted);font-size:13px;line-height:1.7}.mcp-dev{margin-top:18px;border-top:1px solid var(--border);padding-top:14px}.mcp-dev summary{cursor:pointer;color:var(--text);font-size:13px;font-weight:600}`}</style>
      {error ? <Notice tone="error" onClose={() => setError(null)}>{error}</Notice> : null}

      <div className="mcp-row"><strong>{nl ? "Serveradres" : "Server address"}</strong>{copyButton("endpoint", endpoint)}</div>
      <pre className="mcp-code">{endpoint}</pre>
      <ol className="mcp-steps">
        <li>
          <strong>Claude</strong> (claude.ai, desktop):{" "}
          {nl
            ? "Instellingen → Connectors → Aangepaste connector toevoegen. Plak het serveradres, klik op Verbinden en sta de toegang toe."
            : "Settings → Connectors → Add custom connector. Paste the server address, click Connect and allow access."}
        </li>
        <li>
          <strong>ChatGPT</strong>:{" "}
          {nl
            ? "Instellingen → Apps en connectors → Geavanceerd → zet de ontwikkelaarsmodus aan. Maak dan een connector met het serveradres en kies OAuth als authenticatie."
            : "Settings → Apps & Connectors → Advanced → turn on developer mode. Then create a connector with the server address and choose OAuth as authentication."}
        </li>
      </ol>

      {apps.length ? (
        <div className="settings-list" style={{ marginTop: 14 }}>
          {apps.map((app) => (
            <div key={app.id} className="settings-list-row">
              <div className="settings-row-copy">
                <strong>{app.appName}</strong>
                <span>{nl ? "verbonden" : "connected"} {date(app.createdAt)} · {usage(app.lastUsedAt)}</span>
              </div>
              {revokeButton({ kind: "app", id: app.id, name: app.appName })}
            </div>
          ))}
        </div>
      ) : null}

      <details className="mcp-dev" open={Boolean(created) || keys.length > 0}>
        <summary>{nl ? "Met een sleutel (Claude Code, Cursor, n8n)" : "With a key (Claude Code, Cursor, n8n)"}</summary>
        <form onSubmit={createKey} className="settings-compact-form" style={{ marginTop: 12 }}>
          <input
            className="settings-control"
            required
            maxLength={80}
            value={name}
            onChange={(event) => { setName(event.currentTarget.value); setError(null); }}
            placeholder={nl ? "Naam, bijvoorbeeld Claude Code van Ezra" : "Name, e.g. Ezra's Claude Code"}
            aria-label={nl ? "Naam van de sleutel" : "Key name"}
          />
          <button type="submit" className="settings-btn primary" disabled={Boolean(busy) || !name.trim()}>
            {busy === "create" ? <Loader2 className="settings-spin" size={14} /> : <Plus size={14} />}
            {nl ? "Nieuwe sleutel" : "New key"}
          </button>
        </form>

        {created ? (
          <>
            <Notice tone="warning" title={nl ? `Sleutel "${created.name}" is klaar` : `Key "${created.name}" is ready`}>
              {nl ? "Kopieer hem nu: je ziet hem maar één keer. Iedereen met deze sleutel kan je supportgegevens lezen." : "Copy it now: you will only see it once. Anyone with this key can read your support data."}
            </Notice>
            <div className="mcp-row"><strong>{nl ? "Sleutel" : "Key"}</strong>{copyButton("token", created.token)}</div>
            <pre className="mcp-code">{created.token}</pre>
          </>
        ) : null}

        <div className="mcp-row"><strong>Claude Code</strong>{copyButton("code", claudeCode)}</div>
        <pre className="mcp-code">{claudeCode}</pre>
        <p className="settings-hint">
          {nl
            ? "Andere MCP-apps gebruiken hetzelfde serveradres met de kop Authorization: Bearer en je sleutel."
            : "Other MCP apps use the same server address with the header Authorization: Bearer and your key."}
        </p>

        {keys.length ? (
          <div className="settings-list" style={{ marginTop: 12 }}>
            {keys.map((key) => (
              <div key={key.id} className="settings-list-row">
                <div className="settings-row-copy">
                  <strong>{key.name}</strong>
                  <span>{key.hint} · {nl ? "gemaakt" : "created"} {date(key.createdAt)} · {usage(key.lastUsedAt)}</span>
                </div>
                {revokeButton({ kind: "key", id: key.id, name: key.name })}
              </div>
            ))}
          </div>
        ) : null}
      </details>

      {revoking ? (
        <ConfirmDialog
          danger
          title={nl ? `Toegang van "${revoking.name}" intrekken?` : `Revoke access for "${revoking.name}"?`}
          description={nl ? "Deze app kan direct niets meer lezen. Opnieuw koppelen kan altijd." : "This app immediately loses access. You can connect it again any time."}
          confirmLabel={nl ? "Intrekken" : "Revoke"}
          busy={busy === revoking.id}
          onCancel={() => setRevoking(null)}
          onConfirm={() => void revoke(revoking)}
        />
      ) : null}
    </Section>
  );
}
