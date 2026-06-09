"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, useCallback } from "react";
import type { ComponentType } from "react";
import { Icon } from "@iconify/react";
import {
  MessageSquare,
  Star,
  Calendar,
  FileText,
  Folder,
  Settings as SettingsIcon,
} from "lucide-react";
import type { LucideProps } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/context/AuthContext";
import Logo from "@/components/Logo";
import ChatHistory from "@/components/ChatHistory";

const MIN_WIDTH = 72;
const MAX_WIDTH = 340;
const DEFAULT_WIDTH = 256;
const COLLAPSE_AT = 130;

type NavItem = { href: string; label: string; icon: ComponentType<LucideProps> };

const NAV_ITEMS: NavItem[] = [
  { href: "/chat", label: "Agent Chat", icon: MessageSquare },
  { href: "/shortlist", label: "Shortlist", icon: Star },
  { href: "/tracker", label: "App Tracker", icon: Calendar },
  { href: "/drafts", label: "Drafts", icon: FileText },
  { href: "/documents", label: "Documents", icon: Folder },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const displayName = user?.displayName ?? user?.email ?? "User";
  const initials =
    displayName
      .split(/\s+/)
      .map((w) => w.charAt(0))
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";
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
      className="relative flex-shrink-0 flex flex-col h-screen overflow-hidden bg-paper-2 font-space"
      style={{
        width,
        borderRight: "2px solid #0D0D0D",
        transition: isDragging ? "none" : "width 200ms ease-out",
      }}
    >
      {/* Logo */}
      <div
        className={`flex-shrink-0 flex ${collapsed ? "flex-row items-center justify-center px-2 py-2.5" : "flex-row items-center gap-3 p-4"}`}
        style={{ background: "#0D0D0D", borderBottom: "2px solid #E8472A" }}
      >
        {!collapsed && (
          <>
            <Link href="/" aria-label="Go to landing page" className="flex-1 min-w-0">
              <Logo />
            </Link>
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
      <nav className="shrink-0 py-2 overflow-x-hidden">
        {!collapsed && (
          <div className="px-4 mb-2 mt-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Navigation
            </span>
          </div>
        )}
        {NAV_ITEMS.map(({ href, label, icon: NavIcon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={clsx(
                "flex items-center gap-3 mx-2 px-3 py-2.5 mb-1 border-2 transition-colors",
                collapsed && "justify-center",
                active
                  ? "bg-ink text-paper border-ink"
                  : "border-transparent text-ink hover:border-ink hover:bg-paper"
              )}
            >
              <NavIcon className="size-4 shrink-0" strokeWidth={2.25} />
              {!collapsed && (
                <span className="text-sm font-semibold leading-tight truncate">{label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Spacer pushes the chat-history panel down so it bottom-anchors above the footer */}
      {!collapsed && <div className="flex-1 min-h-0" />}

      {/* Chat history */}
      {!collapsed && <ChatHistory />}

      {/* Footer */}
      <div
        className={clsx(
          "p-3 flex items-center flex-shrink-0 gap-3 bg-paper",
          collapsed ? "justify-center" : ""
        )}
        style={{ borderTop: "2px solid #0D0D0D" }}
      >
        {user?.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.photoURL}
            alt={displayName}
            referrerPolicy="no-referrer"
            className="size-9 flex-shrink-0 object-cover border-2 border-ink"
          />
        ) : (
          <div className="size-9 flex-shrink-0 grid place-items-center text-sm font-bold bg-accent-teal border-2 border-ink text-ink">
            {initials}
          </div>
        )}
        {!collapsed && (
          <>
            <div className="leading-tight flex-1 min-w-0">
              <div className="text-sm font-bold truncate text-ink">{displayName}</div>
              <div className="text-xs truncate text-muted-foreground">{user?.email ?? ""}</div>
            </div>
            <Link
              href="/settings"
              aria-label="Settings"
              className="size-8 grid place-items-center border-2 border-ink text-ink hover:bg-ink hover:text-paper transition-colors"
            >
              <SettingsIcon className="size-4" />
            </Link>
          </>
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
