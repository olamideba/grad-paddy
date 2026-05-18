"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Star, CalendarDays, FileText } from "lucide-react";
import clsx from "clsx";

const NAV_ITEMS = [
  { href: "/chat",      label: "Chat",      icon: MessageSquare },
  { href: "/shortlist", label: "Shortlist", icon: Star },
  { href: "/tracker",   label: "Tracker",   icon: CalendarDays },
  { href: "/drafts",    label: "Drafts",    icon: FileText },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="bottom-nav-safe flex border-t-2"
      style={{ background: "var(--surface)", borderColor: "var(--border-bright)" }}
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-bold font-grotesk uppercase tracking-wide transition-colors",
              active ? "text-[color:var(--violet-light)]" : "text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
            )}
          >
            <Icon size={20} strokeWidth={active ? 2.5 : 2} />
            {label}
            {active && (
              <div
                className="absolute bottom-0 h-0.5 w-8"
                style={{ background: "var(--violet)" }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
