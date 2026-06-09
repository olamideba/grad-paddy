"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import clsx from "clsx";
import {
  Calendar,
  Plus,
  FileText,
  Users,
  DollarSign,
  Clock,
  Pencil,
  Check,
  AlertTriangle,
  Circle,
  Paperclip,
  UploadCloud,
  X,
  Trash2,
  Plus as PlusIcon,
} from "lucide-react";
import type { LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import type { Application as ApiApp, TrackerStats, Attachment } from "../../lib/api";
import ConfirmModal from "@/components/ConfirmModal";
import EmailCanvas from "@/components/EmailCanvas";
import { SkeletonTable } from "@/components/Skeleton";
import { NeoButton, StatusPill } from "@/components/Neo";

type DocStatus = "not-started" | "in-progress" | "ready";
type AppStatus =
  | "tracking"
  | "drafting"
  | "submitted"
  | "decision-pending"
  | "accepted"
  | "rejected"
  | "waitlisted";
type RecommenderStatus = "not-asked" | "asked" | "confirmed" | "submitted";

type Application = {
  id: string;
  program: string;
  university: string;
  department: string;
  deadline: Date;
  status: AppStatus;
  sop: DocStatus;
  cv: DocStatus;
  writingSample: DocStatus;
  recommenders: Array<{ name: string; status: RecommenderStatus; email?: string }>;
  attachments: Attachment[];
  calendarEventId?: string | null;
  funded: boolean | "unknown";
  notes?: string;
};

const ATTACH_META: Record<Attachment["kind"], { label: string; icon: string; color: string }> = {
  sop: { label: "SOP", icon: "solar:document-text-bold", color: "#E8472A" },
  narrative: { label: "Narrative", icon: "solar:book-bold", color: "#0D0D0D" },
  cv: { label: "CV", icon: "solar:file-text-bold", color: "#4ECDC4" },
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
    department: a.department,
    deadline: new Date(a.deadline),
    status: (a.status || "tracking") as AppStatus,
    sop: normalizeDocStatus(a.sop_status),
    cv: normalizeDocStatus(a.cv_status),
    writingSample: "not-started",
    recommenders: a.recommenders.map((r) => ({
      name: r.name,
      status: normalizeRecStatus(r.status),
      email: r.email ?? "",
    })),
    attachments: a.attachments ?? [],
    calendarEventId: a.calendar_event_id ?? null,
    funded: a.funded === "yes" ? true : a.funded === "no" ? false : "unknown",
    notes: a.notes ?? undefined,
  };
}

function daysUntil(date: Date) {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function DeadlineBadge({ date }: { date: Date }) {
  const days = daysUntil(date);
  const formatted = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const tone = days < 0 ? "orange" : days < 30 ? "yellow" : "muted";
  return (
    <div className="flex flex-col gap-1 items-start">
      <span className="text-xs font-mono text-ink">{formatted}</span>
      <StatusPill tone={tone}>
        <Clock className="size-3 mr-1" />
        {days}d left
      </StatusPill>
    </div>
  );
}

const STATUS_META: Record<AppStatus, { label: string; bg: string; color: string; border: string }> =
  {
    tracking: { label: "Tracking", bg: "#EDE6D3", color: "#5A5A5A", border: "#0D0D0D" },
    drafting: { label: "Drafting", bg: "#E8472A", color: "#FFFFFF", border: "#0D0D0D" },
    submitted: { label: "Submitted", bg: "#4ECDC4", color: "#0D0D0D", border: "#0D0D0D" },
    "decision-pending": {
      label: "Decision Pending",
      bg: "#0D0D0D",
      color: "#FFFFFF",
      border: "#0D0D0D",
    },
    accepted: { label: "Accepted", bg: "#4ECDC4", color: "#0D0D0D", border: "#0D0D0D" },
    rejected: { label: "Rejected", bg: "#E8472A", color: "#FFFFFF", border: "#0D0D0D" },
    waitlisted: { label: "Waitlisted", bg: "#F7F0E3", color: "#92400E", border: "#D97706" },
  };

const DOC_META: Record<DocStatus, { Icon: ComponentType<LucideProps>; cell: string }> = {
  "not-started": { Icon: Circle, cell: "bg-paper text-muted-foreground" },
  "in-progress": { Icon: AlertTriangle, cell: "bg-accent-yellow text-ink" },
  ready: { Icon: Check, cell: "bg-accent-teal text-ink" },
};

const DOC_CYCLE: DocStatus[] = ["not-started", "in-progress", "ready"];

// Application readiness: SOP + CV ready, plus each recommender submitted.
// SOP/CV count as ready when the doc status is "ready" OR a matching file is
// attached — otherwise attaching an SOP/CV wouldn't move the percentage.
function readiness(app: Application): number {
  const sopReady = app.sop === "ready" || app.attachments.some((a) => a.kind === "sop");
  const cvReady = app.cv === "ready" || app.attachments.some((a) => a.kind === "cv");
  const items = [sopReady, cvReady, ...app.recommenders.map((r) => r.status === "submitted")];
  if (items.length === 0) return 0;
  return Math.round((items.filter(Boolean).length / items.length) * 100);
}

function ReadinessBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-3 border-2 border-ink bg-paper overflow-hidden">
        <div
          className="h-full bg-accent-orange"
          style={{ width: `${value}%`, transition: "width 200ms ease-out" }}
        />
      </div>
      <span className="font-mono text-xs w-9 text-right text-ink">{value}%</span>
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-center gap-2 px-4 py-2 border-2 border-ink neo-shadow-sm text-sm font-bold transition-colors",
        active ? "bg-ink text-paper" : "bg-paper-2 hover:bg-paper"
      )}
    >
      {label}
      <span
        className={clsx(
          "text-[11px] font-mono px-1.5 py-0.5 border-2",
          active ? "border-paper" : "border-ink"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function DocCell({
  status,
  label,
  attached,
  onCycle,
}: {
  status: DocStatus;
  label: string;
  attached?: boolean;
  onCycle?: () => void;
}) {
  // An attached SOP/CV auto-marks the cell ready — no manual cycling needed.
  if (attached) {
    return (
      <div
        title={`${label} attached`}
        className="size-6 border-2 border-ink grid place-items-center bg-accent-teal text-ink"
      >
        <Paperclip className="size-3.5" strokeWidth={2.5} />
      </div>
    );
  }
  const { Icon: DocIcon, cell } = DOC_META[status];
  return (
    <button
      type="button"
      onClick={onCycle}
      title={`${label}: ${status.replace(/-/g, " ")} — click to change`}
      className={clsx("size-6 border-2 border-ink grid place-items-center transition-colors", cell)}
    >
      <DocIcon className="size-3.5" strokeWidth={2.5} />
    </button>
  );
}

const REC_STYLE: Record<RecommenderStatus, { bg: string; border: string }> = {
  "not-asked": { bg: "#FBF7EF", border: "#1D1A16" },
  asked: { bg: "#FBE49A", border: "#1D1A16" },
  confirmed: { bg: "#4ECDC4", border: "#1D1A16" },
  submitted: { bg: "#1D1A16", border: "#1D1A16" },
};

function RecDots({ recommenders }: { recommenders: Application["recommenders"] }) {
  return (
    <div className="flex items-center gap-1">
      {recommenders.map((r, i) => (
        <div
          key={i}
          title={`${r.name}: ${r.status.replace(/-/g, " ")}`}
          className="size-3.5 border-2 border-ink"
          style={{ background: REC_STYLE[r.status].bg }}
        />
      ))}
    </div>
  );
}

function StatCard({
  Icon: StatIcon,
  label,
  value,
  tone,
}: {
  Icon: ComponentType<LucideProps>;
  label: string;
  value: string;
  tone: "teal" | "ink" | "orange";
}) {
  const bg = tone === "teal" ? "bg-accent-teal" : tone === "orange" ? "bg-accent-orange" : "bg-ink";
  const fg = tone === "teal" ? "text-ink" : "text-paper";
  return (
    <div className="neo-card p-5 flex items-center gap-4">
      <div className={clsx("size-14 border-2 border-ink grid place-items-center", bg, fg)}>
        <StatIcon className="size-6" strokeWidth={2.5} />
      </div>
      <div>
        <div className="text-4xl font-bold font-mono leading-none">{value}</div>
        <div className="text-[11px] tracking-[0.18em] font-bold text-muted-foreground mt-2">
          {label}
        </div>
      </div>
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

type AddAppForm = {
  university: string;
  program: string;
  department: string;
  deadline: string;
  status: AppStatus;
  funded: string;
  notes: string;
};

const EMPTY_APP_FORM: AddAppForm = {
  university: "",
  program: "",
  department: "",
  deadline: "",
  status: "tracking",
  funded: "unknown",
  notes: "",
};

// Drag-and-drop (or click) CV upload. Uploads straight to the user's Documents
// via cvsApi.upload, then hands the new CV back so it can be attached.
function CvDropzone({ onUploaded }: { onUploaded: (cv: { id: string; title: string }) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const { cvsApi } = await import("../../lib/api");
      const res = await cvsApi.upload(file);
      onUploaded({ id: res.data.id, title: res.data.title });
    } catch (e) {
      setErr(
        e instanceof Error && e.message.startsWith("415")
          ? "PDF or Word only."
          : "Upload failed. Try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) upload(f);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) upload(f);
        }}
        className={clsx(
          "w-full border-2 border-dashed border-ink p-3 flex items-center justify-center gap-2 text-xs font-bold transition-colors",
          drag ? "bg-accent-yellow/40" : "bg-paper-2 hover:bg-paper"
        )}
      >
        {busy ? (
          <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
        ) : (
          <UploadCloud className="size-4" strokeWidth={2.5} />
        )}
        {busy ? "Uploading…" : "Drop a new CV here, or click to upload"}
      </button>
      {err && <p className="text-xs text-accent-orange mt-1">{err}</p>}
    </div>
  );
}

function AddApplicationModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (a: Application) => void;
}) {
  const [form, setForm] = useState<AddAppForm>(EMPTY_APP_FORM);
  const [recs, setRecs] = useState<string[]>([]);
  const [recInput, setRecInput] = useState("");
  const [pendingCv, setPendingCv] = useState<{ id: string; title: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  function set<K extends keyof AddAppForm>(key: K, value: AddAppForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addRec() {
    const name = recInput.trim();
    if (name && !recs.includes(name)) setRecs((r) => [...r, name]);
    setRecInput("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.university.trim() || !form.program.trim() || !form.department.trim()) {
      setError("University, program, and department are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { trackerApi } = await import("../../lib/api");
      const res = await trackerApi.create({
        university: form.university.trim(),
        program: form.program.trim(),
        department: form.department.trim(),
        ...(form.deadline && { deadline: form.deadline }),
        status: form.status,
        funded: form.funded,
        ...(form.notes.trim() && { notes: form.notes.trim() }),
        recommenders: recs.map((name) => ({ name, status: "not_asked" })),
      });
      let created = mapApp(res.data);
      // Attach the dragged/uploaded CV to the freshly-created application.
      if (pendingCv) {
        try {
          const att = { kind: "cv" as const, ref_id: pendingCv.id, title: pendingCv.title };
          const attRes = await trackerApi.addAttachment(created.id, att);
          created = { ...created, attachments: attRes.data.attachments ?? [att] };
        } catch {
          // best-effort; application is created regardless
        }
      }
      onAdd(created);
      onClose();
    } catch {
      setError("Failed to add application. Try again.");
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
      <div className="w-full max-w-[786px] flex flex-col max-h-[90vh] overflow-y-auto bg-paper-2 border-2 border-ink neo-shadow font-space">
        {/* Header */}
        <div className="px-5 py-4 flex items-center gap-3 shrink-0 bg-ink text-paper border-b-2 border-ink">
          <div className="size-8 grid place-items-center shrink-0 bg-accent-orange border-2 border-paper">
            <Calendar className="size-4 text-paper" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-base flex-1">Add Application</span>
          <button onClick={onClose} className="shrink-0 text-paper/60 hover:text-paper">
            <X className="size-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3">
          {/* University */}
          <div>
            <label
              className="block text-[11px] font-bold font-space uppercase tracking-wider mb-1"
              style={{ color: "#5A5A5A" }}
            >
              University <span style={{ color: "#E8472A" }}>*</span>
            </label>
            <input
              ref={firstRef}
              type="text"
              value={form.university}
              onChange={(e) => set("university", e.target.value)}
              className="input-brutal w-full text-sm"
              placeholder="MIT"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                className="block text-[11px] font-bold font-space uppercase tracking-wider mb-1"
                style={{ color: "#5A5A5A" }}
              >
                Program <span style={{ color: "#E8472A" }}>*</span>
              </label>
              <input
                type="text"
                value={form.program}
                onChange={(e) => set("program", e.target.value)}
                className="input-brutal w-full text-sm"
                placeholder="PhD Computer Science"
              />
            </div>
            <div>
              <label
                className="block text-[11px] font-bold font-space uppercase tracking-wider mb-1"
                style={{ color: "#5A5A5A" }}
              >
                Department <span style={{ color: "#E8472A" }}>*</span>
              </label>
              <input
                type="text"
                value={form.department}
                onChange={(e) => set("department", e.target.value)}
                className="input-brutal w-full text-sm"
                placeholder="EECS"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                className="block text-[11px] font-bold font-space uppercase tracking-wider mb-1"
                style={{ color: "#5A5A5A" }}
              >
                Deadline
              </label>
              <input
                type="date"
                value={form.deadline}
                onChange={(e) => set("deadline", e.target.value)}
                className="input-brutal w-full text-sm"
              />
            </div>
            <div>
              <label
                className="block text-[11px] font-bold font-space uppercase tracking-wider mb-1"
                style={{ color: "#5A5A5A" }}
              >
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value as AppStatus)}
                className="input-brutal w-full text-sm"
              >
                {(Object.keys(STATUS_META) as AppStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              className="block text-[11px] font-bold font-space uppercase tracking-wider mb-1"
              style={{ color: "#5A5A5A" }}
            >
              Funding
            </label>
            <select
              value={form.funded}
              onChange={(e) => set("funded", e.target.value)}
              className="input-brutal w-full text-sm"
            >
              <option value="unknown">Unknown</option>
              <option value="yes">Funded</option>
              <option value="no">Not Funded</option>
            </select>
          </div>

          {/* Recommenders */}
          <div>
            <label
              className="block text-[11px] font-bold font-space uppercase tracking-wider mb-1"
              style={{ color: "#5A5A5A" }}
            >
              Recommenders
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={recInput}
                onChange={(e) => setRecInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addRec();
                  }
                }}
                className="input-brutal flex-1 text-sm"
                placeholder="Prof. Name (Enter to add)"
              />
              <button type="button" onClick={addRec} className="btn-white btn-sm shrink-0">
                <Icon icon="solar:add-circle-bold" width={13} />
              </button>
            </div>
            {recs.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {recs.map((name) => (
                  <span
                    key={name}
                    className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-dm"
                    style={{
                      background: "#EDE6D3",
                      border: "1.5px solid #C8C0AF",
                      borderRadius: "4px",
                    }}
                  >
                    {name}
                    <button
                      type="button"
                      onClick={() => setRecs((r) => r.filter((n) => n !== name))}
                      className="ml-0.5"
                      style={{ color: "#9CA3AF" }}
                    >
                      <Icon icon="solar:close-circle-bold" width={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label
              className="block text-[11px] font-bold font-space uppercase tracking-wider mb-1"
              style={{ color: "#5A5A5A" }}
            >
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              className="input-brutal w-full text-sm resize-none"
              rows={2}
              placeholder="Any additional notes..."
            />
          </div>

          {/* CV — drag-drop a new one (saved to Documents) and attach it */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[0.18em] mb-1.5 text-muted-foreground">
              CV (optional)
            </label>
            {pendingCv ? (
              <div className="flex items-center gap-2 border-2 border-ink bg-accent-teal px-3 py-2 text-sm">
                <Paperclip className="size-4 shrink-0" strokeWidth={2.5} />
                <span className="flex-1 min-w-0 truncate font-bold">{pendingCv.title}</span>
                <button
                  type="button"
                  onClick={() => setPendingCv(null)}
                  className="shrink-0 hover:text-accent-orange"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <CvDropzone onUploaded={setPendingCv} />
            )}
            <p className="text-[10px] mt-1 text-muted-foreground">
              Uploads to your Documents and attaches to this application.
            </p>
          </div>

          {error && <p className="text-xs font-semibold text-accent-orange">{error}</p>}

          <div className="flex gap-2 pt-1">
            <NeoButton
              type="submit"
              variant="primary"
              disabled={saving}
              className="flex-1 justify-center"
            >
              {saving ? (
                <span className="size-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
              ) : (
                <PlusIcon className="size-4" />
              )}
              {saving ? "Saving…" : "Add Application"}
            </NeoButton>
            <NeoButton type="button" variant="default" onClick={onClose}>
              Cancel
            </NeoButton>
          </div>
        </form>
      </div>
    </div>
  );
}

function toDateInput(d: Date): string {
  if (isNaN(d.getTime())) return "";
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function EditApplicationModal({
  app,
  onClose,
  onSaved,
  onDeleted,
}: {
  app: Application;
  onClose: () => void;
  onSaved: (a: Application) => void;
  onDeleted: (id: string) => void;
}) {
  const [form, setForm] = useState<AddAppForm>({
    university: app.university,
    program: app.program,
    department: app.department,
    deadline: toDateInput(app.deadline),
    status: app.status,
    funded: app.funded === true ? "yes" : app.funded === false ? "no" : "unknown",
    notes: app.notes ?? "",
  });
  const [recs, setRecs] = useState<{ name: string; status: RecommenderStatus; email?: string }[]>(
    app.recommenders
  );
  const [recInput, setRecInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>(app.attachments);
  const [linkOptions, setLinkOptions] = useState<Attachment[]>([]);
  const [linkBusy, setLinkBusy] = useState(false);
  const [calendarEventId, setCalendarEventId] = useState<string | null>(
    app.calendarEventId ?? null
  );
  const [calBusy, setCalBusy] = useState(false);
  const [calError, setCalError] = useState<string | null>(null);
  // Recommender being emailed (opens the EmailCanvas modal), or null.
  const [emailing, setEmailing] = useState<{ name: string; email: string } | null>(null);

  async function addToCalendar() {
    setCalBusy(true);
    setCalError(null);
    try {
      const { trackerApi } = await import("../../lib/api");
      const res = await trackerApi.addToCalendar(app.id);
      const id = res.data.calendar_event_id ?? null;
      setCalendarEventId(id);
      onSaved({ ...app, calendarEventId: id });
    } catch (e) {
      setCalError(
        e instanceof Error && e.message.toLowerCase().includes("not connected")
          ? "Connect Google in Settings first."
          : "Couldn't add to calendar."
      );
    } finally {
      setCalBusy(false);
    }
  }

  async function removeFromCalendar() {
    setCalBusy(true);
    setCalError(null);
    setCalendarEventId(null);
    onSaved({ ...app, calendarEventId: null });
    try {
      const { trackerApi } = await import("../../lib/api");
      await trackerApi.removeFromCalendar(app.id);
    } catch {
      // optimistic removal stays
    } finally {
      setCalBusy(false);
    }
  }
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  // Load approved SOP/narrative drafts + approved CVs that can be attached.
  useEffect(() => {
    import("../../lib/api").then(async ({ draftsApi, cvsApi }) => {
      try {
        const [draftsRes, cvsRes] = await Promise.all([
          draftsApi.list({ status: "approved" }),
          cvsApi.list(),
        ]);
        const draftOpts: Attachment[] = draftsRes.data
          .map((d): Attachment | null => {
            const t = d.type;
            if (t === "sop") return { kind: "sop", ref_id: d.id, title: d.title };
            if (t === "narrative" || t === "research_narrative" || t === "research-narrative")
              return { kind: "narrative", ref_id: d.id, title: d.title };
            return null;
          })
          .filter((x): x is Attachment => x !== null);
        // CVs no longer have an approval step — any uploaded CV is attachable.
        const cvOpts: Attachment[] = cvsRes.data.map((c) => ({
          kind: "cv",
          ref_id: c.id,
          title: c.title,
        }));
        setLinkOptions([...draftOpts, ...cvOpts]);
      } catch {
        // non-fatal; the picker just stays empty
      }
    });
  }, []);

  async function linkAttachment(opt: Attachment) {
    setLinkBusy(true);
    setError(null);
    try {
      const { trackerApi } = await import("../../lib/api");
      const res = await trackerApi.addAttachment(app.id, {
        kind: opt.kind,
        ref_id: opt.ref_id,
        title: opt.title,
      });
      const next = res.data.attachments ?? [...attachments, opt];
      setAttachments(next);
      onSaved({ ...app, attachments: next });
    } catch {
      setError("Couldn't link that document.");
    } finally {
      setLinkBusy(false);
    }
  }

  async function unlinkAttachment(ref_id: string) {
    const next = attachments.filter((a) => a.ref_id !== ref_id);
    setAttachments(next);
    onSaved({ ...app, attachments: next });
    try {
      const { trackerApi } = await import("../../lib/api");
      await trackerApi.removeAttachment(app.id, ref_id);
    } catch {
      // optimistic removal stays
    }
  }

  function set<K extends keyof AddAppForm>(key: K, value: AddAppForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addRec() {
    const name = recInput.trim();
    if (name && !recs.some((r) => r.name === name))
      setRecs((r) => [...r, { name, status: "not-asked", email: "" }]);
    setRecInput("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.university.trim() || !form.program.trim() || !form.department.trim()) {
      setError("University, program, and department are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { trackerApi } = await import("../../lib/api");
      await trackerApi.update(app.id, {
        university: form.university.trim(),
        program: form.program.trim(),
        department: form.department.trim(),
        ...(form.deadline && { deadline: form.deadline }),
        status: form.status,
        funded: form.funded,
        notes: form.notes.trim(),
        recommenders: recs.map((r) => ({
          name: r.name,
          status: r.status.replace(/-/g, "_"),
          email: r.email ?? "",
        })),
      });
      // Build the updated row from known values rather than the response body,
      // so the table reflects the edit immediately regardless of response shape.
      onSaved({
        ...app,
        university: form.university.trim(),
        program: form.program.trim(),
        department: form.department.trim(),
        deadline: form.deadline ? new Date(form.deadline) : app.deadline,
        status: form.status,
        funded: form.funded === "yes" ? true : form.funded === "no" ? false : "unknown",
        notes: form.notes.trim() || undefined,
        recommenders: recs,
        attachments,
        calendarEventId,
      });
      onClose();
    } catch {
      setError("Failed to save changes. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function performDelete() {
    setConfirmDelete(false);
    setDeleting(true);
    try {
      const { trackerApi } = await import("../../lib/api");
      await trackerApi.delete(app.id);
      onDeleted(app.id);
      onClose();
    } catch {
      setError("Failed to delete. Try again.");
      setDeleting(false);
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
      <div className="w-full max-w-[786px] flex flex-col max-h-[90vh] overflow-y-auto bg-paper-2 border-2 border-ink neo-shadow font-space">
        <div className="px-5 py-4 flex items-center gap-3 shrink-0 bg-ink text-paper border-b-2 border-ink">
          <div className="size-8 grid place-items-center shrink-0 bg-accent-orange border-2 border-paper">
            <Pencil className="size-4 text-paper" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-base flex-1">Edit Application</span>
          <button onClick={onClose} className="shrink-0 text-paper/60 hover:text-paper">
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3">
          <div>
            <label
              className="block text-[11px] font-bold font-space uppercase tracking-wider mb-1"
              style={{ color: "#5A5A5A" }}
            >
              University <span style={{ color: "#E8472A" }}>*</span>
            </label>
            <input
              ref={firstRef}
              type="text"
              value={form.university}
              onChange={(e) => set("university", e.target.value)}
              className="input-brutal w-full text-sm"
              placeholder="MIT"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                className="block text-[11px] font-bold font-space uppercase tracking-wider mb-1"
                style={{ color: "#5A5A5A" }}
              >
                Program <span style={{ color: "#E8472A" }}>*</span>
              </label>
              <input
                type="text"
                value={form.program}
                onChange={(e) => set("program", e.target.value)}
                className="input-brutal w-full text-sm"
                placeholder="PhD Computer Science"
              />
            </div>
            <div>
              <label
                className="block text-[11px] font-bold font-space uppercase tracking-wider mb-1"
                style={{ color: "#5A5A5A" }}
              >
                Department <span style={{ color: "#E8472A" }}>*</span>
              </label>
              <input
                type="text"
                value={form.department}
                onChange={(e) => set("department", e.target.value)}
                className="input-brutal w-full text-sm"
                placeholder="EECS"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                className="block text-[11px] font-bold font-space uppercase tracking-wider mb-1"
                style={{ color: "#5A5A5A" }}
              >
                Deadline
              </label>
              <input
                type="date"
                value={form.deadline}
                onChange={(e) => set("deadline", e.target.value)}
                className="input-brutal w-full text-sm"
              />
            </div>
            <div>
              <label
                className="block text-[11px] font-bold font-space uppercase tracking-wider mb-1"
                style={{ color: "#5A5A5A" }}
              >
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value as AppStatus)}
                className="input-brutal w-full text-sm"
              >
                {(Object.keys(STATUS_META) as AppStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              className="block text-[11px] font-bold font-space uppercase tracking-wider mb-1"
              style={{ color: "#5A5A5A" }}
            >
              Funding
            </label>
            <select
              value={form.funded}
              onChange={(e) => set("funded", e.target.value)}
              className="input-brutal w-full text-sm"
            >
              <option value="unknown">Unknown</option>
              <option value="yes">Funded</option>
              <option value="no">Not Funded</option>
            </select>
          </div>

          <div>
            <label
              className="block text-[11px] font-bold font-space uppercase tracking-wider mb-1"
              style={{ color: "#5A5A5A" }}
            >
              Recommenders
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={recInput}
                onChange={(e) => setRecInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addRec();
                  }
                }}
                className="input-brutal flex-1 text-sm"
                placeholder="Prof. Name (Enter to add)"
              />
              <button type="button" onClick={addRec} className="btn-white btn-sm shrink-0">
                <Icon icon="solar:add-circle-bold" width={13} />
              </button>
            </div>
            {recs.length > 0 && (
              <div className="flex flex-col gap-1.5 mt-2">
                {recs.map((r) => (
                  <div
                    key={r.name}
                    className="flex flex-col gap-1.5 px-2 py-1.5 text-[11px] font-dm"
                    style={{
                      background: "#EDE6D3",
                      border: "1.5px solid #C8C0AF",
                      borderRadius: "4px",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 shrink-0"
                        style={{
                          background: REC_STYLE[r.status].bg,
                          border: `1px solid ${REC_STYLE[r.status].border}`,
                          borderRadius: "2px",
                        }}
                      />
                      <span className="flex-1 min-w-0 truncate">{r.name}</span>
                      <select
                        value={r.status}
                        onChange={(e) =>
                          setRecs((rs) =>
                            rs.map((x) =>
                              x.name === r.name
                                ? { ...x, status: e.target.value as RecommenderStatus }
                                : x
                            )
                          )
                        }
                        className="text-[11px] font-dm bg-white px-1 py-0.5 shrink-0"
                        style={{ border: "1.5px solid #0D0D0D", borderRadius: "4px" }}
                      >
                        {(
                          ["not-asked", "asked", "confirmed", "submitted"] as RecommenderStatus[]
                        ).map((s) => (
                          <option key={s} value={s}>
                            {s.replace(/-/g, " ")}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setEmailing({ name: r.name, email: r.email ?? "" })}
                        title="Email this recommender"
                        className="shrink-0"
                        style={{ color: r.email ? "#0D0D0D" : "#C8C0AF" }}
                      >
                        <Icon icon="solar:letter-bold" width={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecs((rs) => rs.filter((x) => x.name !== r.name))}
                        className="shrink-0"
                        style={{ color: "#9CA3AF" }}
                      >
                        <Icon icon="solar:close-circle-bold" width={12} />
                      </button>
                    </div>
                    <input
                      type="email"
                      value={r.email ?? ""}
                      onChange={(e) =>
                        setRecs((rs) =>
                          rs.map((x) => (x.name === r.name ? { ...x, email: e.target.value } : x))
                        )
                      }
                      placeholder="email@university.edu (for recommendation request)"
                      className="w-full text-[11px] font-dm bg-white px-2 py-1"
                      style={{ border: "1.5px solid #C8C0AF", borderRadius: "4px" }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {emailing &&
            createPortal(
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                style={{ background: "rgba(13,13,13,0.55)" }}
                onClick={() => setEmailing(null)}
              >
                <div className="w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
                  <EmailCanvas
                    initialTo={emailing.email}
                    initialSubject={`Recommendation letter request — ${form.university || app.university}`}
                    initialBody={
                      `Dear ${emailing.name},\n\n` +
                      `I hope you're doing well. I'm applying to ${form.program || app.program} at ` +
                      `${form.university || app.university}` +
                      `${form.deadline ? ` (deadline ${form.deadline})` : ""}, and I would be very grateful ` +
                      `if you would be willing to write a letter of recommendation in support of my application.\n\n` +
                      `I'm happy to share my CV, statement of purpose, and any other materials that would help, ` +
                      `and to give you plenty of notice before the deadline. Thank you so much for considering.\n\n` +
                      `Warm regards,\n[Your Name]`
                    }
                    kind="recommender"
                    linkedApplicationId={app.id}
                    refId={emailing.name}
                    onSent={() => {
                      setRecs((rs) =>
                        rs.map((x) =>
                          x.name === emailing.name && x.status === "not-asked"
                            ? { ...x, status: "asked" }
                            : x
                        )
                      );
                      setEmailing(null);
                    }}
                    onCancel={() => setEmailing(null)}
                  />
                </div>
              </div>,
              document.body
            )}

          <div>
            <label
              className="block text-[11px] font-bold font-space uppercase tracking-wider mb-1"
              style={{ color: "#5A5A5A" }}
            >
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              className="input-brutal w-full text-sm resize-none"
              rows={2}
              placeholder="Any additional notes..."
            />
          </div>

          <div>
            <label
              className="block text-[11px] font-bold font-space uppercase tracking-wider mb-1"
              style={{ color: "#5A5A5A" }}
            >
              Attachments
            </label>
            {(() => {
              const attachedIds = new Set(attachments.map((a) => a.ref_id));
              const slots: { kind: Attachment["kind"]; label: string }[] = [
                { kind: "sop", label: "SOP" },
                { kind: "cv", label: "CV" },
                { kind: "narrative", label: "Research Narrative" },
              ];
              return (
                <div className="space-y-3">
                  {slots.map(({ kind, label }) => {
                    const current = attachments.find((a) => a.kind === kind);
                    const available = linkOptions.filter(
                      (o) => o.kind === kind && !attachedIds.has(o.ref_id)
                    );
                    return (
                      <div key={kind}>
                        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-1">
                          {label}
                        </div>
                        {current ? (
                          <div className="flex items-center gap-2 border-2 border-ink bg-accent-teal px-3 py-2 text-sm">
                            <Paperclip className="size-4 shrink-0" strokeWidth={2.5} />
                            <span className="flex-1 min-w-0 truncate font-bold">
                              {current.title}
                            </span>
                            <button
                              type="button"
                              onClick={() => unlinkAttachment(current.ref_id)}
                              title="Unlink"
                              className="shrink-0 hover:text-accent-orange"
                            >
                              <X className="size-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <select
                              value=""
                              disabled={linkBusy || available.length === 0}
                              onChange={(e) => {
                                const opt = available.find((o) => o.ref_id === e.target.value);
                                if (opt) linkAttachment(opt);
                              }}
                              className="input-brutal w-full text-sm"
                            >
                              <option value="">
                                {available.length === 0
                                  ? `No approved ${label} to link`
                                  : `Link an approved ${label}…`}
                              </option>
                              {available.map((o) => (
                                <option key={o.ref_id} value={o.ref_id}>
                                  {o.title}
                                </option>
                              ))}
                            </select>
                            {kind === "cv" && (
                              <CvDropzone
                                onUploaded={(cv) =>
                                  linkAttachment({ kind: "cv", ref_id: cv.id, title: cv.title })
                                }
                              />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <p className="text-[10px] text-muted-foreground">
                    SOP &amp; Narrative pull from approved Drafts. Drop a CV to upload it to
                    Documents and attach it here.
                  </p>
                </div>
              );
            })()}
          </div>

          <div>
            <label
              className="block text-[11px] font-bold font-space uppercase tracking-wider mb-1"
              style={{ color: "#5A5A5A" }}
            >
              Google Calendar
            </label>
            {calendarEventId ? (
              <div
                className="flex items-center justify-between gap-2 px-3 py-2"
                style={{
                  background: "#EDE6D3",
                  border: "1.5px solid #C8C0AF",
                  borderRadius: "4px",
                }}
              >
                <span
                  className="flex items-center gap-1.5 text-[11px] font-semibold font-space"
                  style={{ color: "#0D0D0D" }}
                >
                  <Icon icon="solar:calendar-mark-bold" width={13} style={{ color: "#0D9268" }} />
                  Deadline on your calendar
                </span>
                <button
                  type="button"
                  onClick={removeFromCalendar}
                  disabled={calBusy}
                  className="text-[11px] font-semibold font-space bouncy shrink-0"
                  style={{ color: "#E8472A" }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={addToCalendar}
                disabled={calBusy}
                className="btn-white btn-sm text-xs w-full justify-center"
              >
                {calBusy ? (
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                ) : (
                  <Icon icon="solar:calendar-add-bold" width={14} />
                )}
                Add deadline to Google Calendar
              </button>
            )}
            {calError && (
              <p className="text-[11px] font-dm mt-1" style={{ color: "#E8472A" }}>
                {calError}
              </p>
            )}
          </div>

          {error && (
            <p className="text-xs font-dm font-semibold" style={{ color: "#E8472A" }}>
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <NeoButton
              type="submit"
              variant="primary"
              disabled={saving || deleting}
              className="flex-1 justify-center"
            >
              {saving ? (
                <span className="size-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
              ) : (
                <Check className="size-4" />
              )}
              {saving ? "Saving…" : "Save Changes"}
            </NeoButton>
            <NeoButton
              type="button"
              variant="danger"
              onClick={() => setConfirmDelete(true)}
              disabled={saving || deleting}
            >
              <Trash2 className="size-4" /> Delete
            </NeoButton>
          </div>
        </form>
      </div>
      {confirmDelete && (
        <ConfirmModal
          title="Delete application"
          message={`Delete the ${app.university} application? This cannot be undone.`}
          onClose={() => setConfirmDelete(false)}
          onConfirm={performDelete}
        />
      )}
    </div>
  );
}

export default function TrackerPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [stats, setStats] = useState<TrackerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("deadline");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editApp, setEditApp] = useState<Application | null>(null);
  const [filter, setFilter] = useState<"all" | "due-soon" | AppStatus>("all");

  function patchApp(id: string, patch: Partial<Application>) {
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  async function setStatus(app: Application, status: AppStatus) {
    patchApp(app.id, { status });
    const { trackerApi } = await import("../../lib/api");
    trackerApi.updateStatus(app.id, status).catch(() => {});
  }

  async function cycleDoc(app: Application, field: "sop" | "cv") {
    const next = DOC_CYCLE[(DOC_CYCLE.indexOf(app[field]) + 1) % DOC_CYCLE.length];
    patchApp(app.id, { [field]: next });
    const api = (await import("../../lib/api")).trackerApi;
    const value = next.replace(/-/g, "_");
    (field === "sop"
      ? api.updateSopStatus(app.id, value)
      : api.updateCvStatus(app.id, value)
    ).catch(() => {});
  }

  useEffect(() => {
    import("../../lib/api").then(({ trackerApi }) =>
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
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filtered = apps.filter((a) => {
    if (filter === "all") return true;
    if (filter === "due-soon") return daysUntil(a.deadline) < 30;
    return a.status === filter;
  });

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "deadline") cmp = a.deadline.getTime() - b.deadline.getTime();
    else if (sortKey === "program") cmp = a.university.localeCompare(b.university);
    else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const totalDue30 = apps.filter((a) => daysUntil(a.deadline) < 30).length;
  // Statuses present, for filter chips.
  const presentStatuses = (Object.keys(STATUS_META) as AppStatus[]).filter((s) =>
    apps.some((a) => a.status === s)
  );
  const totalDrafting = apps.filter((a) => a.status === "drafting").length;

  const statCards: {
    label: string;
    Icon: ComponentType<LucideProps>;
    value: string;
    tone: "teal" | "ink" | "orange";
  }[] = [
    {
      label: "SOP READY",
      Icon: FileText,
      value: stats ? `${stats.sop_ready}/${stats.total}` : "—",
      tone: "teal",
    },
    {
      label: "RECS CONFIRMED",
      Icon: Users,
      value: stats ? `${stats.recs_confirmed}` : "—",
      tone: "ink",
    },
    {
      label: "FUNDED PROGRAMS",
      Icon: DollarSign,
      value: stats ? `${stats.funded_programs}/${stats.total}` : "—",
      tone: "orange",
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-paper font-space">
      {/* Header — black branded bar */}
      <div className="px-6 py-4 shrink-0 relative flex items-center gap-4 bg-ink text-paper border-b-2 border-ink">
        <div className="size-9 grid place-items-center shrink-0 bg-accent-orange border-2 border-paper">
          <Calendar className="size-5 text-paper" strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight leading-tight">Application Tracker</h1>
          <p className="text-xs mt-0.5 text-paper/70">
            {loading ? "Loading…" : `${apps.length} applications · ${totalDrafting} drafting`}
            {!loading && totalDue30 > 0 && (
              <span className="text-accent-orange font-semibold">
                {" "}
                · {totalDue30} deadline{totalDue30 > 1 ? "s" : ""} in &lt;30 days
              </span>
            )}
          </p>
        </div>
        <NeoButton variant="primary" onClick={() => setShowAddModal(true)} className="shrink-0">
          <Plus className="size-4" /> <span className="hidden sm:inline">Add Application</span>
        </NeoButton>
        <div className="absolute -bottom-[2px] left-0 right-0 h-[3px] bg-accent-orange" />
      </div>

      {/* Filter bar */}
      <div className="px-6 py-4 shrink-0 flex items-center gap-3 flex-wrap bg-paper border-b-2 border-ink">
        <FilterChip
          label="All"
          count={apps.length}
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        <FilterChip
          label="Due <30d"
          count={totalDue30}
          active={filter === "due-soon"}
          onClick={() => setFilter("due-soon")}
        />
        {presentStatuses.map((s) => (
          <FilterChip
            key={s}
            label={STATUS_META[s].label}
            count={apps.filter((a) => a.status === s).length}
            active={filter === s}
            onClick={() => setFilter(s)}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Summary stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {statCards.map((c) => (
            <StatCard key={c.label} Icon={c.Icon} label={c.label} value={c.value} tone={c.tone} />
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <SkeletonTable rows={6} />
        ) : apps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <div className="size-12 bg-accent-yellow border-2 border-ink grid place-items-center mb-3">
              <Calendar className="size-5" strokeWidth={2.5} />
            </div>
            <p className="font-bold">No applications yet</p>
            <p className="text-sm mt-1 text-muted-foreground">Add your first application above</p>
          </div>
        ) : (
          <div className="neo-card overflow-x-auto">
            <table className="table-brutal w-full">
              <thead>
                <tr>
                  <th
                    className="min-w-48 cursor-pointer select-none"
                    onClick={() => toggleSort("program")}
                  >
                    <span className="inline-flex items-center">
                      Program
                      <SortArrow active={sortKey === "program"} dir={sortDir} />
                    </span>
                  </th>
                  <th
                    className="min-w-36 cursor-pointer select-none"
                    onClick={() => toggleSort("deadline")}
                  >
                    <span className="inline-flex items-center">
                      Deadline
                      <SortArrow active={sortKey === "deadline"} dir={sortDir} />
                    </span>
                  </th>
                  <th
                    className="min-w-36 cursor-pointer select-none"
                    onClick={() => toggleSort("status")}
                  >
                    <span className="inline-flex items-center">
                      Status
                      <SortArrow active={sortKey === "status"} dir={sortDir} />
                    </span>
                  </th>
                  <th className="min-w-28">Readiness</th>
                  <th className="text-center w-14" title="Statement of Purpose">
                    SOP
                  </th>
                  <th className="text-center w-12" title="CV / Resume">
                    CV
                  </th>
                  <th className="min-w-32">Recommenders</th>
                  <th className="w-20 text-center">Funded</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((app) => {
                  const meta = STATUS_META[app.status] ?? STATUS_META.tracking;
                  const urgent = daysUntil(app.deadline) < 30;
                  return (
                    <tr
                      key={app.id}
                      className="group"
                      style={urgent ? { borderLeft: "3px solid #E8472A" } : {}}
                    >
                      <td>
                        <div
                          className="font-bold text-sm font-space leading-tight"
                          style={{ color: "#0D0D0D" }}
                        >
                          {app.university}
                        </div>
                        <div className="text-xs font-dm mt-0.5" style={{ color: "#9CA3AF" }}>
                          {app.program}
                        </div>
                        {app.notes && (
                          <div className="text-xs font-dm mt-1 italic" style={{ color: "#5A5A5A" }}>
                            {app.notes}
                          </div>
                        )}
                        {app.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {app.attachments.map((a) => (
                              <span
                                key={a.ref_id}
                                title={a.title}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold font-space"
                                style={{
                                  background: "#EDE6D3",
                                  border: "1.5px solid #0D0D0D",
                                  borderRadius: "4px",
                                  color: "#0D0D0D",
                                }}
                              >
                                <Icon
                                  icon={ATTACH_META[a.kind].icon}
                                  width={10}
                                  style={{ color: ATTACH_META[a.kind].color }}
                                />
                                {ATTACH_META[a.kind].label}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        <DeadlineBadge date={app.deadline} />
                      </td>
                      <td>
                        <select
                          value={app.status}
                          onChange={(e) => setStatus(app, e.target.value as AppStatus)}
                          className="text-xs font-bold font-space px-2 py-0.5 cursor-pointer"
                          style={{
                            background: meta.bg,
                            color: meta.color,
                            border: `1.5px solid ${meta.border}`,
                            borderRadius: "4px",
                          }}
                        >
                          {(Object.keys(STATUS_META) as AppStatus[]).map((s) => (
                            <option
                              key={s}
                              value={s}
                              style={{ background: "#FFFFFF", color: "#0D0D0D" }}
                            >
                              {STATUS_META[s].label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <ReadinessBar value={readiness(app)} />
                      </td>
                      <td className="text-center">
                        <div className="flex justify-center">
                          <DocCell
                            status={app.sop}
                            label="SOP"
                            attached={app.attachments.some((a) => a.kind === "sop")}
                            onCycle={() => cycleDoc(app, "sop")}
                          />
                        </div>
                      </td>
                      <td className="text-center">
                        <div className="flex justify-center">
                          <DocCell
                            status={app.cv}
                            label="CV"
                            attached={app.attachments.some((a) => a.kind === "cv")}
                            onCycle={() => cycleDoc(app, "cv")}
                          />
                        </div>
                      </td>
                      <td>
                        <RecDots recommenders={app.recommenders} />
                        <div className="text-[10px] font-dm mt-0.5" style={{ color: "#9CA3AF" }}>
                          {app.recommenders.filter((r) => r.status === "submitted").length}/
                          {app.recommenders.length} submitted
                        </div>
                      </td>
                      <td className="text-center">
                        {app.funded === true && <StatusPill tone="teal">Yes</StatusPill>}
                        {app.funded === false && <StatusPill tone="orange">No</StatusPill>}
                        {app.funded === "unknown" && <StatusPill tone="muted">?</StatusPill>}
                      </td>
                      <td>
                        <button
                          onClick={() => setEditApp(app)}
                          title="Edit application"
                          className="size-8 grid place-items-center border-2 border-ink text-ink opacity-0 group-hover:opacity-100 transition-all hover:bg-ink hover:text-paper"
                        >
                          <Pencil className="size-4" />
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

      {showAddModal && (
        <AddApplicationModal
          onClose={() => setShowAddModal(false)}
          onAdd={(a) => setApps((prev) => [a, ...prev])}
        />
      )}

      {editApp && (
        <EditApplicationModal
          app={editApp}
          onClose={() => setEditApp(null)}
          onSaved={(updated) =>
            setApps((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
          }
          onDeleted={(id) => setApps((prev) => prev.filter((a) => a.id !== id))}
        />
      )}
    </div>
  );
}
