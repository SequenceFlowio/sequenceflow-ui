"use client";

import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  Library,
  LockKeyhole,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTranslation } from "@/lib/i18n/LanguageProvider";
import {
  summarizeKnowledgeDocuments,
  type KnowledgeDocumentState,
  type KnowledgeHealth,
} from "@/lib/knowledge/status";
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
  status: KnowledgeDocumentState;
  chunk_count: number;
  error: string | null;
  tags: string[] | null;
  language: string;
  created_at: string;
  updated_at: string;
};

type UsageInfo = {
  docsLimit: number | null;
};

type KnowledgeMatch = {
  documentId: string;
  title: string;
  source: string | null;
  docType: string;
  content: string;
  similarity: number | null;
  shared: boolean;
};

type Notice = { type: "success" | "error"; message: string } | null;

const DOC_TYPE_VALUES: DocType[] = [
  "return_policy",
  "shipping_policy",
  "warranty",
  "product_info",
  "general",
];
const LANGUAGE_VALUES = ["nl", "en", "de", "fr"] as const;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = new Set(["pdf", "txt", "md", "csv"]);

async function readApiError(response: Response, fallback: string) {
  const data = await response.json().catch(() => ({})) as { error?: string };
  return data.error || fallback;
}

function validateFile(file: File, invalidMessage: string, sizeMessage: string) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ACCEPTED_EXTENSIONS.has(extension)) return invalidMessage;
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) return sizeMessage;
  return null;
}

function StatusBadge({ status }: { status: KnowledgeDocumentState }) {
  const { t } = useTranslation();
  return (
    <span className={`knowledge-badge knowledge-badge--${status}`}>
      <span className="knowledge-badge__dot" aria-hidden="true" />
      {t.knowledge.status[status]}
    </span>
  );
}

function KnowledgeMatchResult({ match, initiallyOpen }: { match: KnowledgeMatch; initiallyOpen: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(initiallyOpen);

  return (
    <details
      className="knowledge-match"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="knowledge-match__head">
        <div>
          <strong>{match.title}</strong>
          {match.source && match.source !== match.title ? <span>{match.source}</span> : null}
        </div>
        <div className="knowledge-row__badges">
          {match.shared ? <span className="knowledge-badge knowledge-badge--neutral"><LockKeyhole size={11} />{t.knowledge.sharedLabel}</span> : null}
          {match.similarity !== null ? (
            <span className={`knowledge-badge ${match.similarity >= 0.68 ? "knowledge-badge--ready" : "knowledge-badge--processing"}`}>
              {match.similarity >= 0.68 ? t.knowledge.strongMatch : t.knowledge.possibleMatch} · {Math.round(match.similarity * 100)}%
            </span>
          ) : null}
          <ChevronDown className="knowledge-match__chevron" size={16} />
        </div>
      </summary>
      <div className="knowledge-match__content"><p>{match.content}</p></div>
    </details>
  );
}

function HealthPanel({
  health,
  ready,
  processing,
  attention,
  ownUsed,
  limit,
  limitKnown,
}: {
  health: KnowledgeHealth;
  ready: number;
  processing: number;
  attention: number;
  ownUsed: number;
  limit: number | null;
  limitKnown: boolean;
}) {
  const { t } = useTranslation();
  const content = {
    healthy: {
      title: t.knowledge.healthReadyTitle,
      description: t.knowledge.healthReadyDescription,
      Icon: CheckCircle2,
    },
    processing: {
      title: t.knowledge.healthProcessingTitle,
      description: t.knowledge.healthProcessingDescription,
      Icon: Clock3,
    },
    attention: {
      title: t.knowledge.healthAttentionTitle,
      description: t.knowledge.healthAttentionDescription,
      Icon: AlertTriangle,
    },
    empty: {
      title: t.knowledge.healthEmptyTitle,
      description: t.knowledge.healthEmptyDescription,
      Icon: BookOpen,
    },
  }[health];
  const Icon = content.Icon;
  const capacity = !limitKnown
    ? `${ownUsed} / —`
    : limit === null
      ? `${ownUsed} · ${t.knowledge.unlimited}`
      : `${ownUsed} / ${limit}`;

  return (
    <section className={`knowledge-health knowledge-health--${health}`} aria-live="polite">
      <div className="knowledge-health__summary">
        <span className="knowledge-icon-box" aria-hidden="true">
          <Icon size={19} />
        </span>
        <div>
          <h2>{content.title}</h2>
          <p>{content.description}</p>
        </div>
      </div>
      <div className="knowledge-health__metrics">
        <div>
          <strong>{ready}</strong>
          <span>{t.knowledge.readyDocuments}</span>
        </div>
        <div>
          <strong>{processing}</strong>
          <span>{t.knowledge.processingDocuments}</span>
        </div>
        <div>
          <strong>{attention}</strong>
          <span>{t.knowledge.attentionDocuments}</span>
        </div>
        <div>
          <strong>{capacity}</strong>
          <span>{t.knowledge.capacity}</span>
        </div>
      </div>
    </section>
  );
}

function KnowledgeTestPanel() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<KnowledgeMatch[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const normalized = query.trim();
    if (normalized.length < 3) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/knowledge/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: normalized }),
      });
      if (!response.ok) throw new Error(await readApiError(response, t.knowledge.testNoResults));
      const data = await response.json() as { matches?: KnowledgeMatch[] };
      setMatches(data.matches ?? []);
    } catch (requestError) {
      setMatches(null);
      setError(requestError instanceof Error ? requestError.message : t.knowledge.testNoResults);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="knowledge-section">
      <div className="knowledge-section__header">
        <span className="knowledge-icon-box" aria-hidden="true">
          <Sparkles size={18} />
        </span>
        <div>
          <h2>{t.knowledge.testTitle}</h2>
          <p>{t.knowledge.testDescription}</p>
        </div>
      </div>
      <div className="knowledge-test">
        <form className="knowledge-test__form" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="knowledge-test-query">{t.knowledge.testTitle}</label>
          <input
            id="knowledge-test-query"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.knowledge.testPlaceholder}
            maxLength={500}
          />
          <button type="submit" className="knowledge-button knowledge-button--dark" disabled={loading || query.trim().length < 3}>
            <Search size={16} />
            {loading ? t.knowledge.testLoading : t.knowledge.testAction}
          </button>
        </form>

        <div className="knowledge-test__results" aria-live="polite">
          {error ? (
            <div className="knowledge-inline-message knowledge-inline-message--error">
              <AlertTriangle size={17} />
              <span>{error}</span>
            </div>
          ) : matches === null ? (
            <p className="knowledge-test__hint">{t.knowledge.testEmpty}</p>
          ) : matches.length === 0 ? (
            <div className="knowledge-inline-message">
              <Search size={17} />
              <span>{t.knowledge.testNoResults}</span>
            </div>
          ) : (
            <>
              <p className="knowledge-test__result-title">{t.knowledge.testResults} · {matches.length}</p>
              <div className="knowledge-match-list">
                {matches.map((match, index) => (
                  <KnowledgeMatchResult key={match.documentId} match={match} initiallyOpen={index === 0} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function UploadDialog({
  open,
  atLimit,
  onClose,
  onUploaded,
  onNotice,
}: {
  open: boolean;
  atLimit: boolean;
  onClose: () => void;
  onUploaded: () => void;
  onNotice: (notice: Notice) => void;
}) {
  const { t } = useTranslation();
  const { open: openUpgradeModal } = useUpgradeModal();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState<DocType>("general");
  const [tags, setTags] = useState("");
  const [language, setLanguage] = useState<(typeof LANGUAGE_VALUES)[number]>("nl");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setFile(null);
    setTitle("");
    setDocType("general");
    setTags("");
    setLanguage("nl");
    setError(null);
    setDragging(false);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const close = useCallback(() => {
    if (uploading) return;
    reset();
    onClose();
  }, [onClose, reset, uploading]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close, open]);

  function selectFile(nextFile: File | null) {
    if (!nextFile) {
      setFile(null);
      return;
    }
    const validationError = validateFile(nextFile, t.knowledge.invalidFile, t.knowledge.fileTooLarge);
    setError(validationError);
    setFile(validationError ? null : nextFile);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file || atLimit) return;

    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", "policy");
    formData.append("title", title.trim() || file.name);
    formData.append("doc_type", docType);
    formData.append("tags", tags.trim());
    formData.append("language", language);

    try {
      const response = await fetch("/api/knowledge/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) throw new Error(await readApiError(response, t.knowledge.uploadFailed));
      onNotice({ type: "success", message: t.knowledge.uploadSuccess });
      onUploaded();
      reset();
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t.knowledge.uploadFailed);
    } finally {
      setUploading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="knowledge-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <div className="knowledge-dialog" role="dialog" aria-modal="true" aria-labelledby="knowledge-upload-title">
        <div className="knowledge-dialog__header">
          <div>
            <h2 id="knowledge-upload-title">{t.knowledge.uploadDialogTitle}</h2>
            <p>{t.knowledge.uploadDialogDescription}</p>
          </div>
          <button type="button" className="knowledge-icon-button" onClick={close} disabled={uploading} aria-label={t.common.close}>
            <X size={18} />
          </button>
        </div>

        {atLimit ? (
          <div className="knowledge-dialog__body">
            <div className="knowledge-inline-message knowledge-inline-message--warning">
              <AlertTriangle size={18} />
              <div>
                <strong>{t.knowledge.limitReachedTitle}</strong>
                <p>{t.knowledge.limitReachedDescription}</p>
              </div>
            </div>
            <div className="knowledge-dialog__footer">
              <button type="button" className="knowledge-button knowledge-button--secondary" onClick={close}>{t.common.cancel}</button>
              <button type="button" className="knowledge-button knowledge-button--primary" onClick={() => openUpgradeModal()}>
                {t.knowledge.limitReachedCta}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="knowledge-dialog__body">
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.txt,.md,.csv"
                hidden
                onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                className={`knowledge-dropzone${dragging ? " knowledge-dropzone--dragging" : ""}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  selectFile(event.dataTransfer.files?.[0] ?? null);
                }}
              >
                <span className="knowledge-icon-box"><UploadCloud size={19} /></span>
                <span>
                  <strong>{file ? file.name : t.knowledge.dropzoneTitle}</strong>
                  <small>{file ? `${Math.max(1, Math.round(file.size / 1024))} KB` : t.knowledge.acceptedFormats}</small>
                </span>
                <span className="knowledge-button knowledge-button--secondary">
                  {file ? t.knowledge.changeFile : t.knowledge.selectFile}
                </span>
              </button>

              <div className="knowledge-form-grid">
                <label>
                  <span>{t.common.titleOptional}</span>
                  <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} />
                </label>
                <label>
                  <span>{t.knowledge.docTypeLabel}</span>
                  <select value={docType} onChange={(event) => setDocType(event.target.value as DocType)}>
                    {DOC_TYPE_VALUES.map((value) => <option key={value} value={value}>{t.knowledge.docType[value]}</option>)}
                  </select>
                </label>
                <label>
                  <span>{t.knowledge.tagsLabel}</span>
                  <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder={t.knowledge.tagsPlaceholder} />
                </label>
                <label>
                  <span>{t.knowledge.languageLabel}</span>
                  <select value={language} onChange={(event) => setLanguage(event.target.value as (typeof LANGUAGE_VALUES)[number])}>
                    {LANGUAGE_VALUES.map((value) => <option key={value} value={value}>{t.knowledge.languageOptions[value]}</option>)}
                  </select>
                </label>
              </div>

              {error ? (
                <div className="knowledge-inline-message knowledge-inline-message--error" aria-live="polite">
                  <AlertTriangle size={17} />
                  <span>{error}</span>
                </div>
              ) : null}
            </div>
            <div className="knowledge-dialog__footer">
              <button type="button" className="knowledge-button knowledge-button--secondary" onClick={close} disabled={uploading}>
                {t.common.cancel}
              </button>
              <button type="submit" className="knowledge-button knowledge-button--primary" disabled={!file || uploading}>
                <UploadCloud size={16} />
                {uploading ? t.common.uploading : t.common.upload}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function DeleteDialog({
  document,
  deleting,
  onCancel,
  onConfirm,
}: {
  document: KnowledgeDoc | null;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!document) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deleting) onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleting, document, onCancel]);

  if (!document) return null;
  return (
    <div className="knowledge-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !deleting && onCancel()}>
      <div className="knowledge-dialog knowledge-dialog--small" role="alertdialog" aria-modal="true" aria-labelledby="knowledge-delete-title">
        <div className="knowledge-dialog__header">
          <div>
            <h2 id="knowledge-delete-title">{t.knowledge.deleteTitle}</h2>
            <p>{t.knowledge.deleteDescription.replace("{title}", document.title)}</p>
          </div>
          <button type="button" className="knowledge-icon-button" onClick={onCancel} disabled={deleting} aria-label={t.common.close}>
            <X size={18} />
          </button>
        </div>
        <div className="knowledge-dialog__footer">
          <button type="button" className="knowledge-button knowledge-button--secondary" onClick={onCancel} disabled={deleting}>
            {t.common.cancel}
          </button>
          <button type="button" className="knowledge-button knowledge-button--danger" onClick={onConfirm} disabled={deleting}>
            <Trash2 size={16} />
            {deleting ? t.common.loading : t.knowledge.deleteConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}

export function KnowledgeClient({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<DocType | "all">("all");
  const [notice, setNotice] = useState<Notice>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeDoc | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reindexingId, setReindexingId] = useState<string | null>(null);

  const loadDocuments = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/knowledge/documents", { cache: "no-store" });
      if (!response.ok) throw new Error(await readApiError(response, t.knowledge.libraryLoadError));
      const data = await response.json() as { documents?: KnowledgeDoc[] };
      setDocuments(data.documents ?? []);
      setLoadError(null);
    } catch (requestError) {
      if (!silent) {
        setLoadError(requestError instanceof Error ? requestError.message : t.knowledge.libraryLoadError);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [t.knowledge.libraryLoadError]);

  useEffect(() => {
    void loadDocuments();
    fetch("/api/billing/usage", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json() as { docsLimit?: number | null };
        setUsage({ docsLimit: data.docsLimit ?? null });
      })
      .catch(() => {});
  }, [loadDocuments]);

  const hasProcessing = documents.some((document) => document.status === "pending" || document.status === "processing");
  useEffect(() => {
    if (!hasProcessing) return;
    const interval = window.setInterval(() => void loadDocuments({ silent: true }), 4000);
    return () => window.clearInterval(interval);
  }, [hasProcessing, loadDocuments]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const summary = useMemo(
    () => summarizeKnowledgeDocuments(documents, usage?.docsLimit ?? null),
    [documents, usage?.docsLimit]
  );
  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return documents.filter((document) => {
      if (filter !== "all" && document.doc_type !== filter) return false;
      if (!query) return true;
      return document.title.toLowerCase().includes(query)
        || document.source.toLowerCase().includes(query)
        || document.tags?.some((tag) => tag.toLowerCase().includes(query));
    });
  }, [documents, filter, search]);

  const closeDelete = useCallback(() => {
    if (!deleting) setDeleteTarget(null);
  }, [deleting]);

  async function handleReindex(document: KnowledgeDoc) {
    setReindexingId(document.id);
    try {
      const response = await fetch("/api/knowledge/reindex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: document.id }),
      });
      if (!response.ok) throw new Error(await readApiError(response, t.knowledge.reindexFailed));
      setNotice({ type: "success", message: t.knowledge.reindexQueued });
      await loadDocuments({ silent: true });
    } catch (requestError) {
      setNotice({
        type: "error",
        message: requestError instanceof Error ? requestError.message : t.knowledge.reindexFailed,
      });
    } finally {
      setReindexingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/knowledge/document/${deleteTarget.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await readApiError(response, t.knowledge.deleteError));
      setDeleteTarget(null);
      setNotice({ type: "success", message: t.knowledge.deleteSuccess });
      await loadDocuments({ silent: true });
    } catch (requestError) {
      setNotice({
        type: "error",
        message: requestError instanceof Error ? requestError.message : t.knowledge.deleteError,
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="knowledge-page">
      <style>{`
        .knowledge-page {
          width: min(1120px, 100%);
          min-height: 100vh;
          margin: 0 auto;
          padding: 36px 28px 56px;
          color: var(--text);
          box-sizing: border-box;
        }
        .knowledge-page *, .knowledge-page *::before, .knowledge-page *::after { box-sizing: border-box; }
        .knowledge-page button, .knowledge-page input, .knowledge-page select { font: inherit; }
        .knowledge-page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 22px;
        }
        .knowledge-page-header h1 { margin: 0; font-size: 28px; line-height: 1.2; font-weight: 780; }
        .knowledge-page-header p { margin: 7px 0 0; max-width: 680px; color: var(--muted); font-size: 14px; line-height: 1.6; }
        .knowledge-button {
          min-height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 14px;
          border: 1px solid transparent;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          transition: background 120ms ease, border-color 120ms ease, opacity 120ms ease;
        }
        .knowledge-button:disabled { cursor: not-allowed; opacity: .5; }
        .knowledge-button--primary { background: #c7f56f; color: #132000; }
        .knowledge-button--primary:not(:disabled):hover { background: #baf050; }
        .knowledge-button--dark { background: #111827; color: #fff; }
        .knowledge-button--secondary { background: var(--surface); border-color: var(--border); color: var(--text); }
        .knowledge-button--secondary:not(:disabled):hover { background: var(--surface-2); }
        .knowledge-button--danger { background: #fff1f2; border-color: #fecdd3; color: #be123c; }
        .knowledge-icon-button {
          width: 38px;
          height: 38px;
          display: inline-grid;
          place-items: center;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
          color: var(--muted);
          cursor: pointer;
          flex: 0 0 auto;
        }
        .knowledge-icon-button:hover { color: var(--text); background: var(--surface-2); }
        .knowledge-icon-button--danger:hover { color: #be123c; border-color: #fecdd3; background: #fff1f2; }
        .knowledge-icon-button:disabled { opacity: .45; cursor: not-allowed; }
        .knowledge-icon-box {
          width: 38px;
          height: 38px;
          display: inline-grid;
          place-items: center;
          border-radius: 8px;
          background: rgba(199, 245, 111, .18);
          color: #56820d;
          flex: 0 0 auto;
        }
        .knowledge-notice {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 48px;
          margin-bottom: 16px;
          padding: 11px 14px;
          border: 1px solid #d9efac;
          border-radius: 8px;
          background: #f7fce9;
          color: #4d7312;
          font-size: 13px;
          font-weight: 650;
        }
        .knowledge-notice--error { border-color: #fecdd3; background: #fff1f2; color: #be123c; }
        .knowledge-health {
          overflow: hidden;
          margin-bottom: 16px;
          border: 1px solid #dbeabf;
          border-radius: 8px;
          background: var(--surface);
        }
        .knowledge-health--attention { border-color: #fecdd3; }
        .knowledge-health--processing { border-color: #fde6af; }
        .knowledge-health__summary {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 16px 18px;
          border-bottom: 1px solid var(--border);
        }
        .knowledge-health--attention .knowledge-icon-box { background: #fff1f2; color: #be123c; }
        .knowledge-health--processing .knowledge-icon-box { background: #fff8e6; color: #b45309; }
        .knowledge-health__summary h2, .knowledge-section__header h2, .knowledge-dialog__header h2 {
          margin: 0;
          font-size: 15px;
          line-height: 1.35;
          font-weight: 750;
        }
        .knowledge-health__summary p, .knowledge-section__header p, .knowledge-dialog__header p {
          margin: 3px 0 0;
          color: var(--muted);
          font-size: 13px;
          line-height: 1.5;
        }
        .knowledge-health__metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .knowledge-health__metrics > div { display: grid; gap: 3px; padding: 13px 18px; border-right: 1px solid var(--border); }
        .knowledge-health__metrics > div:last-child { border-right: 0; }
        .knowledge-health__metrics strong { font-size: 16px; font-weight: 760; }
        .knowledge-health__metrics span { color: var(--muted); font-size: 11px; font-weight: 650; }
        .knowledge-section {
          overflow: hidden;
          margin-bottom: 16px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
        }
        .knowledge-section__header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          border-bottom: 1px solid var(--border);
          background: var(--surface-2);
        }
        .knowledge-test { padding: 16px; }
        .knowledge-test__form { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; }
        .knowledge-test input, .knowledge-toolbar input, .knowledge-form-grid input, .knowledge-form-grid select {
          width: 100%;
          min-height: 42px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
          color: var(--text);
          padding: 9px 12px;
          outline: 0;
        }
        .knowledge-test input:focus, .knowledge-toolbar input:focus, .knowledge-form-grid input:focus, .knowledge-form-grid select:focus {
          border-color: #9bcf3d;
          box-shadow: 0 0 0 3px rgba(199, 245, 111, .22);
        }
        .knowledge-test__results { margin-top: 13px; }
        .knowledge-test__hint { margin: 0; color: var(--muted); font-size: 12px; }
        .knowledge-test__result-title { margin: 0 0 8px; color: var(--muted); font-size: 11px; font-weight: 750; text-transform: uppercase; }
        .knowledge-match-list { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
        .knowledge-match { border-bottom: 1px solid var(--border); }
        .knowledge-match:last-child { border-bottom: 0; }
        .knowledge-match__head { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 13px 14px; list-style: none; cursor: pointer; }
        .knowledge-match__head::-webkit-details-marker { display: none; }
        .knowledge-match__head:hover { background: var(--surface-2); }
        .knowledge-match__head > div:first-child { min-width: 0; display: grid; gap: 3px; }
        .knowledge-match__head strong { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .knowledge-match__head span { color: var(--muted); font-size: 11px; }
        .knowledge-match__chevron { flex: none; color: var(--muted); transition: transform .2s; }
        .knowledge-match[open] .knowledge-match__chevron { transform: rotate(180deg); }
        .knowledge-match__content { padding: 0 14px 14px; }
        .knowledge-match__content p { max-width: 760px; margin: 0; color: var(--muted); font-size: 12px; line-height: 1.6; white-space: pre-wrap; }
        .knowledge-library__head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          padding: 15px 16px;
          border-bottom: 1px solid var(--border);
        }
        .knowledge-library__title { display: flex; align-items: center; gap: 11px; min-width: 0; }
        .knowledge-library__title h2 { margin: 0; font-size: 15px; font-weight: 750; }
        .knowledge-library__title p { margin: 3px 0 0; color: var(--muted); font-size: 12px; }
        .knowledge-library__counts { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
        .knowledge-toolbar {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
        }
        .knowledge-toolbar__search { position: relative; width: min(350px, 100%); }
        .knowledge-toolbar__search svg { position: absolute; top: 50%; left: 12px; transform: translateY(-50%); color: var(--muted); pointer-events: none; }
        .knowledge-toolbar__search input { padding-left: 36px; min-height: 38px; font-size: 13px; }
        .knowledge-filters { display: flex; gap: 5px; flex-wrap: wrap; }
        .knowledge-filter {
          min-height: 34px;
          padding: 0 10px;
          border: 1px solid transparent;
          border-radius: 7px;
          background: transparent;
          color: var(--muted);
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }
        .knowledge-filter--active { border-color: var(--border); background: var(--surface-2); color: var(--text); }
        .knowledge-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 16px;
          align-items: center;
          padding: 14px 16px;
          border-bottom: 1px solid var(--border);
        }
        .knowledge-row:last-child { border-bottom: 0; }
        .knowledge-row__main { display: flex; align-items: flex-start; gap: 12px; min-width: 0; }
        .knowledge-row__content { min-width: 0; display: grid; gap: 6px; }
        .knowledge-row__title-line { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; }
        .knowledge-row__title-line strong { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
        .knowledge-row__badges { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
        .knowledge-row__meta { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; color: var(--muted); font-size: 11px; }
        .knowledge-row__meta span + span::before { content: "·"; margin-right: 7px; }
        .knowledge-row__error { margin: 1px 0 0; color: #be123c; font-size: 11px; line-height: 1.5; }
        .knowledge-row__actions { display: flex; gap: 7px; }
        .knowledge-badge {
          min-height: 23px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 0 7px;
          border-radius: 6px;
          background: var(--surface-2);
          color: var(--muted);
          font-size: 10px;
          font-weight: 750;
          white-space: nowrap;
        }
        .knowledge-badge__dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
        .knowledge-badge--ready { background: #f2fadf; color: #56820d; }
        .knowledge-badge--processing { background: #fff8e6; color: #b45309; }
        .knowledge-badge--pending { background: #f1f5f9; color: #64748b; }
        .knowledge-badge--error { background: #fff1f2; color: #be123c; }
        .knowledge-badge--neutral { background: var(--surface-2); color: var(--muted); }
        .knowledge-inline-message {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          padding: 11px 12px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface-2);
          color: var(--muted);
          font-size: 12px;
          line-height: 1.5;
        }
        .knowledge-inline-message strong { display: block; color: var(--text); margin-bottom: 2px; }
        .knowledge-inline-message p { margin: 0; }
        .knowledge-inline-message--error { border-color: #fecdd3; background: #fff1f2; color: #be123c; }
        .knowledge-inline-message--warning { border-color: #fde6af; background: #fff8e6; color: #92400e; }
        .knowledge-empty { display: grid; justify-items: center; gap: 9px; padding: 34px 18px; text-align: center; }
        .knowledge-empty strong { font-size: 14px; }
        .knowledge-empty p { max-width: 440px; margin: 0; color: var(--muted); font-size: 12px; line-height: 1.6; }
        .knowledge-loading { display: grid; gap: 1px; background: var(--border); }
        .knowledge-loading > div { height: 72px; background: linear-gradient(90deg, var(--surface) 25%, var(--surface-2) 50%, var(--surface) 75%); background-size: 400% 100%; animation: knowledge-shimmer 1.5s infinite; }
        .knowledge-dialog-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(15, 23, 42, .52);
          backdrop-filter: blur(3px);
        }
        .knowledge-dialog {
          width: min(680px, 100%);
          max-height: calc(100vh - 40px);
          overflow: auto;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
          box-shadow: 0 24px 70px rgba(15, 23, 42, .22);
        }
        .knowledge-dialog--small { width: min(480px, 100%); }
        .knowledge-dialog__header {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          padding: 17px 18px;
          border-bottom: 1px solid var(--border);
        }
        .knowledge-dialog__body { display: grid; gap: 15px; padding: 18px; }
        .knowledge-dialog__footer { display: flex; justify-content: flex-end; gap: 9px; padding: 14px 18px; border-top: 1px solid var(--border); }
        .knowledge-dropzone {
          width: 100%;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 12px;
          min-height: 94px;
          padding: 14px;
          border: 1px dashed #b8c3d1;
          border-radius: 8px;
          background: var(--surface-2);
          color: var(--text);
          text-align: left;
          cursor: pointer;
        }
        .knowledge-dropzone--dragging { border-color: #8fbd37; background: #f7fce9; }
        .knowledge-dropzone > span:nth-child(2) { min-width: 0; display: grid; gap: 4px; }
        .knowledge-dropzone strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
        .knowledge-dropzone small { color: var(--muted); font-size: 11px; }
        .knowledge-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 13px; }
        .knowledge-form-grid label { display: grid; gap: 6px; color: var(--muted); font-size: 11px; font-weight: 700; }
        .knowledge-form-grid input, .knowledge-form-grid select { font-size: 13px; }
        .knowledge-spin { animation: knowledge-spin .85s linear infinite; }
        .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
        @keyframes knowledge-spin { to { transform: rotate(360deg); } }
        @keyframes knowledge-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @media (max-width: 800px) {
          .knowledge-page { padding: 26px 18px 44px; }
          .knowledge-page-header { align-items: stretch; }
          .knowledge-health__metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .knowledge-health__metrics > div:nth-child(2) { border-right: 0; }
          .knowledge-health__metrics > div:nth-child(-n+2) { border-bottom: 1px solid var(--border); }
          .knowledge-toolbar { align-items: stretch; flex-direction: column; }
          .knowledge-toolbar__search { width: 100%; }
        }
        @media (max-width: 600px) {
          .knowledge-page-header { flex-direction: column; }
          .knowledge-page-header .knowledge-button { width: 100%; }
          .knowledge-test__form { grid-template-columns: 1fr; }
          .knowledge-test__form .knowledge-button { width: 100%; }
          .knowledge-library__head { align-items: flex-start; flex-direction: column; }
          .knowledge-library__counts { justify-content: flex-start; }
          .knowledge-row { grid-template-columns: 1fr; }
          .knowledge-row__actions { padding-left: 50px; }
          .knowledge-form-grid { grid-template-columns: 1fr; }
          .knowledge-dropzone { grid-template-columns: auto minmax(0, 1fr); }
          .knowledge-dropzone > .knowledge-button { grid-column: 1 / -1; width: 100%; }
          .knowledge-match__head { flex-direction: column; }
        }
      `}</style>

      <header className="knowledge-page-header">
        <div>
          <h1>{t.knowledge.title}</h1>
          <p>{isAdmin ? t.knowledge.subtitle : t.knowledge.subtitleClient}</p>
        </div>
        {isAdmin ? (
          <button type="button" className="knowledge-button knowledge-button--primary" onClick={() => setUploadOpen(true)}>
            <Plus size={17} />
            {t.knowledge.addDocument}
          </button>
        ) : (
          <span className="knowledge-badge knowledge-badge--neutral"><LockKeyhole size={11} />{t.knowledge.readOnly}</span>
        )}
      </header>

      {notice ? (
        <div className={`knowledge-notice${notice.type === "error" ? " knowledge-notice--error" : ""}`} role="status" aria-live="polite">
          {notice.type === "success" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{notice.message}</span>
        </div>
      ) : null}

      <HealthPanel
        health={summary.health}
        ready={summary.ready}
        processing={summary.processing}
        attention={summary.attention}
        ownUsed={summary.ownUsed}
        limit={summary.limit}
        limitKnown={usage !== null}
      />

      <KnowledgeTestPanel />

      <section className="knowledge-section">
        <div className="knowledge-library__head">
          <div className="knowledge-library__title">
            <span className="knowledge-icon-box" aria-hidden="true"><Library size={18} /></span>
            <div>
              <h2>{t.knowledge.libraryTitle}</h2>
              <p>{t.knowledge.libraryDescription}</p>
            </div>
          </div>
          <div className="knowledge-library__counts">
            <span className="knowledge-badge knowledge-badge--neutral">{summary.total - summary.shared} {t.knowledge.ownLabel}</span>
            {summary.shared > 0 ? <span className="knowledge-badge knowledge-badge--neutral"><LockKeyhole size={11} />{summary.shared} {t.knowledge.sharedLabel}</span> : null}
          </div>
        </div>

        <div className="knowledge-toolbar">
          <label className="knowledge-toolbar__search">
            <span className="sr-only">{t.knowledge.searchLabel}</span>
            <Search size={15} />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.knowledge.searchPlaceholder} />
          </label>
          <div className="knowledge-filters" aria-label={t.knowledge.docTypeLabel}>
            {(["all", ...DOC_TYPE_VALUES] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={`knowledge-filter${filter === value ? " knowledge-filter--active" : ""}`}
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
              >
                {value === "all" ? t.knowledge.filterAll : t.knowledge.docType[value]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="knowledge-loading" aria-label={t.common.loading}>
            <div /><div /><div />
          </div>
        ) : loadError ? (
          <div className="knowledge-empty">
            <span className="knowledge-icon-box"><AlertTriangle size={19} /></span>
            <strong>{t.knowledge.libraryLoadError}</strong>
            <p>{loadError}</p>
            <button type="button" className="knowledge-button knowledge-button--secondary" onClick={() => void loadDocuments()}>
              <RefreshCw size={15} />
              {t.knowledge.retry}
            </button>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="knowledge-empty">
            <span className="knowledge-icon-box"><FileText size={19} /></span>
            <strong>{search || filter !== "all" ? t.knowledge.emptyFilteredTitle : t.knowledge.emptyTitle}</strong>
            <p>{search || filter !== "all" ? t.knowledge.emptyFilteredDescription : t.knowledge.emptyDescription}</p>
            {search || filter !== "all" ? (
              <button type="button" className="knowledge-button knowledge-button--secondary" onClick={() => { setSearch(""); setFilter("all"); }}>
                {t.knowledge.clearFilters}
              </button>
            ) : isAdmin ? (
              <button type="button" className="knowledge-button knowledge-button--primary" onClick={() => setUploadOpen(true)}>
                <Plus size={16} />
                {t.knowledge.addDocument}
              </button>
            ) : null}
          </div>
        ) : (
          <div>
            {filteredDocuments.map((document) => {
              const shared = document.client_id === null;
              const canManage = isAdmin && !shared;
              return (
                <article className="knowledge-row" key={document.id}>
                  <div className="knowledge-row__main">
                    <span className="knowledge-icon-box" aria-hidden="true">{shared ? <ShieldCheck size={18} /> : <FileText size={18} />}</span>
                    <div className="knowledge-row__content">
                      <div className="knowledge-row__title-line">
                        <strong title={document.title}>{document.title}</strong>
                        <div className="knowledge-row__badges">
                          <StatusBadge status={document.status} />
                          <span className="knowledge-badge knowledge-badge--neutral">{t.knowledge.docType[document.doc_type ?? "general"]}</span>
                          {shared ? <span className="knowledge-badge knowledge-badge--neutral"><LockKeyhole size={11} />{t.knowledge.sharedLabel}</span> : null}
                        </div>
                      </div>
                      <div className="knowledge-row__meta">
                        <span>{document.source}</span>
                        <span>{document.language.toUpperCase()}</span>
                        <span>{document.chunk_count} {t.knowledge.chunksLabel}</span>
                        <span>{t.knowledge.lastUpdatedLabel} {new Date(document.updated_at).toLocaleDateString()}</span>
                      </div>
                      {document.error ? <p className="knowledge-row__error">{document.error}</p> : null}
                    </div>
                  </div>
                  {canManage ? (
                    <div className="knowledge-row__actions">
                      <button
                        type="button"
                        className="knowledge-icon-button"
                        onClick={() => void handleReindex(document)}
                        disabled={reindexingId === document.id}
                        aria-label={t.common.reindex}
                        title={t.common.reindex}
                      >
                        <RefreshCw size={16} className={reindexingId === document.id ? "knowledge-spin" : undefined} />
                      </button>
                      <button
                        type="button"
                        className="knowledge-icon-button knowledge-icon-button--danger"
                        onClick={() => setDeleteTarget(document)}
                        aria-label={t.common.delete}
                        title={t.common.delete}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <UploadDialog
        open={uploadOpen}
        atLimit={summary.atLimit}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => void loadDocuments({ silent: true })}
        onNotice={setNotice}
      />
      <DeleteDialog
        document={deleteTarget}
        deleting={deleting}
        onCancel={closeDelete}
        onConfirm={() => void handleDelete()}
      />
    </main>
  );
}
