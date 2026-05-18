"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, useCallback } from "react";
import {
  MessageSquare, Star, CalendarDays, FileText,
  GraduationCap, Settings, Zap,
} from "lucide-react";
import clsx from "clsx";

const MIN_WIDTH     = 180;
const MAX_WIDTH     = 400;
const DEFAULT_WIDTH = 256;

const NAV_ITEMS = [
  { href: "/chat",      label: "Agent Chat",  icon: MessageSquare, description: "Talk to Grad Paddy" },
  { href: "/shortlist", label: "Shortlist",   icon: Star,          description: "Saved faculty & programs" },
  { href: "/tracker",   label: "App Tracker", icon: CalendarDays,  description: "Deadlines & status" },
  { href: "/drafts",    label: "Drafts",      icon: FileText,      description: "SOPs & outreach prep" },
];

export default function Sidebar() {
  const pathname   = usePathname();
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const dragging   = useRef(false);
  const startX     = useRef(0);
  const startWidth = useRef(DEFAULT_WIDTH);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current   = true;
    startX.current     = e.clientX;
    startWidth.current = width;
    document.body.style.cursor     = "col-resize";
    document.body.style.userSelect = "none";

    function onMouseMove(e: MouseEvent) {
      if (!dragging.current) return;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + e.clientX - startX.current));
      setWidth(next);
    }
    function onMouseUp() {
      dragging.current = false;
      document.body.style.cursor     = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup",   onMouseUp);
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup",   onMouseUp);
  }, [width]);

  const collapsed = width < 220;

  return (
    <aside
      className="relative flex-shrink-0 flex flex-col h-screen overflow-hidden"
      style={{ width, background: "var(--surface)", borderRight: "2px solid var(--border-bright)" }}
    >
      {/* Logo */}
      <div className="p-4 flex-shrink-0" style={{ borderBottom: "2px solid var(--border-bright)" }}>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 flex items-center justify-center flex-shrink-0"
            style={{
              background:  "var(--violet)",
              border:      "2px solid var(--violet-light)",
              boxShadow:   "3px 3px 0 var(--violet-dark, #5B21B6)",
            }}
          >
            <GraduationCap size={20} strokeWidth={2.5} color="#fff" />
          </div>
          {!collapsed && (
            <div>
              <div className="font-black text-lg leading-none tracking-tight font-grotesk uppercase" style={{ color: "var(--fg)" }}>
                GRAD
              </div>
              <div className="font-black text-lg leading-none tracking-tight font-grotesk uppercase" style={{ color: "var(--violet-light)" }}>
                PADDY
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
        {!collapsed && (
          <div className="px-3 mb-2">
            <span className="text-xs font-bold uppercase tracking-widest font-grotesk" style={{ color: "var(--fg-muted)" }}>
              Navigation
            </span>
          </div>
        )}
        {NAV_ITEMS.map(({ href, label, icon: Icon, description }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={clsx("flex items-center gap-3 mx-2 px-3 py-3 mb-1 transition-all duration-75", collapsed && "justify-center")}
              style={
                active
                  ? { background: "rgba(124,58,237,0.15)", border: "2px solid var(--violet)", boxShadow: "2px 2px 0 var(--violet)", color: "var(--violet-light)" }
                  : { border: "2px solid transparent", color: "var(--fg-muted)" }
              }
              onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.borderColor = "var(--border-bright)"; (e.currentTarget as HTMLElement).style.color = "var(--fg)"; }}
              onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.borderColor = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--fg-muted)"; } }}
            >
              <Icon size={18} strokeWidth={active ? 2.5 : 2} className="flex-shrink-0" />
              {!collapsed && (
                <div className="min-w-0">
                  <div className="text-sm font-bold leading-tight truncate">{label}</div>
                  <div className="text-xs leading-tight truncate" style={{ color: "var(--fg-muted)" }}>{description}</div>
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* AI badge */}
      {!collapsed && (
        <div
          className="mx-3 mb-3 p-3 flex-shrink-0"
          style={{ border: "2px solid var(--border-bright)", background: "var(--surface-2)", boxShadow: "3px 3px 0 var(--violet)" }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Zap size={14} strokeWidth={2.5} style={{ color: "var(--violet-light)" }} />
            <span className="text-xs font-bold uppercase tracking-widest font-grotesk" style={{ color: "var(--violet-light)" }}>
              Powered By
            </span>
          </div>
          <div className="text-xs font-mono leading-relaxed" style={{ color: "var(--fg-muted)" }}>
            Gemini 3 · Elastic MCP<br />Agent Builder · Cloud Run
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-3 flex items-center justify-between flex-shrink-0 gap-2" style={{ borderTop: "2px solid var(--border-bright)" }}>
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 flex-shrink-0 flex items-center justify-center text-xs font-black"
            style={{ background: "var(--violet)", border: "2px solid var(--violet-light)", color: "#fff" }}
          >
            U
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-xs font-bold truncate" style={{ color: "var(--fg)" }}>User</div>
              <div className="text-xs truncate" style={{ color: "var(--fg-muted)" }}>adisad377@gmail.com</div>
            </div>
          )}
        </div>
        <button
          className="p-1.5 transition-colors flex-shrink-0"
          style={{ border: "2px solid transparent", color: "var(--fg-muted)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-bright)"; (e.currentTarget as HTMLElement).style.color = "var(--fg)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--fg-muted)"; }}
        >
          <Settings size={14} strokeWidth={2} />
        </button>
      </div>

      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize group z-10"
      >
        <div
          className="absolute right-0 top-0 w-1.5 h-full opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          style={{ background: "var(--violet)" }}
        />
      </div>
    </aside>
  );
}
