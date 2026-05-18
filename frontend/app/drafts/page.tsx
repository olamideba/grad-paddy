"use client";

import { useState } from "react";
import {
  FileText,
  Plus,
  Edit3,
  CheckCircle2,
  Clock,
  RotateCcw,
  Eye,
  Mail,
  BookOpen,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import clsx from "clsx";

type DraftType = "sop" | "outreach-prep" | "research-narrative";
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
    id: "d1",
    type: "sop",
    targetProgram: "PhD Computer Science",
    targetUniversity: "MIT",
    targetFaculty: "Prof. Regina Barzilay",
    status: "draft",
    wordCount: 487,
    excerpt:
      "During my four years building production NLP systems at Acme Corp, I encountered a fundamental limitation: models optimised for benchmark performance consistently failed in clinical environments where distributional shift is not an edge case but the norm...",
    lastEdited: new Date(Date.now() - 2 * 60 * 60 * 1000),
    groundedIn: ["Barzilay lab page", "CSAIL program requirements"],
    isAiDraft: true,
  },
  {
    id: "d2",
    type: "outreach-prep",
    targetFaculty: "Prof. Christopher Manning",
    targetUniversity: "Stanford",
    status: "approved",
    excerpt:
      "PREP CARD — Paper: 'Emergent Linguistic Structure in LLMs' (2024). Key finding: syntactic competence emerges in layers 8-12 of 7B+ models, independent of training objective. Questions to ask: (1) How does this interact with RLHF fine-tuning? (2) Does this generalise to non-English...",
    lastEdited: new Date(Date.now() - 24 * 60 * 60 * 1000),
    groundedIn: ["Manning Google Scholar", "Stanford NLP lab page"],
    isAiDraft: true,
  },
  {
    id: "d3",
    type: "sop",
    targetProgram: "PhD Language Technologies",
    targetUniversity: "CMU",
    targetFaculty: "Prof. Graham Neubig",
    status: "draft",
    wordCount: 210,
    excerpt:
      "My research interest sits at the intersection of low-resource NLP and code generation — a combination that, I believe, Prof. Neubig's work on cross-lingual transfer and SWE-bench directly anticipates...",
    lastEdited: new Date(Date.now() - 4 * 60 * 60 * 1000),
    groundedIn: ["Neubig lab page", "CMU LTI admissions page"],
    isAiDraft: true,
  },
  {
    id: "d4",
    type: "research-narrative",
    targetProgram: "General",
    status: "in-review",
    wordCount: 312,
    excerpt:
      "This is my personal research narrative — a translation of four years of production NLP work into academic framing. I've built: (1) a named-entity pipeline processing 40M docs/day, (2) a retrieval-augmented clinical decision support system, (3) a domain-adaptation framework for low-resource medical...",
    lastEdited: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    isAiDraft: false,
  },
];

const TYPE_CONFIG: Record<DraftType, { label: string; icon: React.ElementType; color: string }> = {
  sop: { label: "Statement of Purpose", icon: FileText, color: "bg-violet-paddy/20" },
  "outreach-prep": { label: "Outreach Prep Card", icon: Mail, color: "bg-violet-paddy/30" },
  "research-narrative": { label: "Research Narrative", icon: BookOpen, color: "bg-violet-paddy/20" },
};

const STATUS_CONFIG: Record<DraftStatus, { label: string; bg: string; icon: React.ElementType }> = {
  draft: { label: "Draft", bg: "bg-surface-2", icon: Edit3 },
  "in-review": { label: "In Review", bg: "bg-violet-paddy/30", icon: Eye },
  approved: { label: "Approved", bg: "bg-green-paddy", icon: CheckCircle2 },
  archived: { label: "Archived", bg: "bg-surface-3", icon: Clock },
};

function DraftCard({ draft }: { draft: Draft }) {
  const { label: typeLabel, icon: TypeIcon, color: typeBg } = TYPE_CONFIG[draft.type];
  const { label: statusLabel, bg: statusBg, icon: StatusIcon } = STATUS_CONFIG[draft.status];

  const timeAgo = () => {
    const mins = Math.floor((Date.now() - draft.lastEdited.getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="card-brutal flex flex-col">
      {/* Header bar */}
      <div className={clsx("flex items-center justify-between px-4 py-3 border-b-3 border-border-bright", typeBg)}>
        <div className="flex items-center gap-2">
          <TypeIcon size={14} strokeWidth={2.5} />
          <span className="text-xs font-black uppercase tracking-wider font-grotesk">
            {typeLabel}
          </span>
        </div>
        <span
          className={clsx(
            "badge-brutal text-xs flex items-center gap-1",
            statusBg
          )}
        >
          <StatusIcon size={10} strokeWidth={2.5} />
          {statusLabel}
        </span>
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col gap-3">
        {/* Target info */}
        <div>
          {draft.targetFaculty && (
            <div className="text-sm font-black font-grotesk leading-tight">
              → {draft.targetFaculty}
            </div>
          )}
          <div className="text-xs font-grotesk text-fg-muted mt-0.5">
            {draft.targetUniversity}
            {draft.targetProgram && draft.targetProgram !== "General" && (
              <> · {draft.targetProgram}</>
            )}
          </div>
        </div>

        {/* Excerpt */}
        <div className="border-l-4 border-border pl-3">
          <p className="text-xs font-grotesk text-fg-muted leading-relaxed line-clamp-3 italic">
            "{draft.excerpt}"
          </p>
        </div>

        {/* Grounded in */}
        {draft.groundedIn && draft.groundedIn.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {draft.groundedIn.map((source) => (
              <span
                key={source}
                className="text-xs font-mono text-fg-muted border border-border px-1.5 py-0.5"
              >
                📄 {source}
              </span>
            ))}
          </div>
        )}

        {/* AI draft warning */}
        {draft.isAiDraft && draft.status === "draft" && (
          <div className="flex items-start gap-2 border-2 border-violet-paddy bg-violet-paddy/10 px-3 py-2">
            <AlertTriangle size={12} className="text-violet-light flex-shrink-0 mt-0.5" strokeWidth={2.5} />
            <p className="text-xs font-grotesk text-fg-muted">
              <strong>AI draft — requires your review and personalisation</strong> before use.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t-3 border-border-bright flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 text-xs font-grotesk text-fg-muted">
          <Clock size={11} />
          <span>{timeAgo()}</span>
          {draft.wordCount && (
            <>
              <span>·</span>
              <span>{draft.wordCount} words</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {draft.status !== "approved" && (
            <button className="btn-brutal bg-violet-paddy text-white px-3 py-1.5 text-xs">
              <Edit3 size={11} strokeWidth={2.5} />
              Edit
            </button>
          )}
          {draft.status === "draft" && (
            <button className="btn-brutal bg-surface-2 text-fg px-3 py-1.5 text-xs">
              <RotateCcw size={11} strokeWidth={2.5} />
              Regenerate
            </button>
          )}
          {draft.status === "draft" && (
            <button className="btn-brutal bg-green-paddy text-midnight px-3 py-1.5 text-xs">
              <CheckCircle2 size={11} strokeWidth={2.5} />
              Approve
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DraftsPage() {
  const [typeFilter, setTypeFilter] = useState<DraftType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<DraftStatus | "all">("all");

  const filtered = DRAFTS.filter((d) => {
    const matchesType = typeFilter === "all" || d.type === typeFilter;
    const matchesStatus = statusFilter === "all" || d.status === statusFilter;
    return matchesType && matchesStatus;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b-3 border-border-bright flex-shrink-0" style={{ background: "var(--surface)" }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight font-grotesk flex items-center gap-2">
              <FileText size={18} strokeWidth={2.5} />
              Drafts
            </h1>
            <p className="text-xs font-grotesk text-fg-muted">
              {DRAFTS.filter((d) => d.status === "draft").length} drafts ·{" "}
              {DRAFTS.filter((d) => d.status === "approved").length} approved ·{" "}
              {DRAFTS.filter((d) => d.isAiDraft && d.status === "draft").length} need your review
            </p>
          </div>
          <a href="/chat" className="btn-yellow gap-2">
            <Plus size={15} strokeWidth={2.5} />
            <span className="text-sm font-bold">Generate Draft</span>
          </a>
        </div>

        {/* Filters */}
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 border-3 border-border-bright overflow-hidden"
               style={{ boxShadow: "3px 3px 0 #7C3AED" }}>
            <button
              onClick={() => setTypeFilter("all")}
              className={clsx(
                "px-3 py-2 text-xs font-black font-grotesk uppercase tracking-wide transition-colors",
                typeFilter === "all" ? "bg-violet-paddy text-white" : "bg-surface-2 text-fg hover:bg-violet-paddy/30"
              )}
            >
              All Types
            </button>
            {(["sop", "outreach-prep", "research-narrative"] as DraftType[]).map((t) => {
              const { label, icon: Icon } = TYPE_CONFIG[t];
              return (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={clsx(
                    "px-3 py-2 text-xs font-black font-grotesk uppercase tracking-wide transition-colors border-l-2 border-border-bright",
                    typeFilter === t ? "bg-violet-paddy text-white" : "bg-surface-2 text-fg hover:bg-violet-paddy/30"
                  )}
                >
                  {label === "Statement of Purpose" ? "SOP" : label === "Outreach Prep Card" ? "Outreach" : "Narrative"}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 border-3 border-border-bright overflow-hidden">
            {(["all", "draft", "in-review", "approved"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={clsx(
                  "px-3 py-2 text-xs font-bold font-grotesk capitalize transition-colors",
                  s !== "all" && "border-l-2 border-border-bright",
                  statusFilter === s ? "bg-violet-paddy text-white" : "bg-surface-2 text-fg hover:bg-violet-paddy/30"
                )}
              >
                {s === "all" ? "All" : s === "in-review" ? "In Review" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* AI draft notice */}
        {DRAFTS.some((d) => d.isAiDraft && d.status === "draft") && (
          <div
            className="mb-5 border-3 border-violet-paddy bg-violet-paddy/20 p-4 flex items-center justify-between"
            style={{ boxShadow: "4px 4px 0 #7C3AED" }}
          >
            <div className="flex items-center gap-3">
              <AlertTriangle size={18} strokeWidth={2.5} className="text-violet-light" />
              <div>
                <p className="text-sm font-black font-grotesk">
                  AI drafts require personalisation
                </p>
                <p className="text-xs font-grotesk text-fg-muted">
                  Grad Paddy generates drafts grounded in indexed content, but{" "}
                  <strong>you must review and personalise</strong> before submission.
                  The agent never presents drafts as submission-ready.
                </p>
              </div>
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <FileText size={36} className="text-fg-muted mb-3" />
            <p className="font-bold text-fg-muted font-grotesk">No drafts yet</p>
            <p className="text-sm text-fg-muted font-grotesk mt-1 mb-4">
              Generate your first SOP or outreach prep in Agent Chat
            </p>
            <a href="/chat" className="btn-yellow gap-2">
              <ChevronRight size={14} strokeWidth={2.5} />
              <span className="text-sm font-bold">Go to Chat</span>
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filtered.map((draft) => (
              <DraftCard key={draft.id} draft={draft} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
