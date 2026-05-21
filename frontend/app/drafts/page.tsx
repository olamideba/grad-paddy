"use client";

import { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import clsx from "clsx";
import type { Draft as ApiDraft, DraftStats } from "../../lib/api";

type DraftType   = "sop" | "outreach-prep" | "research-narrative";
type DraftStatus = "draft" | "in-review" | "approved" | "archived";

type Draft = {
  id: string;
  type: DraftType;
  title: string;
  status: DraftStatus;
  wordCount: number;
  excerpt: string;
  lastEdited: Date;
  sourceTags: string[];
  isAiDraft: boolean;
};

function normalizeDraftType(s: string): DraftType {
  if (s === "sop") return "sop";
  if (s === "outreach-prep" || s === "outreach_prep" || s === "outreach") return "outreach-prep";
  if (s === "research-narrative" || s === "research_narrative" || s === "narrative") return "research-narrative";
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
    excerpt: excerpt || a.title,
    lastEdited: new Date(a.updated_at),
    sourceTags: a.source_tags,
    isAiDraft: a.ai_generated,
  };
}

const TYPE_META: Record<DraftType, { label: string; icon: string; accent: string; iconColor: string }> = {
  sop:                  { label: "Statement of Purpose", icon: "solar:document-text-bold", accent: "#E8472A", iconColor: "#FFFFFF" },
  "outreach-prep":      { label: "Outreach Prep Card",   icon: "solar:letter-bold",        accent: "#4ECDC4", iconColor: "#0D0D0D" },
  "research-narrative": { label: "Research Narrative",   icon: "solar:book-bold",          accent: "#0D0D0D", iconColor: "#FFFFFF" },
};

const STATUS_META: Record<DraftStatus, { label: string; bg: string; color: string; border: string }> = {
  draft:       { label: "Draft",     bg: "#EDE6D3", color: "#5A5A5A",  border: "#0D0D0D" },
  "in-review": { label: "In Review", bg: "#E8472A", color: "#FFFFFF",  border: "#0D0D0D" },
  approved:    { label: "Approved",  bg: "#4ECDC4", color: "#0D0D0D",  border: "#0D0D0D" },
  archived:    { label: "Archived",  bg: "#F7F0E3", color: "#9CA3AF",  border: "#C8C0AF" },
};

function timeAgo(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 60)   return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

function DraftCard({ draft }: { draft: Draft }) {
  const type   = TYPE_META[draft.type];
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
            <span className="text-[10px] font-bold uppercase tracking-wider font-space" style={{ color: "#9CA3AF" }}>
              {type.label}
            </span>
            <span
              className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold font-space flex-shrink-0"
              style={{ background: status.bg, color: status.color, border: `1.5px solid ${status.border}`, borderRadius: "4px" }}
            >
              {status.label}
            </span>
          </div>
          <p className="text-sm font-bold font-space leading-tight mt-0.5" style={{ color: "#0D0D0D" }}>
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
        <div className="px-4 py-3 flex flex-col gap-2" style={{ borderBottom: "2px solid #0D0D0D", background: "#FAFAF8" }}>
          {draft.isAiDraft && draft.status === "draft" && (
            <div className="flex items-center gap-1.5">
              <Icon icon="solar:danger-triangle-bold" width={11} style={{ color: "#D97706" }} className="shrink-0" />
              <p className="text-[11px] font-dm" style={{ color: "#5A5A5A" }}>
                <span className="font-semibold" style={{ color: "#0D0D0D" }}>AI draft</span> — personalise before use
              </p>
            </div>
          )}
          {draft.sourceTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {draft.sourceTags.map(source => (
                <span
                  key={source}
                  className="text-[10px] font-mono px-2 py-0.5"
                  style={{ background: "#EDE6D3", border: "1.5px solid #C8C0AF", color: "#5A5A5A", borderRadius: "4px" }}
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
          {draft.wordCount > 0 && <><span>·</span><span>{draft.wordCount}w</span></>}
        </div>
        <div className="flex items-center gap-1.5">
          {draft.status !== "approved" && (
            <button className="btn-black btn-sm gap-1 text-xs">
              <Icon icon="solar:pen-bold" width={10} />Edit
            </button>
          )}
          {draft.status === "draft" && (
            <button className="btn-teal btn-sm gap-1 text-xs">
              <Icon icon="solar:check-circle-bold" width={10} />Approve
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DraftsPage() {
  const [drafts, setDrafts]   = useState<Draft[]>([]);
  const [stats, setStats]     = useState<DraftStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter,   setTypeFilter]   = useState<DraftType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<DraftStatus | "all">("all");

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

  const filtered = drafts.filter(d => {
    const matchType   = typeFilter === "all"   || d.type === typeFilter;
    const matchStatus = statusFilter === "all" || d.status === statusFilter;
    return matchType && matchStatus;
  });

  const aiDraftCount = drafts.filter(d => d.isAiDraft && d.status === "draft").length;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#F7F0E3" }}>
      {/* Header — black */}
      <div className="px-6 py-4 shrink-0" style={{ background: "#0D0D0D", borderBottom: "2px solid #E8472A" }}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-sm font-bold font-space flex items-center gap-2" style={{ color: "#FFFFFF" }}>
              <Icon icon="solar:document-text-bold" width={15} style={{ color: "#E8472A" }} />
              Drafts
            </h1>
            <p className="text-xs font-dm mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
              {loading ? "Loading…" : stats
                ? `${stats.total - stats.approved} drafts · ${stats.approved} approved${stats.need_review > 0 ? ` · ${stats.need_review} need review` : ""}`
                : `${drafts.length} drafts`}
            </p>
          </div>
          <a href="/chat" className="btn-coral btn-sm">
            <Icon icon="solar:add-circle-bold" width={14} />
            <span className="text-sm">Generate Draft</span>
          </a>
        </div>
      </div>

      {/* Filter bar */}
      <div className="px-6 py-3 shrink-0 flex items-center gap-3 flex-wrap" style={{ background: "#FFFFFF", borderBottom: "2px solid #0D0D0D" }}>
        <div className="flex overflow-hidden" style={{ border: "2px solid #0D0D0D", borderRadius: "4px" }}>
          {(["all", "sop", "outreach-prep", "research-narrative"] as const).map((t, i) => (
            <button key={t} onClick={() => setTypeFilter(t)}
                    className={clsx("px-3 py-2 text-xs font-semibold font-space bouncy", i > 0 && "border-l-2")}
                    style={{
                      background: typeFilter === t ? "#E8472A" : "#FFFFFF",
                      color: typeFilter === t ? "#FFFFFF" : "#5A5A5A",
                      borderColor: "#0D0D0D",
                    }}>
              {t === "all" ? "All" : t === "sop" ? "SOP" : t === "outreach-prep" ? "Outreach" : "Narrative"}
            </button>
          ))}
        </div>
        <div className="flex overflow-hidden" style={{ border: "2px solid #0D0D0D", borderRadius: "4px" }}>
          {(["all", "draft", "in-review", "approved"] as const).map((s, i) => (
            <button key={s} onClick={() => setStatusFilter(s)}
                    className={clsx("px-3 py-2 text-xs font-semibold font-space bouncy", i > 0 && "border-l-2")}
                    style={{
                      background: statusFilter === s ? "#E8472A" : "#FFFFFF",
                      color: statusFilter === s ? "#FFFFFF" : "#5A5A5A",
                      borderColor: "#0D0D0D",
                    }}>
              {s === "all" ? "All" : s === "in-review" ? "In Review" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {!loading && aiDraftCount > 0 && (
          <div
            className="mb-5 p-4 flex items-center gap-3"
            style={{ background: "#FFFFFF", border: "2px solid #0D0D0D", boxShadow: "3px 3px 0 #0D0D0D", borderRadius: "4px" }}
          >
            <div
              className="w-8 h-8 flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(217,119,6,0.12)", border: "1.5px solid #D97706", borderRadius: "4px" }}
            >
              <Icon icon="solar:danger-triangle-bold" width={14} style={{ color: "#D97706" }} />
            </div>
            <div>
              <p className="text-sm font-bold font-space" style={{ color: "#0D0D0D" }}>AI drafts require personalisation</p>
              <p className="text-xs font-dm mt-0.5" style={{ color: "#5A5A5A" }}>
                Generated from indexed content — <strong>review and personalise</strong> before submission.
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" style={{ color: "#E8472A" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Icon icon="solar:document-text-bold" width={32} style={{ color: "#B0A898" }} className="mb-3" />
            <p className="font-semibold font-space" style={{ color: "#5A5A5A" }}>No drafts yet</p>
            <p className="text-xs font-dm mt-1 mb-4" style={{ color: "#9CA3AF" }}>Generate your first SOP in Agent Chat</p>
            <a href="/chat" className="btn-coral btn-sm">
              <Icon icon="solar:alt-arrow-right-bold" width={13} />
              <span className="text-sm">Go to Chat</span>
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(draft => <DraftCard key={draft.id} draft={draft} />)}
          </div>
        )}
      </div>
    </div>
  );
}
