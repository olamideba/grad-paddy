"use client";

import { useState, useEffect, useRef } from "react";
import { Icon } from "@iconify/react";
import clsx from "clsx";
import type { Draft as ApiDraft, DraftStats } from "../../lib/api";
import ConfirmModal from "@/components/ConfirmModal";

type DraftType = "sop" | "outreach-prep" | "research-narrative";
type DraftStatus = "draft" | "in-review" | "approved" | "archived";

type Draft = {
  id: string;
  type: DraftType;
  title: string;
  status: DraftStatus;
  wordCount: number;
  content: string;
  excerpt: string;
  lastEdited: Date;
  sourceTags: string[];
  isAiDraft: boolean;
};

function normalizeDraftType(s: string): DraftType {
  if (s === "sop") return "sop";
  if (s === "outreach-prep" || s === "outreach_prep" || s === "outreach") return "outreach-prep";
  if (s === "research-narrative" || s === "research_narrative" || s === "narrative")
    return "research-narrative";
  return "sop";
}

function normalizeDraftStatus(s: string): DraftStatus {
  if (s === "approved") return "approved";
  if (s === "in-review" || s === "in_review") return "in-review";
  if (s === "archived") return "archived";
  return "draft";
}

function mapDraft(a: ApiDraft): Draft {
  const excerpt = a.content.slice(0, 320) + (a.content.length > 320 ? "…" : "");
  return {
    id: a.id,
    type: normalizeDraftType(a.type),
    title: a.title,
    status: normalizeDraftStatus(a.status),
    wordCount: a.word_count,
    content: a.content,
    excerpt: excerpt || a.title,
    lastEdited: new Date(a.updated_at),
    sourceTags: a.source_tags,
    isAiDraft: a.ai_generated,
  };
}

const TYPE_META: Record<
  DraftType,
  { label: string; icon: string; accent: string; iconColor: string }
> = {
  sop: {
    label: "Statement of Purpose",
    icon: "solar:document-text-bold",
    accent: "#E8472A",
    iconColor: "#FFFFFF",
  },
  "outreach-prep": {
    label: "Outreach Prep Card",
    icon: "solar:letter-bold",
    accent: "#4ECDC4",
    iconColor: "#0D0D0D",
  },
  "research-narrative": {
    label: "Research Narrative",
    icon: "solar:book-bold",
    accent: "#0D0D0D",
    iconColor: "#FFFFFF",
  },
};

const STATUS_META: Record<
  DraftStatus,
  { label: string; bg: string; color: string; border: string }
> = {
  draft: { label: "Draft", bg: "#EDE6D3", color: "#5A5A5A", border: "#0D0D0D" },
  "in-review": { label: "In Review", bg: "#E8472A", color: "#FFFFFF", border: "#0D0D0D" },
  approved: { label: "Approved", bg: "#4ECDC4", color: "#0D0D0D", border: "#0D0D0D" },
  archived: { label: "Archived", bg: "#F7F0E3", color: "#9CA3AF", border: "#C8C0AF" },
};

function timeAgo(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

function EditDraftModal({
  draft,
  onClose,
  onSaved,
}: {
  draft: Draft;
  onClose: () => void;
  onSaved: (updated: Draft) => void;
}) {
  const [content, setContent] = useState(draft.content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textRef.current?.focus();
  }, []);

  // Fetch the full draft so the editor always shows the latest stored content
  // (the list payload can be stale or trimmed).
  useEffect(() => {
    import("../../lib/api")
      .then(({ draftsApi }) => draftsApi.get(draft.id))
      .then((res) => {
        if (typeof res.data.content === "string") setContent(res.data.content);
      })
      .catch(() => {});
  }, [draft.id]);

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const { draftsApi } = await import("../../lib/api");
      const res = await draftsApi.updateContent(draft.id, content);
      onSaved(mapDraft(res.data));
      onClose();
    } catch {
      setError("Failed to save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(13,13,13,0.6)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl flex flex-col max-h-[90vh]"
        style={{
          background: "#F7F0E3",
          border: "2px solid #0D0D0D",
          boxShadow: "6px 6px 0 #0D0D0D",
          borderRadius: "4px",
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center justify-between shrink-0"
          style={{ background: "#0D0D0D", borderRadius: "2px 2px 0 0" }}
        >
          <div>
            <span className="font-bold font-space text-sm" style={{ color: "#FFFFFF" }}>
              {draft.title}
            </span>
            <span
              className="ml-2 text-[10px] font-space uppercase tracking-wider"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              {TYPE_META[draft.type].label}
            </span>
          </div>
          <button onClick={onClose} className="bouncy" style={{ color: "rgba(255,255,255,0.5)" }}>
            <Icon icon="solar:close-circle-bold" width={18} />
          </button>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-hidden flex flex-col p-5 gap-3">
          <textarea
            ref={textRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 input-brutal w-full text-sm font-dm resize-none"
            style={{ minHeight: "320px" }}
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono" style={{ color: "#9CA3AF" }}>
              {wordCount} words
            </span>
            {error && (
              <span className="text-xs font-dm font-semibold" style={{ color: "#E8472A" }}>
                {error}
              </span>
            )}
            <div className="flex gap-2">
              <button onClick={onClose} className="btn-white btn-sm">
                <span className="text-sm">Cancel</span>
              </button>
              <button onClick={handleSave} disabled={saving} className="btn-coral btn-sm">
                {saving ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                ) : (
                  <Icon icon="solar:check-circle-bold" width={14} />
                )}
                <span className="text-sm">{saving ? "Saving…" : "Save"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmApproveModal({
  draft,
  onClose,
  onConfirmed,
}: {
  draft: Draft;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setSaving(true);
    setError(null);
    try {
      const { draftsApi } = await import("../../lib/api");
      await draftsApi.updateStatus(draft.id, "approved");
      onConfirmed();
      onClose();
    } catch {
      setError("Failed to approve. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(13,13,13,0.6)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-sm flex flex-col"
        style={{
          background: "#F7F0E3",
          border: "2px solid #0D0D0D",
          boxShadow: "6px 6px 0 #0D0D0D",
          borderRadius: "4px",
        }}
      >
        <div className="px-5 py-4" style={{ background: "#0D0D0D", borderRadius: "2px 2px 0 0" }}>
          <span className="font-bold font-space text-sm" style={{ color: "#FFFFFF" }}>
            Approve Draft
          </span>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm font-dm" style={{ color: "#0D0D0D" }}>
            Mark <span className="font-bold">{draft.title}</span> as approved? This signals the
            draft is ready for submission.
          </p>
          {error && (
            <p className="text-xs font-dm font-semibold" style={{ color: "#E8472A" }}>
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={handleApprove} disabled={saving} className="btn-teal btn-sm flex-1">
              {saving ? (
                <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
              ) : (
                <Icon icon="solar:check-circle-bold" width={14} />
              )}
              <span className="text-sm">{saving ? "Approving…" : "Approve"}</span>
            </button>
            <button onClick={onClose} className="btn-white btn-sm">
              <span className="text-sm">Cancel</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DraftCard({
  draft,
  onEdit,
  onApprove,
  onDelete,
}: {
  draft: Draft;
  onEdit: () => void;
  onApprove: () => void;
  onDelete: () => void;
}) {
  const type = TYPE_META[draft.type];
  const status = STATUS_META[draft.status];

  return (
    <div className="card-brutal flex flex-col overflow-hidden p-0">
      {/* Header */}
      <div className="p-4 flex items-start gap-3" style={{ borderBottom: "2px solid #0D0D0D" }}>
        <div
          className="w-10 h-10 flex items-center justify-center flex-shrink-0"
          style={{ background: type.accent, border: "2px solid #0D0D0D", borderRadius: "4px" }}
        >
          <Icon icon={type.icon} width={16} style={{ color: type.iconColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span
              className="text-[10px] font-bold uppercase tracking-wider font-space"
              style={{ color: "#9CA3AF" }}
            >
              {type.label}
            </span>
            <span
              className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold font-space flex-shrink-0"
              style={{
                background: status.bg,
                color: status.color,
                border: `1.5px solid ${status.border}`,
                borderRadius: "4px",
              }}
            >
              {status.label}
            </span>
          </div>
          <p
            className="text-sm font-bold font-space leading-tight mt-0.5"
            style={{ color: "#0D0D0D" }}
          >
            {draft.title}
          </p>
        </div>
      </div>

      {/* Excerpt */}
      <div className="px-4 py-3 flex-1" style={{ borderBottom: "1.5px solid #EDE6D3" }}>
        <p className="text-xs font-dm leading-relaxed line-clamp-4" style={{ color: "#5A5A5A" }}>
          {draft.excerpt}
        </p>
      </div>

      {/* Sources + AI warning */}
      {(draft.sourceTags.length > 0 || (draft.isAiDraft && draft.status === "draft")) && (
        <div
          className="px-4 py-3 flex flex-col gap-2"
          style={{ borderBottom: "2px solid #0D0D0D", background: "#FAFAF8" }}
        >
          {draft.isAiDraft && draft.status === "draft" && (
            <div className="flex items-center gap-1.5">
              <Icon
                icon="solar:danger-triangle-bold"
                width={11}
                style={{ color: "#D97706" }}
                className="shrink-0"
              />
              <p className="text-[11px] font-dm" style={{ color: "#5A5A5A" }}>
                <span className="font-semibold" style={{ color: "#0D0D0D" }}>
                  AI draft
                </span>{" "}
                — personalise before use
              </p>
            </div>
          )}
          {draft.sourceTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {draft.sourceTags.map((source) => (
                <span
                  key={source}
                  className="text-[10px] font-mono px-2 py-0.5"
                  style={{
                    background: "#EDE6D3",
                    border: "1.5px solid #C8C0AF",
                    color: "#5A5A5A",
                    borderRadius: "4px",
                  }}
                >
                  {source}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-[10px] font-dm" style={{ color: "#B0A898" }}>
          <Icon icon="solar:clock-circle-bold" width={10} />
          <span>{timeAgo(draft.lastEdited)}</span>
          {draft.wordCount > 0 && (
            <>
              <span>·</span>
              <span>{draft.wordCount}w</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={onEdit} className="btn-black btn-sm gap-1 text-xs">
            <Icon icon="solar:pen-bold" width={10} />
            Edit
          </button>
          {draft.status === "draft" && (
            <button onClick={onApprove} className="btn-teal btn-sm gap-1 text-xs">
              <Icon icon="solar:check-circle-bold" width={10} />
              Approve
            </button>
          )}
          <button
            onClick={onDelete}
            title="Delete draft"
            className="btn-white btn-sm gap-1 text-xs"
            style={{ color: "#E8472A", borderColor: "#E8472A" }}
          >
            <Icon icon="solar:trash-bin-trash-bold" width={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

function AddDraftModal({ onClose, onAdd }: { onClose: () => void; onAdd: (d: Draft) => void }) {
  const [type, setType] = useState<DraftType>("sop");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  function addTag() {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { draftsApi } = await import("../../lib/api");
      const res = await draftsApi.create({
        type,
        title: title.trim(),
        ...(content.trim() && { content: content.trim() }),
        ai_generated: false,
        ...(tags.length > 0 && { source_tags: tags }),
      });
      onAdd(mapDraft(res.data));
      onClose();
    } catch {
      setError("Failed to create draft. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(13,13,13,0.6)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg flex flex-col max-h-[90vh] overflow-y-auto"
        style={{
          background: "#F7F0E3",
          border: "2px solid #0D0D0D",
          boxShadow: "6px 6px 0 #0D0D0D",
          borderRadius: "4px",
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center justify-between shrink-0"
          style={{ background: "#0D0D0D", borderRadius: "2px 2px 0 0" }}
        >
          <span className="font-bold font-space text-sm" style={{ color: "#FFFFFF" }}>
            New Draft
          </span>
          <button onClick={onClose} className="bouncy" style={{ color: "rgba(255,255,255,0.5)" }}>
            <Icon icon="solar:close-circle-bold" width={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3">
          {/* Type */}
          <div>
            <label
              className="block text-[11px] font-bold font-space uppercase tracking-wider mb-1"
              style={{ color: "#5A5A5A" }}
            >
              Type
            </label>
            <div
              className="flex overflow-hidden"
              style={{ border: "2px solid #0D0D0D", borderRadius: "4px" }}
            >
              {(Object.keys(TYPE_META) as DraftType[]).map((t, i) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={clsx(
                    "flex-1 py-2 text-[11px] font-bold font-space bouncy",
                    i > 0 && "border-l-2"
                  )}
                  style={{
                    background: type === t ? "#E8472A" : "#FFFFFF",
                    color: type === t ? "#FFFFFF" : "#5A5A5A",
                    borderColor: "#0D0D0D",
                  }}
                >
                  {t === "sop" ? "SOP" : t === "outreach-prep" ? "Outreach" : "Narrative"}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label
              className="block text-[11px] font-bold font-space uppercase tracking-wider mb-1"
              style={{ color: "#5A5A5A" }}
            >
              Title <span style={{ color: "#E8472A" }}>*</span>
            </label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-brutal w-full text-sm"
              placeholder={
                type === "sop"
                  ? "MIT PhD SOP – v1"
                  : type === "outreach-prep"
                    ? "Prof. Smith Outreach"
                    : "Research Background"
              }
            />
          </div>

          {/* Content */}
          <div>
            <label
              className="block text-[11px] font-bold font-space uppercase tracking-wider mb-1"
              style={{ color: "#5A5A5A" }}
            >
              Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="input-brutal w-full text-sm resize-none font-dm"
              rows={8}
              placeholder="Write your draft here…"
            />
            {content.length > 0 && (
              <p className="text-[10px] font-mono mt-1" style={{ color: "#9CA3AF" }}>
                {content.trim().split(/\s+/).filter(Boolean).length} words
              </p>
            )}
          </div>

          {/* Source tags */}
          <div>
            <label
              className="block text-[11px] font-bold font-space uppercase tracking-wider mb-1"
              style={{ color: "#5A5A5A" }}
            >
              Source Tags
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                className="input-brutal flex-1 text-sm"
                placeholder="e.g. mit-cs-2025 (Enter to add)"
              />
              <button type="button" onClick={addTag} className="btn-white btn-sm shrink-0">
                <Icon icon="solar:add-circle-bold" width={13} />
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono"
                    style={{
                      background: "#EDE6D3",
                      border: "1.5px solid #C8C0AF",
                      borderRadius: "4px",
                    }}
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => setTags((t) => t.filter((x) => x !== tag))}
                      style={{ color: "#9CA3AF" }}
                    >
                      <Icon icon="solar:close-circle-bold" width={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs font-dm font-semibold" style={{ color: "#E8472A" }}>
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="btn-coral btn-sm flex-1">
              {saving ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
              ) : (
                <Icon icon="solar:add-circle-bold" width={14} />
              )}
              <span className="text-sm">{saving ? "Saving…" : "Create Draft"}</span>
            </button>
            <button type="button" onClick={onClose} className="btn-white btn-sm">
              <span className="text-sm">Cancel</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [stats, setStats] = useState<DraftStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<DraftType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<DraftStatus | "all">("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDraft, setEditingDraft] = useState<Draft | null>(null);
  const [approvingDraft, setApprovingDraft] = useState<Draft | null>(null);
  const [confirmDeleteDraft, setConfirmDeleteDraft] = useState<Draft | null>(null);

  function updateDraft(updated: Draft) {
    setDrafts((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  }
  function approveDraft(id: string) {
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: "approved" as DraftStatus } : d))
    );
  }
  async function deleteDraft(draft: Draft) {
    setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
    try {
      const { draftsApi } = await import("../../lib/api");
      await draftsApi.delete(draft.id);
    } catch {
      // best-effort; list already updated optimistically
    }
  }

  useEffect(() => {
    import("../../lib/api").then(({ draftsApi }) =>
      Promise.all([draftsApi.list(), draftsApi.stats()])
        .then(([listRes, statsRes]) => {
          setDrafts(listRes.data.map(mapDraft));
          setStats(statsRes.data);
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    );
  }, []);

  const filtered = drafts.filter((d) => {
    const matchType = typeFilter === "all" || d.type === typeFilter;
    const matchStatus = statusFilter === "all" || d.status === statusFilter;
    return matchType && matchStatus;
  });

  const aiDraftCount = drafts.filter((d) => d.isAiDraft && d.status === "draft").length;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#F7F0E3" }}>
      {/* Header — black */}
      <div
        className="px-4 sm:px-6 py-4 shrink-0"
        style={{ background: "#0D0D0D", borderBottom: "2px solid #E8472A" }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1
              className="text-sm font-bold font-space flex items-center gap-2"
              style={{ color: "#FFFFFF" }}
            >
              <Icon icon="solar:document-text-bold" width={15} style={{ color: "#E8472A" }} />
              Drafts
            </h1>
            <p
              className="text-xs font-dm mt-0.5 truncate"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              {loading
                ? "Loading…"
                : stats
                  ? `${stats.total - stats.approved} drafts · ${stats.approved} approved${stats.need_review > 0 ? ` · ${stats.need_review} need review` : ""}`
                  : `${drafts.length} drafts`}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button className="btn-white btn-sm" onClick={() => setShowAddModal(true)}>
              <Icon icon="solar:pen-bold" width={14} />
              <span className="text-sm hidden sm:inline">New Draft</span>
            </button>
            <a href="/chat" className="btn-coral btn-sm">
              <Icon icon="solar:add-circle-bold" width={14} />
              <span className="text-sm hidden sm:inline">Generate Draft</span>
            </a>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div
        className="px-4 sm:px-6 py-3 shrink-0 flex items-center gap-3 flex-wrap"
        style={{ background: "#FFFFFF", borderBottom: "2px solid #0D0D0D" }}
      >
        <div
          className="flex overflow-hidden"
          style={{ border: "2px solid #0D0D0D", borderRadius: "4px" }}
        >
          {(["all", "sop", "outreach-prep", "research-narrative"] as const).map((t, i) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={clsx(
                "px-3 py-2 text-xs font-semibold font-space bouncy",
                i > 0 && "border-l-2"
              )}
              style={{
                background: typeFilter === t ? "#E8472A" : "#FFFFFF",
                color: typeFilter === t ? "#FFFFFF" : "#5A5A5A",
                borderColor: "#0D0D0D",
              }}
            >
              {t === "all"
                ? "All"
                : t === "sop"
                  ? "SOP"
                  : t === "outreach-prep"
                    ? "Outreach"
                    : "Narrative"}
            </button>
          ))}
        </div>
        <div
          className="flex overflow-hidden"
          style={{ border: "2px solid #0D0D0D", borderRadius: "4px" }}
        >
          {(["all", "draft", "in-review", "approved"] as const).map((s, i) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={clsx(
                "px-3 py-2 text-xs font-semibold font-space bouncy",
                i > 0 && "border-l-2"
              )}
              style={{
                background: statusFilter === s ? "#E8472A" : "#FFFFFF",
                color: statusFilter === s ? "#FFFFFF" : "#5A5A5A",
                borderColor: "#0D0D0D",
              }}
            >
              {s === "all"
                ? "All"
                : s === "in-review"
                  ? "In Review"
                  : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {!loading && aiDraftCount > 0 && (
          <div
            className="mb-5 p-4 flex items-center gap-3"
            style={{
              background: "#FFFFFF",
              border: "2px solid #0D0D0D",
              boxShadow: "3px 3px 0 #0D0D0D",
              borderRadius: "4px",
            }}
          >
            <div
              className="w-8 h-8 flex items-center justify-center flex-shrink-0"
              style={{
                background: "rgba(217,119,6,0.12)",
                border: "1.5px solid #D97706",
                borderRadius: "4px",
              }}
            >
              <Icon icon="solar:danger-triangle-bold" width={14} style={{ color: "#D97706" }} />
            </div>
            <div>
              <p className="text-sm font-bold font-space" style={{ color: "#0D0D0D" }}>
                AI drafts require personalisation
              </p>
              <p className="text-xs font-dm mt-0.5" style={{ color: "#5A5A5A" }}>
                Generated from indexed content — <strong>review and personalise</strong> before
                submission.
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div
              className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"
              style={{ color: "#E8472A" }}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Icon
              icon="solar:document-text-bold"
              width={32}
              style={{ color: "#B0A898" }}
              className="mb-3"
            />
            <p className="font-semibold font-space" style={{ color: "#5A5A5A" }}>
              No drafts yet
            </p>
            <p className="text-xs font-dm mt-1 mb-4" style={{ color: "#9CA3AF" }}>
              Generate your first SOP in Agent Chat
            </p>
            <a href="/chat" className="btn-coral btn-sm">
              <Icon icon="solar:alt-arrow-right-bold" width={13} />
              <span className="text-sm">Go to Chat</span>
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((draft) => (
              <DraftCard
                key={draft.id}
                draft={draft}
                onEdit={() => setEditingDraft(draft)}
                onApprove={() => setApprovingDraft(draft)}
                onDelete={() => setConfirmDeleteDraft(draft)}
              />
            ))}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddDraftModal
          onClose={() => setShowAddModal(false)}
          onAdd={(d) => setDrafts((prev) => [d, ...prev])}
        />
      )}
      {editingDraft && (
        <EditDraftModal
          draft={editingDraft}
          onClose={() => setEditingDraft(null)}
          onSaved={(updated) => {
            updateDraft(updated);
            setEditingDraft(null);
          }}
        />
      )}
      {approvingDraft && (
        <ConfirmApproveModal
          draft={approvingDraft}
          onClose={() => setApprovingDraft(null)}
          onConfirmed={() => {
            approveDraft(approvingDraft.id);
            setApprovingDraft(null);
          }}
        />
      )}
      {confirmDeleteDraft && (
        <ConfirmModal
          title="Delete draft"
          message={`Delete “${confirmDeleteDraft.title}”? This cannot be undone.`}
          onClose={() => setConfirmDeleteDraft(null)}
          onConfirm={() => {
            deleteDraft(confirmDeleteDraft);
            setConfirmDeleteDraft(null);
          }}
        />
      )}
    </div>
  );
}
