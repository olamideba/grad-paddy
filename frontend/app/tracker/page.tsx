"use client";

import { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import type { Application as ApiApp, TrackerStats } from "@/lib/api";

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

function normalizeDocStatus(s: string): DocStatus {
  if (s === "ready") return "ready";
  if (s === "in_progress" || s === "in-progress") return "in-progress";
  return "not-started";
}

function normalizeRecStatus(s: string): RecommenderStatus {
  if (s === "asked") return "asked";
  if (s === "confirmed") return "confirmed";
  if (s === "submitted") return "submitted";
  return "not-asked";
}

function mapApp(a: ApiApp): Application {
  return {
    id: a.id,
    program: a.program,
    university: a.university,
    deadline: new Date(a.deadline),
    status: (a.status || "tracking") as AppStatus,
    sop: normalizeDocStatus(a.sop_status),
    cv: normalizeDocStatus(a.cv_status),
    writingSample: "not-started",
    recommenders: a.recommenders.map(r => ({ name: r.name, status: normalizeRecStatus(r.status) })),
    funded: a.funded === "yes" ? true : a.funded === "no" ? false : "unknown",
    notes: a.notes ?? undefined,
  };
}

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
        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold font-space w-fit"
        style={urgent
          ? { background: "#E8472A", color: "#FFFFFF", border: "1.5px solid #0D0D0D", borderRadius: "4px" }
          : { background: "#EDE6D3", color: "#5A5A5A", border: "1.5px solid #0D0D0D", borderRadius: "4px" }
        }
      >
        <Icon icon="solar:clock-circle-bold" width={9} />
        {days}d left
      </span>
    </div>
  );
}

const STATUS_META: Record<AppStatus, { label: string; bg: string; color: string; border: string }> = {
  tracking:           { label: "Tracking",         bg: "#EDE6D3", color: "#5A5A5A",  border: "#0D0D0D" },
  drafting:           { label: "Drafting",          bg: "#E8472A", color: "#FFFFFF",  border: "#0D0D0D" },
  submitted:          { label: "Submitted",         bg: "#4ECDC4", color: "#0D0D0D",  border: "#0D0D0D" },
  "decision-pending": { label: "Decision Pending",  bg: "#0D0D0D", color: "#FFFFFF",  border: "#0D0D0D" },
  accepted:           { label: "Accepted",          bg: "#4ECDC4", color: "#0D0D0D",  border: "#0D0D0D" },
  rejected:           { label: "Rejected",          bg: "#E8472A", color: "#FFFFFF",  border: "#0D0D0D" },
  waitlisted:         { label: "Waitlisted",        bg: "#F7F0E3", color: "#92400E",  border: "#D97706" },
};

const DOC_META: Record<DocStatus, { icon: string; color: string }> = {
  "not-started": { icon: "solar:circle-bold",          color: "#C8C0AF" },
  "in-progress": { icon: "solar:danger-triangle-bold",  color: "#E8472A" },
  ready:         { icon: "solar:check-circle-bold",     color: "#4ECDC4" },
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
        <div
          key={i}
          title={`${r.name}: ${r.status.replace(/-/g, " ")}`}
          className="w-3 h-3"
          style={{ background: REC_STYLE[r.status].bg, border: `1px solid ${REC_STYLE[r.status].border}`, borderRadius: "2px" }}
        />
      ))}
    </div>
  );
}

type SortKey = "program" | "deadline" | "status";
type SortDir = "asc" | "desc";

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <Icon
      icon={active && dir === "desc" ? "solar:alt-arrow-up-bold" : "solar:alt-arrow-down-bold"}
      width={10}
      style={{ color: active ? "#E8472A" : "#C8C0AF", marginLeft: 3, flexShrink: 0 }}
    />
  );
}

export default function TrackerPage() {
  const [apps, setApps]       = useState<Application[]>([]);
  const [stats, setStats]     = useState<TrackerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("deadline");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    import("@/lib/api").then(({ trackerApi }) =>
      Promise.all([trackerApi.list(), trackerApi.stats()])
        .then(([listRes, statsRes]) => {
          setApps(listRes.data.map(mapApp));
          setStats(statsRes.data);
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    );
  }, []);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  const sorted = [...apps].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "deadline") cmp = a.deadline.getTime() - b.deadline.getTime();
    else if (sortKey === "program") cmp = a.university.localeCompare(b.university);
    else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const totalDue30    = apps.filter(a => daysUntil(a.deadline) < 30).length;
  const totalDrafting = apps.filter(a => a.status === "drafting").length;

  const statCards = [
    {
      label: "SOP Ready",
      icon: "solar:document-text-bold",
      value: stats ? `${stats.sop_ready}/${stats.total}` : "—",
      accent: "#4ECDC4",
    },
    {
      label: "Recs Confirmed",
      icon: "solar:users-group-two-rounded-bold",
      value: stats ? `${stats.recs_confirmed}` : "—",
      accent: "#0D0D0D",
    },
    {
      label: "Funded Programs",
      icon: "solar:dollar-minimalistic-bold",
      value: stats ? `${stats.funded_programs}/${stats.total}` : "—",
      accent: "#E8472A",
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#F7F0E3" }}>
      {/* Header — black */}
      <div className="px-6 py-4 shrink-0" style={{ background: "#0D0D0D", borderBottom: "2px solid #E8472A" }}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-sm font-bold font-space flex items-center gap-2" style={{ color: "#FFFFFF" }}>
              <Icon icon="solar:calendar-bold" width={15} style={{ color: "#E8472A" }} />
              Application Tracker
            </h1>
            <p className="text-xs font-dm mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
              {loading ? "Loading…" : `${apps.length} applications · ${totalDrafting} drafting`}
              {!loading && totalDue30 > 0 && (
                <span style={{ color: "#E8472A" }}> · {totalDue30} deadline{totalDue30 > 1 ? "s" : ""} in &lt;30 days</span>
              )}
            </p>
          </div>
          <button className="btn-coral btn-sm">
            <Icon icon="solar:add-circle-bold" width={14} />
            <span className="text-sm">Add Application</span>
          </button>
        </div>
      </div>

      {/* Filter / legend bar */}
      <div className="px-6 py-3 shrink-0 flex items-center gap-6 flex-wrap" style={{ background: "#FFFFFF", borderBottom: "2px solid #0D0D0D" }}>
        <div className="flex items-center gap-3 text-xs font-dm" style={{ color: "#9CA3AF" }}>
          <span className="font-bold font-space text-[10px] uppercase tracking-wider" style={{ color: "#5A5A5A" }}>Docs</span>
          {(["not-started", "in-progress", "ready"] as DocStatus[]).map(s => {
            const { icon, color } = DOC_META[s];
            return (
              <div key={s} className="flex items-center gap-1">
                <Icon icon={icon} width={12} color={color} />
                <span className="text-[10px]">{s.replace(/-/g, " ")}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2 text-xs font-dm" style={{ color: "#9CA3AF" }}>
          <span className="font-bold font-space text-[10px] uppercase tracking-wider" style={{ color: "#5A5A5A" }}>Recs</span>
          {(["not-asked", "asked", "confirmed", "submitted"] as RecommenderStatus[]).map(s => (
            <div key={s} className="flex items-center gap-1">
              <div className="w-3 h-3" title={s.replace(/-/g, " ")}
                   style={{ background: REC_STYLE[s].bg, border: `1px solid ${REC_STYLE[s].border}`, borderRadius: "2px" }} />
              <span className="text-[10px]">{s.replace(/-/g, " ")}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Summary stat cards */}
        <div className="grid grid-cols-3 gap-4 mb-5">
          {statCards.map(({ label, icon, value, accent }) => (
            <div
              key={label}
              className="p-4 flex items-center gap-4"
              style={{ background: "#FFFFFF", border: "2px solid #0D0D0D", boxShadow: "3px 3px 0 #0D0D0D", borderRadius: "4px" }}
            >
              <div
                className="w-10 h-10 flex items-center justify-center flex-shrink-0"
                style={{ background: accent, border: "2px solid #0D0D0D", borderRadius: "4px" }}
              >
                <Icon icon={icon} width={18} style={{ color: accent === "#0D0D0D" ? "#FFFFFF" : "#0D0D0D" }} />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono leading-none" style={{ color: "#0D0D0D" }}>{value}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider font-space mt-1" style={{ color: "#9CA3AF" }}>{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" style={{ color: "#E8472A" }} />
          </div>
        ) : apps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Icon icon="solar:calendar-bold" width={32} style={{ color: "#B0A898" }} className="mb-3" />
            <p className="font-semibold font-space" style={{ color: "#5A5A5A" }}>No applications yet</p>
            <p className="text-sm font-dm mt-1" style={{ color: "#9CA3AF" }}>Add your first application above</p>
          </div>
        ) : (
          <div className="overflow-hidden" style={{ border: "2px solid #0D0D0D", boxShadow: "4px 4px 0 #0D0D0D", borderRadius: "4px" }}>
            <table className="table-brutal w-full">
              <thead>
                <tr>
                  <th className="min-w-48 cursor-pointer select-none" onClick={() => toggleSort("program")}>
                    <span className="inline-flex items-center">Program<SortArrow active={sortKey === "program"} dir={sortDir} /></span>
                  </th>
                  <th className="min-w-36 cursor-pointer select-none" onClick={() => toggleSort("deadline")}>
                    <span className="inline-flex items-center">Deadline<SortArrow active={sortKey === "deadline"} dir={sortDir} /></span>
                  </th>
                  <th className="min-w-36 cursor-pointer select-none" onClick={() => toggleSort("status")}>
                    <span className="inline-flex items-center">Status<SortArrow active={sortKey === "status"} dir={sortDir} /></span>
                  </th>
                  <th className="text-center w-14" title="Statement of Purpose">SOP</th>
                  <th className="text-center w-12" title="CV / Resume">CV</th>
                  <th className="text-center w-16" title="Writing Sample">WS</th>
                  <th className="min-w-32">Recommenders</th>
                  <th className="w-20 text-center">Funded</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {sorted.map(app => {
                  const meta = STATUS_META[app.status] ?? STATUS_META.tracking;
                  const urgent = daysUntil(app.deadline) < 30;
                  return (
                    <tr
                      key={app.id}
                      className="group"
                      style={urgent ? { borderLeft: "3px solid #E8472A" } : {}}
                    >
                      <td>
                        <div className="font-bold text-sm font-space leading-tight" style={{ color: "#0D0D0D" }}>{app.university}</div>
                        <div className="text-xs font-dm mt-0.5" style={{ color: "#9CA3AF" }}>{app.program}</div>
                        {app.notes && <div className="text-xs font-dm mt-1 italic" style={{ color: "#5A5A5A" }}>{app.notes}</div>}
                      </td>
                      <td><DeadlineBadge date={app.deadline} /></td>
                      <td>
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 text-xs font-bold font-space"
                          style={{ background: meta.bg, color: meta.color, border: `1.5px solid ${meta.border}`, borderRadius: "4px" }}
                        >
                          {meta.label}
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
                        {app.funded === true    && <span className="badge-teal">Yes</span>}
                        {app.funded === false   && <span className="badge-coral">No</span>}
                        {app.funded === "unknown" && <span className="badge-gray">?</span>}
                      </td>
                      <td>
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bouncy"
                          style={{ border: "1.5px solid #0D0D0D", color: "#9CA3AF", borderRadius: "4px" }}
                          onMouseEnter={e => { (e.currentTarget.style.background = "#EDE6D3"); (e.currentTarget.style.color = "#0D0D0D"); }}
                          onMouseLeave={e => { (e.currentTarget.style.background = ""); (e.currentTarget.style.color = "#9CA3AF"); }}
                        >
                          <Icon icon="solar:menu-dots-bold" width={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
