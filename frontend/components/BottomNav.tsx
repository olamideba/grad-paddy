"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@iconify/react";
import clsx from "clsx";

const NAV_ITEMS = [
  { href: "/chat",      label: "Chat",      icon: "solar:chat-round-bold" },
  { href: "/shortlist", label: "Shortlist", icon: "solar:star-bold" },
  { href: "/tracker",   label: "Tracker",   icon: "solar:calendar-bold" },
  { href: "/drafts",    label: "Drafts",    icon: "solar:document-text-bold" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="bottom-nav-safe flex"
      style={{ background: "#F7F0E3", borderTop: "2px solid #0D0D0D" }}
    >
      {NAV_ITEMS.map(({ href, label, icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              "relative flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-semibold font-space tracking-wide bouncy",
            )}
            style={{ color: active ? "#E8472A" : "#9CA3AF" }}
          >
            <Icon icon={icon} width={20} />
            {label}
            {active && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8"
                style={{ background: "#E8472A" }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
