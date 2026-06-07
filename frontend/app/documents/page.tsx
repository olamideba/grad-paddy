"use client";

import { useState, useEffect, useRef } from "react";
import { Icon } from "@iconify/react";
import type { CV } from "../../lib/api";
import ConfirmModal from "@/components/ConfirmModal";

const ACCEPT = ".pdf,.doc,.docx";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

function fileIcon(contentType: string): string {
  if (contentType.includes("pdf")) return "solar:file-text-bold";
  return "solar:document-bold";
}

export default function DocumentsPage() {
  const [cvs, setCvs] = useState<CV[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<CV | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    import("../../lib/api")
      .then(({ cvsApi }) => cvsApi.list())
      .then((res) => setCvs(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { cvsApi } = await import("../../lib/api");
      const res = await cvsApi.upload(file);
      setCvs((prev) => [res.data, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? humanizeError(err.message) : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function humanizeError(msg: string): string {
    if (msg.startsWith("415")) return "Only PDF or Word documents are allowed.";
    if (msg.startsWith("413")) return "File exceeds the 10 MB limit.";
    return "Upload failed. Try again.";
  }

  async function openCv(cv: CV) {
    setBusyId(cv.id);
    try {
      const { cvsApi } = await import("../../lib/api");
      const url = await cvsApi.fetchBlobUrl(cv.id);
      window.open(url, "_blank", "noopener");
      // Revoke later so the new tab has time to load it.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setError("Couldn't open the file.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleApprove(cv: CV) {
    const next = cv.status === "approved" ? "draft" : "approved";
    setCvs((prev) => prev.map((c) => (c.id === cv.id ? { ...c, status: next } : c)));
    try {
      const { cvsApi } = await import("../../lib/api");
      await cvsApi.update(cv.id, { status: next });
    } catch {
      setCvs((prev) => prev.map((c) => (c.id === cv.id ? { ...c, status: cv.status } : c)));
    }
  }

  function startRename(cv: CV) {
    setRenamingId(cv.id);
    setRenameDraft(cv.title);
  }

  async function commitRename(cv: CV) {
    const title = renameDraft.trim();
    setRenamingId(null);
    if (!title || title === cv.title) return;
    setCvs((prev) => prev.map((c) => (c.id === cv.id ? { ...c, title } : c)));
    try {
      const { cvsApi } = await import("../../lib/api");
      await cvsApi.update(cv.id, { title });
    } catch {
      setCvs((prev) => prev.map((c) => (c.id === cv.id ? { ...c, title: cv.title } : c)));
    }
  }

  async function performDelete(cv: CV) {
    setConfirmDelete(null);
    setCvs((prev) => prev.filter((c) => c.id !== cv.id));
    try {
      const { cvsApi } = await import("../../lib/api");
      await cvsApi.delete(cv.id);
    } catch {
      // best-effort; optimistic removal stays
    }
  }

  const approvedCount = cvs.filter((c) => c.status === "approved").length;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#F7F0E3" }}>
      {/* Header — black */}
      <div
        className="px-4 sm:px-6 py-4 shrink-0"
        style={{ background: "#0D0D0D", borderBottom: "2px solid #E8472A" }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1
              className="text-sm font-bold font-space flex items-center gap-2"
              style={{ color: "#FFFFFF" }}
            >
              <Icon icon="solar:folder-with-files-bold" width={15} style={{ color: "#E8472A" }} />
              Documents
            </h1>
            <p
              className="text-xs font-dm mt-0.5 truncate"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              {loading
                ? "Loading…"
                : `${cvs.length} resume${cvs.length === 1 ? "" : "s"} · ${approvedCount} approved`}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              onChange={handleFile}
              className="hidden"
            />
            <button
              className="btn-coral btn-sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
              ) : (
                <Icon icon="solar:upload-bold" width={14} />
              )}
              <span className="text-sm hidden sm:inline">
                {uploading ? "Uploading…" : "Upload CV"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div
          className="px-4 sm:px-6 py-2 shrink-0 text-xs font-dm flex items-center gap-2"
          style={{ background: "#FFF0ED", borderBottom: "2px solid #E8472A", color: "#E8472A" }}
        >
          <Icon icon="solar:danger-triangle-bold" width={14} />
          {error}
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div
              className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"
              style={{ color: "#E8472A" }}
            />
          </div>
        ) : cvs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Icon
              icon="solar:folder-with-files-bold"
              width={36}
              style={{ color: "#B0A898" }}
              className="mb-3"
            />
            <p className="font-semibold font-space" style={{ color: "#5A5A5A" }}>
              No resumes yet
            </p>
            <p className="text-sm font-dm mt-1 mb-4" style={{ color: "#9CA3AF" }}>
              Upload a PDF or Word resume to attach it to your applications.
            </p>
            <button className="btn-coral btn-sm" onClick={() => fileRef.current?.click()}>
              <Icon icon="solar:upload-bold" width={14} />
              Upload CV
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cvs.map((cv) => {
              const approved = cv.status === "approved";
              return (
                <div key={cv.id} className="card-brutal flex flex-col p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-9 h-9 flex items-center justify-center shrink-0"
                      style={{
                        background: approved ? "#4ECDC4" : "#EDE6D3",
                        border: "2px solid #0D0D0D",
                        borderRadius: "4px",
                      }}
                    >
                      <Icon
                        icon={fileIcon(cv.content_type)}
                        width={18}
                        style={{ color: "#0D0D0D" }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      {renamingId === cv.id ? (
                        <input
                          autoFocus
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onBlur={() => commitRename(cv)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename(cv);
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          className="input-brutal w-full text-sm py-1"
                        />
                      ) : (
                        <div
                          className="text-sm font-bold font-space truncate"
                          style={{ color: "#0D0D0D" }}
                          title={cv.title}
                        >
                          {cv.title}
                        </div>
                      )}
                      <div className="text-xs font-dm mt-0.5 truncate" style={{ color: "#9CA3AF" }}>
                        {cv.filename} · {formatSize(cv.size)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <span
                      className="text-[10px] font-bold font-space px-2 py-0.5"
                      style={{
                        background: approved ? "#4ECDC4" : "#EDE6D3",
                        color: approved ? "#0D0D0D" : "#5A5A5A",
                        border: "1.5px solid #0D0D0D",
                        borderRadius: "4px",
                      }}
                    >
                      {approved ? "Approved" : "Draft"}
                    </span>
                    <span className="text-[11px] font-dm" style={{ color: "#B0A898" }}>
                      {timeAgo(cv.updated_at)}
                    </span>
                  </div>

                  <div
                    className="flex items-center gap-1 mt-3 pt-3"
                    style={{ borderTop: "1px solid #EDE6D3" }}
                  >
                    <CardAction
                      icon={busyId === cv.id ? "svg-spinners:ring-resize" : "solar:eye-bold"}
                      label="Open"
                      onClick={() => openCv(cv)}
                    />
                    <CardAction
                      icon={approved ? "solar:close-circle-bold" : "solar:check-circle-bold"}
                      label={approved ? "Unapprove" : "Approve"}
                      onClick={() => toggleApprove(cv)}
                      accent={!approved}
                    />
                    <CardAction
                      icon="solar:pen-bold"
                      label="Rename"
                      onClick={() => startRename(cv)}
                    />
                    <CardAction
                      icon="solar:trash-bin-trash-bold"
                      label="Delete"
                      onClick={() => setConfirmDelete(cv)}
                      danger
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {confirmDelete && (
        <ConfirmModal
          title="Delete resume"
          message={`Delete “${confirmDelete.title}”? This removes the file permanently and unlinks it from any applications.`}
          confirmLabel="Delete"
          onConfirm={() => performDelete(confirmDelete)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

function CardAction({
  icon,
  label,
  onClick,
  danger,
  accent,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
  accent?: boolean;
}) {
  const color = danger ? "#E8472A" : accent ? "#0D0D0D" : "#5A5A5A";
  return (
    <button
      onClick={onClick}
      title={label}
      className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold font-space bouncy"
      style={{ color, border: "1.5px solid transparent", borderRadius: "4px" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? "#FFF0ED" : "#EDE6D3";
        e.currentTarget.style.border = `1.5px solid ${danger ? "#E8472A" : "#0D0D0D"}`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "";
        e.currentTarget.style.border = "1.5px solid transparent";
      }}
    >
      <Icon icon={icon} width={13} />
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}
