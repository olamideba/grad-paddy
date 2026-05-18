"use client";

import { useState } from "react";
import {
  CalendarDays,
  Plus,
  CheckCircle2,
  Circle,
  AlertCircle,
  Clock,
  FileText,
  Users,
  ExternalLink,
  ChevronDown,
  MoreHorizontal,
} from "lucide-react";
import clsx from "clsx";

type DocStatus = "not-started" | "in-progress" | "ready";
type AppStatus = "tracking" | "drafting" | "submitted" | "decision-pending" | "accepted" | "rejected" | "waitlisted";
type RecommenderStatus = "not-asked" | "asked" | "confirmed" | "submitted";

type Application = {
  id: string;
  program: string;
  university: string;
  deadline: Date;
  status: AppStatus;
  sop: DocStatus;
  cv: DocStatus;
  writingSample: DocStatus;
  recommenders: Array<{ name: string; status: RecommenderStatus }>;
  funded: boolean | "unknown";
  gre: boolean;
  notes?: string;
};

const APPS: Application[] = [
  {
    id: "a1",
    program: "PhD Computer Science",
    university: "MIT",
    deadline: new Date("2025-12-15"),
    status: "drafting",
    sop: "in-progress",
    cv: "ready",
    writingSample: "not-started",
    recommenders: [
      { name: "Dr. Ayo Olatunji", status: "confirmed" },
      { name: "Prof. S. Chen", status: "asked" },
      { name: "Dr. R. Kim", status: "not-asked" },
    ],
    funded: true,
    gre: false,
  },
  {
    id: "a2",
    program: "PhD Computer Science (NLP)",
    university: "Stanford",
    deadline: new Date("2025-12-05"),
    status: "drafting",
    sop: "not-started",
    cv: "ready",
    writingSample: "not-started",
    recommenders: [
      { name: "Dr. Ayo Olatunji", status: "asked" },
      { name: "Prof. S. Chen", status: "not-asked" },
      { name: "Dr. R. Kim", status: "not-asked" },
    ],
    funded: true,
    gre: false,
  },
  {
    id: "a3",
    program: "PhD Language Technologies",
    university: "CMU",
    deadline: new Date("2025-12-01"),
    status: "tracking",
    sop: "not-started",
    cv: "not-started",
    writingSample: "not-started",
    recommenders: [
      { name: "Dr. Ayo Olatunji", status: "not-asked" },
      { name: "Prof. S. Chen", status: "not-asked" },
      { name: "Dr. R. Kim", status: "not-asked" },
    ],
    funded: "unknown",
    gre: false,
  },
  {
    id: "a4",
    program: "PhD Computer Science",
    university: "University of Washington",
    deadline: new Date("2026-01-10"),
    status: "tracking",
    sop: "not-started",
    cv: "ready",
    writingSample: "not-started",
    recommenders: [
      { name: "Dr. Ayo Olatunji", status: "not-asked" },
      { name: "Prof. S. Chen", status: "not-asked" },
    ],
    funded: true,
    gre: false,
    notes: "Noah Smith's lab — priority if CMU doesn't work out",
  },
];

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function DeadlineBadge({ date }: { date: Date }) {
  const days = daysUntil(date);
  const formatted = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const urgency =
    days < 30
      ? { bg: "bg-red-paddy", text: "text-white", label: `${days}d left` }
      : days < 60
      ? { bg: "bg-violet-paddy", text: "text-white", label: `${days}d left` }
      : { bg: "bg-surface-3", text: "text-fg", label: `${days}d left` };

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-mono font-bold text-fg">{formatted}</span>
      <span
        className={clsx(
          "text-xs font-black font-grotesk px-1.5 py-0.5 border border-border-bright inline-flex items-center gap-1",
          urgency.bg,
          urgency.text
        )}
      >
        <Clock size={10} strokeWidth={2.5} />
        {urgency.label}
      </span>
    </div>
  );
}

const STATUS_CONFIG: Record<AppStatus, { label: string; bg: string; text: string }> = {
  tracking: { label: "Tracking", bg: "bg-surface-2", text: "text-fg" },
  drafting: { label: "Drafting", bg: "bg-violet-paddy/20", text: "text-fg" },
  submitted: { label: "Submitted", bg: "bg-green-paddy", text: "text-midnight" },
  "decision-pending": { label: "Decision Pending", bg: "bg-violet-paddy", text: "text-white" },
  accepted: { label: "Accepted", bg: "bg-green-paddy", text: "text-midnight" },
  rejected: { label: "Rejected", bg: "bg-red-paddy/20", text: "text-fg" },
  waitlisted: { label: "Waitlisted", bg: "bg-orange-paddy/30", text: "text-fg" },
};

const DOC_CONFIG: Record<DocStatus, { icon: React.ElementType; color: string }> = {
  "not-started": { icon: Circle, color: "text-fg-muted" },
  "in-progress": { icon: AlertCircle, color: "text-violet-light" },
  ready: { icon: CheckCircle2, color: "text-green-paddy" },
};

function DocCell({ status }: { status: DocStatus }) {
  const { icon: Icon, color } = DOC_CONFIG[status];
  return <Icon size={16} strokeWidth={2} className={color} />;
}

const REC_CONFIG: Record<RecommenderStatus, { color: string; label: string }> = {
  "not-asked": { color: "bg-surface-2 border-border", label: "·" },
  asked: { color: "bg-violet-paddy border-border-bright", label: "?" },
  confirmed: { color: "bg-violet-paddy/30 border-border-bright", label: "✓" },
  submitted: { color: "bg-green-paddy border-border-bright", label: "✓" },
};

function RecDots({ recommenders }: { recommenders: Application["recommenders"] }) {
  return (
    <div className="flex items-center gap-1">
      {recommenders.map((r, i) => {
        const { color } = REC_CONFIG[r.status];
        return (
          <div
            key={i}
            title={`${r.name}: ${r.status.replace("-", " ")}`}
            className={clsx("w-4 h-4 border-2 rounded-none", color)}
          />
        );
      })}
    </div>
  );
}

export default function TrackerPage() {
  const [sort, setSort] = useState<"deadline" | "status">("deadline");
  const sorted = [...APPS].sort((a, b) => {
    if (sort === "deadline") return a.deadline.getTime() - b.deadline.getTime();
    return a.status.localeCompare(b.status);
  });

  const totalDue30 = APPS.filter((a) => daysUntil(a.deadline) < 30).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b-3 border-border-bright flex-shrink-0" style={{ background: "var(--surface)" }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight font-grotesk flex items-center gap-2">
              <CalendarDays size={18} strokeWidth={2.5} />
              Application Tracker
            </h1>
            <p className="text-xs font-grotesk text-fg-muted">
              {APPS.length} applications · {totalDue30 > 0 && (
                <span className="text-red-paddy font-bold">
                  {totalDue30} deadline{totalDue30 > 1 ? "s" : ""} in &lt;30 days
                </span>
              )}
            </p>
          </div>
          <button className="btn-yellow gap-2">
            <Plus size={15} strokeWidth={2.5} />
            <span className="text-sm font-bold">Add Application</span>
          </button>
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-fg-muted font-grotesk">Docs:</span>
            {(["not-started", "in-progress", "ready"] as DocStatus[]).map((s) => {
              const { icon: Icon, color } = DOC_CONFIG[s];
              return (
                <div key={s} className="flex items-center gap-1">
                  <Icon size={13} className={color} />
                  <span className="text-xs font-grotesk text-fg-muted">{s.replace("-", " ")}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-fg-muted font-grotesk">Recs:</span>
            <div className="w-4 h-4 border-2 border-border bg-surface-2" title="Not asked" />
            <div className="w-4 h-4 border-2 border-border-bright bg-violet-paddy" title="Asked" />
            <div className="w-4 h-4 border-2 border-border-bright bg-violet-paddy/30" title="Confirmed" />
            <div className="w-4 h-4 border-2 border-border-bright bg-green-paddy" title="Submitted" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs font-grotesk text-fg-muted">Sort:</span>
            <button
              onClick={() => setSort("deadline")}
              className={clsx(
                "text-xs font-bold px-2 py-1 border-2 border-border-bright transition-colors",
                sort === "deadline" ? "bg-violet-paddy text-white" : "bg-surface-2 text-fg hover:bg-violet-paddy/30"
              )}
            >
              Deadline
            </button>
            <button
              onClick={() => setSort("status")}
              className={clsx(
                "text-xs font-bold px-2 py-1 border-2 border-border-bright transition-colors",
                sort === "status" ? "bg-violet-paddy text-white" : "bg-surface-2 text-fg hover:bg-violet-paddy/30"
              )}
            >
              Status
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        <table className="table-brutal w-full">
          <thead>
            <tr>
              <th className="min-w-48">Program</th>
              <th className="min-w-36">Deadline</th>
              <th className="min-w-32">Status</th>
              <th className="text-center w-16" title="Statement of Purpose">SOP</th>
              <th className="text-center w-12" title="CV">CV</th>
              <th className="text-center w-20" title="Writing Sample">WS</th>
              <th className="min-w-28">Recommenders</th>
              <th className="w-20 text-center">Funded</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((app) => {
              const { label, bg, text } = STATUS_CONFIG[app.status];
              return (
                <tr key={app.id} className="group">
                  <td>
                    <div>
                      <div className="font-bold text-sm font-grotesk leading-tight">
                        {app.university}
                      </div>
                      <div className="text-xs text-fg-muted font-grotesk">
                        {app.program}
                      </div>
                      {app.notes && (
                        <div className="text-xs text-violet-light font-grotesk mt-0.5 italic">
                          {app.notes}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <DeadlineBadge date={app.deadline} />
                  </td>
                  <td>
                    <span
                      className={clsx(
                        "badge-brutal text-xs",
                        bg,
                        text
                      )}
                    >
                      {label}
                    </span>
                  </td>
                  <td className="text-center">
                    <div className="flex items-center justify-center">
                      <DocCell status={app.sop} />
                    </div>
                  </td>
                  <td className="text-center">
                    <div className="flex items-center justify-center">
                      <DocCell status={app.cv} />
                    </div>
                  </td>
                  <td className="text-center">
                    <div className="flex items-center justify-center">
                      <DocCell status={app.writingSample} />
                    </div>
                  </td>
                  <td>
                    <RecDots recommenders={app.recommenders} />
                    <div className="text-xs font-grotesk text-fg-muted mt-0.5">
                      {app.recommenders.filter((r) => r.status === "submitted").length}/
                      {app.recommenders.length} submitted
                    </div>
                  </td>
                  <td className="text-center">
                    {app.funded === true && (
                      <span className="badge-brutal bg-green-paddy text-midnight text-xs">Yes</span>
                    )}
                    {app.funded === false && (
                      <span className="badge-brutal bg-red-paddy/20 text-fg text-xs">No</span>
                    )}
                    {app.funded === "unknown" && (
                      <span className="badge-brutal bg-surface-3 text-fg-muted text-xs">?</span>
                    )}
                  </td>
                  <td>
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 border border-border hover:border-border-bright hover:bg-violet-paddy/20">
                      <MoreHorizontal size={14} strokeWidth={2} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Summary footer */}
        <div className="mt-4 grid grid-cols-3 gap-4">
          {[
            {
              label: "SOP Ready",
              value: `${APPS.filter((a) => a.sop === "ready").length}/${APPS.length}`,
              color: "bg-green-paddy",
            },
            {
              label: "Recs Confirmed",
              value: `${APPS.flatMap((a) => a.recommenders).filter((r) => r.status === "confirmed" || r.status === "submitted").length}/${APPS.flatMap((a) => a.recommenders).length}`,
              color: "bg-violet-paddy/30",
            },
            {
              label: "Funded Programs",
              value: `${APPS.filter((a) => a.funded === true).length}/${APPS.length}`,
              color: "bg-violet-paddy",
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="border-3 border-border-bright p-4 bg-surface-2"
              style={{ boxShadow: "3px 3px 0 #7C3AED" }}
            >
              <div className="flex items-end justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-fg-muted font-grotesk">
                  {label}
                </span>
                <div className={clsx("w-3 h-3 border-2 border-border-bright", color)} />
              </div>
              <div className="text-2xl font-black font-mono text-fg mt-1">
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
