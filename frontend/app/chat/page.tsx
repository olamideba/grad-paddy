"use client";

import { useState, useRef, useEffect } from "react";
import { flushSync } from "react-dom";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import clsx from "clsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAgent } from "@/components/AgentProvider";
import type { Message, BaseEvent } from "../../lib/ag-ui";
import { useChatSessions } from "@/context/ChatSessionsContext";

// ── Types ────────────────────────────────────────────────────────────────────

type StepStatus = "pending" | "running" | "done" | "error";

// Map tool names to human-friendly descriptions
const TOOL_DESCRIPTIONS: Record<string, { label: string; emoji: string; description: string }> = {
  transfer_to_agent: { label: "Processing", emoji: "⚡", description: "Connecting to agent..." },
  researcher_google_search_agent: {
    label: "Searching the web",
    emoji: "🔍",
    description: "Searching for information...",
  },
  researcher_url_context_agent: {
    label: "Analyzing page content",
    emoji: "📄",
    description: "Reading and analyzing web pages...",
  },
  elite_search: {
    label: "Searching databases",
    emoji: "📚",
    description: "Querying research databases...",
  },
  hitl_approval: {
    label: "Requesting approval",
    emoji: "👤",
    description: "Waiting for your input...",
  },
  request_hitl: {
    label: "Requesting approval",
    emoji: "👤",
    description: "Waiting for your input...",
  },
  researcher_find_url_agent: {
    label: "Finding relevant pages",
    emoji: "🔗",
    description: "Locating important resources...",
  },
};

function getToolDescription(toolName: string): { label: string; emoji: string } {
  if (toolName in TOOL_DESCRIPTIONS) {
    const desc = TOOL_DESCRIPTIONS[toolName];
    return { label: desc.label, emoji: desc.emoji };
  }
  const normalized = toolName.toLowerCase();
  if (normalized.includes("profile") || normalized.includes("preference")) {
    return { label: "Updating profile", emoji: "👤" };
  }
  if (normalized.includes("session")) {
    return { label: "Managing sessions", emoji: "💬" };
  }
  if (normalized.includes("group")) {
    return { label: "Managing groups", emoji: "🗂️" };
  }
  if (normalized.includes("shortlist")) {
    return { label: "Updating shortlist", emoji: "📌" };
  }
  if (normalized.includes("tracker") || normalized.includes("application")) {
    return { label: "Updating tracker", emoji: "🧭" };
  }
  if (normalized.includes("draft")) {
    return { label: "Editing drafts", emoji: "📝" };
  }
  if (normalized.includes("hitl") || normalized.includes("approval")) {
    return { label: "Requesting approval", emoji: "👤" };
  }
  return { label: toolName.replace(/_/g, " "), emoji: "⚙️" };
}

type ChatItem =
  | { type: "user"; id: string; content: string; timestamp: Date }
  | { type: "agent"; id: string; content: string; timestamp: Date }
  | {
      type: "step";
      id: string;
      label: string;
      status: StepStatus;
      detail?: string;
      tool?: string;
      children?: { label: string; status: StepStatus; detail?: string }[];
    }
  | { type: "phase"; id: string; label: string; status: StepStatus }
  | {
      type: "approval";
      id: string;
      kind: "approval" | "choice" | "input";
      title: string;
      description: string;
      payload?: Record<string, unknown>;
      options?: { id: string; label: string }[];
      schema?: Record<string, unknown>;
      items?: string[];
      resolved?: "approved" | "rejected";
      resolveError?: string;
      expired?: boolean;
    };

// Reconstruct phase/step items from persisted AG-UI events for a restored session.
// TEXT_MESSAGE_* events are skipped — the agent text item is built from the message content.
function replayEventsToItems(events: Record<string, unknown>[], messageId: string): ChatItem[] {
  const items: ChatItem[] = [];
  for (const e of events) {
    const type = e.type as string;
    if (type === "RUN_STARTED") {
      items.push({ type: "phase", id: `run-${messageId}`, label: "Processing", status: "done" });
    } else if (type === "STEP_STARTED") {
      const name = e.stepName as string;
      items.push({ type: "phase", id: `step-${name}-${messageId}`, label: name, status: "done" });
    } else if (type === "TOOL_CALL_START") {
      const toolName = (e.toolCallName as string) ?? "";
      items.push({
        type: "step",
        id: (e.toolCallId as string) ?? `tc-${messageId}-${items.length}`,
        label: toolName.replace(/_/g, " "),
        status: "done",
        tool: toolName,
        detail: toolName,
      });
    }
  }
  return items;
}

// ── Smooth typing animation component ────────────────────────────────────────

function StreamingText({
  content,
  messageId,
  isStreaming,
}: {
  content: string;
  messageId: string;
  isStreaming: boolean;
}) {
  const [shown, setShown] = useState(0);

  // Typewriter: reveal chars at a steady pace. When not streaming (restored or
  // finished), `visible` falls back to the full content, so no state update is
  // needed here.
  useEffect(() => {
    if (!isStreaming) return;
    const id = setInterval(() => {
      setShown((n) => {
        if (n >= content.length) return n;
        // Steady reveal; small extra nudge only if we fall far behind the
        // incoming stream so we never lag by more than ~1 line.
        const behind = content.length - n;
        const step = behind > 120 ? 3 : 1;
        return Math.min(content.length, n + step);
      });
    }, 18);
    return () => clearInterval(id);
  }, [content, isStreaming]);

  const visible = isStreaming ? content.slice(0, shown) : content;
  const caretVisible = isStreaming && shown < content.length;

  return (
    <div className="w-full" style={{ wordWrap: "break-word", overflowWrap: "break-word" }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="text-xs font-dm">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-bold" style={{ color: "#0D0D0D" }}>
              {children}
            </strong>
          ),
          h1: ({ children }) => (
            <h1 className="font-bold font-space text-base mb-2 mt-3 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-bold font-space text-sm mb-2 mt-3 first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-semibold font-space text-sm mb-1 mt-2 first:mt-0">{children}</h3>
          ),
          code: ({ children }) => (
            <code
              className="font-mono text-xs px-1 py-0.5 rounded"
              style={{ background: "#F7F0E3" }}
            >
              {children}
            </code>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: "#E8472A" }}
            >
              {children}
            </a>
          ),
        }}
      >
        {visible}
      </ReactMarkdown>
      {caretVisible && <span className="typewriter-caret" />}
    </div>
  );
}

// ── Visual sub-components ─────────────────────────────────────────────────────

function StepIndicator({ status }: { status: StepStatus }) {
  if (status === "running")
    return (
      <Icon
        icon="solar:spinner-bold"
        width={16}
        className="animate-spin shrink-0"
        style={{ color: "#E8472A" }}
      />
    );
  if (status === "done")
    return (
      <div
        className="w-3 h-3 rounded-full shrink-0"
        style={{ background: "#4ECDC4", border: "2px solid #0D0D0D" }}
      />
    );
  if (status === "error")
    return (
      <div
        className="w-3 h-3 rounded-full shrink-0"
        style={{ background: "#E8472A", border: "2px solid #0D0D0D" }}
      />
    );
  return (
    <div
      className="w-3 h-3 rounded-full shrink-0"
      style={{ background: "#EDE6D3", border: "2px solid #C8C0AF" }}
    />
  );
}

function StepCard({ step, number }: { step: Extract<ChatItem, { type: "step" }>; number: number }) {
  const statusBadge = {
    done: { label: "Done", bg: "#4ECDC4", color: "#0D0D0D", border: "#0D0D0D" },
    running: { label: "In progress", bg: "#FFF0ED", color: "#E8472A", border: "#E8472A" },
    pending: { label: "Waiting", bg: "#EDE6D3", color: "#9CA3AF", border: "#C8C0AF" },
    error: { label: "Error", bg: "#FFF0ED", color: "#E8472A", border: "#E8472A" },
  }[step.status];

  // Get human-friendly description for tool
  const toolDesc = step.tool ? getToolDescription(step.tool) : { label: step.label, emoji: "⚙️" };

  return (
    <div
      className="msg-enter flex items-center gap-3 px-3 py-2"
      style={{
        background: step.status === "running" ? "#FFFAF9" : "#FFFFFF",
        borderTop: "1.5px solid #EDE6D3",
      }}
    >
      <StepIndicator status={step.status} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs">{toolDesc.emoji}</span>
          <p
            className="text-sm font-space leading-snug"
            style={{
              color: step.status === "pending" ? "#B0A898" : "#0D0D0D",
              fontWeight: step.status === "running" ? 600 : 400,
            }}
          >
            {toolDesc.label}
          </p>
        </div>
        {step.detail && step.status === "error" && (
          <p className="text-[10px] font-mono mt-0.5 truncate" style={{ color: "#E8472A" }}>
            {step.detail}
          </p>
        )}
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <span
            className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold font-space"
            style={{
              background: statusBadge.bg,
              color: statusBadge.color,
              border: `1.5px solid ${statusBadge.border}`,
              borderRadius: "4px",
            }}
          >
            {statusBadge.label}
          </span>
        </div>
      </div>
    </div>
  );
}

type PhaseGroup = {
  phase: Extract<ChatItem, { type: "phase" }>;
  steps: Extract<ChatItem, { type: "step" }>[];
};

function groupStream(stream: ChatItem[]) {
  const out: Array<
    | { kind: "standalone"; item: Exclude<ChatItem, { type: "phase" | "step" }> }
    | { kind: "group"; group: PhaseGroup }
    | { kind: "orphan"; item: Extract<ChatItem, { type: "step" }> }
  > = [];
  for (const item of stream) {
    if (item.type === "phase") {
      out.push({ kind: "group", group: { phase: item, steps: [] } });
    } else if (item.type === "step") {
      const last = out[out.length - 1];
      if (last?.kind === "group") last.group.steps.push(item);
      else out.push({ kind: "orphan", item });
    } else {
      out.push({ kind: "standalone", item: item as Exclude<ChatItem, { type: "phase" | "step" }> });
    }
  }
  return out;
}

function AgentWorkCard({
  group,
  collapsed,
  onToggle,
}: {
  group: PhaseGroup;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { phase, steps } = group;
  const doneCount = steps.filter((s) => s.status === "done").length;
  const runningStep = steps.find((s) => s.status === "running");
  const lastActiveTool = [...steps].reverse().find((s) => s.tool)?.tool;
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (phase.status !== "running") return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase.status]);
  const elapsedStr = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  return (
    <div
      className="msg-enter"
      style={{
        border: "2px solid #0D0D0D",
        boxShadow: "3px 3px 0 #0D0D0D",
        borderRadius: "4px",
        overflow: "hidden",
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        style={{ background: "#E8472A", borderBottom: "2px solid #0D0D0D" }}
        onClick={onToggle}
      >
        <div className="min-w-0">
          <span className="text-sm font-bold font-space" style={{ color: "#FFFFFF" }}>
            Agent · {phase.label}
          </span>
          {collapsed && phase.status === "running" && lastActiveTool && (
            <div
              className="text-[11px] font-dm truncate"
              style={{ color: "rgba(255,255,255,0.85)" }}
            >
              {getToolDescription(lastActiveTool).emoji} {getToolDescription(lastActiveTool).label}…
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {phase.status === "running" && (
            <span
              className="text-[10px] font-bold font-space px-2 py-0.5"
              style={{
                background: "#4ECDC4",
                color: "#0D0D0D",
                border: "1.5px solid #0D0D0D",
                borderRadius: "4px",
              }}
            >
              Running
            </span>
          )}
          {phase.status === "done" && (
            <span
              className="text-[10px] font-bold font-space px-2 py-0.5"
              style={{
                background: "rgba(255,255,255,0.2)",
                color: "#FFFFFF",
                border: "1.5px solid rgba(255,255,255,0.4)",
                borderRadius: "4px",
              }}
            >
              Done
            </span>
          )}
          <Icon
            icon="solar:alt-arrow-down-bold"
            width={12}
            className={clsx("transition-transform duration-150", collapsed && "-rotate-90")}
            style={{ color: "rgba(255,255,255,0.7)" }}
          />
        </div>
      </div>
      {!collapsed && (
        <>
          <div className="grid grid-cols-3" style={{ borderBottom: "2px solid #0D0D0D" }}>
            <div
              className="px-3 py-2"
              style={{ background: "#F7F0E3", borderRight: "1.5px solid #0D0D0D" }}
            >
              <p
                className="text-[9px] font-bold uppercase tracking-widest font-space"
                style={{ color: "#9CA3AF" }}
              >
                Steps Done
              </p>
              <p className="text-lg font-bold font-mono mt-0.5" style={{ color: "#0D0D0D" }}>
                {doneCount}/{steps.length}
              </p>
            </div>
            <div
              className="px-3 py-2"
              style={{
                background: runningStep ? "#FFF0ED" : "#F7F0E3",
                borderRight: "1.5px solid #0D0D0D",
                outline: runningStep ? "2px solid #E8472A" : undefined,
                outlineOffset: "-2px",
              }}
            >
              <p
                className="text-[9px] font-bold uppercase tracking-widest font-space"
                style={{ color: "#9CA3AF" }}
              >
                Active Tool
              </p>
              <p className="text-xs font-bold font-mono mt-0.5" style={{ color: "#0D0D0D" }}>
                {lastActiveTool ? getToolDescription(lastActiveTool).label : "—"}
              </p>
            </div>
            <div className="px-3 py-2" style={{ background: "#F7F0E3" }}>
              <p
                className="text-[9px] font-bold uppercase tracking-widest font-space"
                style={{ color: "#9CA3AF" }}
              >
                Elapsed
              </p>
              <p className="text-lg font-bold font-mono mt-0.5" style={{ color: "#0D0D0D" }}>
                {elapsedStr}
              </p>
            </div>
          </div>
          <div style={{ background: "#FFFFFF" }}>
            {steps.map((step, i) => (
              <StepCard key={step.id} step={step} number={i + 1} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function payloadPreview(payload: Record<string, unknown> | undefined): string[] | undefined {
  if (!payload || Object.keys(payload).length === 0) return undefined;
  return Object.entries(payload).map(
    ([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`
  );
}

function ApprovalGate({
  item,
  onResolve,
  resolving,
}: {
  item: Extract<ChatItem, { type: "approval" }>;
  onResolve: (
    id: string,
    d: "approved" | "rejected",
    response?: Record<string, unknown>
  ) => void;
  resolving: boolean;
}) {
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  if (item.expired) {
    return (
      <div className="flex gap-3 msg-enter">
        <div className="text-xs font-dm" style={{ color: "#9CA3AF" }}>
          This approval request has expired. You can send a new message to continue.
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 msg-enter">
      <div
        className="w-7 h-7 shrink-0 flex items-center justify-center text-xs font-semibold mt-0.5"
        style={{
          background: "#EDE6D3",
          color: "#5A5A5A",
          border: "2px solid #0D0D0D",
          borderRadius: "50%",
        }}
      >
        <span className="text-xs leading-none">🎓</span>
      </div>
      <div className="flex flex-col gap-3 max-w-[75%]">
        <div
          className="px-4 py-3 text-sm font-dm leading-relaxed"
          style={{
            background: "#FFFFFF",
            color: "#0D0D0D",
            border: "2px solid #0D0D0D",
            boxShadow: "3px 3px 0 #0D0D0D",
            borderRadius: "8px",
          }}
        >
          <p className="font-semibold font-space mb-1" style={{ color: "#0D0D0D" }}>
            {item.title}
          </p>
          <p className="text-xs font-dm mb-3" style={{ color: "#5A5A5A" }}>
            {item.description}
          </p>
          {(item.items ?? payloadPreview(item.payload)) && (
            <ul className="space-y-1 mb-1">
              {(item.items ?? payloadPreview(item.payload) ?? []).map((it, i) => (
                <li
                  key={i}
                  className="text-xs font-dm flex items-start gap-1.5"
                  style={{ color: "#5A5A5A" }}
                >
                  <span className="shrink-0" style={{ color: "#B0A898" }}>
                    –
                  </span>
                  {it}
                </li>
              ))}
            </ul>
          )}
          {item.kind === "input" && item.schema && !item.resolved && (
            <div className="space-y-2 mt-2">
              {Object.entries(
                (item.schema.properties as Record<string, { title?: string }>) ?? {}
              ).map(([key, prop]) => (
                <label key={key} className="block text-xs font-dm">
                  <span style={{ color: "#5A5A5A" }}>{prop.title ?? key}</span>
                  <input
                    className="mt-1 w-full px-2 py-1 border text-xs"
                    style={{ borderColor: "#EDE6D3" }}
                    value={inputValues[key] ?? ""}
                    onChange={(e) =>
                      setInputValues((p) => ({ ...p, [key]: e.target.value }))
                    }
                    disabled={resolving}
                  />
                </label>
              ))}
            </div>
          )}
        </div>
        {item.resolveError && (
          <p className="text-xs font-dm" style={{ color: "#E8472A" }}>
            {item.resolveError}
          </p>
        )}
        {item.resolved ? (
          <div
            className="flex items-center gap-2 text-xs font-semibold font-space"
            style={{ color: item.resolved === "approved" ? "#4ECDC4" : "#9CA3AF" }}
          >
            <Icon
              icon={
                item.resolved === "approved" ? "solar:check-circle-bold" : "solar:close-circle-bold"
              }
              width={13}
            />
            {item.resolved === "approved" ? "Approved" : "Rejected"}
          </div>
        ) : item.kind === "choice" && item.options?.length ? (
          <div className="flex flex-wrap gap-2">
            {item.options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => onResolve(item.id, "approved", { optionId: opt.id })}
                className="btn-teal btn-sm gap-1.5 text-xs"
                disabled={resolving}
              >
                {opt.label}
              </button>
            ))}
            <button
              onClick={() => onResolve(item.id, "rejected")}
              className="btn-white btn-sm gap-1.5 text-xs"
              disabled={resolving}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() =>
                onResolve(
                  item.id,
                  "approved",
                  item.kind === "input" ? inputValues : undefined
                )
              }
              className="btn-teal btn-sm gap-1.5 text-xs"
              disabled={resolving}
            >
              <Icon icon="solar:check-circle-bold" width={12} />
              {item.kind === "approval" ? "Yes, save" : "Submit"}
            </button>
            <button
              onClick={() => onResolve(item.id, "rejected")}
              className="btn-white btn-sm gap-1.5 text-xs"
              disabled={resolving}
            >
              <Icon icon="solar:close-circle-bold" width={12} />
              {item.kind === "approval" ? "No, discard" : "Cancel"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Stable per-id offset so bubbles bob out of sync instead of in lockstep.
function floatDelay(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `-${(h % 45) / 10}s`;
}

type GlassBubble = {
  id: number;
  x: number;
  y: number;
  size: number;
  dx: number;
  dy: number;
  radius: string;
};

// Random point on the rectangle perimeter (w × h).
function edgePoint(w: number, h: number): { x: number; y: number } {
  let p = Math.random() * 2 * (w + h);
  if (p < w) return { x: p, y: 0 };
  p -= w;
  if (p < h) return { x: w, y: p };
  p -= h;
  if (p < w) return { x: w - p, y: h };
  p -= w;
  return { x: 0, y: h - p };
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const blobRadius = () =>
  `${rand(40, 70)}% ${rand(40, 70)}% ${rand(40, 70)}% ${rand(40, 70)}% / ` +
  `${rand(40, 70)}% ${rand(40, 70)}% ${rand(40, 70)}% ${rand(40, 70)}%`;

// Monotonic id source. Kept at module scope so the impure increment never runs
// during a component render (satisfies react-hooks/purity).
let _effectId = 0;
const nextId = () => ++_effectId;

// Build the glass bubbles for a burst. Module-scoped because it relies on
// Math.random; viewport coords let a body-level portal render them un-clipped.
function createBubbles(rect: DOMRect): GlassBubble[] {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const n = 6 + Math.floor(Math.random() * 3);
  const out: GlassBubble[] = [];
  for (let i = 0; i < n; i++) {
    const pt = edgePoint(rect.width, rect.height);
    const px = rect.left + pt.x;
    const py = rect.top + pt.y;
    const ang = Math.atan2(py - cy, px - cx);
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    // Distance along direction until we hit a window edge.
    const tx = c > 0 ? (vw - px) / c : c < 0 ? -px / c : Infinity;
    const ty = s > 0 ? (vh - py) / s : s < 0 ? -py / s : Infinity;
    const dist = Math.max(0, Math.min(tx, ty)) * rand(0.7, 1);
    out.push({
      id: nextId(),
      x: px,
      y: py,
      size: rand(8, 20),
      dx: c * dist,
      dy: s * dist,
      radius: blobRadius(),
    });
  }
  return out;
}

function MessageBubble({
  item,
  streamingMessageId,
}: {
  item: Extract<ChatItem, { type: "user" | "agent" }>;
  streamingMessageId: string | null;
}) {
  const isUser = item.type === "user";
  const isStreaming = !isUser && streamingMessageId === item.id;
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number; size: number }[]>([]);
  const [bubbles, setBubbles] = useState<GlassBubble[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);

  function spawnRipple(e: React.PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const size = Math.max(r.width, r.height);
    setRipples((p) => [...p, { id: nextId(), x, y, size }]);
  }

  // Ripple reached the edge → release polymorphic glass bubbles that escape the
  // box and float outward across the window to its edges.
  function burstBubbles(rippleId: number) {
    setRipples((p) => p.filter((r) => r.id !== rippleId));
    const el = boxRef.current;
    if (!el) return;
    setBubbles((p) => [...p, ...createBubbles(el.getBoundingClientRect())]);
  }

  const rippleColor = isUser ? "rgba(255,255,255,0.4)" : "rgba(13,13,13,0.12)";

  return (
    <>
      {typeof document !== "undefined" &&
        bubbles.length > 0 &&
        createPortal(
          <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 60 }}>
            {bubbles.map((b) => (
              <span
                key={b.id}
                className="glass-bubble"
                onAnimationEnd={() => setBubbles((p) => p.filter((x) => x.id !== b.id))}
                style={
                  {
                    left: b.x,
                    top: b.y,
                    width: b.size,
                    height: b.size,
                    borderRadius: b.radius,
                    "--dx": `${b.dx}px`,
                    "--dy": `${b.dy}px`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>,
          document.body
        )}
      <div className={clsx("flex gap-3 msg-enter", isUser && "flex-row-reverse")}>
        <div
          className="w-7 h-7 shrink-0 flex items-center justify-center text-xs font-semibold mt-0.5"
          style={{
            background: isUser ? "#0D0D0D" : "#EDE6D3",
            color: isUser ? "#fff" : "#5A5A5A",
            border: "2px solid #0D0D0D",
            borderRadius: "50%",
          }}
        >
          {isUser ? (
            <Icon icon="solar:user-bold" width={13} />
          ) : (
            <span className="text-xs leading-none">🎓</span>
          )}
        </div>
        <div className={clsx("flex flex-col gap-1 max-w-[88%]", isUser && "items-end")}>
          <div
            ref={boxRef}
            onPointerDown={spawnRipple}
            className="float-water relative overflow-hidden px-4 py-2.5 text-xs font-dm leading-relaxed"
            style={{
              background: isUser ? "#0D0D0D" : "#FFFFFF",
              color: isUser ? "#fff" : "#0D0D0D",
              border: "2px solid #0D0D0D",
              boxShadow: "3px 3px 0 #0D0D0D",
              borderRadius: "8px",
              minHeight: isStreaming ? "100px" : "auto",
              animationDelay: floatDelay(item.id),
            }}
          >
            {ripples.map((r) => (
              <span
                key={r.id}
                className="ripple"
                onAnimationEnd={() => burstBubbles(r.id)}
                style={{
                  left: r.x,
                  top: r.y,
                  width: r.size,
                  height: r.size,
                  background: rippleColor,
                }}
              />
            ))}
            {isUser ? (
              <span>{item.content}</span>
            ) : item.content ? (
              <StreamingText content={item.content} messageId={item.id} isStreaming={isStreaming} />
            ) : (
              <span className="text-xs italic" style={{ color: "#9CA3AF" }}>
                Thinking...
              </span>
            )}
          </div>
          <div
            className={clsx("text-[10px] font-mono text-[#B0A898]", isUser && "text-right")}
            suppressHydrationWarning
          >
            {item.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const [stream, setStream] = useState<ChatItem[]>([]);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [urls, setUrls] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [showEvents, setShowEvents] = useState(true);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const [queue, setQueue] = useState<{ id: string; content: string }[]>([]);
  const [running, setLocalRunning] = useState(false);
  const [resolvingHitl, setResolvingHitl] = useState(false);
  const {
    sessions,
    setSessions,
    activeSessionId,
    setActiveSessionId,
    pendingGroupId,
    setPendingGroupId,
  } = useChatSessions();

  const threadId = useRef(crypto.randomUUID());
  const agMessages = useRef<Message[]>([]);
  const agMsgContent = useRef<Map<string, string>>(new Map());
  const subscription = useRef<{ unsubscribe(): void } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const justCreatedSession = useRef(false);

  const { setRunning } = useAgent();

  const isAgentRunning = running;
  const runningStep = stream.find(
    (i): i is Extract<ChatItem, { type: "step" }> => i.type === "step" && i.status === "running"
  );
  const agentStatusText = runningStep?.tool
    ? `${getToolDescription(runningStep.tool).label}...`
    : "Working...";
  const pendingApproval = stream.some(
    (i) => i.type === "approval" && !i.resolved && !i.expired
  );
  const inputBlocked = isAgentRunning || pendingApproval;

  useEffect(() => {
    setRunning(isAgentRunning);
  }, [isAgentRunning, setRunning]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [stream]);
  useEffect(
    () => () => {
      subscription.current?.unsubscribe();
    },
    []
  );

  // Process queue when agent finishes and no HITL gate is open
  useEffect(() => {
    if (!isAgentRunning && !pendingApproval && queue.length > 0) {
      const [first, ...rest] = queue;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStream((p) => [
        ...p,
        { type: "user", id: first.id, content: first.content, timestamp: new Date() },
      ]);
      setQueue(rest);
      sendToBackend(first.content, first.id);
    }
  }, [isAgentRunning, pendingApproval]); // eslint-disable-line react-hooks/exhaustive-deps

  function startNewChat() {
    setActiveSessionId(null);
  }

  // React to session selection from sidebar
  useEffect(() => {
    // Skip reset when sendToBackend just created this session — stream is live
    if (justCreatedSession.current) {
      justCreatedSession.current = false;
      return;
    }

    subscription.current?.unsubscribe();
    setLocalRunning(false);
    setQueue([]);
    agMsgContent.current = new Map();

    if (!activeSessionId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStream([]);
      agMessages.current = [];
      threadId.current = crypto.randomUUID();
      return;
    }

    threadId.current = activeSessionId;
    import("../../lib/api").then(({ sessionsApi }) =>
      sessionsApi
        .listMessages(activeSessionId)
        .then((res) => {
          const items: ChatItem[] = [];
          const restored: Message[] = [];
          for (const m of res.data) {
            if (m.role !== "user" && m.role !== "assistant") continue;
            const ts = new Date(m.created_at);
            if (m.role === "assistant" && m.ag_ui_events?.length) {
              items.push(...replayEventsToItems(m.ag_ui_events, m.id));
            }
            items.push(
              m.role === "user"
                ? { type: "user", id: m.id, content: m.content, timestamp: ts }
                : { type: "agent", id: m.id, content: m.content, timestamp: ts }
            );
            restored.push({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
            } as Message);
          }
          setStream(items);
          agMessages.current = restored;
          checkHITL();
        })
        .catch((err) => console.error("[chat] load session messages error", err))
    );
  }, [activeSessionId]);

  function togglePhase(id: string) {
    setCollapsedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleEvent(event: BaseEvent, phaseId: string) {
    const type = event.type as string;

    if (type === "RUN_STARTED") {
      setStream((p) => [
        ...p,
        { type: "phase", id: phaseId, label: "Processing", status: "running" },
      ]);
      // Default to collapsed so users see friendly progress, not raw tool detail.
      setCollapsedPhases((prev) => new Set(prev).add(phaseId));
    } else if (type === "TEXT_MESSAGE_START") {
      const e = event as unknown as { messageId: string };
      setStreamingMessageId(e.messageId);
      agMsgContent.current.set(e.messageId, "");
      setStream((p) => [
        ...p,
        { type: "agent", id: e.messageId, content: "", timestamp: new Date() },
      ]);
    } else if (type === "TEXT_MESSAGE_CONTENT") {
      const e = event as unknown as { messageId: string; delta: string };
      const prev = agMsgContent.current.get(e.messageId) ?? "";
      const next = prev + e.delta;
      agMsgContent.current.set(e.messageId, next);
      setStream((p) =>
        p.map((item) =>
          item.id === e.messageId && item.type === "agent" ? { ...item, content: next } : item
        )
      );
    } else if (type === "TEXT_MESSAGE_END") {
      const e = event as unknown as { messageId: string };
      setStreamingMessageId(null);
      const content = agMsgContent.current.get(e.messageId) ?? "";
      agMsgContent.current.delete(e.messageId);
      agMessages.current = [
        ...agMessages.current,
        { id: e.messageId, role: "assistant", content } as Message,
      ];
    } else if (type === "TOOL_CALL_START") {
      const e = event as unknown as { toolCallId: string; toolCallName: string };
      flushSync(() => {
        setStream((p) => [
          ...p,
          {
            type: "step",
            id: e.toolCallId,
            label: e.toolCallName.replace(/_/g, " "),
            status: "running",
            tool: e.toolCallName,
            detail: e.toolCallName,
          },
        ]);
      });
    } else if (type === "TOOL_CALL_END") {
      const e = event as unknown as { toolCallId: string };
      setStream((p) =>
        p.map((item) =>
          item.id === e.toolCallId && item.type === "step" ? { ...item, status: "done" } : item
        )
      );
    } else if (type === "STEP_STARTED") {
      const e = event as unknown as { stepName: string };
      const stepPhaseId = `step-${e.stepName}`;
      flushSync(() => {
        setStream((p) => [
          ...p,
          {
            type: "phase",
            id: stepPhaseId,
            label: e.stepName.replace(/_/g, " "),
            status: "running",
          },
        ]);
      });
      setCollapsedPhases((prev) => new Set(prev).add(stepPhaseId));
    } else if (type === "STEP_FINISHED") {
      const e = event as unknown as { stepName: string };
      setStream((p) =>
        p.map((item) =>
          item.id === `step-${e.stepName}` && item.type === "phase"
            ? { ...item, status: "done" }
            : item
        )
      );
    } else if (type === "HITL_REQUIRED") {
      const e = event as unknown as {
        hitlId: string;
        kind: "approval" | "choice" | "input";
        title: string;
        description: string;
        payload?: Record<string, unknown>;
        options?: { id: string; label: string }[];
        schema?: Record<string, unknown>;
      };
      setStream((p) => {
        if (p.some((i) => i.type === "approval" && i.id === e.hitlId)) return p;
        return [
          ...p,
          {
            type: "approval",
            id: e.hitlId,
            kind: e.kind ?? "approval",
            title: e.title,
            description: e.description,
            payload: e.payload,
            options: e.options,
            schema: e.schema,
          },
        ];
      });
    } else if (type === "RUN_FINISHED" || type === "RUN_ERROR") {
      const runStatus =
        type === "RUN_FINISHED"
          ? ((event as unknown as { status?: string }).status ?? "completed")
          : "error";
      const phaseStatus = runStatus === "error" ? "error" : "done";
      setStream((p) =>
        p.map((item) => {
          if (item.type === "phase" && item.id === phaseId && item.status === "running")
            return { ...item, status: phaseStatus };
          if (item.type === "step" && item.status === "running") return { ...item, status: "done" };
          return item;
        })
      );
    }
  }

  function hitlToApprovalItem(hitl: import("../../lib/api").HITLItem): Extract<ChatItem, { type: "approval" }> {
    return {
      type: "approval",
      id: hitl.id,
      kind: hitl.kind ?? "approval",
      title: hitl.title,
      description: hitl.description,
      payload: hitl.payload,
      options: hitl.options,
      schema: hitl.schema,
      expired: hitl.status === "expired",
    };
  }

  async function checkHITL() {
    try {
      const { hitlApi } = await import("../../lib/api");
      const res = await hitlApi.getPending(threadId.current);
      if (!res.data) return;
      const gate = hitlToApprovalItem(res.data);
      setStream((p) => {
        if (p.some((i) => i.type === "approval" && i.id === gate.id)) return p;
        return [...p, gate];
      });
    } catch (err) {
      console.error("[chat] checkHITL error", err);
    }
  }

  async function resumeAfterHitl(
    hitlId: string,
    decision: "approved" | "rejected",
    response?: Record<string, unknown>
  ) {
    subscription.current?.unsubscribe();
    setLocalRunning(true);
    const phaseId = `phase-resume-${Date.now()}`;

    const pushError = (msg: string) => {
      setStream((p) => [
        ...p,
        { type: "agent", id: `err-${Date.now()}`, content: `Error: ${msg}`, timestamp: new Date() },
      ]);
      setLocalRunning(false);
    };

    try {
      const { createChatAgent } = await import("../../lib/ag-ui");
      const agent = await createChatAgent(agMessages.current, threadId.current);

      subscription.current = agent
        .run({
          messages: agMessages.current,
          threadId: threadId.current,
          runId: crypto.randomUUID(),
          tools: [],
          context: [],
          state: {},
          forwardedProps: {
            resume: { hitlId, decision, response },
          },
        })
        .subscribe({
          next: (event: BaseEvent) => handleEvent(event, phaseId),
          error: (err: unknown) => {
            console.error("[chat] HITL resume error", err);
            pushError(err instanceof Error ? err.message : String(err));
          },
          complete: () => {
            setLocalRunning(false);
            checkHITL();
          },
        });
    } catch (err) {
      console.error("[chat] resumeAfterHitl error", err);
      pushError(err instanceof Error ? err.message : String(err));
    }
  }

  async function resolveApproval(
    id: string,
    decision: "approved" | "rejected",
    response?: Record<string, unknown>
  ) {
    setResolvingHitl(true);
    setStream((prev) =>
      prev.map((item) =>
        item.id === id && item.type === "approval"
          ? { ...item, resolveError: undefined }
          : item
      )
    );
    try {
      const { hitlApi } = await import("../../lib/api");
      await hitlApi.resolve(id, decision, response);
      setStream((prev) =>
        prev.map((item) =>
          item.id === id && item.type === "approval" ? { ...item, resolved: decision } : item
        )
      );
      await resumeAfterHitl(id, decision, response);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to resolve approval";
      setStream((prev) =>
        prev.map((item) =>
          item.id === id && item.type === "approval" ? { ...item, resolveError: msg } : item
        )
      );
    } finally {
      setResolvingHitl(false);
    }
  }

  async function sendToBackend(content: string, msgId: string) {
    subscription.current?.unsubscribe();
    setLocalRunning(true);

    const userMsg = { id: msgId, role: "user", content } as Message;
    agMessages.current = [...agMessages.current, userMsg];

    const phaseId = `phase-${Date.now()}`;

    const pushError = (msg: string) => {
      setStream((p) => [
        ...p,
        { type: "agent", id: `err-${Date.now()}`, content: `Error: ${msg}`, timestamp: new Date() },
      ]);
      setLocalRunning(false);
    };

    // Persist user message before running agent so ordering is correct in DB
    if (!activeSessionId) {
      // First message: create session (backend saves first user msg automatically)
      try {
        const { sessionsApi } = await import("../../lib/api");
        const res = await sessionsApi.create(content);
        const created = res.data;
        threadId.current = created.id;
        justCreatedSession.current = true;
        // If this chat was started from inside a group, assign it.
        if (pendingGroupId) {
          created.group_id = pendingGroupId;
          sessionsApi.setGroup(created.id, pendingGroupId).catch(() => {});
          setPendingGroupId(null);
        }
        setActiveSessionId(created.id);
        setSessions((prev) => [created, ...prev]);
      } catch (err) {
        console.error("[chat] create session error", err);
      }
    } else {
      // Subsequent messages: save user msg now, before agent runs
      import("../../lib/api").then(({ sessionsApi }) =>
        sessionsApi.createMessage(threadId.current, "user", content).catch(() => {})
      );
    }

    try {
      const { createChatAgent } = await import("../../lib/ag-ui");
      const agent = await createChatAgent(agMessages.current, threadId.current);

      subscription.current = agent
        .run({
          messages: agMessages.current,
          threadId: threadId.current,
          runId: crypto.randomUUID(),
          tools: [],
          context: [],
          state: {},
          forwardedProps: {},
        })
        .subscribe({
          next: (event: BaseEvent) => handleEvent(event, phaseId),
          error: (err: unknown) => {
            console.error("[chat] agent error", err);
            pushError(err instanceof Error ? err.message : String(err));
          },
          complete: () => {
            setLocalRunning(false);
            // Restore gate from REST if the stream did not emit HITL_REQUIRED.
            checkHITL();
          },
        });
    } catch (err) {
      console.error("[chat] sendToBackend error", err);
      pushError(err instanceof Error ? err.message : String(err));
    }
  }

  function addUrl() {
    const t = urlInput.trim();
    if (t && !urls.includes(t)) setUrls((p) => [...p, t]);
    setUrlInput("");
    setShowUrlInput(false);
  }

  function send() {
    const text = input.trim();
    if (!text && urls.length === 0) return;
    const content = text + (urls.length > 0 ? "\n" + urls.map((u) => `• ${u}`).join("\n") : "");
    const id = `u${Date.now()}`;
    if (inputBlocked) {
      setQueue((p) => [...p, { id, content }]);
    } else {
      setStream((p) => [...p, { type: "user", id, content, timestamp: new Date() }]);
      sendToBackend(content, id);
    }
    setInput("");
    setUrls([]);
    textareaRef.current?.focus();
  }

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <div className="flex flex-col h-full" style={{ background: "#F7F0E3" }}>
      {/* Mobile chat controls (sidebar is hidden on phones) */}
      <div
        className="md:hidden shrink-0 flex items-center gap-2 px-3 py-2"
        style={{ borderBottom: "2px solid #0D0D0D", background: "#F7F0E3" }}
      >
        <select
          value={activeSessionId ?? ""}
          onChange={(e) => setActiveSessionId(e.target.value || null)}
          className="input-brutal flex-1 min-w-0 text-xs py-1.5"
        >
          <option value="">New chat</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        <button onClick={startNewChat} className="btn-coral btn-sm text-xs shrink-0">
          <Icon icon="solar:add-circle-bold" width={13} />
          New
        </button>
      </div>

      {/* Session title bar */}
      {activeSession && (
        <div
          className="shrink-0 flex items-center gap-2 px-4 py-2"
          style={{ borderBottom: "1.5px solid #E0D8CA", background: "#F7F0E3" }}
        >
          <span className="text-sm font-space font-semibold truncate" style={{ color: "#0D0D0D" }}>
            {activeSession.title}
          </span>
        </div>
      )}

      {/* Stream */}
      <div className="flex-1 overflow-y-auto py-6">
        <div className="max-w-3xl mx-auto px-4 space-y-1">
          {stream.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center py-6">
              <div
                className="w-12 h-12 flex items-center justify-center mb-4"
                style={{
                  background: "#E8472A",
                  border: "2px solid #0D0D0D",
                  boxShadow: "3px 3px 0 #0D0D0D",
                  borderRadius: "50%",
                }}
              >
                <Icon icon="solar:diploma-bold" width={22} style={{ color: "#FFFFFF" }} />
              </div>
              <h2 className="font-bold font-space text-lg mb-1" style={{ color: "#0D0D0D" }}>
                Grad Paddy is ready
              </h2>
              <p className="text-sm font-dm mb-6 max-w-md mx-auto" style={{ color: "#5A5A5A" }}>
                Your AI co-pilot for grad school — research faculty, build a shortlist, track
                applications, and draft outreach, all from one chat.
              </p>

              {/* Workflow path */}
              <div className="w-full max-w-lg mb-6">
                <p
                  className="text-[10px] font-semibold uppercase tracking-widest font-space mb-2 text-left"
                  style={{ color: "#9CA3AF" }}
                >
                  How it works
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    {
                      icon: "solar:magnifer-bold",
                      label: "Research",
                      desc: "Find faculty & programs",
                    },
                    { icon: "solar:star-bold", label: "Shortlist", desc: "Save the best fits" },
                    { icon: "solar:calendar-bold", label: "Track", desc: "Manage deadlines" },
                    { icon: "solar:document-text-bold", label: "Draft", desc: "SOPs & outreach" },
                  ].map((step, i) => (
                    <div
                      key={step.label}
                      className="flex flex-col items-center text-center px-2 py-3"
                      style={{
                        background: "#FFFFFF",
                        border: "2px solid #0D0D0D",
                        boxShadow: "2px 2px 0 #0D0D0D",
                        borderRadius: "4px",
                      }}
                    >
                      <div
                        className="w-7 h-7 flex items-center justify-center mb-1.5"
                        style={{
                          background: "#F7F0E3",
                          border: "1.5px solid #0D0D0D",
                          borderRadius: "50%",
                          color: "#E8472A",
                        }}
                      >
                        <Icon icon={step.icon} width={14} />
                      </div>
                      <span
                        className="text-xs font-bold font-space leading-none mb-0.5"
                        style={{ color: "#0D0D0D" }}
                      >
                        {i + 1}. {step.label}
                      </span>
                      <span
                        className="text-[10px] font-dm leading-tight"
                        style={{ color: "#9CA3AF" }}
                      >
                        {step.desc}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Try asking */}
              <div className="w-full max-w-lg">
                <p
                  className="text-[10px] font-semibold uppercase tracking-widest font-space mb-2 text-left"
                  style={{ color: "#9CA3AF" }}
                >
                  Try asking
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {[
                    "Find NLP professors at MIT and Stanford",
                    "Draft an SOP for CMU LTI",
                    "Who is hiring in ML systems?",
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => {
                        setInput(prompt);
                        textareaRef.current?.focus();
                      }}
                      className="text-xs font-dm px-3 py-1.5 bouncy"
                      style={{
                        background: "#FFFFFF",
                        border: "1.5px solid #0D0D0D",
                        borderRadius: "4px",
                        color: "#5A5A5A",
                      }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {groupStream(stream).map((entry) => {
            if (entry.kind === "standalone") {
              const item = entry.item;
              if (item.type === "user" || item.type === "agent")
                return (
                  <div key={item.id} className="py-1">
                    <MessageBubble item={item} streamingMessageId={streamingMessageId} />
                  </div>
                );
              if (item.type === "approval")
                return (
                  <div key={item.id} className="py-2">
                    <ApprovalGate
                      item={item}
                      onResolve={resolveApproval}
                      resolving={resolvingHitl}
                    />
                  </div>
                );
            }
            if (!showEvents) return null;
            if (entry.kind === "group")
              return (
                <AgentWorkCard
                  key={entry.group.phase.id}
                  group={entry.group}
                  collapsed={collapsedPhases.has(entry.group.phase.id)}
                  onToggle={() => togglePhase(entry.group.phase.id)}
                />
              );
            if (entry.kind === "orphan")
              return (
                <div key={entry.item.id}>
                  <StepCard step={entry.item} number={1} />
                </div>
              );
            return null;
          })}
          {isAgentRunning && (
            <div className="flex items-center gap-3 py-1 msg-enter">
              <div
                className="w-7 h-7 shrink-0 flex items-center justify-center logo-beat"
                style={{ background: "#E8472A", border: "2px solid #C8381F", borderRadius: "50%" }}
              >
                <span className="text-xs leading-none">🎓</span>
              </div>
              <span className="text-xs font-dm" style={{ color: "#9CA3AF" }}>
                {agentStatusText}
              </span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 w-full max-w-3xl mx-auto px-4 pb-6 pt-2">
        {queue.length > 0 && (
          <div
            className="mb-2 overflow-hidden bg-white"
            style={{
              border: "2px solid #0D0D0D",
              boxShadow: "3px 3px 0 #0D0D0D",
              borderRadius: "4px",
            }}
          >
            <div
              className="flex items-center gap-2 px-3 py-2"
              style={{
                background: "#0D0D0D",
                borderBottom: "2px solid #0D0D0D",
                borderRadius: "4px 4px 0 0",
              }}
            >
              <Icon
                icon="solar:spinner-bold"
                width={11}
                className="animate-spin"
                style={{ color: "#9CA3AF" }}
              />
              <span className="text-xs font-semibold font-space tracking-wide text-white">
                {queue.length} queued — sends when agent finishes
              </span>
            </div>
            {queue.map((q) => (
              <div
                key={q.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
                style={{ borderBottom: "1px solid #EDE6D3" }}
              >
                <p className="text-xs font-dm truncate flex-1 min-w-0" style={{ color: "#5A5A5A" }}>
                  {q.content}
                </p>
                <button
                  onClick={() => setQueue((p) => p.filter((m) => m.id !== q.id))}
                  className="bouncy shrink-0"
                  style={{ color: "#B0A898" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#E8472A")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#B0A898")}
                >
                  <Icon icon="solar:close-circle-bold" width={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {urls.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {urls.map((url, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-white text-xs font-mono"
                style={{ border: "1.5px solid #0D0D0D", color: "#5A5A5A", borderRadius: "4px" }}
              >
                <Icon icon="solar:link-bold" width={10} />
                <span className="truncate max-w-[180px]">{url}</span>
                <button
                  onClick={() => setUrls((p) => p.filter((_, j) => j !== i))}
                  style={{ color: "#B0A898" }}
                >
                  <Icon icon="solar:close-circle-bold" width={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        {showUrlInput && (
          <div className="mb-2 flex gap-2">
            <input
              autoFocus
              type="url"
              placeholder="https://example.edu/faculty"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addUrl()}
              className="input-brutal flex-1 text-sm"
            />
            <button onClick={addUrl} className="btn-black btn-sm text-xs">
              Add
            </button>
            <button onClick={() => setShowUrlInput(false)} className="btn-white btn-sm text-xs">
              <Icon icon="solar:close-circle-bold" width={13} />
            </button>
          </div>
        )}

        <div
          className="bg-white overflow-hidden"
          style={{
            border: "2px solid #0D0D0D",
            boxShadow: "4px 4px 0 #0D0D0D",
            borderRadius: "4px",
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={
              inputBlocked ? "Type to queue — sends when agent finishes..." : "Ask Grad Paddy..."
            }
            rows={2}
            className="w-full px-4 pt-3.5 pb-1 text-sm font-dm bg-transparent resize-none outline-none"
            style={{ color: "#0D0D0D" }}
          />
          <div className="flex items-center justify-between px-3 pb-3">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowUrlInput(!showUrlInput)}
                className="p-2 bouncy"
                style={{
                  border: "1.5px solid #0D0D0D",
                  background: showUrlInput ? "#0D0D0D" : "#F7F0E3",
                  color: showUrlInput ? "#fff" : "#9CA3AF",
                  borderRadius: "4px",
                }}
                title="Add URL"
              >
                <Icon icon="solar:link-bold" width={14} />
              </button>
              <button
                onClick={() => setShowEvents((v) => !v)}
                className="p-2 bouncy"
                style={{
                  border: "1.5px solid #0D0D0D",
                  background: "#F7F0E3",
                  color: showEvents ? "#0D0D0D" : "#B0A898",
                  borderRadius: "4px",
                }}
                title={showEvents ? "Hide agent events" : "Show agent events"}
              >
                <Icon icon={showEvents ? "solar:eye-bold" : "solar:eye-closed-bold"} width={14} />
              </button>
            </div>
            <button
              onClick={send}
              disabled={!input.trim() && urls.length === 0}
              className={clsx(
                "flex items-center gap-1.5 btn-sm font-space font-semibold text-xs bouncy",
                input.trim() || urls.length > 0 ? "btn-coral" : "btn-cream"
              )}
              style={
                !(input.trim() || urls.length > 0)
                  ? { color: "#B0A898", cursor: "not-allowed" }
                  : undefined
              }
            >
              {inputBlocked ? (
                <>
                  <Icon icon="solar:spinner-bold" width={13} className="animate-spin" />
                  Queue
                </>
              ) : (
                <>
                  <Icon icon="solar:arrow-right-up-bold" width={13} />
                  Send
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
