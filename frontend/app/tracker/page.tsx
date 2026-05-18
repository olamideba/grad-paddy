"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
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
  notes?: string;
};

const APPS: Application[] = [
  {
    id: "a1", program: "PhD Computer Science", university: "MIT",
    deadline: new Date("2025-12-15"), status: "drafting",
    sop: "in-progress", cv: "ready", writingSample: "not-started",
    recommenders: [
      { name: "Dr. Ayo Olatunji", status: "confirmed" },
      { name: "Prof. S. Chen",    status: "asked" },
      { name: "Dr. R. Kim",       status: "not-asked" },
    ],
    funded: true,
  },
  {
    id: "a2", program: "PhD Computer Science (NLP)", university: "Stanford",
    deadline: new Date("2025-12-05"), status: "drafting",
    sop: "not-started", cv: "ready", writingSample: "not-started",
    recommenders: [
      { name: "Dr. Ayo Olatunji", status: "asked" },
      { name: "Prof. S. Chen",    status: "not-asked" },
      { name: "Dr. R. Kim",       status: "not-asked" },
    ],
    funded: true,
  },
  {
    id: "a3", program: "PhD Language Technologies", university: "CMU",
    deadline: new Date("2025-12-01"), status: "tracking",
    sop: "not-started", cv: "not-started", writingSample: "not-started",
    recommenders: [
      { name: "Dr. Ayo Olatunji", status: "not-asked" },
      { name: "Prof. S. Chen",    status: "not-asked" },
      { name: "Dr. R. Kim",       status: "not-asked" },
    ],
    funded: "unknown",
  },
  {
    id: "a4", program: "PhD Computer Science", university: "University of Washington",
    deadline: new Date("2026-01-10"), status: "tracking",
    sop: "not-started", cv: "ready", writingSample: "not-started",
    recommenders: [
      { name: "Dr. Ayo Olatunji", status: "not-asked" },
      { name: "Prof. S. Chen",    status: "not-asked" },
    ],
    funded: true,
    notes: "Noah Smith's lab — priority if CMU doesn't work out",
  },
];

function daysUntil(date: Date) {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function DeadlineBadge({ date }: { date: Date }) {
  const days = daysUntil(date);
  const formatted = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const urgent = days < 30;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-mono font-semibold" style={{ color: "#0D0D0D" }}>{formatted}</span>
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold font-space"
        style={urgent
          ? { background: "#E8472A", color: "#FFFFFF", border: "1.5px solid #0D0D0D" }
          : { background: "#EDE6D3", color: "#5A5A5A", border: "1.5px solid #0D0D0D" }
        }
      >
        <Icon icon="solar:clock-circle-bold" width={9} />
        {days}d left
      </span>
    </div>
  );
}

const STATUS_META: Record<AppStatus, { label: string; bg: string; color: string; border: string }> = {
  tracking:           { label: "Tracking",        bg: "#EDE6D3", color: "#5A5A5A",  border: "#0D0D0D" },
  drafting:           { label: "Drafting",         bg: "#E8472A", color: "#FFFFFF",  border: "#0D0D0D" },
  submitted:          { label: "Submitted",        bg: "#4ECDC4", color: "#0D0D0D",  border: "#0D0D0D" },
  "decision-pending": { label: "Decision Pending", bg: "#0D0D0D", color: "#FFFFFF",  border: "#0D0D0D" },
  accepted:           { label: "Accepted",         bg: "#4ECDC4", color: "#0D0D0D",  border: "#0D0D0D" },
  rejected:           { label: "Rejected",         bg: "#E8472A", color: "#FFFFFF",  border: "#0D0D0D" },
  waitlisted:         { label: "Waitlisted",       bg: "#F7F0E3", color: "#92400E",  border: "#D97706" },
};

const DOC_META: Record<DocStatus, { icon: string; color: string }> = {
  "not-started": { icon: "solar:circle-bold",         color: "#B0A898" },
  "in-progress": { icon: "solar:danger-triangle-bold", color: "#E8472A" },
  ready:         { icon: "solar:check-circle-bold",    color: "#4ECDC4" },
};

function DocCell({ status }: { status: DocStatus }) {
  const { icon, color } = DOC_META[status];
  return <Icon icon={icon} width={16} color={color} />;
}

const REC_STYLE: Record<RecommenderStatus, { bg: string; border: string }> = {
  "not-asked": { bg: "#EDE6D3", border: "#C8C0AF" },
  asked:       { bg: "#C8C0AF", border: "#9CA3AF" },
  confirmed:   { bg: "#5A5A5A", border: "#0D0D0D" },
  submitted:   { bg: "#0D0D0D", border: "#0D0D0D" },
};

function RecDots({ recommenders }: { recommenders: Application["recommenders"] }) {
  return (
    <div className="flex items-center gap-1">
      {recommenders.map((r, i) => (
        <div key={i} title={`${r.name}: ${r.status.replace("-", " ")}`}
             className="w-3 h-3"
             style={{ background: REC_STYLE[r.status].bg, border: `1px solid ${REC_STYLE[r.status].border}` }} />
      ))}
    </div>
  );
}

export default function TrackerPage() {
  const [sort, setSort] = useState<"deadline" | "status">("deadline");
  const sorted = [...APPS].sort((a, b) =>
    sort === "deadline" ? a.deadline.getTime() - b.deadline.getTime() : a.status.localeCompare(b.status)
  );
  const totalDue30 = APPS.filter(a => daysUntil(a.deadline) < 30).length;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#F7F0E3" }}>
      {/* Header */}
      <div className="px-6 py-4 shrink-0 bg-white" style={{ borderBottom: "2px solid #0D0D0D" }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold font-space flex items-center gap-2" style={{ color: "#0D0D0D" }}>
              <Icon icon="solar:calendar-bold" width={15} style={{ color: "#E8472A" }} />
              Application Tracker
            </h1>
            <p className="text-xs font-dm mt-0.5" style={{ color: "#9CA3AF" }}>
              {APPS.length} applications
              {totalDue30 > 0 && (
                <span style={{ color: "#E8472A" }}> · {totalDue30} deadline{totalDue30 > 1 ? "s" : ""} in &lt;30 days</span>
              )}
            </p>
          </div>
          <button className="btn-coral btn-sm">
            <Icon icon="solar:add-circle-bold" width={14} />
            <span className="text-sm">Add Application</span>
          </button>
        </div>

        <div className="mt-4 flex items-center gap-6 flex-wrap">
          {/* Legend */}
          <div className="flex items-center gap-3 text-xs font-dm" style={{ color: "#9CA3AF" }}>
            <span className="font-semibold font-space" style={{ color: "#5A5A5A" }}>Docs:</span>
            {(["not-started", "in-progress", "ready"] as DocStatus[]).map(s => {
              const { icon, color } = DOC_META[s];
              return (
                <div key={s} className="flex items-center gap-1">
                  <Icon icon={icon} width={12} color={color} />
                  <span>{s.replace(/-/g, " ")}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2 text-xs font-dm" style={{ color: "#9CA3AF" }}>
            <span className="font-semibold font-space" style={{ color: "#5A5A5A" }}>Recs:</span>
            {(["not-asked", "asked", "confirmed", "submitted"] as RecommenderStatus[]).map(s => (
              <div key={s} className="w-3 h-3" title={s.replace(/-/g, " ")}
                   style={{ background: REC_STYLE[s].bg, border: `1px solid ${REC_STYLE[s].border}` }} />
            ))}
          </div>
          {/* Sort */}
          <div className="ml-auto flex overflow-hidden" style={{ border: "2px solid #0D0D0D" }}>
            {(["deadline", "status"] as const).map((s, i) => (
              <button key={s} onClick={() => setSort(s)}
                      className={clsx("px-3 py-1.5 text-xs font-semibold font-space uppercase tracking-wide bouncy", i > 0 && "border-l-2")}
                      style={{
                        background: sort === s ? "#E8472A" : "#FFFFFF",
                        color: sort === s ? "#FFFFFF" : "#5A5A5A",
                        borderColor: "#0D0D0D",
                      }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="overflow-hidden" style={{ border: "2px solid #0D0D0D", boxShadow: "4px 4px 0 #0D0D0D" }}>
          <table className="table-brutal w-full">
            <thead>
              <tr>
                <th className="min-w-48">Program</th>
                <th className="min-w-36">Deadline</th>
                <th className="min-w-32">Status</th>
                <th className="text-center w-14" title="Statement of Purpose">SOP</th>
                <th className="text-center w-12" title="CV">CV</th>
                <th className="text-center w-16" title="Writing Sample">WS</th>
                <th className="min-w-28">Recs</th>
                <th className="w-20 text-center">Funded</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {sorted.map(app => {
                const { label, bg, color, border } = STATUS_META[app.status];
                return (
                  <tr key={app.id} className="group">
                    <td>
                      <div className="font-semibold text-sm font-space leading-tight" style={{ color: "#0D0D0D" }}>{app.university}</div>
                      <div className="text-xs font-dm mt-0.5" style={{ color: "#9CA3AF" }}>{app.program}</div>
                      {app.notes && <div className="text-xs font-dm mt-0.5 italic" style={{ color: "#5A5A5A" }}>{app.notes}</div>}
                    </td>
                    <td><DeadlineBadge date={app.deadline} /></td>
                    <td>
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold font-space"
                        style={{ background: bg, color, border: `1.5px solid ${border}` }}
                      >
                        {label}
                      </span>
                    </td>
                    <td className="text-center"><div className="flex justify-center"><DocCell status={app.sop} /></div></td>
                    <td className="text-center"><div className="flex justify-center"><DocCell status={app.cv} /></div></td>
                    <td className="text-center"><div className="flex justify-center"><DocCell status={app.writingSample} /></div></td>
                    <td>
                      <RecDots recommenders={app.recommenders} />
                      <div className="text-[10px] font-dm mt-0.5" style={{ color: "#9CA3AF" }}>
                        {app.recommenders.filter(r => r.status === "submitted").length}/{app.recommenders.length} submitted
                      </div>
                    </td>
                    <td className="text-center">
                      {app.funded === true  && <span className="badge-teal">Yes</span>}
                      {app.funded === false && <span className="badge-coral">No</span>}
                      {app.funded === "unknown" && <span className="badge-gray">?</span>}
                    </td>
                    <td>
                      <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bouncy"
                              style={{ border: "1.5px solid #0D0D0D", color: "#9CA3AF" }}
                              onMouseEnter={e => { (e.currentTarget.style.background = "#EDE6D3"); (e.currentTarget.style.color = "#0D0D0D"); }}
                              onMouseLeave={e => { (e.currentTarget.style.background = ""); (e.currentTarget.style.color = "#9CA3AF"); }}>
                        <Icon icon="solar:menu-dots-bold" width={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="mt-5 grid grid-cols-3 gap-4">
          {[
            { label: "SOP Ready",       value: `${APPS.filter(a => a.sop === "ready").length}/${APPS.length}` },
            { label: "Recs Confirmed",  value: `${APPS.flatMap(a => a.recommenders).filter(r => r.status === "confirmed" || r.status === "submitted").length}/${APPS.flatMap(a => a.recommenders).length}` },
            { label: "Funded Programs", value: `${APPS.filter(a => a.funded === true).length}/${APPS.length}` },
          ].map(({ label, value }) => (
            <div key={label} className="card-brutal p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider font-space" style={{ color: "#9CA3AF" }}>{label}</span>
              </div>
              <div className="text-2xl font-bold font-mono" style={{ color: "#0D0D0D" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
