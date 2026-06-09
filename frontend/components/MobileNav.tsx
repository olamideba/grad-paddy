"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@iconify/react";
import clsx from "clsx";
import Logo from "@/components/Logo";
import ChatHistory from "@/components/ChatHistory";
import { useAuth } from "@/context/AuthContext";

const NAV_ITEMS = [
  { href: "/chat", label: "Agent Chat", icon: "solar:chat-round-bold" },
  { href: "/shortlist", label: "Shortlist", icon: "solar:star-bold" },
  { href: "/tracker", label: "App Tracker", icon: "solar:calendar-bold" },
  { href: "/drafts", label: "Drafts", icon: "solar:document-text-bold" },
  { href: "/documents", label: "Documents", icon: "solar:folder-with-files-bold" },
  { href: "/settings", label: "Settings", icon: "solar:settings-bold" },
];

export default function MobileNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const displayName = user?.displayName ?? user?.email ?? "User";
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const [open, setOpen] = useState(false);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {/* Mobile top bar */}
      <header
        className="md:hidden shrink-0 flex items-center gap-3 px-4"
        style={{
          background: "#0D0D0D",
          borderBottom: "2px solid #E8472A",
          // Clear the Dynamic Island / status bar on notched iPhones so the
          // toggle isn't hidden underneath it.
          paddingTop: "env(safe-area-inset-top)",
          minHeight: "calc(96px + env(safe-area-inset-top))",
        }}
      >
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="bouncy shrink-0 flex items-center justify-center w-12 h-12"
          style={{
            color: "#FFFFFF",
            background: "rgba(255,255,255,0.12)",
            border: "1.5px solid rgba(255,255,255,0.3)",
            borderRadius: "8px",
          }}
        >
          <Icon icon="solar:sidebar-minimalistic-bold" width={26} />
        </button>
        <div className="min-w-0">
          <Logo size="sm" />
        </div>
      </header>

      {/* Slide-over drawer */}
      {open &&
        createPortal(
          <div className="md:hidden fixed inset-0 z-[70]">
            <div
              className="absolute inset-0 backdrop-fade"
              style={{ background: "rgba(13,13,13,0.6)" }}
              onClick={() => setOpen(false)}
            />
            <aside
              className="drawer-in-left absolute top-0 left-0 h-full w-[300px] max-w-[85%] flex flex-col"
              style={{ background: "#F7F0E3", borderRight: "2px solid #0D0D0D" }}
            >
              {/* Drawer logo header */}
              <div
                className="flex-shrink-0 flex items-center justify-between gap-3 px-4 h-[80px]"
                style={{ background: "#0D0D0D", borderBottom: "2px solid #E8472A" }}
              >
                <div className="flex-1 min-w-0">
                  <Logo />
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="bouncy flex-shrink-0 flex items-center justify-center w-9 h-9"
                  style={{ color: "rgba(255,255,255,0.4)", borderRadius: "4px" }}
                >
                  <Icon icon="solar:sidebar-minimalistic-bold" width={16} />
                </button>
              </div>

              {/* Nav */}
              <nav className="shrink-0 py-2">
                <div className="px-4 mb-1">
                  <span
                    className="text-[10px] font-semibold uppercase tracking-widest font-space"
                    style={{ color: "#9CA3AF" }}
                  >
                    Navigation
                  </span>
                </div>
                {NAV_ITEMS.map(({ href, label, icon }) => {
                  const active = pathname === href || pathname.startsWith(href + "/");
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setOpen(false)}
                      className={clsx("flex items-center gap-2.5 mx-2 px-3 py-2 mb-0.5 bouncy")}
                      style={
                        active
                          ? {
                              background: "#0D0D0D",
                              color: "#FFFFFF",
                              border: "2px solid #0D0D0D",
                              borderRadius: "4px",
                            }
                          : { color: "#5A5A5A", border: "2px solid transparent" }
                      }
                    >
                      <Icon icon={icon} width={16} className="flex-shrink-0" />
                      <span className="text-[13px] font-semibold font-space leading-tight truncate">
                        {label}
                      </span>
                    </Link>
                  );
                })}
              </nav>

              {/* Spacer pushes chat history down to bottom-anchor above footer */}
              <div className="flex-1 min-h-0" />

              {/* Chat history — collapsible + resizable, same as desktop */}
              <ChatHistory onNavigate={() => setOpen(false)} />

              {/* Footer — profile, pinned to bottom */}
              <div
                className="p-3 flex items-center justify-between gap-2 flex-shrink-0"
                style={{ borderTop: "2px solid #0D0D0D" }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {user?.photoURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.photoURL}
                      alt={displayName}
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 flex-shrink-0 object-cover"
                      style={{ border: "2px solid #0D0D0D", borderRadius: "4px" }}
                    />
                  ) : (
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
                  )}
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
                </div>
                <Link
                  href="/settings"
                  onClick={() => setOpen(false)}
                  className="p-1.5 bouncy shrink-0"
                  style={{
                    color: "#9CA3AF",
                    border: "1.5px solid transparent",
                    borderRadius: "4px",
                  }}
                >
                  <Icon icon="solar:settings-bold" width={14} />
                </Link>
              </div>
            </aside>
          </div>,
          document.body
        )}
    </>
  );
}
