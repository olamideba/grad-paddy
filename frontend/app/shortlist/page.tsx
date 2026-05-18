"use client";

import { useState } from "react";
import {
  Star,
  ExternalLink,
  Mail,
  BookOpen,
  Users,
  Trash2,
  Search,
  Plus,
  ChevronRight,
  GraduationCap,
} from "lucide-react";
import clsx from "clsx";

type Faculty = {
  id: string;
  name: string;
  university: string;
  department: string;
  researchAreas: string[];
  fitScore: number;
  recentPaper: string;
  paperYear: number;
  profileUrl: string;
  openPositions: boolean | "unknown";
  outreachStatus: "none" | "drafted" | "sent" | "responded";
};

const MOCK_FACULTY: Faculty[] = [
  {
    id: "f1",
    name: "Regina Barzilay",
    university: "MIT",
    department: "CSAIL",
    researchAreas: ["Clinical NLP", "Cancer AI", "Drug Discovery"],
    fitScore: 94,
    recentPaper: "Empowering biomedical discovery with AI agents (2024)",
    paperYear: 2024,
    profileUrl: "https://www.regina.csail.mit.edu/",
    openPositions: true,
    outreachStatus: "drafted",
  },
  {
    id: "f2",
    name: "Christopher Manning",
    university: "Stanford",
    department: "CS / Linguistics",
    researchAreas: ["NLP", "Deep Learning", "Information Extraction"],
    fitScore: 88,
    recentPaper: "Emergent Linguistic Structure in LLMs (2024)",
    paperYear: 2024,
    profileUrl: "https://nlp.stanford.edu/~manning/",
    openPositions: "unknown",
    outreachStatus: "none",
  },
  {
    id: "f3",
    name: "Graham Neubig",
    university: "CMU",
    department: "LTI",
    researchAreas: ["NLP", "Low-resource Languages", "Code Generation"],
    fitScore: 82,
    recentPaper: "SWE-bench: Can LLMs Resolve Github Issues? (2024)",
    paperYear: 2024,
    profileUrl: "http://www.phontron.com/",
    openPositions: false,
    outreachStatus: "none",
  },
  {
    id: "f4",
    name: "Percy Liang",
    university: "Stanford",
    department: "CS / HAI",
    researchAreas: ["Foundation Models", "Robustness", "Evaluation"],
    fitScore: 79,
    recentPaper: "HELM: Holistic Evaluation of Language Models (2023)",
    paperYear: 2023,
    profileUrl: "https://cs.stanford.edu/~pliang/",
    openPositions: true,
    outreachStatus: "none",
  },
  {
    id: "f5",
    name: "Noah Smith",
    university: "UW / AI2",
    department: "Paul G. Allen School",
    researchAreas: ["NLP", "Social Media Analysis", "Computational Social Science"],
    fitScore: 71,
    recentPaper: "Reasoning about Moral Situations (2024)",
    paperYear: 2024,
    profileUrl: "https://nasmith.github.io/",
    openPositions: true,
    outreachStatus: "sent",
  },
];

const STATUS_COLORS: Record<Faculty["outreachStatus"], string> = {
  none: "bg-surface-2 text-fg",
  drafted: "bg-violet-paddy/20 text-fg",
  sent: "bg-violet-paddy text-white",
  responded: "bg-green-paddy text-midnight",
};

const STATUS_LABEL: Record<Faculty["outreachStatus"], string> = {
  none: "No outreach",
  drafted: "Draft ready",
  sent: "Email sent",
  responded: "Responded",
};

function FitScoreBar({ score }: { score: number }) {
  const color =
    score >= 85
      ? "bg-green-paddy"
      : score >= 70
      ? "bg-violet-paddy"
      : "bg-orange-paddy";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 border-2 border-border-bright bg-surface-3">
        <div
          className={clsx("h-full transition-all", color)}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs font-black font-mono text-fg w-8 text-right">
        {score}
      </span>
    </div>
  );
}

function PositionBadge({ status }: { status: Faculty["openPositions"] }) {
  if (status === true)
    return (
      <span className="badge-brutal bg-green-paddy text-midnight text-xs">
        Open
      </span>
    );
  if (status === false)
    return (
      <span className="badge-brutal bg-red-paddy/20 text-fg text-xs">
        Closed
      </span>
    );
  return (
    <span className="badge-brutal bg-surface-3 text-fg-muted text-xs">
      Unknown
    </span>
  );
}

function FacultyCard({
  faculty,
  rotation,
}: {
  faculty: Faculty;
  rotation: string;
}) {
  return (
    <div
      className={clsx("card-brutal p-0 flex flex-col overflow-hidden", rotation)}
    >
      {/* Top color bar + university badge */}
      <div className="h-2 bg-violet-paddy w-full" />

      <div className="p-5 flex-1 flex flex-col gap-3">
        {/* Name + university */}
        <div>
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-black text-base font-grotesk leading-tight">
              {faculty.name}
            </h3>
            <button
              className="flex-shrink-0 text-fg-muted hover:text-red-paddy transition-colors mt-0.5"
              title="Remove from shortlist"
            >
              <Trash2 size={13} strokeWidth={2} />
            </button>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="badge-brutal text-xs"
              style={{ background: "var(--surface-3)" }}
            >
              {faculty.university}
            </span>
            <span className="text-xs font-grotesk text-fg-muted">
              {faculty.department}
            </span>
          </div>
        </div>

        {/* Research areas */}
        <div className="flex flex-wrap gap-1">
          {faculty.researchAreas.map((area) => (
            <span
              key={area}
              className="text-xs font-grotesk border border-border px-2 py-0.5 bg-surface-3"
            >
              {area}
            </span>
          ))}
        </div>

        {/* Fit score */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-fg-muted font-grotesk">
              Research Fit
            </span>
            <PositionBadge status={faculty.openPositions} />
          </div>
          <FitScoreBar score={faculty.fitScore} />
        </div>

        {/* Recent paper */}
        <div className="border-t-2 border-dashed border-border pt-3">
          <div className="flex items-start gap-1.5">
            <BookOpen size={12} className="text-fg-muted flex-shrink-0 mt-0.5" />
            <p className="text-xs font-grotesk text-fg-muted leading-snug line-clamp-2">
              {faculty.recentPaper}
            </p>
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="border-t-3 border-border-bright flex">
        <div
          className={clsx(
            "px-3 py-2 border-r-2 border-border-bright flex-shrink-0",
            STATUS_COLORS[faculty.outreachStatus]
          )}
        >
          <div className="flex items-center gap-1.5">
            <Mail size={11} strokeWidth={2.5} />
            <span className="text-xs font-bold font-grotesk whitespace-nowrap">
              {STATUS_LABEL[faculty.outreachStatus]}
            </span>
          </div>
        </div>

        <div className="flex flex-1">
          <a
            href={faculty.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold font-grotesk hover:bg-violet-paddy/20 transition-colors border-r border-border"
          >
            <ExternalLink size={11} strokeWidth={2.5} />
            Profile
          </a>
          <button className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold font-grotesk hover:bg-violet-paddy transition-colors hover:text-white">
            <Mail size={11} strokeWidth={2.5} />
            Prep Email
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ShortlistPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "outreach">("all");

  const filtered = MOCK_FACULTY.filter((f) => {
    const matchesSearch =
      search === "" ||
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.university.toLowerCase().includes(search.toLowerCase()) ||
      f.researchAreas.some((a) =>
        a.toLowerCase().includes(search.toLowerCase())
      );
    const matchesFilter =
      filter === "all" ||
      (filter === "open" && f.openPositions === true) ||
      (filter === "outreach" && f.outreachStatus !== "none");
    return matchesSearch && matchesFilter;
  });

  const ROTATIONS = ["rotate-neg", "", "rotate-pos", "", "rotate-neg"];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b-3 border-border-bright flex-shrink-0" style={{ background: "var(--surface)" }}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight font-grotesk flex items-center gap-2">
              <Star size={18} strokeWidth={2.5} />
              Faculty Shortlist
            </h1>
            <p className="text-xs font-grotesk text-fg-muted">
              {MOCK_FACULTY.length} saved ·{" "}
              {MOCK_FACULTY.filter((f) => f.openPositions === true).length} open
              positions
            </p>
          </div>
          <button className="btn-yellow gap-2">
            <Plus size={15} strokeWidth={2.5} />
            <span className="text-sm font-bold">Add Faculty</span>
          </button>
        </div>

        {/* Filters */}
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted"
            />
            <input
              type="text"
              placeholder="Search faculty, university, research area..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-brutal pl-8 pr-4 py-2 text-sm w-full"
            />
          </div>
          <div className="flex border-3 border-border-bright overflow-hidden"
               style={{ boxShadow: "3px 3px 0 #7C3AED" }}>
            {(["all", "open", "outreach"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={clsx(
                  "px-3 py-2 text-xs font-black uppercase tracking-wide font-grotesk transition-colors",
                  f !== "all" && "border-l-2 border-border-bright",
                  filter === f
                    ? "bg-violet-paddy text-white"
                    : "bg-surface-2 text-fg hover:bg-violet-paddy/30"
                )}
              >
                {f === "all" ? "All" : f === "open" ? "Open Positions" : "Has Outreach"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <GraduationCap size={36} className="text-fg-muted mb-3" />
            <p className="font-bold text-fg-muted font-grotesk">
              No faculty found
            </p>
            <p className="text-sm text-fg-muted font-grotesk mt-1">
              Try adjusting your search or filters
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((faculty, i) => (
              <FacultyCard
                key={faculty.id}
                faculty={faculty}
                rotation={ROTATIONS[i % ROTATIONS.length]}
              />
            ))}
          </div>
        )}

        {/* CTA to chat */}
        <div
          className="mt-6 border-3 border-border-bright bg-violet-paddy/20 p-4 flex items-center justify-between"
          style={{ boxShadow: "4px 4px 0 #7C3AED" }}
        >
          <div>
            <p className="font-black font-grotesk text-fg">
              Want more faculty matches?
            </p>
            <p className="text-sm font-grotesk text-fg-muted">
              Go to Agent Chat and paste more program URLs to discover new faculty.
            </p>
          </div>
          <a href="/chat" className="btn-black flex items-center gap-2 ml-4">
            <span className="text-sm font-bold">Open Chat</span>
            <ChevronRight size={14} strokeWidth={2.5} />
          </a>
        </div>
      </div>
    </div>
  );
}
