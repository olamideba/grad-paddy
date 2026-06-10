"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { ChevronDown, Plus, Star, Folder, Trash2, MoreVertical } from "lucide-react";
import clsx from "clsx";
import { useChatSessions } from "@/context/ChatSessionsContext";
import { SidebarSkeleton } from "@/components/Skeleton";
import type { Session, Group } from "@/lib/api";

const DAY_MS = 86_400_000;

// Bucket sessions into timeline groups (newest first) by last activity.
function groupSessionsByTime(sessions: Session[]): { label: string; items: Session[] }[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const order: string[] = [];
  const buckets = new Map<string, Session[]>();
  const push = (label: string, s: Session) => {
    if (!buckets.has(label)) {
      buckets.set(label, []);
      order.push(label);
    }
    buckets.get(label)!.push(s);
  };
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
  for (const s of sorted) {
    const t = new Date(s.updated_at).getTime();
    if (t >= startOfToday) push("Today", s);
    else if (t >= startOfToday - DAY_MS) push("Yesterday", s);
    else if (t >= startOfToday - 7 * DAY_MS) push("Previous 7 Days", s);
    else if (t >= startOfToday - 30 * DAY_MS) push("Previous 30 Days", s);
    else push(new Date(t).toLocaleString(undefined, { month: "long", year: "numeric" }), s);
  }
  return order.map((label) => ({ label, items: buckets.get(label)! }));
}

const byUpdated = (a: Session, b: Session) =>
  new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();

type MenuState = { session: Session; x: number; y: number };

export default function ChatHistory({
  fill = false,
  onNavigate,
}: {
  fill?: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const {
    sessions,
    setSessions,
    activeSessionId,
    setActiveSessionId,
    sessionsLoading,
    setPendingGroupId,
  } = useChatSessions();

  const [groups, setGroups] = useState<Group[]>([]);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [addToGroupSession, setAddToGroupSession] = useState<Session | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<Group | null>(null);
  const [deleteChatTarget, setDeleteChatTarget] = useState<Session | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [panelOpen, setPanelOpen] = useState(true);
  const [height, setHeight] = useState(340);
  const rootRef = useRef<HTMLDivElement>(null);

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    const startY = e.clientY;
    const startH = height;
    // Cap growth to the flex spacer above us + our current height = all the free
    // space between the nav and the footer. Growing past this collapses the
    // spacer and pushes the profile footer off-screen, so clamp to it.
    const spacer = rootRef.current?.previousElementSibling as HTMLElement | null;
    const maxH = Math.max(140, (spacer?.offsetHeight ?? 0) + startH);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "row-resize";
    function move(ev: MouseEvent) {
      // Drag up grows the panel.
      const next = startH + (startY - ev.clientY);
      setHeight(Math.min(Math.max(140, next), maxH));
    }
    function up() {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  }

  function toggleGroup(id: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    import("@/lib/api")
      .then(({ groupsApi }) => groupsApi.list())
      .then((r) => setGroups(r.data))
      .catch(() => {});
  }, []);

  function selectSession(id: string) {
    setPendingGroupId(null);
    setActiveSessionId(id);
    router.push("/chat");
    onNavigate?.();
  }

  function newChat(groupId: string | null) {
    setPendingGroupId(groupId);
    setActiveSessionId(null);
    if (groupId)
      setCollapsedGroups((prev) => {
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
    router.push("/chat");
    onNavigate?.();
  }

  function openMenu(e: React.MouseEvent, session: Session) {
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu({ session, x: r.right, y: r.bottom });
  }

  // ── Mutations (optimistic + API) ──────────────────────────────────────────
  function patchSession(id: string, patch: Partial<Session>) {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function startRename(session: Session) {
    setRenamingId(session.id);
    setRenameDraft(session.title);
    setMenu(null);
  }

  async function commitRename(session: Session) {
    const title = renameDraft.trim();
    setRenamingId(null);
    if (!title || title === session.title) return;
    patchSession(session.id, { title });
    try {
      const { sessionsApi } = await import("@/lib/api");
      await sessionsApi.rename(session.id, title);
    } catch {
      // ignore; optimistic value stays
    }
  }

  async function toggleStar(session: Session) {
    setMenu(null);
    const original = !!session.starred;
    const next = !original;
    patchSession(session.id, { starred: next });
    try {
      const { sessionsApi } = await import("@/lib/api");
      const res = await sessionsApi.toggleStar(session.id);
      // Only trust the server value if it actually came back as a boolean;
      // otherwise keep the optimistic flip so the star never silently vanishes.
      const serverVal = typeof res.data?.starred === "boolean" ? res.data.starred : next;
      patchSession(session.id, { starred: serverVal });
    } catch {
      patchSession(session.id, { starred: original });
    }
  }

  async function assignGroup(sessionId: string, groupId: string | null) {
    patchSession(sessionId, { group_id: groupId });
    try {
      const { sessionsApi } = await import("@/lib/api");
      await sessionsApi.setGroup(sessionId, groupId);
    } catch {
      // ignore
    }
  }

  async function createGroup(name: string): Promise<Group | null> {
    try {
      const { groupsApi } = await import("@/lib/api");
      const res = await groupsApi.create(name);
      setGroups((prev) => [res.data, ...prev]);
      return res.data;
    } catch {
      return null;
    }
  }

  async function deleteSession(session: Session) {
    setSessions((prev) => prev.filter((s) => s.id !== session.id));
    if (activeSessionId === session.id) {
      setActiveSessionId(null);
      router.push("/chat");
    }
    try {
      const { sessionsApi } = await import("@/lib/api");
      await sessionsApi.delete(session.id);
    } catch {
      // ignore
    }
  }

  async function deleteGroup(group: Group, withSessions: boolean) {
    setDeleteGroupTarget(null);
    setGroups((prev) => prev.filter((g) => g.id !== group.id));
    if (withSessions) {
      const removedIds = new Set(sessions.filter((s) => s.group_id === group.id).map((s) => s.id));
      setSessions((prev) => prev.filter((s) => !removedIds.has(s.id)));
      if (activeSessionId && removedIds.has(activeSessionId)) {
        setActiveSessionId(null);
        router.push("/chat");
      }
    } else {
      setSessions((prev) =>
        prev.map((s) => (s.group_id === group.id ? { ...s, group_id: null } : s))
      );
    }
    try {
      const { groupsApi } = await import("@/lib/api");
      await groupsApi.delete(group.id, withSessions);
    } catch {
      // ignore
    }
  }

  // ── Section building ──────────────────────────────────────────────────────
  const starred = sessions.filter((s) => s.starred).sort(byUpdated);
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const grouped = new Map<string, Session[]>();
  const ungrouped: Session[] = [];
  for (const s of sessions) {
    if (s.starred) continue;
    if (s.group_id && groupById.has(s.group_id)) {
      if (!grouped.has(s.group_id)) grouped.set(s.group_id, []);
      grouped.get(s.group_id)!.push(s);
    } else {
      ungrouped.push(s);
    }
  }

  const renderRow = (s: Session) => (
    <Row
      key={s.id}
      session={s}
      active={activeSessionId === s.id}
      renaming={renamingId === s.id}
      renameDraft={renameDraft}
      setRenameDraft={setRenameDraft}
      onCommitRename={() => commitRename(s)}
      onCancelRename={() => setRenamingId(null)}
      onSelect={() => selectSession(s.id)}
      onMenu={(e) => openMenu(e, s)}
    />
  );

  return (
    <div
      ref={rootRef}
      className={clsx("flex flex-col min-h-0", fill ? "flex-1" : "shrink")}
      style={{
        borderTop: "2px solid #0D0D0D",
        // Preferred height when open, but allowed to shrink (min-h-0 + shrink) so
        // a short viewport collapses the list's scroll area instead of pushing
        // the profile footer off-screen.
        flexBasis: !fill && panelOpen ? height : undefined,
      }}
    >
      {/* Resize handle (drag to adjust height) — desktop only */}
      {panelOpen && !fill && (
        <div
          onMouseDown={startResize}
          title="Drag to resize"
          className="group/resize h-2 shrink-0 cursor-row-resize flex items-center justify-center"
        >
          <div className="h-1 w-10 rounded-full bg-[#C8C0AF] transition-all group-hover/resize:w-16 group-hover/resize:bg-[#0D0D0D]" />
        </div>
      )}

      <div className="flex items-center justify-between gap-1 px-2 py-1.5 flex-shrink-0">
        <button
          onClick={() => setPanelOpen((v) => !v)}
          className="flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 transition-colors hover:bg-paper"
          title={panelOpen ? "Collapse chats" : "Expand chats"}
        >
          <ChevronDown
            strokeWidth={2.5}
            className={clsx(
              "size-4 shrink-0 text-ink transition-transform duration-150",
              !panelOpen && "-rotate-90"
            )}
          />
          <span className="text-sm font-bold uppercase tracking-wide text-ink">Chats</span>
          <span className="text-[11px] font-mono px-1.5 py-0.5 border-2 border-ink text-ink">
            {sessions.length}
          </span>
        </button>
        <button
          onClick={() => newChat(null)}
          className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-accent-orange hover:underline"
        >
          <Plus className="size-3.5" />
          New Chat
        </button>
      </div>

      {panelOpen && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {sessionsLoading ? (
            <SidebarSkeleton />
          ) : sessions.length === 0 && groups.length === 0 ? (
            <p className="text-[11px] text-center py-4 px-4" style={{ color: "#9CA3AF" }}>
              No chats yet
            </p>
          ) : (
            <>
              {starred.length > 0 && (
                <Section label="Starred" accent>
                  {starred.map(renderRow)}
                </Section>
              )}

              {groups.length > 0 && (
                <div className="pt-1">
                  <div className="px-4 pt-2 pb-1">
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                      Groups
                    </span>
                  </div>
                  {groups.map((g) => {
                    const items = (grouped.get(g.id) ?? []).sort(byUpdated);
                    return (
                      <GroupFolder
                        key={g.id}
                        group={g}
                        count={items.length}
                        open={!collapsedGroups.has(g.id)}
                        onToggle={() => toggleGroup(g.id)}
                        onNewChat={() => newChat(g.id)}
                        onDelete={() => setDeleteGroupTarget(g)}
                      >
                        {items.length > 0 ? (
                          items.map(renderRow)
                        ) : (
                          <p className="text-[11px] px-4 py-1.5" style={{ color: "#B0A898" }}>
                            No chats yet
                          </p>
                        )}
                      </GroupFolder>
                    );
                  })}
                </div>
              )}

              {ungrouped.length > 0 && (
                <div className="pt-1">
                  {groupSessionsByTime(ungrouped).map((bucket) => (
                    <Section key={bucket.label} label={bucket.label}>
                      {bucket.items.map(renderRow)}
                    </Section>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {menu && (
        <ContextMenu
          state={menu}
          onClose={() => setMenu(null)}
          onRename={() => startRename(menu.session)}
          onToggleStar={() => toggleStar(menu.session)}
          onAddToGroup={() => {
            setAddToGroupSession(menu.session);
            setMenu(null);
          }}
          onDelete={() => {
            setDeleteChatTarget(menu.session);
            setMenu(null);
          }}
        />
      )}

      {deleteChatTarget && (
        <DeleteChatModal
          session={deleteChatTarget}
          onClose={() => setDeleteChatTarget(null)}
          onConfirm={() => {
            deleteSession(deleteChatTarget);
            setDeleteChatTarget(null);
          }}
        />
      )}

      {addToGroupSession && (
        <AddToGroupModal
          session={addToGroupSession}
          groups={groups}
          onClose={() => setAddToGroupSession(null)}
          onAssign={(gid) => {
            assignGroup(addToGroupSession.id, gid);
            setAddToGroupSession(null);
          }}
          onCreateGroup={createGroup}
        />
      )}

      {deleteGroupTarget && (
        <DeleteGroupModal
          group={deleteGroupTarget}
          count={sessions.filter((s) => s.group_id === deleteGroupTarget.id).length}
          onClose={() => setDeleteGroupTarget(null)}
          onDelete={(withSessions) => deleteGroup(deleteGroupTarget, withSessions)}
        />
      )}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function Section({
  label,
  accent,
  onDelete,
  children,
}: {
  label: string;
  accent?: boolean;
  onDelete?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-1">
      <div className="group/section flex items-center justify-between px-4 pt-2 pb-1">
        <span
          className={clsx(
            "flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] truncate",
            accent ? "text-accent-orange" : "text-muted-foreground"
          )}
        >
          {accent && <Star className="size-3 shrink-0 fill-current" />}
          {label}
        </span>
        {onDelete && (
          <button
            onClick={onDelete}
            title="Delete group"
            className="shrink-0 opacity-0 group-hover/section:opacity-100 transition-opacity p-0.5 text-muted-foreground hover:text-accent-orange"
          >
            <Trash2 className="size-3" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Group folder (collapsible) ────────────────────────────────────────────────

function GroupFolder({
  group,
  count,
  open,
  onToggle,
  onNewChat,
  onDelete,
  children,
}: {
  group: Group;
  count: number;
  open: boolean;
  onToggle: () => void;
  onNewChat: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        className="group/folder flex items-center gap-2 px-4 py-1.5 cursor-pointer select-none transition-colors hover:bg-paper"
        onClick={onToggle}
      >
        <ChevronDown
          strokeWidth={2.5}
          className={clsx(
            "size-3.5 shrink-0 text-muted-foreground transition-transform duration-150",
            !open && "-rotate-90"
          )}
        />
        <Folder className="size-4 shrink-0 text-accent-orange" />
        <span className="flex-1 min-w-0 text-sm font-bold truncate text-ink">{group.name}</span>
        <span className="text-[11px] font-mono shrink-0 px-1.5 border-2 border-ink text-ink group-hover/folder:hidden">
          {count}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNewChat();
          }}
          title="New chat in this group"
          className="shrink-0 opacity-0 group-hover/folder:opacity-100 transition-opacity p-0.5 text-muted-foreground hover:text-ink"
        >
          <Plus className="size-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete group"
          className="shrink-0 opacity-0 group-hover/folder:opacity-100 transition-opacity p-0.5 text-muted-foreground hover:text-accent-orange"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {open && <div className="ml-4 border-l-2 border-cream-dark">{children}</div>}
    </div>
  );
}

// ── Session row ───────────────────────────────────────────────────────────────

function Row({
  session,
  active,
  renaming,
  renameDraft,
  setRenameDraft,
  onCommitRename,
  onCancelRename,
  onSelect,
  onMenu,
}: {
  session: Session;
  active: boolean;
  renaming: boolean;
  renameDraft: string;
  setRenameDraft: (v: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onSelect: () => void;
  onMenu: (e: React.MouseEvent) => void;
}) {
  if (renaming) {
    return (
      <div className="px-4 py-1">
        <input
          autoFocus
          value={renameDraft}
          onChange={(e) => setRenameDraft(e.target.value)}
          onBlur={onCommitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommitRename();
            if (e.key === "Escape") onCancelRename();
          }}
          className="input-brutal w-full text-[12px] py-1"
        />
      </div>
    );
  }
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
      className={clsx(
        "group flex items-center gap-2 px-4 py-1.5 w-full text-left cursor-pointer border-l-2 transition-colors",
        active ? "bg-accent-yellow border-accent-orange" : "border-transparent hover:bg-paper"
      )}
    >
      {session.starred && (
        <Star className="size-3.5 shrink-0 fill-accent-orange text-accent-orange" />
      )}
      <span className="flex-1 min-w-0 text-xs font-medium truncate text-ink">{session.title}</span>
      <button
        onClick={onMenu}
        title="Options"
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-ink"
      >
        <MoreVertical className="size-4" />
      </button>
    </div>
  );
}

// ── Kebab dropdown (portaled) ─────────────────────────────────────────────────

function ContextMenu({
  state,
  onClose,
  onRename,
  onToggleStar,
  onAddToGroup,
  onDelete,
}: {
  state: MenuState;
  onClose: () => void;
  onRename: () => void;
  onToggleStar: () => void;
  onAddToGroup: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);

  const item = "w-full flex items-center gap-2 px-3 py-2 text-xs font-space text-left bouncy";
  const width = 184;
  const left = Math.max(8, Math.min(state.x - width, window.innerWidth - width - 8));
  const top = Math.min(state.y + 4, window.innerHeight - 180);

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[70] overflow-hidden"
      style={{
        left,
        top,
        width,
        background: "#FFFFFF",
        border: "2px solid #0D0D0D",
        boxShadow: "4px 4px 0 #0D0D0D",
        borderRadius: "4px",
      }}
    >
      <MenuButton className={item} icon="solar:pen-bold" label="Rename" onClick={onRename} />
      <MenuButton
        className={item}
        icon="solar:star-bold"
        label={state.session.starred ? "Unstar" : "Star"}
        onClick={onToggleStar}
      />
      <MenuButton
        className={item}
        icon="solar:folder-with-files-bold"
        label="Add to group"
        onClick={onAddToGroup}
      />
      <MenuButton
        className={item}
        icon="solar:trash-bin-trash-bold"
        label="Delete"
        onClick={onDelete}
        danger
      />
    </div>,
    document.body
  );
}

function MenuButton({
  className,
  icon,
  label,
  onClick,
  danger,
}: {
  className: string;
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  const color = danger ? "#E8472A" : "#0D0D0D";
  return (
    <button
      onClick={onClick}
      className={className}
      style={{ color, borderTop: "1px solid #EDE6D3" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = danger ? "#FFF0ED" : "#F7F0E3")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "")}
    >
      <Icon icon={icon} width={14} />
      {label}
    </button>
  );
}

// ── Add-to-group modal ────────────────────────────────────────────────────────

function AddToGroupModal({
  session,
  groups,
  onClose,
  onAssign,
  onCreateGroup,
}: {
  session: Session;
  groups: Group[];
  onClose: () => void;
  onAssign: (groupId: string | null) => void;
  onCreateGroup: (name: string) => Promise<Group | null>;
}) {
  const [search, setSearch] = useState("");
  const [showNewGroup, setShowNewGroup] = useState(false);
  const filtered = groups.filter((g) => g.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <ModalShell onClose={onClose}>
      {showNewGroup && (
        <NewGroupModal
          onClose={() => setShowNewGroup(false)}
          onCreate={async (name) => {
            const group = await onCreateGroup(name);
            if (!group) return false;
            onAssign(group.id);
            return true;
          }}
        />
      )}
      <div
        className="px-4 py-3 flex items-center justify-between gap-2"
        style={{ background: "#0D0D0D", borderBottom: "2px solid #E8472A" }}
      >
        <span className="text-sm font-bold font-space text-white truncate">Add to group</span>
        <button onClick={() => setShowNewGroup(true)} className="btn-coral btn-sm text-xs shrink-0">
          <Icon icon="solar:add-circle-bold" width={13} />
          New group
        </button>
      </div>

      <div className="p-4">
        <div className="relative mb-3">
          <Icon
            icon="solar:magnifer-bold"
            width={13}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "#B0A898" }}
          />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search groups..."
            className="input-brutal w-full pl-8 text-sm"
          />
        </div>

        <div className="max-h-64 overflow-y-auto -mx-1 px-1">
          {session.group_id && (
            <button
              onClick={() => onAssign(null)}
              className="w-full flex items-center gap-2 px-3 py-2 mb-1 text-xs font-semibold font-dm text-left bouncy"
              style={{ color: "#E8472A", border: "1.5px solid #E8472A", borderRadius: "4px" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#FFF0ED")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "")}
            >
              <Icon icon="solar:close-circle-bold" width={14} />
              Remove from current group
            </button>
          )}

          {filtered.length === 0 ? (
            <p className="text-xs font-dm text-center py-6" style={{ color: "#9CA3AF" }}>
              {groups.length === 0 ? "No groups yet — create one." : "No matching groups."}
            </p>
          ) : (
            filtered.map((g) => {
              const current = session.group_id === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => onAssign(g.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 mb-1 text-sm font-dm text-left bouncy"
                  style={{
                    background: current ? "#EDE6D3" : "#FFFFFF",
                    border: "1.5px solid #0D0D0D",
                    borderRadius: "4px",
                    color: "#0D0D0D",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#F7F0E3")}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = current ? "#EDE6D3" : "#FFFFFF")
                  }
                >
                  <Icon icon="solar:folder-bold" width={14} style={{ color: "#E8472A" }} />
                  <span className="flex-1 min-w-0 truncate">{g.name}</span>
                  {current && (
                    <Icon icon="solar:check-circle-bold" width={14} style={{ color: "#4ECDC4" }} />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </ModalShell>
  );
}

// ── Delete-group modal ────────────────────────────────────────────────────────

function DeleteGroupModal({
  group,
  count,
  onClose,
  onDelete,
}: {
  group: Group;
  count: number;
  onClose: () => void;
  onDelete: (withSessions: boolean) => void;
}) {
  return (
    <ModalShell onClose={onClose}>
      <div
        className="px-4 py-3 flex items-center justify-between gap-2"
        style={{ background: "#0D0D0D", borderBottom: "2px solid #E8472A" }}
      >
        <span className="text-sm font-bold font-space text-white truncate">
          Delete “{group.name}”
        </span>
        <button
          onClick={onClose}
          className="bouncy shrink-0"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          <Icon icon="solar:close-circle-bold" width={16} />
        </button>
      </div>

      <div className="p-4">
        <p className="text-sm font-dm mb-4" style={{ color: "#5A5A5A" }}>
          This group has {count} chat{count === 1 ? "" : "s"}. Choose what to do with{" "}
          {count === 1 ? "it" : "them"}.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onDelete(false)}
            className="btn-white btn-sm justify-start text-xs"
          >
            <Icon icon="solar:folder-open-bold" width={14} />
            Delete group only — keep chats
          </button>
          <button onClick={() => onDelete(true)} className="btn-coral btn-sm justify-start text-xs">
            <Icon icon="solar:trash-bin-trash-bold" width={14} />
            Delete group and its chats
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ── New-group name modal ──────────────────────────────────────────────────────

function NewGroupModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    const ok = await onCreate(trimmed);
    // On success the parent unmounts this modal; on failure recover so the
    // button isn't stuck in a loading state.
    if (!ok) {
      setBusy(false);
      setError("Couldn't create group. Try again.");
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <div
        className="px-4 py-3 flex items-center justify-between gap-2"
        style={{ background: "#0D0D0D", borderBottom: "2px solid #E8472A" }}
      >
        <span className="text-sm font-bold font-space text-white truncate">New group</span>
        <button
          onClick={onClose}
          className="bouncy shrink-0"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          <Icon icon="solar:close-circle-bold" width={16} />
        </button>
      </div>
      <div className="p-4">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onClose();
          }}
          placeholder="Group name"
          className="input-brutal w-full text-sm mb-2"
        />
        {error && (
          <p className="text-xs font-dm mb-2" style={{ color: "#E8472A" }}>
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 mt-1">
          <button onClick={onClose} className="btn-white btn-sm text-xs">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!name.trim() || busy}
            className="btn-coral btn-sm text-xs"
          >
            {busy ? (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
            ) : (
              <Icon icon="solar:add-circle-bold" width={13} />
            )}
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ── Delete-chat confirm modal ─────────────────────────────────────────────────

function DeleteChatModal({
  session,
  onClose,
  onConfirm,
}: {
  session: Session;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalShell onClose={onClose}>
      <div
        className="px-4 py-3 flex items-center justify-between gap-2"
        style={{ background: "#0D0D0D", borderBottom: "2px solid #E8472A" }}
      >
        <span className="text-sm font-bold font-space text-white truncate">Delete chat</span>
        <button
          onClick={onClose}
          className="bouncy shrink-0"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          <Icon icon="solar:close-circle-bold" width={16} />
        </button>
      </div>
      <div className="p-4">
        <p className="text-sm font-dm mb-4" style={{ color: "#5A5A5A" }}>
          Delete “{session.title}”? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-white btn-sm text-xs">
            Cancel
          </button>
          <button onClick={onConfirm} className="btn-coral btn-sm text-xs">
            <Icon icon="solar:trash-bin-trash-bold" width={13} />
            Delete
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ── Shared modal shell ────────────────────────────────────────────────────────

function ModalShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: "rgba(13,13,13,0.6)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-sm overflow-hidden"
        style={{
          background: "#FFFFFF",
          border: "2px solid #0D0D0D",
          boxShadow: "6px 6px 0 #0D0D0D",
          borderRadius: "4px",
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
