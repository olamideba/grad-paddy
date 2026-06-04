"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, useCallback } from "react";
import { Icon } from "@iconify/react";
import clsx from "clsx";
import { useChatSessions } from "@/context/ChatSessionsContext";
import { useAuth } from "@/context/AuthContext";
import Logo from "@/components/Logo";
import type { Session } from "@/lib/api";

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

const MIN_WIDTH = 72;
const MAX_WIDTH = 340;
const DEFAULT_WIDTH = 256;
const COLLAPSE_AT = 130;

const NAV_ITEMS = [
  { href: "/chat", label: "Agent Chat", icon: "solar:chat-round-bold", desc: "Talk to Grad Paddy" },
  {
    href: "/shortlist",
    label: "Shortlist",
    icon: "solar:star-bold",
    desc: "Saved faculty & programs",
  },
  {
    href: "/tracker",
    label: "App Tracker",
    icon: "solar:calendar-bold",
    desc: "Deadlines & status",
  },
  {
    href: "/drafts",
    label: "Drafts",
    icon: "solar:document-text-bold",
    desc: "SOPs & outreach prep",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: "solar:settings-bold",
    desc: "Preferences & interests",
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sessions, setSessions, activeSessionId, setActiveSessionId, sessionsLoading } =
    useChatSessions();

  async function deleteSession(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!window.confirm("Delete this chat? This cannot be undone.")) return;
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSessionId === id) {
      setActiveSessionId(null);
      router.push("/chat");
    }
    try {
      const { sessionsApi } = await import("@/lib/api");
      await sessionsApi.delete(id);
    } catch {
      // Best-effort; list already updated optimistically.
    }
  }
  const { user } = useAuth();
  const displayName = user?.displayName ?? user?.email ?? "User";
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(DEFAULT_WIDTH);
  const prevWidth = useRef(DEFAULT_WIDTH);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragging.current = true;
      startX.current = e.clientX;
      startWidth.current = width;
      setIsDragging(true);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      function onMouseMove(ev: MouseEvent) {
        if (!dragging.current) return;
        setWidth(
          Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + ev.clientX - startX.current))
        );
      }
      function onMouseUp() {
        dragging.current = false;
        setIsDragging(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      }
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [width]
  );

  const collapsed = width < COLLAPSE_AT;

  const toggleCollapse = useCallback(() => {
    if (collapsed) {
      setWidth(prevWidth.current >= COLLAPSE_AT ? prevWidth.current : DEFAULT_WIDTH);
    } else {
      prevWidth.current = width;
      setWidth(MIN_WIDTH);
    }
  }, [collapsed, width]);

  return (
    <aside
      className="relative flex-shrink-0 flex flex-col h-screen overflow-hidden"
      style={{
        width,
        background: "#F7F0E3",
        borderRight: "2px solid #0D0D0D",
        transition: isDragging ? "none" : "width 200ms ease-out",
      }}
    >
      {/* Logo */}
      <div
        className={`flex-shrink-0 flex ${collapsed ? "flex-row items-center justify-between px-2 py-2.5" : "flex-row items-center gap-3 p-4"}`}
        style={{ background: "#0D0D0D", borderBottom: "2px solid #E8472A" }}
      >
        {collapsed && <Logo size="sm" iconOnly />}
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0">
              <Logo />
            </div>
            <button
              onClick={toggleCollapse}
              className="bouncy flex-shrink-0 p-1"
              style={{ color: "rgba(255,255,255,0.4)", borderRadius: "4px" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                e.currentTarget.style.color = "#FFFFFF";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "";
                e.currentTarget.style.color = "rgba(255,255,255,0.4)";
              }}
              title="Collapse sidebar"
            >
              <Icon icon="solar:sidebar-minimalistic-bold" width={14} />
            </button>
          </>
        )}
        {collapsed && (
          <button
            onClick={toggleCollapse}
            className="bouncy flex items-center justify-center w-6 h-6 flex-shrink-0"
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1.5px solid rgba(255,255,255,0.2)",
              borderRadius: "50%",
              color: "rgba(255,255,255,0.6)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.18)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.5)";
              e.currentTarget.style.color = "#FFFFFF";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
              e.currentTarget.style.color = "rgba(255,255,255,0.6)";
            }}
            title="Expand sidebar"
          >
            <Icon icon="solar:sidebar-minimalistic-bold" width={12} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
        {!collapsed && (
          <div className="px-4 mb-2">
            <span
              className="text-[10px] font-semibold uppercase tracking-widest font-space"
              style={{ color: "#9CA3AF" }}
            >
              Navigation
            </span>
          </div>
        )}
        {NAV_ITEMS.map(({ href, label, icon, desc }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={clsx(
                "flex items-center gap-3 mx-2 px-3 py-2.5 mb-0.5 bouncy",
                collapsed && "justify-center"
              )}
              style={
                active
                  ? {
                      background: "#0D0D0D",
                      color: "#FFFFFF",
                      border: "2px solid #0D0D0D",
                      outline: "none",
                      borderRadius: "4px",
                    }
                  : { color: "#5A5A5A", border: "2px solid transparent" }
              }
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.background = "#EDE6D3";
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.background = "";
              }}
            >
              <Icon icon={icon} width={17} className="flex-shrink-0" />
              {!collapsed && (
                <div className="min-w-0">
                  <div className="text-sm font-semibold font-space leading-tight truncate">
                    {label}
                  </div>
                  <div
                    className="text-xs leading-tight truncate font-dm"
                    style={{ color: active ? "rgba(255,255,255,0.65)" : "#9CA3AF" }}
                  >
                    {desc}
                  </div>
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Chat history */}
      {!collapsed && (
        <div
          className="flex-shrink-0 flex flex-col"
          style={{ borderTop: "2px solid #0D0D0D", maxHeight: "40vh" }}
        >
          <div className="flex items-center justify-between px-4 py-2 flex-shrink-0">
            <span
              className="text-[10px] font-semibold uppercase tracking-widest font-space"
              style={{ color: "#9CA3AF" }}
            >
              Chats
            </span>
            <button
              onClick={() => {
                setActiveSessionId(null);
                router.push("/chat");
              }}
              className="bouncy flex items-center gap-1 px-2 py-1 text-[11px] font-semibold font-space"
              style={{ color: "#9CA3AF", borderRadius: "4px", border: "1.5px solid transparent" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#EDE6D3";
                e.currentTarget.style.color = "#0D0D0D";
                e.currentTarget.style.border = "1.5px solid #0D0D0D";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "";
                e.currentTarget.style.color = "#9CA3AF";
                e.currentTarget.style.border = "1.5px solid transparent";
              }}
            >
              <Icon icon="solar:add-circle-bold" width={11} />
              New Chat
            </button>
          </div>
          <div className="overflow-y-auto">
            {sessionsLoading ? (
              <div className="flex items-center justify-center py-4">
                <div
                  className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: "#E8472A", borderTopColor: "transparent" }}
                />
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-[11px] font-dm text-center py-4 px-4" style={{ color: "#9CA3AF" }}>
                No chats yet
              </p>
            ) : (
              groupSessionsByTime(sessions).map((group) => (
                <div key={group.label}>
                  <div className="px-4 pt-2 pb-1">
                    <span
                      className="text-[10px] font-semibold uppercase tracking-widest font-space"
                      style={{ color: "#B0A898" }}
                    >
                      {group.label}
                    </span>
                  </div>
                  {group.items.map((s) => (
                    <div
                      key={s.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setActiveSessionId(s.id);
                        router.push("/chat");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          setActiveSessionId(s.id);
                          router.push("/chat");
                        }
                      }}
                      className="group flex items-center gap-2 px-4 py-1.5 bouncy w-full text-left cursor-pointer"
                      style={{
                        borderLeft: `3px solid ${activeSessionId === s.id ? "#E8472A" : "transparent"}`,
                        background: activeSessionId === s.id ? "#EDE6D3" : "transparent",
                      }}
                      onMouseEnter={(e) => {
                        if (activeSessionId !== s.id) e.currentTarget.style.background = "#F7F0E3";
                      }}
                      onMouseLeave={(e) => {
                        if (activeSessionId !== s.id) e.currentTarget.style.background = "";
                      }}
                    >
                      <span
                        className="flex-1 min-w-0 text-[12px] font-dm truncate"
                        style={{ color: activeSessionId === s.id ? "#0D0D0D" : "#5A5A5A" }}
                      >
                        {s.title}
                      </span>
                      <button
                        onClick={(e) => deleteSession(e, s.id)}
                        title="Delete chat"
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 bouncy"
                        style={{ color: "#B0A898", borderRadius: "4px" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#E8472A")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "#B0A898")}
                      >
                        <Icon icon="solar:trash-bin-trash-bold" width={13} />
                      </button>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div
        className="p-3 flex items-center justify-between flex-shrink-0 gap-2"
        style={{ borderTop: "2px solid #0D0D0D" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 flex-shrink-0 flex items-center justify-center text-xs font-bold"
            style={{
              background: "#E8472A",
              color: "#FFFFFF",
              border: "2px solid #0D0D0D",
              borderRadius: "4px",
            }}
          >
            {avatarLetter}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div
                className="text-xs font-semibold truncate font-space"
                style={{ color: "#0D0D0D" }}
              >
                {displayName}
              </div>
              <div className="text-xs truncate font-dm" style={{ color: "#9CA3AF" }}>
                {user?.email ?? ""}
              </div>
            </div>
          )}
        </div>
        {!collapsed && (
          <Link
            href="/settings"
            className="p-1.5 bouncy"
            style={{ color: "#9CA3AF", border: "1.5px solid transparent", borderRadius: "4px" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#EDE6D3";
              e.currentTarget.style.color = "#0D0D0D";
              e.currentTarget.style.border = "1.5px solid #0D0D0D";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "";
              e.currentTarget.style.color = "#9CA3AF";
              e.currentTarget.style.border = "1.5px solid transparent";
            }}
          >
            <Icon icon="solar:settings-bold" width={14} />
          </Link>
        )}
      </div>

      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize group z-10"
      >
        <div
          className="absolute right-0 top-0 w-1 h-full opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: "#E8472A" }}
        />
      </div>
    </aside>
  );
}
