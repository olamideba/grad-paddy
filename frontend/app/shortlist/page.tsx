"use client";

import { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import clsx from "clsx";
import type { Faculty as ApiFaculty, ShortlistStats } from "@/lib/api";

type OutreachStatus = "none" | "drafted" | "sent" | "responded";
type PositionStatus = boolean | "unknown";

type Faculty = {
  id: string;
  name: string;
  university: string;
  department: string;
  researchAreas: string[];
  fitScore: number;
  researchSummary: string;
  profileUrl: string | null;
  openPositions: PositionStatus;
  outreachStatus: OutreachStatus;
};

function mapOutreachStatus(s: string): OutreachStatus {
  if (s === "drafted") return "drafted";
  if (s === "sent" || s === "emailed") return "sent";
  if (s === "responded" || s === "replied") return "responded";
  return "none";
}

function mapPositionStatus(s: string): PositionStatus {
  if (s === "open") return true;
  if (s === "closed") return false;
  return "unknown";
}

function mapFaculty(a: ApiFaculty): Faculty {
  const areas = a.research_summary
    ? a.research_summary.split(/[,\n]/).map(t => t.trim()).filter(Boolean).slice(0, 5)
    : [];
  return {
    id: a.id,
    name: a.name,
    university: a.university,
    department: a.department,
    researchAreas: areas,
    fitScore: Math.round(a.fit_score),
    researchSummary: a.research_summary ?? "",
    profileUrl: a.webpage,
    openPositions: mapPositionStatus(a.position_status),
    outreachStatus: mapOutreachStatus(a.outreach_status),
  };
}

const OUTREACH_META: Record<OutreachStatus, { label: string; bg: string; color: string }> = {
  none:      { label: "No outreach", bg: "#EDE6D3", color: "#5A5A5A" },
  drafted:   { label: "Draft ready", bg: "#F7F0E3", color: "#0D0D0D" },
  sent:      { label: "Email sent",  bg: "#0D0D0D", color: "#FFFFFF" },
  responded: { label: "Responded",   bg: "#4ECDC4", color: "#0D0D0D" },
};

function ScoreBadge({ score }: { score: number }) {
  const bg    = score >= 85 ? "#4ECDC4" : score >= 70 ? "#0D0D0D" : "#B0A898";
  const color = score >= 85 ? "#0D0D0D" : "#FFFFFF";
  return (
    <div
      className="flex-shrink-0 flex items-center justify-center"
      style={{ width: 48, height: 48, background: bg, border: "2px solid #0D0D0D", borderRadius: "4px" }}
    >
      <span className="font-space font-bold text-base leading-none" style={{ color }}>{score}</span>
    </div>
  );
}

function PositionBadge({ status }: { status: PositionStatus }) {
  if (status === true)  return <span className="badge-teal">Open</span>;
  if (status === false) return <span className="badge-coral">Closed</span>;
  return <span className="badge-gray">?</span>;
}

function FitBar({ score }: { score: number }) {
  const fill = score >= 85 ? "#4ECDC4" : score >= 70 ? "#0D0D0D" : "#B0A898";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 overflow-hidden" style={{ background: "#EDE6D3", border: "1px solid #C8C0AF", borderRadius: "2px" }}>
        <div className="h-full" style={{ width: `${score}%`, background: fill, borderRadius: "2px" }} />
      </div>
    </div>
  );
}

function FacultyCard({ faculty }: { faculty: Faculty }) {
  const outreach = OUTREACH_META[faculty.outreachStatus];
  return (
    <div className="card-brutal flex flex-col overflow-hidden p-0">
      {/* Header */}
      <div className="p-4 flex gap-3" style={{ borderBottom: "2px solid #0D0D0D" }}>
        <ScoreBadge score={faculty.fitScore} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <h3 className="font-bold text-sm font-space leading-tight" style={{ color: "#0D0D0D" }}>
              {faculty.name}
            </h3>
            <button
              className="bouncy shrink-0 p-1"
              style={{ color: "#C8C0AF", border: "1.5px solid transparent", borderRadius: "4px" }}
              onMouseEnter={e => { (e.currentTarget.style.color = "#E8472A"); (e.currentTarget.style.borderColor = "#0D0D0D"); (e.currentTarget.style.background = "#FFF0ED"); }}
              onMouseLeave={e => { (e.currentTarget.style.color = "#C8C0AF"); (e.currentTarget.style.borderColor = "transparent"); (e.currentTarget.style.background = ""); }}
            >
              <Icon icon="solar:trash-bin-trash-bold" width={12} />
            </button>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className="text-[10px] font-bold font-space px-1.5 py-0.5"
              style={{ background: "#0D0D0D", color: "#FFFFFF", borderRadius: "3px" }}
            >
              {faculty.university}
            </span>
            <span className="text-[10px] font-dm truncate" style={{ color: "#9CA3AF" }}>{faculty.department}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <PositionBadge status={faculty.openPositions} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col gap-3">
        {faculty.researchAreas.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {faculty.researchAreas.map(area => (
              <span
                key={area}
                className="text-[10px] px-2 py-0.5 font-dm"
                style={{ background: "#F7F0E3", border: "1.5px solid #C8C0AF", color: "#5A5A5A", borderRadius: "4px" }}
              >
                {area}
              </span>
            ))}
          </div>
        )}

        {/* Fit bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider font-space" style={{ color: "#9CA3AF" }}>Research Fit</span>
            <span className="text-[10px] font-bold font-mono" style={{ color: "#0D0D0D" }}>{faculty.fitScore}%</span>
          </div>
          <FitBar score={faculty.fitScore} />
        </div>

        {/* Research summary */}
        {faculty.researchSummary && (
          <div className="flex items-start gap-2 pt-3" style={{ borderTop: "1px solid #EDE6D3" }}>
            <Icon icon="solar:document-text-bold" width={11} className="shrink-0 mt-0.5" style={{ color: "#C8C0AF" }} />
            <p className="text-[11px] font-dm leading-snug line-clamp-2" style={{ color: "#9CA3AF" }}>{faculty.researchSummary}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex" style={{ borderTop: "2px solid #0D0D0D", borderRadius: "0 0 4px 4px", overflow: "hidden" }}>
        <div
          className="px-3 py-2 shrink-0 flex items-center"
          style={{ background: outreach.bg, borderRight: "2px solid #0D0D0D" }}
        >
          <span className="text-[10px] font-bold font-space whitespace-nowrap" style={{ color: outreach.color }}>
            {outreach.label}
          </span>
        </div>
        <div className="flex flex-1">
          {faculty.profileUrl ? (
            <a
              href={faculty.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-semibold font-space bouncy"
              style={{ color: "#5A5A5A", borderRight: "1px solid #EDE6D3" }}
              onMouseEnter={e => { (e.currentTarget.style.background = "#0D0D0D"); (e.currentTarget.style.color = "#fff"); }}
              onMouseLeave={e => { (e.currentTarget.style.background = ""); (e.currentTarget.style.color = "#5A5A5A"); }}
            >
              <Icon icon="solar:arrow-right-up-bold" width={10} />Profile
            </a>
          ) : (
            <span className="flex-1 flex items-center justify-center py-2 text-[11px] font-space"
                  style={{ color: "#C8C0AF", borderRight: "1px solid #EDE6D3" }}>
              No link
            </span>
          )}
          <button
            className="flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-semibold font-space bouncy"
            style={{ color: "#5A5A5A" }}
            onMouseEnter={e => { (e.currentTarget.style.background = "#EDE6D3"); (e.currentTarget.style.color = "#0D0D0D"); }}
            onMouseLeave={e => { (e.currentTarget.style.background = ""); (e.currentTarget.style.color = "#5A5A5A"); }}
          >
            <Icon icon="solar:letter-bold" width={10} />Email
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ShortlistPage() {
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [stats, setStats]     = useState<ShortlistStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState<"all" | "open" | "outreach">("all");

  useEffect(() => {
    import("@/lib/api").then(({ shortlistApi }) =>
      Promise.all([shortlistApi.list(), shortlistApi.stats()])
        .then(([listRes, statsRes]) => {
          setFaculty(listRes.data.map(mapFaculty));
          setStats(statsRes.data);
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    );
  }, []);

  const filtered = faculty.filter(f => {
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
      {/* Header — black */}
      <div className="px-6 py-4 shrink-0" style={{ background: "#0D0D0D", borderBottom: "2px solid #E8472A" }}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-sm font-bold font-space flex items-center gap-2" style={{ color: "#FFFFFF" }}>
              <Icon icon="solar:star-bold" width={15} style={{ color: "#E8472A" }} />
              Faculty Shortlist
            </h1>
            <p className="text-xs font-dm mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
              {loading ? "Loading…" : stats
                ? `${stats.total} saved · ${stats.open_positions} open positions · ${stats.contacted} contacted`
                : `${faculty.length} saved`}
            </p>
          </div>
          <button className="btn-coral btn-sm">
            <Icon icon="solar:add-circle-bold" width={14} />
            <span className="text-sm">Add Faculty</span>
          </button>
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="px-6 py-3 shrink-0 flex items-center gap-3 flex-wrap" style={{ background: "#FFFFFF", borderBottom: "2px solid #0D0D0D" }}>
        <div className="relative flex-1 min-w-48">
          <Icon icon="solar:magnifer-bold" width={13}
                className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#B0A898" }} />
          <input
            type="text"
            placeholder="Search faculty, university, research area..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-brutal pl-8 text-sm w-full"
          />
        </div>
        <div className="flex overflow-hidden" style={{ border: "2px solid #0D0D0D", borderRadius: "4px" }}>
          {(["all", "open", "outreach"] as const).map((f, i) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx("px-3 py-2 text-xs font-semibold font-space bouncy", i > 0 && "border-l-2")}
              style={{
                background: filter === f ? "#E8472A" : "#FFFFFF",
                color: filter === f ? "#FFFFFF" : "#5A5A5A",
                borderColor: "#0D0D0D",
              }}
            >
              {f === "all" ? "All" : f === "open" ? "Open Positions" : "Outreach"}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" style={{ color: "#E8472A" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Icon icon="solar:graduation-cap-bold" width={32} style={{ color: "#B0A898" }} className="mb-3" />
            <p className="font-semibold font-space" style={{ color: "#5A5A5A" }}>
              {faculty.length === 0 ? "No faculty saved yet" : "No faculty found"}
            </p>
            <p className="text-sm font-dm mt-1" style={{ color: "#9CA3AF" }}>
              {faculty.length === 0 ? "Ask the agent to find professors matching your interests" : "Adjust search or filters"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(f => <FacultyCard key={f.id} faculty={f} />)}
          </div>
        )}

        {/* CTA */}
        <div
          className="mt-6 p-5 flex items-center justify-between"
          style={{ background: "#FFFFFF", border: "2px solid #0D0D0D", boxShadow: "4px 4px 0 #0D0D0D", borderRadius: "4px" }}
        >
          <div>
            <p className="font-bold font-space text-sm" style={{ color: "#0D0D0D" }}>Want more faculty matches?</p>
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
