import type { CSSProperties, ReactNode } from "react";
import clsx from "clsx";

// A single shimmering placeholder block.
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={clsx("skeleton", className)} style={style} />;
}

// A grid of brutalist skeleton cards — matches the drafts/documents/shortlist
// card layout (icon + title, a few text lines, a footer with actions).
export function SkeletonCardGrid({
  count = 6,
  gridClassName = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4",
}: {
  count?: number;
  gridClassName?: string;
}) {
  return (
    <div className={gridClassName}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card-brutal p-4 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <Skeleton className="w-10 h-10 shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton className="h-2 w-16" />
              <Skeleton className="h-3.5 w-3/4" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-2.5 w-full" />
            <Skeleton className="h-2.5 w-11/12" />
            <Skeleton className="h-2.5 w-2/3" />
          </div>
          <div className="flex items-center justify-between pt-2">
            <Skeleton className="h-2.5 w-12" />
            <div className="flex gap-1.5">
              <Skeleton className="h-6 w-14" />
              <Skeleton className="h-6 w-8" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Full page frame (black header bar + scrollable content) for route-level
// loading.tsx fallbacks, so navigation shows the page shell instantly.
export function PageSkeleton({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#F7F0E3" }}>
      <div
        className="px-4 sm:px-6 py-4 shrink-0"
        style={{ background: "#0D0D0D", borderBottom: "2px solid #E8472A" }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-3.5 w-32 rounded" style={{ background: "rgba(255,255,255,0.18)" }} />
            <div className="h-2.5 w-20 rounded" style={{ background: "rgba(255,255,255,0.1)" }} />
          </div>
          <div className="h-7 w-24 rounded" style={{ background: "rgba(255,255,255,0.18)" }} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">{children}</div>
    </div>
  );
}

// Chat view shell: a session title bar, a few message bubbles, and the input.
export function ChatSkeleton() {
  return (
    <div className="flex flex-col h-full" style={{ background: "#F7F0E3" }}>
      <div className="shrink-0 px-4 py-2.5" style={{ borderBottom: "1.5px solid #E0D8CA" }}>
        <Skeleton className="h-3.5 w-44" />
      </div>
      <div className="flex-1 overflow-hidden px-4 py-6">
        <div className="max-w-3xl mx-auto flex flex-col gap-6">
          <div className="flex justify-end">
            <Skeleton className="h-11 w-2/5" style={{ borderRadius: "8px" }} />
          </div>
          <div className="flex gap-3">
            <Skeleton className="w-7 h-7 shrink-0" style={{ borderRadius: "50%" }} />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-11/12" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-10 w-1/3" style={{ borderRadius: "8px" }} />
          </div>
          <div className="flex gap-3">
            <Skeleton className="w-7 h-7 shrink-0" style={{ borderRadius: "50%" }} />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        </div>
      </div>
      <div className="shrink-0 w-full max-w-3xl mx-auto px-4 pb-6 pt-2">
        <Skeleton className="h-14 w-full" style={{ borderRadius: "8px" }} />
      </div>
    </div>
  );
}

// Session-row placeholders for the chat sidebar while sessions load.
export function SidebarSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <div className="px-2 py-2 space-y-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-2 py-2">
          <Skeleton className="h-3" style={{ width: `${85 - (i % 4) * 12}%` }} />
        </div>
      ))}
    </div>
  );
}

// A bordered list of skeleton rows — matches the tracker table.
export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div
      className="overflow-hidden"
      style={{
        border: "2px solid #0D0D0D",
        boxShadow: "4px 4px 0 #0D0D0D",
        borderRadius: "4px",
        background: "#FFFFFF",
      }}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3.5"
          style={{ borderTop: i ? "1.5px solid #EDE6D3" : undefined }}
        >
          <Skeleton className="h-3.5 flex-1" style={{ maxWidth: 240 }} />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}
