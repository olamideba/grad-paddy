"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import clsx from "clsx";

type DraftType   = "sop" | "outreach-prep" | "research-narrative";
type DraftStatus = "draft" | "in-review" | "approved" | "archived";

type Draft = {
  id: string;
  type: DraftType;
  targetProgram?: string;
  targetFaculty?: string;
  targetUniversity?: string;
  status: DraftStatus;
  wordCount?: number;
  excerpt: string;
  lastEdited: Date;
  groundedIn?: string[];
  isAiDraft: boolean;
};

const DRAFTS: Draft[] = [
  {
    id: "d1", type: "sop", targetProgram: "PhD Computer Science",
    targetUniversity: "MIT", targetFaculty: "Prof. Regina Barzilay",
    status: "draft", wordCount: 487,
    excerpt: "During my four years building production NLP systems at Acme Corp, I encountered a fundamental limitation: models optimised for benchmark performance consistently failed in clinical environments where distributional shift is not an edge case but the norm...",
    lastEdited: new Date(Date.now() - 2 * 60 * 60 * 1000),
    groundedIn: ["Barzilay lab page", "CSAIL program requirements"],
    isAiDraft: true,
  },
  {
    id: "d2", type: "outreach-prep", targetFaculty: "Prof. Christopher Manning",
    targetUniversity: "Stanford", status: "approved",
    excerpt: "PREP CARD — Paper: 'Emergent Linguistic Structure in LLMs' (2024). Key finding: syntactic competence emerges in layers 8-12 of 7B+ models. Questions to ask: (1) How does this interact with RLHF fine-tuning?...",
    lastEdited: new Date(Date.now() - 24 * 60 * 60 * 1000),
    groundedIn: ["Manning Google Scholar", "Stanford NLP lab page"],
    isAiDraft: true,
  },
  {
    id: "d3", type: "sop", targetProgram: "PhD Language Technologies",
    targetUniversity: "CMU", targetFaculty: "Prof. Graham Neubig",
    status: "draft", wordCount: 210,
    excerpt: "My research interest sits at the intersection of low-resource NLP and code generation — a combination that, I believe, Prof. Neubig's work on cross-lingual transfer and SWE-bench directly anticipates...",
    lastEdited: new Date(Date.now() - 4 * 60 * 60 * 1000),
    groundedIn: ["Neubig lab page", "CMU LTI admissions page"],
    isAiDraft: true,
  },
  {
    id: "d4", type: "research-narrative", targetProgram: "General",
    status: "in-review", wordCount: 312,
    excerpt: "This is my personal research narrative — a translation of four years of production NLP work into academic framing. I've built: (1) a named-entity pipeline processing 40M docs/day, (2) a retrieval-augmented clinical decision support system...",
    lastEdited: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    isAiDraft: false,
  },
];

const TYPE_META: Record<DraftType, { label: string; icon: string }> = {
  sop:                  { label: "Statement of Purpose", icon: "solar:document-text-bold" },
  "outreach-prep":      { label: "Outreach Prep Card",   icon: "solar:letter-bold" },
  "research-narrative": { label: "Research Narrative",   icon: "solar:book-bold" },
};

const STATUS_META: Record<DraftStatus, { label: string; icon: string; bg: string; color: string; border: string }> = {
  draft:       { label: "Draft",     icon: "solar:pen-bold",          bg: "#EDE6D3", color: "#5A5A5A",  border: "#0D0D0D" },
  "in-review": { label: "In Review", icon: "solar:eye-bold",          bg: "#E8472A", color: "#FFFFFF",  border: "#0D0D0D" },
  approved:    { label: "Approved",  icon: "solar:check-circle-bold", bg: "#4ECDC4", color: "#0D0D0D",  border: "#0D0D0D" },
  archived:    { label: "Archived",  icon: "solar:clock-circle-bold", bg: "#F7F0E3", color: "#9CA3AF",  border: "#C8C0AF" },
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
      {/* Type header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: "#EDE6D3", borderBottom: "2px solid #0D0D0D" }}
      >
        <div className="flex items-center gap-2">
          <Icon icon={type.icon} width={12} style={{ color: "#5A5A5A" }} />
          <span className="text-[10px] font-semibold uppercase tracking-wide font-space" style={{ color: "#5A5A5A" }}>
            {type.label}
          </span>
        </div>
        <span
          className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-semibold font-space"
          style={{ background: status.bg, color: status.color, border: `1.5px solid ${status.border}` }}
        >
          <Icon icon={status.icon} width={9} />
          {status.label}
        </span>
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col gap-3">
        <div>
          {draft.targetFaculty && (
            <p className="text-sm font-semibold font-space leading-tight" style={{ color: "#0D0D0D" }}>→ {draft.targetFaculty}</p>
          )}
          <p className="text-xs font-dm mt-0.5" style={{ color: "#9CA3AF" }}>
            {draft.targetUniversity}
            {draft.targetProgram && draft.targetProgram !== "General" && <> · {draft.targetProgram}</>}
          </p>
        </div>

        <div className="pl-3" style={{ borderLeft: "3px solid #0D0D0D" }}>
          <p className="text-xs font-dm leading-relaxed line-clamp-3 italic" style={{ color: "#5A5A5A" }}>
            "{draft.excerpt}"
          </p>
        </div>

        {draft.groundedIn && draft.groundedIn.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {draft.groundedIn.map(source => (
              <span
                key={source}
                className="text-[10px] font-mono px-2 py-0.5"
                style={{ background: "#F7F0E3", border: "1.5px solid #0D0D0D", color: "#5A5A5A" }}
              >
                {source}
              </span>
            ))}
          </div>
        )}

        {draft.isAiDraft && draft.status === "draft" && (
          <div
            className="flex items-start gap-2 px-3 py-2"
            style={{ border: "1.5px solid #D97706", background: "rgba(217,119,6,0.08)" }}
          >
            <Icon icon="solar:danger-triangle-bold" width={11} style={{ color: "#D97706" }} className="shrink-0 mt-px" />
            <p className="text-[11px] font-dm leading-snug" style={{ color: "#5A5A5A" }}>
              <span className="font-semibold" style={{ color: "#0D0D0D" }}>AI draft</span> — review and personalise before use.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: "2px solid #0D0D0D" }}>
        <div className="flex items-center gap-2 text-[10px] font-dm" style={{ color: "#9CA3AF" }}>
          <Icon icon="solar:clock-circle-bold" width={10} />
          <span>{timeAgo(draft.lastEdited)}</span>
          {draft.wordCount && <><span>·</span><span>{draft.wordCount}w</span></>}
        </div>
        <div className="flex items-center gap-1.5">
          {draft.status !== "approved" && (
            <button className="btn-black btn-sm gap-1 text-xs">
              <Icon icon="solar:pen-bold" width={10} />Edit
            </button>
          )}
          {draft.status === "draft" && (
            <button className="btn-white btn-sm gap-1 text-xs">
              <Icon icon="solar:refresh-bold" width={10} />Regen
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
  const [typeFilter,   setTypeFilter]   = useState<DraftType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<DraftStatus | "all">("all");

  const filtered = DRAFTS.filter(d => {
    const matchType   = typeFilter === "all"   || d.type === typeFilter;
    const matchStatus = statusFilter === "all" || d.status === statusFilter;
    return matchType && matchStatus;
  });

  const aiDraftCount = DRAFTS.filter(d => d.isAiDraft && d.status === "draft").length;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#F7F0E3" }}>
      {/* Header */}
      <div className="px-6 py-4 shrink-0 bg-white" style={{ borderBottom: "2px solid #0D0D0D" }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold font-space flex items-center gap-2" style={{ color: "#0D0D0D" }}>
              <Icon icon="solar:document-text-bold" width={15} style={{ color: "#E8472A" }} />
              Drafts
            </h1>
            <p className="text-xs font-dm mt-0.5" style={{ color: "#9CA3AF" }}>
              {DRAFTS.filter(d => d.status === "draft").length} drafts ·{" "}
              {DRAFTS.filter(d => d.status === "approved").length} approved
              {aiDraftCount > 0 && (
                <span className="font-semibold" style={{ color: "#E8472A" }}> · {aiDraftCount} need review</span>
              )}
            </p>
          </div>
          <a href="/chat" className="btn-coral btn-sm">
            <Icon icon="solar:add-circle-bold" width={14} />
            <span className="text-sm">Generate Draft</span>
          </a>
        </div>

        {/* Filters */}
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <div className="flex overflow-hidden" style={{ border: "2px solid #0D0D0D" }}>
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
          <div className="flex overflow-hidden" style={{ border: "2px solid #0D0D0D" }}>
            {(["all", "draft", "in-review", "approved"] as const).map((s, i) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                      className={clsx("px-3 py-2 text-xs font-semibold font-space capitalize bouncy", i > 0 && "border-l-2")}
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
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {aiDraftCount > 0 && (
          <div
            className="mb-5 bg-white p-4 flex items-center gap-3"
            style={{ border: "2px solid #0D0D0D", boxShadow: "3px 3px 0 #0D0D0D" }}
          >
            <Icon icon="solar:danger-triangle-bold" width={15} style={{ color: "#D97706" }} className="shrink-0" />
            <div>
              <p className="text-sm font-semibold font-space" style={{ color: "#0D0D0D" }}>AI drafts require personalisation</p>
              <p className="text-xs font-dm mt-0.5" style={{ color: "#5A5A5A" }}>
                Generated from indexed content — <strong>review and personalise</strong> before submission.
              </p>
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
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
