"use client";

import { useState, useEffect, useRef } from "react";
import { Icon } from "@iconify/react";
import { Star, Plus, Search, ExternalLink, Mail, Trash2, MessageSquare } from "lucide-react";
import clsx from "clsx";
import type { Faculty as ApiFaculty, ShortlistStats } from "../../lib/api";
import { SkeletonCardGrid } from "@/components/Skeleton";
import { NeoButton, StatusPill } from "@/components/Neo";

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
    ? a.research_summary
        .split(/[,\n]/)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 5)
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
  none: { label: "No outreach", bg: "#EDE6D3", color: "#5A5A5A" },
  drafted: { label: "Draft ready", bg: "#F7F0E3", color: "#0D0D0D" },
  sent: { label: "Email sent", bg: "#0D0D0D", color: "#FFFFFF" },
  responded: { label: "Responded", bg: "#4ECDC4", color: "#0D0D0D" },
};

function initials(name: string): string {
  return (
    name
      .replace(/^(prof\.?|dr\.?)\s+/i, "")
      .split(/\s+/)
      .map((w) => w.charAt(0))
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

function FacultyCard({ faculty }: { faculty: Faculty }) {
  const outreach = OUTREACH_META[faculty.outreachStatus];
  const contacted = faculty.outreachStatus !== "none";
  const open = faculty.openPositions === true;
  const positionLabel =
    faculty.openPositions === true
      ? "Open"
      : faculty.openPositions === false
        ? "Closed"
        : "Unknown";
  return (
    <article className="neo-card flex flex-col">
      {/* Header */}
      <div className="p-4 border-b-2 border-ink flex gap-4">
        <div className="size-16 shrink-0 bg-accent-yellow border-2 border-ink grid place-items-center font-bold text-xl font-mono">
          {initials(faculty.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-lg leading-tight truncate">{faculty.name}</h3>
            <button
              title="Remove"
              className="size-7 grid place-items-center border-2 border-ink hover:bg-accent-orange hover:text-white transition-colors shrink-0"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusPill tone="ink">{faculty.university}</StatusPill>
            <StatusPill tone="muted">{faculty.department}</StatusPill>
          </div>
          <div className="mt-2">
            <StatusPill tone={open ? "teal" : "muted"}>{positionLabel}</StatusPill>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="p-4 text-sm text-muted-foreground leading-relaxed flex-1">
        {faculty.researchSummary || "No research summary yet."}
      </div>

      {/* Research fit */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between text-[11px] tracking-[0.18em] font-bold mb-1.5">
          <span>RESEARCH FIT</span>
          <span className="font-mono text-base text-ink">{faculty.fitScore}%</span>
        </div>
        <div className="h-3 border-2 border-ink bg-paper overflow-hidden">
          <div
            className="h-full bg-accent-orange border-r-2 border-ink"
            style={{ width: `${faculty.fitScore}%` }}
          />
        </div>
      </div>

      {/* Footer actions */}
      <div className="grid grid-cols-3 border-t-2 border-ink divide-x-2 divide-ink">
        <div
          className={clsx(
            "py-2.5 px-1 text-xs font-bold flex items-center justify-center gap-1.5 text-center",
            contacted ? "bg-accent-teal" : "bg-paper text-muted-foreground"
          )}
        >
          {outreach.label}
        </div>
        {faculty.profileUrl ? (
          <a
            href={faculty.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-paper transition-colors"
          >
            <ExternalLink className="size-3.5" /> Page
          </a>
        ) : (
          <span className="py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 text-muted-foreground">
            <ExternalLink className="size-3.5" /> Page
          </span>
        )}
        <a
          href="/chat"
          className="py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-accent-orange hover:text-white transition-colors"
        >
          <Mail className="size-3.5" /> Email
        </a>
      </div>
    </article>
  );
}

type AddFacultyForm = {
  name: string;
  university: string;
  department: string;
  email: string;
  webpage: string;
  research_summary: string;
  fit_score: string;
  position_status: string;
};

const EMPTY_FORM: AddFacultyForm = {
  name: "",
  university: "",
  department: "",
  email: "",
  webpage: "",
  research_summary: "",
  fit_score: "50",
  position_status: "unknown",
};

function AddFacultyModal({ onClose, onAdd }: { onClose: () => void; onAdd: (f: Faculty) => void }) {
  const [form, setForm] = useState<AddFacultyForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  function set(key: keyof AddFacultyForm, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.university.trim() || !form.department.trim()) {
      setError("Name, university, and department are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { shortlistApi } = await import("../../lib/api");
      const res = await shortlistApi.add({
        name: form.name.trim(),
        university: form.university.trim(),
        department: form.department.trim(),
        ...(form.email.trim() && { email: form.email.trim() }),
        ...(form.webpage.trim() && { webpage: form.webpage.trim() }),
        ...(form.research_summary.trim() && { research_summary: form.research_summary.trim() }),
        fit_score: Number(form.fit_score) || 50,
        position_status: form.position_status,
      });
      onAdd(mapFaculty(res.data));
      onClose();
    } catch {
      setError("Failed to add faculty. Try again.");
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
        className="w-full max-w-md flex flex-col"
        style={{
          background: "#F7F0E3",
          border: "2px solid #0D0D0D",
          boxShadow: "6px 6px 0 #0D0D0D",
          borderRadius: "4px",
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ background: "#0D0D0D", borderRadius: "2px 2px 0 0" }}
        >
          <span className="font-bold font-space text-sm" style={{ color: "#FFFFFF" }}>
            Add Faculty
          </span>
          <button onClick={onClose} className="bouncy" style={{ color: "rgba(255,255,255,0.5)" }}>
            <Icon icon="solar:close-circle-bold" width={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3">
          {(["name", "university", "department"] as const).map((key) => (
            <div key={key}>
              <label
                className="block text-[11px] font-bold font-space uppercase tracking-wider mb-1"
                style={{ color: "#5A5A5A" }}
              >
                {key} <span style={{ color: "#E8472A" }}>*</span>
              </label>
              <input
                ref={key === "name" ? firstRef : undefined}
                type="text"
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
                className="input-brutal w-full text-sm"
                placeholder={
                  key === "name"
                    ? "Prof. Jane Smith"
                    : key === "university"
                      ? "MIT"
                      : "Computer Science"
                }
              />
            </div>
          ))}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                className="block text-[11px] font-bold font-space uppercase tracking-wider mb-1"
                style={{ color: "#5A5A5A" }}
              >
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                className="input-brutal w-full text-sm"
                placeholder="prof@mit.edu"
              />
            </div>
            <div>
              <label
                className="block text-[11px] font-bold font-space uppercase tracking-wider mb-1"
                style={{ color: "#5A5A5A" }}
              >
                Fit Score
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.fit_score}
                onChange={(e) => set("fit_score", e.target.value)}
                className="input-brutal w-full text-sm"
                placeholder="50"
              />
            </div>
          </div>

          <div>
            <label
              className="block text-[11px] font-bold font-space uppercase tracking-wider mb-1"
              style={{ color: "#5A5A5A" }}
            >
              Profile URL
            </label>
            <input
              type="url"
              value={form.webpage}
              onChange={(e) => set("webpage", e.target.value)}
              className="input-brutal w-full text-sm"
              placeholder="https://mit.edu/~jsmith"
            />
          </div>

          <div>
            <label
              className="block text-[11px] font-bold font-space uppercase tracking-wider mb-1"
              style={{ color: "#5A5A5A" }}
            >
              Position Status
            </label>
            <select
              value={form.position_status}
              onChange={(e) => set("position_status", e.target.value)}
              className="input-brutal w-full text-sm"
            >
              <option value="unknown">Unknown</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div>
            <label
              className="block text-[11px] font-bold font-space uppercase tracking-wider mb-1"
              style={{ color: "#5A5A5A" }}
            >
              Research Summary
            </label>
            <textarea
              value={form.research_summary}
              onChange={(e) => set("research_summary", e.target.value)}
              className="input-brutal w-full text-sm resize-none"
              rows={3}
              placeholder="Brief description of research interests..."
            />
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
              <span className="text-sm">{saving ? "Saving…" : "Add Faculty"}</span>
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

export default function ShortlistPage() {
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [stats, setStats] = useState<ShortlistStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "outreach">("all");
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    import("../../lib/api").then(({ shortlistApi }) =>
      Promise.all([shortlistApi.list(), shortlistApi.stats()])
        .then(([listRes, statsRes]) => {
          setFaculty(listRes.data.map(mapFaculty));
          setStats(statsRes.data);
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    );
  }, []);

  const filtered = faculty.filter((f) => {
    const matchSearch =
      search === "" ||
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.university.toLowerCase().includes(search.toLowerCase()) ||
      f.researchAreas.some((a) => a.toLowerCase().includes(search.toLowerCase()));
    const matchFilter =
      filter === "all" ||
      (filter === "open" && f.openPositions === true) ||
      (filter === "outreach" && f.outreachStatus !== "none");
    return matchSearch && matchFilter;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden bg-paper font-space">
      {/* Header — black branded bar */}
      <div className="px-6 py-4 shrink-0 relative flex items-center gap-4 bg-ink text-paper border-b-2 border-ink">
        <div className="size-9 grid place-items-center shrink-0 bg-accent-orange border-2 border-paper">
          <Star className="size-5 text-paper" strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight leading-tight">Faculty Shortlist</h1>
          <p className="text-xs mt-0.5 text-paper/70">
            {loading
              ? "Loading…"
              : stats
                ? `${stats.total} saved · ${stats.open_positions} open positions · ${stats.contacted} contacted`
                : `${faculty.length} saved`}
          </p>
        </div>
        <NeoButton variant="primary" onClick={() => setShowAddModal(true)} className="shrink-0">
          <Plus className="size-4" /> <span className="hidden sm:inline">Add Faculty</span>
        </NeoButton>
        <div className="absolute -bottom-[2px] left-0 right-0 h-[3px] bg-accent-orange" />
      </div>

      {/* Search + filter bar */}
      <div className="px-6 py-4 shrink-0 flex gap-4 flex-wrap bg-paper border-b-2 border-ink">
        <div className="flex-1 min-w-[300px] flex items-center gap-2 bg-paper-2 border-2 border-ink px-4 py-2.5 neo-shadow-sm">
          <Search className="size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search faculty, university, research area…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex border-2 border-ink neo-shadow-sm">
          {(["all", "open", "outreach"] as const).map((f, i) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                "px-4 py-2.5 text-sm font-bold transition-colors",
                filter === f ? "bg-accent-orange text-white" : "bg-paper-2 hover:bg-paper",
                i < 2 && "border-r-2 border-ink"
              )}
            >
              {f === "all" ? "All" : f === "open" ? "Open Positions" : "Outreach"}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {loading ? (
          <SkeletonCardGrid
            count={6}
            gridClassName="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
          />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <div className="size-12 bg-accent-yellow border-2 border-ink grid place-items-center mb-3">
              <Star className="size-5" strokeWidth={2.5} />
            </div>
            <p className="font-bold">
              {faculty.length === 0 ? "No faculty saved yet" : "No faculty found"}
            </p>
            <p className="text-sm mt-1 text-muted-foreground">
              {faculty.length === 0
                ? "Ask the agent to find professors matching your interests"
                : "Adjust search or filters"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((f) => (
              <FacultyCard key={f.id} faculty={f} />
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="neo-card bg-paper-2 p-5 flex items-center gap-4">
          <div className="size-12 bg-accent-yellow border-2 border-ink grid place-items-center shrink-0">
            <Star className="size-5" strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <div className="font-bold">Want more faculty matches?</div>
            <div className="text-sm text-muted-foreground">
              Paste program URLs in Agent Chat or describe your research.
            </div>
          </div>
          <NeoButton variant="primary" as="a" href="/chat" className="shrink-0">
            <MessageSquare className="size-4" /> Open Chat
          </NeoButton>
        </div>
      </div>

      {showAddModal && (
        <AddFacultyModal
          onClose={() => setShowAddModal(false)}
          onAdd={(f) => setFaculty((prev) => [f, ...prev])}
        />
      )}
    </div>
  );
}
