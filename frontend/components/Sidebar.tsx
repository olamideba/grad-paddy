"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, useCallback } from "react";
import { Icon } from "@iconify/react";
import clsx from "clsx";

const MIN_WIDTH     = 60;
const MAX_WIDTH     = 340;
const DEFAULT_WIDTH = 256;
const COLLAPSE_AT   = 130;

const NAV_ITEMS = [
  { href: "/chat",      label: "Agent Chat",  icon: "solar:chat-round-bold",    desc: "Talk to Grad Paddy" },
  { href: "/shortlist", label: "Shortlist",   icon: "solar:star-bold",          desc: "Saved faculty & programs" },
  { href: "/tracker",   label: "App Tracker", icon: "solar:calendar-bold",      desc: "Deadlines & status" },
  { href: "/drafts",    label: "Drafts",      icon: "solar:document-text-bold", desc: "SOPs & outreach prep" },
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

    function onMouseMove(ev: MouseEvent) {
      if (!dragging.current) return;
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + ev.clientX - startX.current)));
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

  const collapsed = width < COLLAPSE_AT;

  return (
    <aside
      className="relative flex-shrink-0 flex flex-col h-screen overflow-hidden"
      style={{ width, background: "#F7F0E3", borderRight: "2px solid #0D0D0D" }}
    >
      {/* Logo */}
      <div
        className="p-4 flex-shrink-0 flex items-center gap-3"
        style={{ background: "#0D0D0D", borderBottom: "2px solid #E8472A" }}
      >
        <div
          className="w-9 h-9 flex items-center justify-center flex-shrink-0"
          style={{ background: "#E8472A", border: "2px solid #E8472A" }}
        >
          <Icon icon="solar:graduation-cap-bold" width={18} style={{ color: "#0D0D0D" }} />
        </div>
        {!collapsed && (
          <div>
            <div className="font-space font-bold text-base leading-none tracking-tight" style={{ color: "#FFFFFF" }}>Grad</div>
            <div className="font-space font-bold text-base leading-none tracking-tight" style={{ color: "#E8472A" }}>Paddy</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
        {!collapsed && (
          <div className="px-4 mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest font-space" style={{ color: "#9CA3AF" }}>
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
                  ? { background: "#0D0D0D", color: "#FFFFFF", border: "2px solid #0D0D0D", outline: "none" }
                  : { color: "#5A5A5A", border: "2px solid transparent" }
              }
              onMouseEnter={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = "#EDE6D3";
              }}
              onMouseLeave={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = "";
              }}
            >
              <Icon icon={icon} width={17} className="flex-shrink-0" />
              {!collapsed && (
                <div className="min-w-0">
                  <div className="text-sm font-semibold font-space leading-tight truncate">{label}</div>
                  <div className="text-xs leading-tight truncate font-dm" style={{ color: active ? "rgba(255,255,255,0.65)" : "#9CA3AF" }}>{desc}</div>
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
          style={{ background: "#EDE6D3", border: "2px solid #0D0D0D" }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Icon icon="solar:bolt-bold" width={12} style={{ color: "#9CA3AF" }} />
            <span className="text-[10px] font-semibold uppercase tracking-widest font-space" style={{ color: "#9CA3AF" }}>
              Powered By
            </span>
          </div>
          <div className="text-xs font-mono leading-relaxed" style={{ color: "#5A5A5A" }}>
            Gemini 3 · Elastic MCP<br />Agent Builder · Cloud Run
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-3 flex items-center justify-between flex-shrink-0 gap-2" style={{ borderTop: "2px solid #0D0D0D" }}>
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 flex-shrink-0 flex items-center justify-center text-xs font-bold"
            style={{ background: "#E8472A", color: "#FFFFFF", border: "2px solid #0D0D0D" }}
          >
            U
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-xs font-semibold truncate font-space" style={{ color: "#0D0D0D" }}>User</div>
              <div className="text-xs truncate font-dm" style={{ color: "#9CA3AF" }}>adisad377@gmail.com</div>
            </div>
          )}
        </div>
        <button
          className="p-1.5 bouncy"
          style={{ color: "#9CA3AF", border: "1.5px solid transparent" }}
          onMouseEnter={e => { (e.currentTarget.style.background = "#EDE6D3"); (e.currentTarget.style.color = "#0D0D0D"); (e.currentTarget.style.border = "1.5px solid #0D0D0D"); }}
          onMouseLeave={e => { (e.currentTarget.style.background = ""); (e.currentTarget.style.color = "#9CA3AF"); (e.currentTarget.style.border = "1.5px solid transparent"); }}
        >
          <Icon icon="solar:settings-bold" width={14} />
        </button>
      </div>

      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize group z-10"
      >
        <div className="absolute right-0 top-0 w-1 h-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "#E8472A" }} />
      </div>
    </aside>
  );
}
