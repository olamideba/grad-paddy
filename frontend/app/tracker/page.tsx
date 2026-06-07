"use client";

import { useState, useEffect, useRef } from "react";
import { Icon } from "@iconify/react";
import type { Application as ApiApp, TrackerStats, Attachment } from "../../lib/api";
import ConfirmModal from "@/components/ConfirmModal";

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
  recommenders: Array<{ name: string; status: RecommenderStatus }>;
  attachments: Attachment[];
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
    })),
    attachments: a.attachments ?? [],
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
  const urgent = days < 30;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-mono font-semibold" style={{ color: "#0D0D0D" }}>
        {formatted}
      </span>
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold font-space w-fit"
        style={
          urgent
            ? {
                background: "#E8472A",
                color: "#FFFFFF",
                border: "1.5px solid #0D0D0D",
                borderRadius: "4px",
              }
            : {
                background: "#EDE6D3",
                color: "#5A5A5A",
                border: "1.5px solid #0D0D0D",
                borderRadius: "4px",
              }
        }
      >
        <Icon icon="solar:clock-circle-bold" width={9} />
        {days}d left
      </span>
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

const DOC_META: Record<DocStatus, { icon: string; color: string }> = {
  "not-started": { icon: "solar:circle-bold", color: "#C8C0AF" },
  "in-progress": { icon: "solar:danger-triangle-bold", color: "#E8472A" },
  ready: { icon: "solar:check-circle-bold", color: "#4ECDC4" },
};

const DOC_CYCLE: DocStatus[] = ["not-started", "in-progress", "ready"];

// Application readiness: SOP + CV ready, plus each recommender submitted.
function readiness(app: Application): number {
  const items = [
    app.sop === "ready",
    app.cv === "ready",
    ...app.recommenders.map((r) => r.status === "submitted"),
  ];
  if (items.length === 0) return 0;
  return Math.round((items.filter(Boolean).length / items.length) * 100);
}

function ReadinessBar({ value }: { value: number }) {
  const color = value === 100 ? "#4ECDC4" : value >= 50 ? "#0D0D0D" : "#E8472A";
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 h-2.5 overflow-hidden"
        style={{ background: "#EDE6D3", border: "1.5px solid #0D0D0D", borderRadius: "999px" }}
      >
        <div
          className="h-full"
          style={{ width: `${value}%`, background: color, transition: "width 200ms ease-out" }}
        />
      </div>
      <span className="text-[10px] font-mono shrink-0" style={{ color: "#5A5A5A" }}>
        {value}%
      </span>
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  accent = "#0D0D0D",
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  accent?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bouncy inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold font-space"
      style={{
        background: active ? accent : "#FFFFFF",
        color: active ? "#FFFFFF" : "#5A5A5A",
        border: `1.5px solid ${active ? accent : "#C8C0AF"}`,
        borderRadius: "4px",
      }}
    >
      {label}
      <span
        className="text-[10px] font-mono px-1 rounded"
        style={{
          background: active ? "rgba(255,255,255,0.2)" : "#EDE6D3",
          color: active ? "#FFFFFF" : "#9CA3AF",
        }}
      >
        {count}
      </span>
    </button>
  );
}

function DocCell({
  status,
  label,
  onCycle,
}: {
  status: DocStatus;
  label: string;
  onCycle?: () => void;
}) {
  const { icon, color } = DOC_META[status];
  return (
    <button
      type="button"
      onClick={onCycle}
      title={`${label}: ${status.replace(/-/g, " ")} — click to change`}
      className="bouncy p-0.5"
    >
      <Icon icon={icon} width={18} color={color} />
    </button>
  );
}

const REC_STYLE: Record<RecommenderStatus, { bg: string; border: string }> = {
  "not-asked": { bg: "#EDE6D3", border: "#C8C0AF" },
  asked: { bg: "#C8C0AF", border: "#9CA3AF" },
  confirmed: { bg: "#5A5A5A", border: "#0D0D0D" },
  submitted: { bg: "#0D0D0D", border: "#0D0D0D" },
};

function RecDots({ recommenders }: { recommenders: Application["recommenders"] }) {
  return (
    <div className="flex items-center gap-1">
      {recommenders.map((r, i) => (
        <div
          key={i}
          title={`${r.name}: ${r.status.replace(/-/g, " ")}`}
          className="w-3 h-3"
          style={{
            background: REC_STYLE[r.status].bg,
            border: `1px solid ${REC_STYLE[r.status].border}`,
            borderRadius: "2px",
          }}
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
      onAdd(mapApp(res.data));
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
      <div
        className="w-full max-w-lg flex flex-col max-h-[90vh] overflow-y-auto"
        style={{
          background: "#F7F0E3",
          border: "2px solid #0D0D0D",
          boxShadow: "6px 6px 0 #0D0D0D",
          borderRadius: "4px",
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center justify-between shrink-0"
          style={{ background: "#0D0D0D", borderRadius: "2px 2px 0 0" }}
        >
          <span className="font-bold font-space text-sm" style={{ color: "#FFFFFF" }}>
            Add Application
          </span>
          <button onClick={onClose} className="bouncy" style={{ color: "rgba(255,255,255,0.5)" }}>
            <Icon icon="solar:close-circle-bold" width={18} />
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
              <span className="text-sm">{saving ? "Saving…" : "Add Application"}</span>
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
  const [recs, setRecs] = useState<{ name: string; status: RecommenderStatus }[]>(app.recommenders);
  const [recInput, setRecInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>(app.attachments);
  const [linkOptions, setLinkOptions] = useState<Attachment[]>([]);
  const [linkBusy, setLinkBusy] = useState(false);
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
        const cvOpts: Attachment[] = cvsRes.data
          .filter((c) => c.status === "approved")
          .map((c) => ({ kind: "cv", ref_id: c.id, title: c.title }));
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
      setRecs((r) => [...r, { name, status: "not-asked" }]);
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
        recommenders: recs.map((r) => ({ name: r.name, status: r.status.replace(/-/g, "_") })),
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
      <div
        className="w-full max-w-lg flex flex-col max-h-[90vh] overflow-y-auto"
        style={{
          background: "#F7F0E3",
          border: "2px solid #0D0D0D",
          boxShadow: "6px 6px 0 #0D0D0D",
          borderRadius: "4px",
        }}
      >
        <div
          className="px-5 py-4 flex items-center justify-between shrink-0"
          style={{ background: "#0D0D0D", borderRadius: "2px 2px 0 0" }}
        >
          <span className="font-bold font-space text-sm" style={{ color: "#FFFFFF" }}>
            Edit Application
          </span>
          <button onClick={onClose} className="bouncy" style={{ color: "rgba(255,255,255,0.5)" }}>
            <Icon icon="solar:close-circle-bold" width={18} />
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
                    className="flex items-center gap-2 px-2 py-1 text-[11px] font-dm"
                    style={{
                      background: "#EDE6D3",
                      border: "1.5px solid #C8C0AF",
                      borderRadius: "4px",
                    }}
                  >
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
                      onClick={() => setRecs((rs) => rs.filter((x) => x.name !== r.name))}
                      className="shrink-0"
                      style={{ color: "#9CA3AF" }}
                    >
                      <Icon icon="solar:close-circle-bold" width={12} />
                    </button>
                  </div>
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

          <div>
            <label
              className="block text-[11px] font-bold font-space uppercase tracking-wider mb-1"
              style={{ color: "#5A5A5A" }}
            >
              Attachments
            </label>
            {(() => {
              const attachedIds = new Set(attachments.map((a) => a.ref_id));
              const available = linkOptions.filter((o) => !attachedIds.has(o.ref_id));
              return (
                <>
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
                        ? "No approved documents to link"
                        : "Link an approved SOP / narrative / CV…"}
                    </option>
                    {available.map((o) => (
                      <option key={o.ref_id} value={o.ref_id}>
                        {ATTACH_META[o.kind].label}: {o.title}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] font-dm mt-1" style={{ color: "#9CA3AF" }}>
                    Only approved documents appear here. Approve them in Drafts or Documents.
                  </p>
                  {attachments.length > 0 && (
                    <div className="flex flex-col gap-1.5 mt-2">
                      {attachments.map((a) => (
                        <div
                          key={a.ref_id}
                          className="flex items-center gap-2 px-2 py-1.5 text-[11px] font-dm"
                          style={{
                            background: "#EDE6D3",
                            border: "1.5px solid #C8C0AF",
                            borderRadius: "4px",
                          }}
                        >
                          <Icon
                            icon={ATTACH_META[a.kind].icon}
                            width={13}
                            className="shrink-0"
                            style={{ color: ATTACH_META[a.kind].color }}
                          />
                          <span
                            className="shrink-0 font-semibold font-space"
                            style={{ color: "#9CA3AF" }}
                          >
                            {ATTACH_META[a.kind].label}
                          </span>
                          <span className="flex-1 min-w-0 truncate">{a.title}</span>
                          <button
                            type="button"
                            onClick={() => unlinkAttachment(a.ref_id)}
                            className="shrink-0"
                            style={{ color: "#9CA3AF" }}
                            title="Unlink"
                          >
                            <Icon icon="solar:close-circle-bold" width={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {error && (
            <p className="text-xs font-dm font-semibold" style={{ color: "#E8472A" }}>
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving || deleting} className="btn-coral btn-sm flex-1">
              {saving ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
              ) : (
                <Icon icon="solar:check-circle-bold" width={14} />
              )}
              <span className="text-sm">{saving ? "Saving…" : "Save Changes"}</span>
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={saving || deleting}
              className="btn-white btn-sm"
              style={{ color: "#E8472A", borderColor: "#E8472A" }}
            >
              <Icon icon="solar:trash-bin-trash-bold" width={14} />
              <span className="text-sm">Delete</span>
            </button>
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
      <div
        className="px-4 sm:px-6 py-4 shrink-0"
        style={{ background: "#0D0D0D", borderBottom: "2px solid #E8472A" }}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1
              className="text-sm font-bold font-space flex items-center gap-2"
              style={{ color: "#FFFFFF" }}
            >
              <Icon icon="solar:calendar-bold" width={15} style={{ color: "#E8472A" }} />
              Application Tracker
            </h1>
            <p className="text-xs font-dm mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
              {loading ? "Loading…" : `${apps.length} applications · ${totalDrafting} drafting`}
              {!loading && totalDue30 > 0 && (
                <span style={{ color: "#E8472A" }}>
                  {" "}
                  · {totalDue30} deadline{totalDue30 > 1 ? "s" : ""} in &lt;30 days
                </span>
              )}
            </p>
          </div>
          <button className="btn-coral btn-sm shrink-0" onClick={() => setShowAddModal(true)}>
            <Icon icon="solar:add-circle-bold" width={14} />
            <span className="text-sm hidden sm:inline">Add Application</span>
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div
        className="px-4 sm:px-6 py-3 shrink-0 flex items-center gap-2 flex-wrap"
        style={{ background: "#FFFFFF", borderBottom: "2px solid #0D0D0D" }}
      >
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
          accent="#E8472A"
          onClick={() => setFilter("due-soon")}
        />
        <span className="w-px h-5" style={{ background: "#E0D8CA" }} />
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
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {/* Summary stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-5">
          {statCards.map(({ label, icon, value, accent }) => (
            <div
              key={label}
              className="p-4 flex items-center gap-4"
              style={{
                background: "#FFFFFF",
                border: "2px solid #0D0D0D",
                boxShadow: "3px 3px 0 #0D0D0D",
                borderRadius: "4px",
              }}
            >
              <div
                className="w-10 h-10 flex items-center justify-center flex-shrink-0"
                style={{ background: accent, border: "2px solid #0D0D0D", borderRadius: "4px" }}
              >
                <Icon
                  icon={icon}
                  width={18}
                  style={{ color: accent === "#0D0D0D" ? "#FFFFFF" : "#0D0D0D" }}
                />
              </div>
              <div>
                <div
                  className="text-2xl font-bold font-mono leading-none"
                  style={{ color: "#0D0D0D" }}
                >
                  {value}
                </div>
                <div
                  className="text-[10px] font-semibold uppercase tracking-wider font-space mt-1"
                  style={{ color: "#9CA3AF" }}
                >
                  {label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div
              className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"
              style={{ color: "#E8472A" }}
            />
          </div>
        ) : apps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Icon
              icon="solar:calendar-bold"
              width={32}
              style={{ color: "#B0A898" }}
              className="mb-3"
            />
            <p className="font-semibold font-space" style={{ color: "#5A5A5A" }}>
              No applications yet
            </p>
            <p className="text-sm font-dm mt-1" style={{ color: "#9CA3AF" }}>
              Add your first application above
            </p>
          </div>
        ) : (
          <div
            className="overflow-x-auto"
            style={{
              border: "2px solid #0D0D0D",
              boxShadow: "4px 4px 0 #0D0D0D",
              borderRadius: "4px",
            }}
          >
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
                            onCycle={() => cycleDoc(app, "sop")}
                          />
                        </div>
                      </td>
                      <td className="text-center">
                        <div className="flex justify-center">
                          <DocCell status={app.cv} label="CV" onCycle={() => cycleDoc(app, "cv")} />
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
                        {app.funded === true && <span className="badge-teal">Yes</span>}
                        {app.funded === false && <span className="badge-coral">No</span>}
                        {app.funded === "unknown" && <span className="badge-gray">?</span>}
                      </td>
                      <td>
                        <button
                          onClick={() => setEditApp(app)}
                          title="Edit application"
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bouncy"
                          style={{
                            border: "1.5px solid #0D0D0D",
                            color: "#9CA3AF",
                            borderRadius: "4px",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#EDE6D3";
                            e.currentTarget.style.color = "#0D0D0D";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "";
                            e.currentTarget.style.color = "#9CA3AF";
                          }}
                        >
                          <Icon icon="solar:pen-bold" width={14} />
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
