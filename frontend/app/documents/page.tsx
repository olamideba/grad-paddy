"use client";

import { useState, useEffect, useRef } from "react";
import { Folder, UploadCloud, FileText, Eye, Pencil, Trash2, AlertTriangle } from "lucide-react";
import type { CV } from "../../lib/api";
import ConfirmModal from "@/components/ConfirmModal";
import { SkeletonCardGrid } from "@/components/Skeleton";
import { NeoButton } from "@/components/Neo";

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

  return (
    <div className="flex flex-col h-full overflow-hidden bg-paper font-space">
      {/* Header — black branded bar */}
      <div className="px-6 py-4 shrink-0 relative flex items-center gap-4 bg-ink text-paper border-b-2 border-ink">
        <div className="size-9 grid place-items-center shrink-0 bg-accent-orange border-2 border-paper">
          <Folder className="size-5 text-paper" strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight leading-tight">Documents</h1>
          <p className="text-xs mt-0.5 truncate text-paper/70">
            {loading ? "Loading…" : `${cvs.length} resume${cvs.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <input ref={fileRef} type="file" accept={ACCEPT} onChange={handleFile} className="hidden" />
        <NeoButton
          variant="primary"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="shrink-0"
        >
          {uploading ? (
            <span className="size-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
          ) : (
            <UploadCloud className="size-4" />
          )}
          <span className="hidden sm:inline">{uploading ? "Uploading…" : "Upload CV"}</span>
        </NeoButton>
        <div className="absolute -bottom-[2px] left-0 right-0 h-[3px] bg-accent-orange" />
      </div>

      {error && (
        <div className="px-6 py-2 shrink-0 text-xs flex items-center gap-2 bg-[#FFF0ED] border-b-2 border-accent-orange text-accent-orange">
          <AlertTriangle className="size-3.5" strokeWidth={2.5} />
          {error}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Dropzone */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="neo-card p-8 border-dashed text-center bg-paper-2 w-full block hover:bg-paper transition-colors"
        >
          <div className="mx-auto size-14 bg-accent-yellow border-2 border-ink grid place-items-center mb-3">
            <UploadCloud className="size-6" strokeWidth={2.5} />
          </div>
          <div className="font-bold text-lg">Drop a PDF or DOCX here</div>
          <div className="text-sm text-muted-foreground mt-1">
            Or click upload — agents will use your latest CV automatically.
          </div>
        </button>

        {loading ? (
          <SkeletonCardGrid
            count={6}
            gridClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          />
        ) : cvs.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-4">
            No resumes yet — upload one to attach it to your applications.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {cvs.map((cv) => (
              <article key={cv.id} className="neo-card overflow-hidden">
                <div className="p-4 flex gap-3">
                  <div className="size-12 bg-accent-teal border-2 border-ink grid place-items-center shrink-0">
                    <FileText className="size-5" strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0">
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
                      <div className="font-bold truncate" title={cv.title}>
                        {cv.title}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      {cv.filename} · {formatSize(cv.size)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {timeAgo(cv.updated_at)}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 border-t-2 border-ink divide-x-2 divide-ink">
                  <button
                    onClick={() => openCv(cv)}
                    className="py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-paper transition-colors"
                  >
                    {busyId === cv.id ? (
                      <span className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}{" "}
                    Open
                  </button>
                  <button
                    onClick={() => startRename(cv)}
                    className="py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-paper transition-colors"
                  >
                    <Pencil className="size-3.5" /> Rename
                  </button>
                  <button
                    onClick={() => setConfirmDelete(cv)}
                    className="py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 text-accent-orange hover:bg-accent-orange hover:text-white transition-colors"
                  >
                    <Trash2 className="size-3.5" /> Delete
                  </button>
                </div>
              </article>
            ))}
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
