"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { useUpgradeModal } from "@/lib/upgradeModal";

type DocType = "return_policy" | "shipping_policy" | "warranty" | "product_info" | "general";

type KnowledgeDoc = {
  id: string;
  client_id: string | null;
  type: string;
  doc_type: DocType;
  title: string;
  source: string;
  mime_type: string;
  status: "pending" | "processing" | "ready" | "error";
  chunk_count: number;
  error: string | null;
  tags: string[] | null;
  language: string;
  created_at: string;
  updated_at: string;
};

type UsageInfo = {
  plan: string;
  docsUsed: number;
  docsLimit: number | null;
};

type Notice = { type: "success" | "error"; message: string } | null;

const DOC_TYPE_VALUES: DocType[] = [
  "return_policy",
  "shipping_policy",
  "warranty",
  "product_info",
  "general",
];

const LANGUAGE_VALUES = ["nl", "en", "de", "fr"];

const pageTitleStyle: React.CSSProperties = {
  fontSize: "28px",
  fontWeight: 800,
  letterSpacing: "-0.03em",
  color: "var(--text)",
  margin: 0,
};

const pageSubtitleStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "var(--muted)",
  marginTop: "8px",
  lineHeight: 1.7,
  maxWidth: 720,
};

const eyebrowStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "11px",
  fontWeight: 700,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const sectionCardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  overflow: "hidden",
  boxShadow: "0 18px 36px rgba(15,23,42,0.035)",
};

const sectionHeaderStyle: React.CSSProperties = {
  padding: "14px 18px",
  borderBottom: "1px solid var(--border)",
  display: "grid",
  gap: 6,
  background: "rgba(255,255,255,0.65)",
};

const sectionBodyStyle: React.CSSProperties = {
  padding: 18,
  display: "grid",
  gap: 18,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 13px",
  borderRadius: "10px",
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  transition: "border-color 120ms ease, box-shadow 120ms ease, background 120ms ease",
};

const greenPrimaryButtonStyle: React.CSSProperties = {
  minHeight: 48,
  padding: "12px 20px",
  borderRadius: 14,
  border: "none",
  background: "#C7F56F",
  color: "#0f1a00",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(199,245,111,0.24)",
  transition: "transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease",
};

const secondaryButtonStyle: React.CSSProperties = {
  minHeight: 40,
  padding: "0 14px",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text)",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  transition: "background 120ms ease, border-color 120ms ease",
};

function SectionCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={sectionCardStyle}>
      <div style={sectionHeaderStyle}>
        {eyebrow ? <p style={eyebrowStyle}>{eyebrow}</p> : null}
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{title}</p>
        {description ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.65 }}>{description}</p>
        ) : null}
      </div>
      <div style={sectionBodyStyle}>{children}</div>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 8 }}>
      {children}
    </label>
  );
}

function FileIcon({ mimeType }: { mimeType: string }) {
  const text = mimeType.includes("pdf") ? "PDF" : mimeType.includes("markdown") ? "MD" : mimeType.includes("csv") ? "CSV" : "TXT";
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: "var(--surface-2)",
        color: "var(--text)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.05em",
        flexShrink: 0,
      }}
    >
      {text}
    </div>
  );
}

function StatusChip({ status }: { status: KnowledgeDoc["status"] }) {
  const { t } = useTranslation();
  const styles: Record<KnowledgeDoc["status"], { dot: string; bg: string; color: string }> = {
    ready: { dot: "#7CCF00", bg: "rgba(199,245,111,0.14)", color: "#5c8200" },
    processing: { dot: "#f59e0b", bg: "rgba(245,158,11,0.12)", color: "#b45309" },
    pending: { dot: "#94a3b8", bg: "var(--surface-2)", color: "var(--muted)" },
    error: { dot: "#ef4444", bg: "rgba(239,68,68,0.1)", color: "#dc2626" },
  };
  const tone = styles[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        borderRadius: 6,
        padding: "4px 8px",
        background: tone.bg,
        color: tone.color,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.04em",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: tone.dot }} />
      {t.knowledge.status[status]}
    </span>
  );
}

function MiniDocTypeBadge({ docType }: { docType: DocType }) {
  const { t } = useTranslation();
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 6,
        padding: "4px 8px",
        background: "var(--surface-2)",
        color: "var(--muted)",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.04em",
        whiteSpace: "nowrap",
      }}
    >
      {t.knowledge.docType[docType]}
    </span>
  );
}

function DocumentRow({
  doc,
  onRequestDelete,
  onReindexed,
}: {
  doc: KnowledgeDoc;
  onRequestDelete: (doc: KnowledgeDoc) => void;
  onReindexed: () => void;
}) {
  const { t } = useTranslation();
  const [reindexing, setReindexing] = useState(false);
  const [reindexResult, setReindexResult] = useState<"idle" | "ok" | "error">("idle");

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
      setTimeout(() => setReindexResult("idle"), 2800);
    }
  }

  const reindexLabel =
    reindexing
      ? t.common.loading
      : reindexResult === "ok"
        ? t.knowledge.reindexSuccess
        : reindexResult === "error"
          ? t.knowledge.reindexFailed
          : t.common.reindex;

  const updatedLabel = new Date(doc.updated_at).toLocaleDateString();

  return (
    <article
      style={{
        ...sectionCardStyle,
        overflow: "visible",
        padding: 0,
      }}
      className="knowledge-doc-row"
    >
      <div
        style={{
          padding: 18,
          display: "flex",
          alignItems: "flex-start",
          gap: 16,
        }}
      >
        <FileIcon mimeType={doc.mime_type} />

        <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {doc.title}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <MiniDocTypeBadge docType={doc.doc_type ?? "general"} />
                <StatusChip status={doc.status} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", background: "var(--surface-2)", borderRadius: 6, padding: "4px 8px" }}>
                  {doc.chunk_count} {t.knowledge.chunksLabel}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, opacity: 0.55 }} className="knowledge-doc-row__actions">
              <button
                type="button"
                onClick={handleReindex}
                disabled={reindexing}
                aria-label={t.common.reindex}
                title={reindexLabel}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: reindexResult === "ok" ? "rgba(199,245,111,0.14)" : reindexResult === "error" ? "rgba(239,68,68,0.08)" : "transparent",
                  color: reindexResult === "ok" ? "#5c8200" : reindexResult === "error" ? "#dc2626" : "var(--muted)",
                  cursor: reindexing ? "not-allowed" : "pointer",
                }}
              >
                ↻
              </button>
              <button
                type="button"
                onClick={() => onRequestDelete(doc)}
                aria-label={t.common.delete}
                title={t.common.delete}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: "1px solid rgba(239,68,68,0.16)",
                  background: "rgba(239,68,68,0.06)",
                  color: "#dc2626",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
            <span>{doc.source}</span>
            <span>•</span>
            <span>{t.knowledge.lastUpdatedLabel} {updatedLabel}</span>
            <span>•</span>
            <span>{doc.language?.toUpperCase()}</span>
          </div>

          {doc.tags && doc.tags.length > 0 ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {doc.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    borderRadius: 999,
                    padding: "4px 8px",
                    background: "var(--surface-2)",
                    color: "var(--muted)",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          {doc.error ? (
            <div style={{ borderRadius: 12, border: "1px solid rgba(239,68,68,0.18)", background: "rgba(239,68,68,0.05)", color: "#dc2626", padding: "10px 12px", fontSize: 12, lineHeight: 1.6 }}>
              {doc.error}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function UsageBar({ used, limit }: { used: number; limit: number | null }) {
  const { t } = useTranslation();
  if (limit === null) {
    return (
      <SectionCard eyebrow={t.knowledge.usageEyebrow} title={t.knowledge.usageTitle}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>{t.knowledge.usageUnlimited}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{used}</span>
          </div>
          <div style={{ height: 4, borderRadius: 999, background: "var(--border)", overflow: "hidden" }}>
            <div style={{ width: "38%", height: "100%", background: "#C7F56F" }} />
          </div>
        </div>
      </SectionCard>
    );
  }

  const pct = Math.min(100, Math.round((used / limit) * 100));
  const fill = pct >= 100 ? "#ef4444" : pct >= 85 ? "#f59e0b" : "#C7F56F";

  return (
    <SectionCard eyebrow={t.knowledge.usageEyebrow} title={t.knowledge.usageTitle} description={t.knowledge.usageDescription}>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            {used} / {limit} {t.knowledge.docsLabel}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>{pct}%</span>
        </div>
        <div style={{ height: 4, borderRadius: 999, background: "var(--border)", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: fill, transition: "width 220ms ease" }} />
        </div>
      </div>
    </SectionCard>
  );
}

function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      style={{
        ...sectionCardStyle,
        padding: 32,
        display: "grid",
        placeItems: "center",
        textAlign: "center",
        gap: 14,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 18,
          background: "rgba(199,245,111,0.14)",
          color: "#5c8200",
          display: "grid",
          placeItems: "center",
          fontSize: 24,
          fontWeight: 800,
        }}
      >
        ⌘
      </div>
      <div style={{ display: "grid", gap: 6, maxWidth: 420 }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{title}</p>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.7 }}>{description}</p>
      </div>
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction} style={greenPrimaryButtonStyle}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function UploadComposer({
  isAdmin,
  atLimit,
  onUploaded,
  onNotice,
}: {
  isAdmin: boolean;
  atLimit: boolean;
  onUploaded: () => void;
  onNotice: (notice: Notice) => void;
}) {
  const { t } = useTranslation();
  const { open: openUpgradeModal } = useUpgradeModal();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState<DocType>("general");
  const [tagsInput, setTagsInput] = useState("");
  const [language, setLanguage] = useState("nl");
  const [isPlatform, setIsPlatform] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setUploading(true);
    onNotice(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", isPlatform ? "platform" : "policy");
    fd.append("doc_type", docType);
    fd.append("tags", tagsInput.trim());
    fd.append("language", language);
    fd.append("title", title.trim() || file.name);

    try {
      const res = await fetch("/api/knowledge/upload", { method: "POST", body: fd, credentials: "include" });
      let json: { ok?: boolean; error?: string } = {};
      const contentType = res.headers.get("content-type") ?? "";

      if (contentType.includes("application/json")) {
        json = await res.json();
      } else {
        json = { ok: false, error: `Server error ${res.status}` };
      }

      if (!res.ok || !json.ok) {
        onNotice({ type: "error", message: json?.error ?? t.knowledge.uploadFailed });
        return;
      }

      setFile(null);
      setTitle("");
      setTagsInput("");
      setLanguage("nl");
      setDocType("general");
      setIsPlatform(false);
      if (fileRef.current) fileRef.current.value = "";
      onNotice({ type: "success", message: t.knowledge.uploadSuccess });
      onUploaded();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t.knowledge.uploadNetworkError;
      onNotice({ type: "error", message });
    } finally {
      setUploading(false);
    }
  }

  function handleDragOver(event: React.DragEvent) {
    event.preventDefault();
    setDragging(true);
  }

  function handleDragLeave(event: React.DragEvent) {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  }

  return (
    <SectionCard
      eyebrow={t.knowledge.uploadEyebrow}
      title={t.knowledge.uploadTitle}
      description={atLimit ? t.knowledge.limitReachedDescription : t.knowledge.uploadDescription}
    >
      {atLimit ? (
        <div
          style={{
            borderRadius: 14,
            border: "1px solid rgba(245,158,11,0.22)",
            background: "rgba(245,158,11,0.06)",
            padding: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{t.knowledge.limitReachedTitle}</p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.65 }}>{t.knowledge.limitReachedDescription}</p>
          </div>
          <button type="button" onClick={() => openUpgradeModal()} style={greenPrimaryButtonStyle}>
            {t.knowledge.limitReachedCta}
          </button>
        </div>
      ) : (
        <form id="knowledge-upload" onSubmit={handleUpload} style={{ display: "grid", gap: 18 }}>
          <input ref={fileRef} type="file" accept=".pdf,.txt,.md,.csv" style={{ display: "none" }} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />

          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              borderRadius: 16,
              border: dragging ? "1px solid rgba(199,245,111,0.6)" : "1px dashed rgba(148,163,184,0.45)",
              background: dragging ? "rgba(199,245,111,0.06)" : "var(--bg)",
              padding: "28px 24px",
              display: "grid",
              placeItems: "center",
              textAlign: "center",
              gap: 10,
              cursor: "pointer",
              transition: "border-color 120ms ease, background 120ms ease, transform 120ms ease",
            }}
          >
            <div style={{ width: 54, height: 54, borderRadius: 18, background: "rgba(199,245,111,0.15)", color: "#5c8200", display: "grid", placeItems: "center", fontSize: 24 }}>
              ↓
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{t.knowledge.dropzoneTitle}</p>
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.65 }}>
                {file ? file.name : t.knowledge.dropzoneDescription}
              </p>
            </div>
            <button type="button" onClick={(event) => { event.stopPropagation(); fileRef.current?.click(); }} style={secondaryButtonStyle}>
              {file ? t.knowledge.changeFile : t.knowledge.selectFile}
            </button>
            <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>{t.knowledge.acceptedFormats}</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(180px,0.8fr)", gap: 14 }}>
            <div>
              <Label>{t.common.titleOptional}</Label>
              <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t.common.titleOptional} style={inputStyle} />
            </div>
            <div>
              <Label>{t.knowledge.docTypeLabel}</Label>
              <select value={docType} onChange={(event) => setDocType(event.target.value as DocType)} style={{ ...inputStyle, cursor: "pointer" }}>
                {DOC_TYPE_VALUES.map((value) => (
                  <option key={value} value={value}>{t.knowledge.docType[value]}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 160px", gap: 14 }}>
            <div>
              <Label>{t.knowledge.tagsLabel}</Label>
              <input type="text" value={tagsInput} onChange={(event) => setTagsInput(event.target.value)} placeholder={t.knowledge.tagsPlaceholder} style={inputStyle} />
            </div>
            <div>
              <Label>{t.knowledge.languageLabel}</Label>
              <select value={language} onChange={(event) => setLanguage(event.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                {LANGUAGE_VALUES.map((value) => (
                  <option key={value} value={value}>{t.knowledge.languageOptions[value as keyof typeof t.knowledge.languageOptions]}</option>
                ))}
              </select>
            </div>
          </div>

          {isAdmin ? (
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--muted)", cursor: "pointer" }}>
              <input type="checkbox" checked={isPlatform} onChange={(event) => setIsPlatform(event.target.checked)} style={{ accentColor: "#C7F56F" }} />
              {t.knowledge.platformDocLabel}
            </label>
          ) : null}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              disabled={!file || uploading}
              style={{
                ...greenPrimaryButtonStyle,
                opacity: !file || uploading ? 0.45 : 1,
                cursor: !file || uploading ? "not-allowed" : "pointer",
              }}
            >
              {uploading ? t.common.uploading : t.common.upload}
            </button>
          </div>
        </form>
      )}
    </SectionCard>
  );
}

export function KnowledgeClient({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation();
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<DocType | "all">("all");
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null);
  const [liveDocCount, setLiveDocCount] = useState(0);
  const [notice, setNotice] = useState<Notice>(null);
  const [docToDelete, setDocToDelete] = useState<KnowledgeDoc | null>(null);
  const [deletingDoc, setDeletingDoc] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    fetch("/api/billing/usage", { credentials: "include" })
      .then((response) => response.json())
      .then((data) => {
        if (data.plan) {
          setUsageInfo({ plan: data.plan, docsUsed: data.docsUsed ?? 0, docsLimit: data.docsLimit ?? null });
          setLiveDocCount(data.docsUsed ?? 0);
        }
      })
      .catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/knowledge/documents", { cache: "no-store" });
    const json = await response.json();
    const fetched: KnowledgeDoc[] = json.documents ?? [];
    setDocs(fetched);
    setLiveDocCount(fetched.filter((doc) => doc.status !== "error" && doc.client_id !== null).length);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const hasProcessing = docs.some((doc) => doc.status === "processing" || doc.status === "pending");
  useEffect(() => {
    if (!hasProcessing) return;
    const interval = setInterval(refresh, 4000);
    return () => clearInterval(interval);
  }, [hasProcessing, refresh]);

  const atLimit = usageInfo !== null && usageInfo.docsLimit !== null && liveDocCount >= usageInfo.docsLimit;

  const filtered = useMemo(() => {
    return docs.filter((doc) => {
      const matchesFilter = activeFilter === "all" || doc.doc_type === activeFilter;
      const query = search.toLowerCase();
      const matchesSearch = !search || (
        doc.title?.toLowerCase().includes(query) ||
        doc.source?.toLowerCase().includes(query) ||
        doc.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, docs, search]);

  const filterOptions: { key: DocType | "all"; label: string }[] = [
    { key: "all", label: t.knowledge.filterAll },
    ...DOC_TYPE_VALUES.map((value) => ({ key: value, label: t.knowledge.docType[value] })),
  ];

  async function handleDeleteDocument() {
    if (!docToDelete) return;
    setDeletingDoc(true);
    try {
      await fetch(`/api/knowledge/document/${docToDelete.id}`, { method: "DELETE" });
      setDocToDelete(null);
      setNotice({ type: "success", message: t.knowledge.deleteSuccess });
      refresh();
    } catch {
      setNotice({ type: "error", message: t.knowledge.deleteError });
    } finally {
      setDeletingDoc(false);
    }
  }

  return (
    <div style={{ padding: "52px 44px", maxWidth: 1080, margin: "0 auto", minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <style>{`
        .knowledge-doc-row:hover {
          border-color: rgba(199,245,111,0.28);
          transform: translateY(-1px);
        }
        .knowledge-doc-row:hover .knowledge-doc-row__actions {
          opacity: 1 !important;
        }
        @media (max-width: 900px) {
          .knowledge-header-grid,
          .knowledge-top-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <div className="knowledge-header-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 20, alignItems: "end", marginBottom: 28 }}>
        <div>
          <h1 style={pageTitleStyle}>{t.knowledge.title}</h1>
          <p style={pageSubtitleStyle}>{isAdmin ? t.knowledge.subtitle : t.knowledge.subtitleClient}</p>
        </div>
        <a href="#knowledge-upload" style={{ ...greenPrimaryButtonStyle, display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
          {t.knowledge.uploadAction}
        </a>
      </div>

      {notice ? (
        <div
          style={{
            borderRadius: 14,
            border: `1px solid ${notice.type === "success" ? "rgba(199,245,111,0.28)" : "rgba(239,68,68,0.25)"}`,
            background: notice.type === "success" ? "rgba(199,245,111,0.08)" : "rgba(239,68,68,0.08)",
            color: notice.type === "success" ? "#5c8200" : "#f87171",
            padding: "12px 14px",
            fontSize: 13,
            lineHeight: 1.6,
            marginBottom: 20,
          }}
        >
          {notice.message}
        </div>
      ) : null}

      <div className="knowledge-top-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: 20, alignItems: "start", marginBottom: 24 }}>
        <UploadComposer isAdmin={isAdmin} atLimit={atLimit} onUploaded={refresh} onNotice={setNotice} />
        {usageInfo ? <UsageBar used={liveDocCount} limit={usageInfo.docsLimit} /> : null}
      </div>

      <div style={{ ...sectionCardStyle, marginBottom: 24 }}>
        <div style={{ ...sectionHeaderStyle, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <p style={eyebrowStyle}>{t.knowledge.libraryEyebrow}</p>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{t.knowledge.libraryTitle}</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {filterOptions.map((option) => {
              const active = activeFilter === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setActiveFilter(option.key)}
                  style={{
                    minHeight: 36,
                    padding: "0 12px",
                    borderRadius: 12,
                    border: "none",
                    background: active ? "var(--surface-2)" : "transparent",
                    boxShadow: active ? "0 6px 18px rgba(15,23,42,0.08)" : "none",
                    color: active ? "var(--text)" : "var(--muted)",
                    fontSize: 12,
                    fontWeight: active ? 700 : 600,
                    cursor: "pointer",
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={sectionBodyStyle}>
          <div style={{ display: "grid", gap: 8 }}>
            <Label>{t.knowledge.searchLabel}</Label>
            <input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.knowledge.searchPlaceholder} style={inputStyle} />
          </div>

          {loading ? (
            <div style={{ display: "grid", gap: 12 }}>
              {[1, 2, 3].map((item) => (
                <div key={item} style={{ ...sectionCardStyle, padding: 18, display: "grid", gap: 10 }}>
                  <div style={{ width: "42%", height: 16, borderRadius: 8, background: "linear-gradient(90deg, var(--surface) 25%, var(--surface-2) 50%, var(--surface) 75%)", backgroundSize: "400% 100%", animation: "shimmer 1.5s ease-in-out infinite" }} />
                  <div style={{ width: "78%", height: 12, borderRadius: 8, background: "linear-gradient(90deg, var(--surface) 25%, var(--surface-2) 50%, var(--surface) 75%)", backgroundSize: "400% 100%", animation: "shimmer 1.5s ease-in-out infinite" }} />
                  <div style={{ width: "100%", height: 4, borderRadius: 999, background: "linear-gradient(90deg, var(--surface) 25%, var(--surface-2) 50%, var(--surface) 75%)", backgroundSize: "400% 100%", animation: "shimmer 1.5s ease-in-out infinite" }} />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            search || activeFilter !== "all" ? (
              <EmptyState title={t.knowledge.emptyFilteredTitle} description={t.knowledge.emptyFilteredDescription} actionLabel={t.knowledge.clearFilters} onAction={() => { setSearch(""); setActiveFilter("all"); }} />
            ) : (
              <EmptyState title={t.knowledge.emptyTitle} description={t.knowledge.emptyDescription} actionLabel={t.knowledge.uploadAction} onAction={() => document.getElementById("knowledge-upload")?.scrollIntoView({ behavior: "smooth", block: "center" })} />
            )
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {filtered.map((doc) => (
                <DocumentRow key={doc.id} doc={doc} onRequestDelete={setDocToDelete} onReindexed={refresh} />
              ))}
            </div>
          )}
        </div>
      </div>

      {docToDelete ? (
        <div className="sf-modal-overlay" onClick={() => !deletingDoc && setDocToDelete(null)}>
          <div className="sf-modal" style={{ maxWidth: 500, border: "1px solid var(--border)" }} onClick={(event) => event.stopPropagation()}>
            <div className="sf-modal__header">
              <div className="sf-modal__header-left">
                <span className="sf-modal__icon" style={{ background: "rgba(239,68,68,0.12)" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" />
                    <path d="M8 6V4h8v2" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                </span>
                <div>
                  <p className="sf-modal__title">{t.knowledge.deleteTitle}</p>
                  <p className="sf-modal__subtitle">{t.knowledge.deleteDescription.replace("{title}", docToDelete.title)}</p>
                </div>
              </div>
              <button className="sf-modal__close" onClick={() => setDocToDelete(null)} aria-label={t.common.close}>
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M5 5l10 10M15 5 5 15" />
                </svg>
              </button>
            </div>
            <div className="sf-modal__footer" style={{ gap: 10 }}>
              <button type="button" onClick={() => setDocToDelete(null)} style={secondaryButtonStyle}>
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleDeleteDocument}
                disabled={deletingDoc}
                style={{
                  minHeight: 42,
                  padding: "0 16px",
                  borderRadius: 12,
                  border: "1px solid rgba(239,68,68,0.24)",
                  background: "rgba(239,68,68,0.08)",
                  color: "#f87171",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: deletingDoc ? "not-allowed" : "pointer",
                  opacity: deletingDoc ? 0.6 : 1,
                }}
              >
                {deletingDoc ? t.common.loading : t.knowledge.deleteConfirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
