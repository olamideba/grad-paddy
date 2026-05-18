"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
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
    id: "f1", name: "Regina Barzilay", university: "MIT", department: "CSAIL",
    researchAreas: ["Clinical NLP", "Cancer AI", "Drug Discovery"],
    fitScore: 94, recentPaper: "Empowering biomedical discovery with AI agents (2024)",
    paperYear: 2024, profileUrl: "https://www.regina.csail.mit.edu/",
    openPositions: true, outreachStatus: "drafted",
  },
  {
    id: "f2", name: "Christopher Manning", university: "Stanford", department: "CS / Linguistics",
    researchAreas: ["NLP", "Deep Learning", "Information Extraction"],
    fitScore: 88, recentPaper: "Emergent Linguistic Structure in LLMs (2024)",
    paperYear: 2024, profileUrl: "https://nlp.stanford.edu/~manning/",
    openPositions: "unknown", outreachStatus: "none",
  },
  {
    id: "f3", name: "Graham Neubig", university: "CMU", department: "LTI",
    researchAreas: ["NLP", "Low-resource Languages", "Code Generation"],
    fitScore: 82, recentPaper: "SWE-bench: Can LLMs Resolve Github Issues? (2024)",
    paperYear: 2024, profileUrl: "http://www.phontron.com/",
    openPositions: false, outreachStatus: "none",
  },
  {
    id: "f4", name: "Percy Liang", university: "Stanford", department: "CS / HAI",
    researchAreas: ["Foundation Models", "Robustness", "Evaluation"],
    fitScore: 79, recentPaper: "HELM: Holistic Evaluation of Language Models (2023)",
    paperYear: 2023, profileUrl: "https://cs.stanford.edu/~pliang/",
    openPositions: true, outreachStatus: "none",
  },
  {
    id: "f5", name: "Noah Smith", university: "UW / AI2", department: "Paul G. Allen School",
    researchAreas: ["NLP", "Social Media", "Computational Social Science"],
    fitScore: 71, recentPaper: "Reasoning about Moral Situations (2024)",
    paperYear: 2024, profileUrl: "https://nasmith.github.io/",
    openPositions: true, outreachStatus: "sent",
  },
];

const OUTREACH_META: Record<Faculty["outreachStatus"], { label: string; bg: string; color: string; border: string }> = {
  none:      { label: "No outreach", bg: "#EDE6D3", color: "#5A5A5A",  border: "#0D0D0D" },
  drafted:   { label: "Draft ready", bg: "#F7F0E3", color: "#0D0D0D",  border: "#0D0D0D" },
  sent:      { label: "Email sent",  bg: "#0D0D0D", color: "#FFFFFF",  border: "#0D0D0D" },
  responded: { label: "Responded",   bg: "#4ECDC4", color: "#0D0D0D",  border: "#0D0D0D" },
};

function FitBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 overflow-hidden" style={{ background: "#EDE6D3", border: "1px solid #0D0D0D" }}>
        <div
          className="h-full"
          style={{
            width: `${score}%`,
            background: score >= 85 ? "#4ECDC4" : score >= 70 ? "#0D0D0D" : "#B0A898",
          }}
        />
      </div>
      <span className="text-xs font-semibold font-mono w-6 text-right" style={{ color: "#0D0D0D" }}>{score}</span>
    </div>
  );
}

function PositionBadge({ status }: { status: Faculty["openPositions"] }) {
  if (status === true)  return <span className="badge-teal">Open</span>;
  if (status === false) return <span className="badge-coral">Closed</span>;
  return <span className="badge-gray">Unknown</span>;
}

function FacultyCard({ faculty }: { faculty: Faculty }) {
  const outreach = OUTREACH_META[faculty.outreachStatus];
  return (
    <div className="card-brutal flex flex-col overflow-hidden p-0">
      {/* Score strip */}
      <div className="h-1 w-full" style={{ background: "#EDE6D3" }}>
        <div className="h-full" style={{
          width: `${faculty.fitScore}%`,
          background: faculty.fitScore >= 85 ? "#4ECDC4" : faculty.fitScore >= 70 ? "#0D0D0D" : "#B0A898",
        }} />
      </div>

      <div className="p-5 flex-1 flex flex-col gap-3">
        {/* Name */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-sm font-space leading-tight" style={{ color: "#0D0D0D" }}>{faculty.name}</h3>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span
                className="text-[10px] font-semibold font-space px-2 py-0.5"
                style={{ background: "#EDE6D3", border: "1.5px solid #0D0D0D", color: "#0D0D0D" }}
              >
                {faculty.university}
              </span>
              <span className="text-[10px] font-dm" style={{ color: "#9CA3AF" }}>{faculty.department}</span>
            </div>
          </div>
          <button
            className="bouncy shrink-0 mt-0.5 p-1"
            style={{ color: "#B0A898", border: "1.5px solid transparent" }}
            onMouseEnter={e => { (e.currentTarget.style.color = "#E8472A"); (e.currentTarget.style.border = "1.5px solid #0D0D0D"); }}
            onMouseLeave={e => { (e.currentTarget.style.color = "#B0A898"); (e.currentTarget.style.border = "1.5px solid transparent"); }}
          >
            <Icon icon="solar:trash-bin-trash-bold" width={13} />
          </button>
        </div>

        {/* Research areas */}
        <div className="flex flex-wrap gap-1">
          {faculty.researchAreas.map(area => (
            <span
              key={area}
              className="text-[10px] px-2 py-0.5 font-dm"
              style={{ background: "#F7F0E3", border: "1.5px solid #0D0D0D", color: "#5A5A5A" }}
            >
              {area}
            </span>
          ))}
        </div>

        {/* Fit score */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider font-space" style={{ color: "#9CA3AF" }}>Research Fit</span>
            <PositionBadge status={faculty.openPositions} />
          </div>
          <FitBar score={faculty.fitScore} />
        </div>

        {/* Recent paper */}
        <div className="flex items-start gap-2 pt-3" style={{ borderTop: "1px solid #EDE6D3" }}>
          <Icon icon="solar:book-bold" width={11} className="shrink-0 mt-0.5" style={{ color: "#B0A898" }} />
          <p className="text-[11px] font-dm leading-snug line-clamp-2 italic" style={{ color: "#9CA3AF" }}>{faculty.recentPaper}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex overflow-hidden" style={{ borderTop: "2px solid #0D0D0D" }}>
        <div className="px-3 py-2 shrink-0" style={{ background: outreach.bg, borderRight: `2px solid ${outreach.border}` }}>
          <span className="text-xs font-semibold font-space whitespace-nowrap" style={{ color: outreach.color }}>
            {outreach.label}
          </span>
        </div>
        <div className="flex flex-1">
          <a href={faculty.profileUrl} target="_blank" rel="noopener noreferrer"
             className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold font-space bouncy"
             style={{ color: "#5A5A5A", borderRight: "1px solid #EDE6D3" }}
             onMouseEnter={e => { (e.currentTarget.style.background = "#0D0D0D"); (e.currentTarget.style.color = "#fff"); }}
             onMouseLeave={e => { (e.currentTarget.style.background = ""); (e.currentTarget.style.color = "#5A5A5A"); }}>
            <Icon icon="solar:arrow-right-up-bold" width={11} />Profile
          </a>
          <button className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold font-space bouncy"
                  style={{ color: "#5A5A5A" }}
                  onMouseEnter={e => { (e.currentTarget.style.background = "#EDE6D3"); (e.currentTarget.style.color = "#0D0D0D"); }}
                  onMouseLeave={e => { (e.currentTarget.style.background = ""); (e.currentTarget.style.color = "#5A5A5A"); }}>
            <Icon icon="solar:letter-bold" width={11} />Email
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ShortlistPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "outreach">("all");

  const filtered = MOCK_FACULTY.filter(f => {
    const matchSearch =
      search === "" ||
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.university.toLowerCase().includes(search.toLowerCase()) ||
      f.researchAreas.some(a => a.toLowerCase().includes(search.toLowerCase()));
    const matchFilter =
      filter === "all" ||
      (filter === "open" && f.openPositions === true) ||
      (filter === "outreach" && f.outreachStatus !== "none");
    return matchSearch && matchFilter;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#F7F0E3" }}>
      {/* Header */}
      <div className="px-6 py-4 shrink-0 bg-white" style={{ borderBottom: "2px solid #0D0D0D" }}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-sm font-semibold font-space flex items-center gap-2" style={{ color: "#0D0D0D" }}>
              <Icon icon="solar:star-bold" width={15} style={{ color: "#E8472A" }} />
              Faculty Shortlist
            </h1>
            <p className="text-xs font-dm mt-0.5" style={{ color: "#9CA3AF" }}>
              {MOCK_FACULTY.length} saved · {MOCK_FACULTY.filter(f => f.openPositions === true).length} open positions
            </p>
          </div>
          <button className="btn-coral btn-sm">
            <Icon icon="solar:add-circle-bold" width={14} />
            <span className="text-sm">Add Faculty</span>
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Icon icon="solar:magnifer-bold" width={13}
                  className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#B0A898" }} />
            <input type="text" placeholder="Search faculty, university, research area..."
                   value={search} onChange={e => setSearch(e.target.value)}
                   className="input-brutal pl-8 text-sm w-full" />
          </div>
          <div className="flex overflow-hidden" style={{ border: "2px solid #0D0D0D" }}>
            {(["all", "open", "outreach"] as const).map((f, i) => (
              <button key={f} onClick={() => setFilter(f)}
                      className={clsx("px-3 py-2 text-xs font-semibold font-space bouncy", i > 0 && "border-l-2")}
                      style={{
                        background: filter === f ? "#E8472A" : "#FFFFFF",
                        color: filter === f ? "#FFFFFF" : "#5A5A5A",
                        borderColor: "#0D0D0D",
                      }}>
                {f === "all" ? "All" : f === "open" ? "Open" : "Outreach"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Icon icon="solar:graduation-cap-bold" width={32} style={{ color: "#B0A898" }} className="mb-3" />
            <p className="font-semibold font-space" style={{ color: "#5A5A5A" }}>No faculty found</p>
            <p className="text-sm font-dm mt-1" style={{ color: "#9CA3AF" }}>Adjust search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(f => <FacultyCard key={f.id} faculty={f} />)}
          </div>
        )}

        <div className="mt-6 bg-white p-5 flex items-center justify-between"
             style={{ border: "2px solid #0D0D0D", boxShadow: "4px 4px 0 #0D0D0D" }}>
          <div>
            <p className="font-semibold font-space text-sm" style={{ color: "#0D0D0D" }}>Want more faculty matches?</p>
            <p className="text-xs font-dm mt-0.5" style={{ color: "#9CA3AF" }}>Paste program URLs in Agent Chat.</p>
          </div>
          <a href="/chat" className="btn-coral btn-sm ml-4 shrink-0">
            <span className="text-sm">Open Chat</span>
            <Icon icon="solar:alt-arrow-right-bold" width={13} />
          </a>
        </div>
      </div>
    </div>
  );
}
