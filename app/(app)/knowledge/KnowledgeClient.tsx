"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { useUpgradeModal } from "@/lib/upgradeModal";

// ─── Types ────────────────────────────────────────────────────────────────────
type KnowledgeType = "policy" | "training" | "platform";

type KnowledgeDoc = {
  id: string;
  client_id: string | null;
  type: KnowledgeType;
  title: string;
  source: string;
  mime_type: string;
  status: "pending" | "processing" | "ready" | "error";
  chunk_count: number;
  error: string | null;
  created_at: string;
  updated_at: string;
};

type UsageInfo = {
  plan: string;
  docsUsed: number;
  docsLimit: number | null; // null = unlimited (Scale)
};

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: KnowledgeDoc["status"] }) {
  const { t } = useTranslation();

  const colors: Record<KnowledgeDoc["status"], React.CSSProperties> = {
    ready:      { background: "rgba(180,240,0,0.12)",  color: "#B4F000",      border: "1px solid rgba(180,240,0,0.25)" },
    processing: { background: "rgba(234,179,8,0.12)",  color: "#eab308",      border: "1px solid rgba(234,179,8,0.25)" },
    pending:    { background: "rgba(148,163,184,0.1)", color: "var(--muted)", border: "1px solid var(--border)" },
    error:      { background: "rgba(239,68,68,0.1)",   color: "#ef4444",      border: "1px solid rgba(239,68,68,0.25)" },
  };

  const labels: Record<KnowledgeDoc["status"], string> = {
    ready:      t.knowledge.status.ready,
    processing: t.knowledge.status.processing,
    pending:    t.knowledge.status.pending,
    error:      t.knowledge.status.error,
  };

  return (
    <span style={{ ...colors[status], fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "6px", letterSpacing: "0.03em" }}>
      {labels[status]}
    </span>
  );
}

// ─── Upload card ──────────────────────────────────────────────────────────────
function UploadCard({
  type,
  atLimit,
  onUploaded,
}: {
  type: KnowledgeType;
  atLimit: boolean;
  onUploaded: () => void;
}) {
  const { t } = useTranslation();
  const { open: openUpgradeModal } = useUpgradeModal();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [dragging, setDragging] = useState(false);

  // Auto-dismiss toast after 6 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setToast(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", type);
    fd.append("title", title.trim() || file.name);

    try {
      const res = await fetch("/api/knowledge/upload", { method: "POST", body: fd, credentials: "include" });

      // Safely parse JSON — server might return HTML on unexpected errors
      let json: any = {};
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        json = await res.json();
      } else {
        const text = await res.text();
        console.error("[upload] Non-JSON response:", res.status, text);
        json = { ok: false, error: `Server error ${res.status}` };
      }

      if (!res.ok || !json.ok) {
        console.error("[upload] Upload failed:", json?.error);
        setToast({ type: "error", message: json?.error ?? "Upload failed" });
        return;
      }

      // Success: reset form and trigger list refresh
      setFile(null);
      setTitle("");
      if (fileRef.current) fileRef.current.value = "";
      setToast({ type: "success", message: "Uploaded. Processing started." });
      onUploaded();
    } catch (err: any) {
      console.error("[upload] Network error:", err);
      setToast({ type: "error", message: err?.message ?? "Network error" });
    } finally {
      setUploading(false);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragging(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  }

  function openFilePicker(e: React.MouseEvent) {
    e.stopPropagation();
    fileRef.current?.click();
  }

  // ── Blocked state ──────────────────────────────────────────────────────────
  if (atLimit) {
    return (
      <div style={{ ...styles.uploadCard, alignItems: "flex-start", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "20px" }}>📄</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--text)", marginBottom: "3px" }}>
              Document limit reached
            </div>
            <div style={{ fontSize: "13px", color: "var(--muted)" }}>
              Upgrade to Growth for up to 50 documents.
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => openUpgradeModal()}
          style={{ ...styles.primaryButton, cursor: "pointer" }}
        >
          Upgrade now →
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleUpload} style={styles.uploadCard}>
      {/* Hidden native input — triggered programmatically */}
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.txt,.md,.csv"
        style={{ display: "none" }}
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />

      {/* Title */}
      <input
        type="text"
        placeholder={t.common.titleOptional}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={styles.textInput}
      />

      {/* Drag-and-drop zone */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          padding: "11px 14px",
          borderRadius: "10px",
          border: dragging
            ? "1px solid rgba(180,240,0,0.6)"
            : "1px solid var(--border)",
          background: dragging
            ? "rgba(180,240,0,0.04)"
            : "var(--bg)",
          cursor: "pointer",
          transition: "border-color 0.15s ease, background 0.15s ease",
          userSelect: "none",
        }}
      >
        <span
          style={{
            fontSize: "13px",
            color: file ? "var(--text)" : "var(--muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            minWidth: 0,
          }}
        >
          {file ? file.name : t.knowledge.dropzonePlaceholder}
        </span>

        <button
          type="button"
          onClick={openFilePicker}
          style={{
            background: "#1a1a1a",
            color: "#ffffff",
            border: "none",
            padding: "6px 14px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
            flexShrink: 0,
            transition: "opacity 0.15s ease",
            letterSpacing: "0.01em",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          {file ? t.knowledge.changeFile : t.knowledge.selectFile}
        </button>
      </div>

      {/* Upload submit button */}
      <button
        type="submit"
        disabled={!file || uploading}
        style={{
          ...styles.primaryButton,
          opacity: !file || uploading ? 0.45 : 1,
          cursor: !file || uploading ? "not-allowed" : "pointer",
          alignSelf: "flex-end",
        }}
      >
        {uploading ? t.common.uploading : t.common.upload}
      </button>

      {toast && (
        <div style={toast.type === "success" ? styles.successBanner : styles.errorBanner}>
          {toast.message}
        </div>
      )}
    </form>
  );
}

// ─── Document row ─────────────────────────────────────────────────────────────
function DocRow({
  doc,
  onDeleted,
  onReindexed,
}: {
  doc: KnowledgeDoc;
  onDeleted: () => void;
  onReindexed: () => void;
}) {
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [reindexResult, setReindexResult] = useState<"idle" | "ok" | "error">("idle");

  async function handleDelete() {
    if (!confirm(`${t.common.delete} "${doc.title}"?`)) return;
    setDeleting(true);
    await fetch(`/api/knowledge/document/${doc.id}`, { method: "DELETE" });
    setDeleting(false);
    onDeleted();
  }

  async function handleReindex() {
    setReindexing(true);
    setReindexResult("idle");
    try {
      const res = await fetch("/api/knowledge/reindex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: doc.id }),
      });
      setReindexResult(res.ok ? "ok" : "error");
      if (res.ok) onReindexed();
    } catch {
      setReindexResult("error");
    } finally {
      setReindexing(false);
      setTimeout(() => setReindexResult("idle"), 3000);
    }
  }

  const reindexColor =
    reindexResult === "ok"    ? "#B4F000" :
    reindexResult === "error" ? "#ef4444" :
    "var(--muted)";

  const reindexBorderColor =
    reindexResult === "ok"    ? "rgba(180,240,0,0.3)" :
    reindexResult === "error" ? "rgba(239,68,68,0.3)" :
    "var(--border)";

  return (
    <div style={styles.docRow}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
          <span style={styles.docTitle}>{doc.title}</span>
          <StatusBadge status={doc.status} />
        </div>

        <div style={styles.docMeta}>
          <span>{doc.source}</span>
          <span>·</span>
          <span>{doc.chunk_count} chunks</span>
          <span>·</span>
          <span>{new Date(doc.created_at).toLocaleDateString()}</span>
          {doc.error && (
            <>
              <span>·</span>
              <span style={{ color: "#ef4444" }}>{doc.error}</span>
            </>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
        <button
          onClick={handleReindex}
          disabled={reindexing}
          style={{
            ...styles.actionButton,
            color: reindexColor,
            borderColor: reindexBorderColor,
            opacity: reindexing ? 0.55 : 1,
          }}
        >
          {reindexing ? "…" : reindexResult === "ok" ? "Reindexed ✓" : reindexResult === "error" ? "Failed ✗" : "Reindex"}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          style={{ ...styles.actionButton, color: "#ef4444", borderColor: "rgba(239,68,68,0.3)" }}
        >
          {deleting ? "…" : t.common.delete}
        </button>
      </div>
    </div>
  );
}

// ─── Doc counter bar ──────────────────────────────────────────────────────────
function DocCounterBar({ used, limit }: { used: number; limit: number | null }) {
  if (limit === null) {
    return (
      <div style={styles.docCounter}>
        <span style={{ fontSize: "13px", color: "var(--muted)" }}>
          Documents: <strong style={{ color: "var(--text)" }}>{used}</strong> / ∞
        </span>
      </div>
    );
  }

  const pct = Math.min(100, Math.round((used / limit) * 100));
  const barColor = pct >= 100 ? "#ef4444" : pct >= 90 ? "#eab308" : "#B4F000";

  return (
    <div style={styles.docCounter}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
        <span style={{ fontSize: "13px", color: "var(--muted)" }}>
          Documents: <strong style={{ color: "var(--text)" }}>{used}</strong> / {limit}
        </span>
        <span style={{ fontSize: "12px", color: "var(--muted)" }}>{pct}%</span>
      </div>
      <div style={{ height: "4px", borderRadius: "2px", background: "var(--border)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: "2px", transition: "width 0.3s ease" }} />
      </div>
    </div>
  );
}

// ─── Tab panel ────────────────────────────────────────────────────────────────
function TabPanel({ type, atLimit, onDocCountChange }: {
  type: KnowledgeType;
  atLimit: boolean;
  onDocCountChange: (count: number) => void;
}) {
  const { t } = useTranslation();
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/knowledge/documents?type=${type}`, { cache: "no-store" });
    const json = await res.json();
    const fetched: KnowledgeDoc[] = json.documents ?? [];
    setDocs(fetched);
    setLoading(false);
    if (type !== "platform") {
      onDocCountChange(fetched.filter(d => d.status !== "error").length);
    }
  }, [type, onDocCountChange]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // B4 — Auto-poll while any docs are still processing/pending
  const hasProcessing = docs.some(d => d.status === "processing" || d.status === "pending");
  useEffect(() => {
    if (!hasProcessing) return;
    const interval = setInterval(refresh, 4000);
    return () => clearInterval(interval);
  }, [hasProcessing, refresh]);

  const filtered = search
    ? docs.filter(d => d.title.toLowerCase().includes(search.toLowerCase()) || d.source.toLowerCase().includes(search.toLowerCase()))
    : docs;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <UploadCard type={type} atLimit={atLimit && type !== "platform"} onUploaded={refresh} />

      {!loading && docs.length > 5 && (
        <input
          type="text"
          placeholder="Search documents…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.textInput}
        />
      )}

      {loading ? (
        <div style={styles.emptyState}>{t.common.loading}</div>
      ) : filtered.length === 0 ? (
        <div style={styles.emptyState}>{search ? "No documents match your search." : t.common.noDocuments}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {filtered.map((doc) => (
            <DocRow
              key={doc.id}
              doc={doc}
              onDeleted={refresh}
              onReindexed={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main client component ────────────────────────────────────────────────────
export function KnowledgeClient({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation();
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null);
  // Track live doc count per tab (updated when TabPanel loads)
  const [liveDocCount, setLiveDocCount] = useState(0);

  useEffect(() => {
    fetch("/api/billing/usage", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (data.plan) {
          setUsageInfo({ plan: data.plan, docsUsed: data.docsUsed ?? 0, docsLimit: data.docsLimit ?? null });
          setLiveDocCount(data.docsUsed ?? 0);
        }
      })
      .catch(() => {});
  }, []);

  const atLimit = usageInfo !== null && usageInfo.docsLimit !== null && liveDocCount >= usageInfo.docsLimit;

  const ALL_TABS = [
    { key: "policy"   as KnowledgeType, label: t.knowledge.tabPolicy,   description: t.knowledge.tabPolicyDesc },
    { key: "training" as KnowledgeType, label: t.knowledge.tabTraining, description: t.knowledge.tabTrainingDesc },
    { key: "platform" as KnowledgeType, label: t.knowledge.tabPlatform, description: t.knowledge.tabPlatformDesc },
  ];

  // Platform tab is only available to admin — filter server-side decision into UI
  const TABS = isAdmin ? ALL_TABS : ALL_TABS.filter((tab) => tab.key !== "platform");

  const [activeTab, setActiveTab] = useState<KnowledgeType>(TABS[0].key);

  const safeTab = TABS.find((tab) => tab.key === activeTab) ? activeTab : TABS[0].key;
  const activeTabDef = TABS.find((tab) => tab.key === safeTab) ?? TABS[0];

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>{t.knowledge.title}</h1>
        <p style={styles.subtitle}>
          {isAdmin ? t.knowledge.subtitle : t.knowledge.subtitleClient}
        </p>
      </div>

      {/* Tab bar */}
      <div style={styles.tabBar}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              ...styles.tabButton,
              ...(safeTab === tab.key ? styles.tabButtonActive : {}),
            }}
          >
            {tab.label}
            {tab.key === "platform" && (
              <span style={styles.adminBadge}>{t.common.admin}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab description */}
      <p style={styles.tabDescription}>{activeTabDef.description}</p>

      {/* Doc counter — only for tenant-scoped tabs */}
      {usageInfo && safeTab !== "platform" && (
        <DocCounterBar used={liveDocCount} limit={usageInfo.docsLimit} />
      )}

      {/* Tab content — remount on tab switch */}
      <TabPanel
        key={safeTab}
        type={safeTab}
        atLimit={atLimit}
        onDocCountChange={setLiveDocCount}
      />
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: "52px 44px",
    maxWidth: "960px",
    margin: "0 auto",
    minHeight: "100vh",
    background: "var(--bg)",
    color: "var(--text)",
  },
  header: {
    marginBottom: "36px",
  },
  title: {
    fontSize: "26px",
    fontWeight: 600,
    marginBottom: "6px",
    color: "var(--text)",
    letterSpacing: "-0.02em",
  },
  subtitle: {
    color: "var(--muted)",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  tabBar: {
    display: "flex",
    gap: "4px",
    borderBottom: "1px solid var(--border)",
    marginBottom: "16px",
  },
  tabButton: {
    background: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    padding: "8px 16px",
    marginBottom: "-1px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 500,
    color: "var(--muted)",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    transition: "color 0.15s",
  },
  tabButtonActive: {
    color: "var(--text)",
    borderBottomColor: "#B4F000",
  },
  adminBadge: {
    fontSize: "10px",
    fontWeight: 600,
    padding: "1px 5px",
    borderRadius: "4px",
    background: "rgba(180,240,0,0.12)",
    color: "#B4F000",
    border: "1px solid rgba(180,240,0,0.25)",
    letterSpacing: "0.04em",
  },
  tabDescription: {
    fontSize: "13px",
    color: "var(--muted)",
    marginBottom: "16px",
  },
  docCounter: {
    marginBottom: "16px",
    padding: "12px 16px",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "10px",
  },
  uploadCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    padding: "18px 22px",
    borderRadius: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  textInput: {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "13px",
    color: "var(--text)",
    outline: "none",
    width: "100%",
  },
  primaryButton: {
    background: "#B4F000",
    border: "none",
    padding: "9px 20px",
    borderRadius: "8px",
    color: "#0B1220",
    fontWeight: 700,
    fontSize: "13px",
    whiteSpace: "nowrap" as const,
    transition: "opacity 0.15s",
  },
  successBanner: {
    background: "rgba(180,240,0,0.08)",
    border: "1px solid rgba(180,240,0,0.2)",
    color: "#B4F000",
    padding: "10px 14px",
    borderRadius: "8px",
    fontSize: "13px",
  },
  errorBanner: {
    background: "rgba(239,68,68,0.08)",
    border: "1px solid rgba(239,68,68,0.2)",
    color: "#ef4444",
    padding: "10px 14px",
    borderRadius: "8px",
    fontSize: "13px",
  },
  emptyState: {
    padding: "28px 24px",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "14px",
    color: "var(--muted)",
    fontSize: "14px",
  },
  docRow: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "14px 18px",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "10px",
  },
  docTitle: {
    fontWeight: 600,
    fontSize: "13px",
    color: "var(--text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  docMeta: {
    display: "flex",
    gap: "6px",
    fontSize: "12px",
    color: "var(--muted)",
    flexWrap: "wrap" as const,
  },
  actionButton: {
    background: "transparent",
    border: "1px solid var(--border)",
    color: "var(--muted)",
    padding: "5px 12px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 500,
  },
};
