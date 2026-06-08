"use client";

import { useState, useRef, useEffect } from "react";
import { flushSync } from "react-dom";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import clsx from "clsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAgent } from "@/components/AgentProvider";
import type { Message, BaseEvent } from "../../lib/ag-ui";
import { useChatSessions } from "@/context/ChatSessionsContext";
import MarkdownCanvas from "@/components/MarkdownCanvas";

// ── Types ────────────────────────────────────────────────────────────────────

type StepStatus = "pending" | "running" | "done" | "error";

// Map tool names to human-friendly descriptions
const TOOL_DESCRIPTIONS: Record<string, { label: string; emoji: string; description: string }> = {
  transfer_to_agent: { label: "Thinking", emoji: "⚡", description: "Connecting to agent..." },
  thinking: { label: "Thinking", emoji: "⚡", description: "Thinking..." },
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
  "platform.core.index_explorer": {
    label: "Inspecting Elastic indices",
    emoji: "🔎",
    description: "Finding relevant Elasticsearch indices...",
  },
  "platform.core.list_indices": {
    label: "Listing Elastic indices",
    emoji: "🗂️",
    description: "Checking accessible Elasticsearch data...",
  },
  "platform.core.get_index_mapping": {
    label: "Reading Elastic mappings",
    emoji: "🧭",
    description: "Inspecting field structure...",
  },
  "platform.core.search": {
    label: "Elastic hybrid search",
    emoji: "⚡",
    description: "Searching indexed admissions evidence...",
  },
  "platform.core.generate_esql": {
    label: "Generating ES|QL",
    emoji: "🧠",
    description: "Translating the question into an ES|QL query...",
  },
  "platform.core.execute_esql": {
    label: "Running ES|QL scan",
    emoji: "📊",
    description: "Analyzing admissions data in Elasticsearch...",
  },
  "platform.core.get_document_by_id": {
    label: "Opening Elastic evidence",
    emoji: "📄",
    description: "Retrieving a source document...",
  },
  "platform.core.create_visualization": {
    label: "Creating Elastic visualization",
    emoji: "📈",
    description: "Preparing a Kibana-ready view...",
  },
  hitl_approval: {
    label: "Requesting approval",
    emoji: "👤",
    description: "Waiting for your input...",
  },
  researcher_find_url_agent: {
    label: "Finding relevant pages",
    emoji: "🔗",
    description: "Locating important resources...",
  },
  // Orchestration / planning
  planner: { label: "Planning", emoji: "🧭", description: "Planning the approach..." },
  domain_orchestrator_agent: {
    label: "Coordinating",
    emoji: "🧩",
    description: "Coordinating sub-agents...",
  },
  researcher: { label: "Researching", emoji: "🔬", description: "Researching in depth..." },
  governance_agent: {
    label: "Reviewing action",
    emoji: "🛡️",
    description: "Checking before changes...",
  },
  operations_agent: { label: "Saving changes", emoji: "💾", description: "Applying updates..." },
  request_hitl: {
    label: "Requesting approval",
    emoji: "👤",
    description: "Waiting for your input...",
  },
  // Faculty / shortlist
  faculty_discovery_agent: {
    label: "Finding faculty",
    emoji: "🎓",
    description: "Searching for professors...",
  },
  faculty_profile_deep_dive_agent: {
    label: "Reading faculty profile",
    emoji: "📄",
    description: "Analyzing a professor's work...",
  },
  funding_requirement_flag_detection_agent: {
    label: "Checking funding",
    emoji: "💰",
    description: "Assessing funding requirements...",
  },
  // Tracker / applications
  application_agent: {
    label: "Updating tracker",
    emoji: "🗂️",
    description: "Managing applications...",
  },
  application_tracker_agent: {
    label: "Updating tracker",
    emoji: "🗂️",
    description: "Managing applications...",
  },
  internal_app_agent: {
    label: "Updating tracker",
    emoji: "🗂️",
    description: "Managing applications...",
  },
  account_agent: {
    label: "Updating profile",
    emoji: "👤",
    description: "Reading or editing settings...",
  },
  // Outreach drafting
  outreach_crm_draft: {
    label: "Drafting outreach",
    emoji: "✉️",
    description: "Writing outreach...",
  },
  outreach_talking_points: {
    label: "Drafting outreach",
    emoji: "✉️",
    description: "Preparing talking points...",
  },
  outreach_paper_summary: {
    label: "Summarizing papers",
    emoji: "📚",
    description: "Summarizing recent work...",
  },
  // SOP drafting
  sop_translation_intake: {
    label: "Drafting SOP",
    emoji: "📝",
    description: "Gathering SOP details...",
  },
  sop_translation_strategy: {
    label: "Drafting SOP",
    emoji: "📝",
    description: "Shaping SOP strategy...",
  },
  sop_translation_draft: { label: "Drafting SOP", emoji: "📝", description: "Writing the SOP..." },
  // Research narrative
  research_evidence_synthesis: {
    label: "Shaping research narrative",
    emoji: "🧠",
    description: "Synthesizing evidence...",
  },
  research_framing_recommendation: {
    label: "Shaping research narrative",
    emoji: "🧠",
    description: "Framing your research...",
  },
  research_narrative_angles: {
    label: "Shaping research narrative",
    emoji: "🧠",
    description: "Exploring angles...",
  },
};

function getToolDescription(toolName: string): { label: string; emoji: string } {
  if (toolName in TOOL_DESCRIPTIONS) {
    const desc = TOOL_DESCRIPTIONS[toolName];
    return { label: desc.label, emoji: desc.emoji };
  }
  return { label: toolName.replace(/_/g, " "), emoji: "⚙️" };
}

type ChatItem =
  | { type: "user"; id: string; content: string; timestamp: Date }
  | {
      type: "agent";
      id: string;
      content: string;
      timestamp: Date;
      run?: string;
      thinking?: boolean;
    }
  | {
      type: "step";
      id: string;
      label: string;
      status: StepStatus;
      detail?: string;
      tool?: string;
      children?: { label: string; status: StepStatus; detail?: string }[];
    }
  | { type: "phase"; id: string; label: string; status: StepStatus; reasoning?: string }
  | {
      type: "approval";
      id: string; // hitlId
      kind: "approval" | "choice" | "input";
      title: string;
      description: string;
      items?: string[];
      options?: { id: string; label: string }[];
      schema?: Record<string, unknown> | null;
      reviewContent?: string; // editable draft/body to review before saving
      navTarget?: { route: string; label: string }; // where to open the result
      expiresAt?: string | null;
      resolved?: "approved" | "rejected";
    }
  | {
      type: "result";
      id: string;
      title: string;
      subtitle: string;
      route: string;
      label: string;
    };

// Reconstruct phase/step items from persisted AG-UI events for a restored session.
// TEXT_MESSAGE_* events are skipped — the agent text item is built from the message content.
function replayEventsToItems(events: Record<string, unknown>[], messageId: string): ChatItem[] {
  const items: ChatItem[] = [];
  for (const e of events) {
    const type = e.type as string;
    if (type === "RUN_STARTED") {
      items.push({ type: "phase", id: `run-${messageId}`, label: "Thinking", status: "done" });
    } else if (type === "STEP_STARTED") {
      const name = e.stepName as string;
      items.push({
        type: "step",
        id: `step-${name}-${messageId}`,
        label: name.replace(/_/g, " "),
        status: "done",
        tool: "thinking",
      });
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
          p: ({ children }) => <p className="mb-3.5 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5 mb-3.5 space-y-1.5">{children}</ul>,
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 mb-3.5 space-y-1.5">{children}</ol>
          ),
          li: ({ children }) => <li className="text-[15px] font-dm leading-7">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-bold" style={{ color: "#0D0D0D" }}>
              {children}
            </strong>
          ),
          h1: ({ children }) => (
            <h1 className="font-bold font-space text-lg mb-2.5 mt-4 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-bold font-space text-base mb-2 mt-4 first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-semibold font-space text-[15px] mb-1.5 mt-3 first:mt-0">
              {children}
            </h3>
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
  const toolDesc = step.tool
    ? {
        ...getToolDescription(step.tool),
        label: step.tool === "thinking" ? step.label : getToolDescription(step.tool).label,
      }
    : { label: step.label, emoji: "⚙️" };

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

// Map a HITL payload `entity` hint to where the saved result lives.
function entityNav(entity?: string): { route: string; label: string } | undefined {
  if (!entity) return undefined;
  const e = entity.toLowerCase();
  if (["draft", "sop", "outreach", "outreach-prep", "research-narrative", "narrative"].includes(e))
    return { route: "/drafts", label: "Drafts" };
  if (["tracker", "application", "app", "email", "recommender"].includes(e))
    return { route: "/tracker", label: "Tracker" };
  if (["shortlist", "faculty"].includes(e)) return { route: "/shortlist", label: "Shortlist" };
  return undefined;
}

function groupStream(stream: ChatItem[]) {
  // Decide which agent messages are intermediate "thoughts" purely from position:
  // an agent message is superseded (collapse it) when a LATER agent message exists
  // before the next user message. Only the final agent message of each turn stays
  // visible. Computed here — not from a per-event flag — so it's robust to live
  // streaming, history restore, and however messages get tagged.
  const superseded = new Set<string>();
  let seenAgentAfter = false;
  for (let i = stream.length - 1; i >= 0; i--) {
    const it = stream[i];
    if (it.type === "user") {
      seenAgentAfter = false;
    } else if (it.type === "agent") {
      if (seenAgentAfter) superseded.add(it.id);
      seenAgentAfter = true;
    }
  }

  const out: Array<
    | { kind: "standalone"; item: Exclude<ChatItem, { type: "phase" | "step" }> }
    | { kind: "group"; group: PhaseGroup }
    | { kind: "orphan"; item: Extract<ChatItem, { type: "step" }> }
    | { kind: "thinking"; items: Extract<ChatItem, { type: "agent" }>[] }
  > = [];
  for (const item of stream) {
    if (item.type === "phase") {
      out.push({ kind: "group", group: { phase: item, steps: [] } });
    } else if (item.type === "step") {
      let foundGroup = false;
      for (let i = out.length - 1; i >= 0; i--) {
        const entry = out[i];
        if (entry.kind === "group") {
          entry.group.steps.push(item);
          foundGroup = true;
          break;
        }
      }
      if (!foundGroup) {
        out.push({ kind: "orphan", item });
      }
    } else if (item.type === "agent" && (item.thinking || superseded.has(item.id))) {
      const last = out[out.length - 1];
      if (last?.kind === "thinking") last.items.push(item);
      else out.push({ kind: "thinking", items: [item] });
    } else {
      out.push({ kind: "standalone", item: item as Exclude<ChatItem, { type: "phase" | "step" }> });
    }
  }
  return out;
}

// Collapsible "Thinking" disclosure — holds a run's intermediate agent messages
// so the chat stays tidy (the visible answer is the result card / final reply).
function ThinkingBlock({ items }: { items: Extract<ChatItem, { type: "agent" }>[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="py-1 msg-enter flex gap-3">
      <div
        className="w-7 h-7 shrink-0 flex items-center justify-center mt-0.5"
        style={{ background: "#EDE6D3", border: "2px solid #0D0D0D", borderRadius: "50%" }}
      >
        <span className="text-xs leading-none">🎓</span>
      </div>
      <div className="flex flex-col gap-2 min-w-0 flex-1">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 w-fit bouncy"
          title={open ? "Hide thinking" : "Show thinking"}
        >
          <Icon icon="solar:lightbulb-bolt-bold" width={13} style={{ color: "#E8472A" }} />
          <span className="text-xs font-semibold font-space" style={{ color: "#9CA3AF" }}>
            Thinking
          </span>
          <Icon
            icon="solar:alt-arrow-down-bold"
            width={11}
            className={clsx("transition-transform duration-150", !open && "-rotate-90")}
            style={{ color: "#B0A898" }}
          />
        </button>
        {open && (
          <div className="pl-3 flex flex-col gap-3" style={{ borderLeft: "2px solid #EDE6D3" }}>
            {items.map((it) => (
              <div key={it.id} className="text-xs" style={{ opacity: 0.7 }}>
                <StreamingText content={it.content} messageId={it.id} isStreaming={false} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Live reasoning feed — an auto-scrolling, edge-faded mini view of what the
// agent is doing right now. Collapsed: short and center-focused, with the text
// fading out toward the top/bottom edges (crisp in the ~30–80% band). Expanded:
// a taller, fixed-max-height scrollable view of the entire trace.
function ReasoningFeed({
  lines,
  reasoning,
  running,
}: {
  lines: { id: string; text: string; status: StepStatus }[];
  reasoning?: string;
  running: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasReasoning = !!reasoning && reasoning.trim().length > 0;

  // Keep the latest content in view as the trace grows (and when toggling height).
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [reasoning, lines.length, expanded, running]);

  // Vertical fade: transparent at the edges, opaque across the center band so
  // lines sharpen as they scroll into the middle and shadow out toward the top.
  const fadeMask =
    "linear-gradient(to bottom, transparent 0%, #000 30%, #000 80%, transparent 100%)";

  return (
    <div style={{ background: "#FFFFFF" }}>
      <div
        ref={scrollRef}
        className="px-4"
        style={{
          maxHeight: expanded ? 280 : 108,
          // Padding keeps the newest line resting inside the crisp band rather
          // than flush against the faded bottom edge.
          paddingTop: 14,
          paddingBottom: expanded ? 14 : 34,
          overflowY: expanded ? "auto" : "hidden",
          WebkitMaskImage: expanded ? undefined : fadeMask,
          maskImage: expanded ? undefined : fadeMask,
          transition: "max-height 220ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        {hasReasoning ? (
          <div
            className="text-[13px] font-dm leading-relaxed whitespace-pre-wrap"
            style={{ color: "#6B6457" }}
          >
            {reasoning}
            {running && <span className="typewriter-caret" />}
          </div>
        ) : (
          <div className="space-y-1.5">
            {lines.length === 0 && (
              <div className="text-[13px] font-dm italic" style={{ color: "#9CA3AF" }}>
                {running ? "Thinking…" : "Getting started…"}
              </div>
            )}
            {lines.map((line, i) => {
              const isLast = i === lines.length - 1;
              const active = isLast && running && line.status !== "done";
              return (
                <div
                  key={line.id}
                  className="msg-enter flex items-center gap-2"
                  style={{
                    opacity: active ? 1 : line.status === "done" ? 0.5 : 0.75,
                    transition: "opacity 220ms ease",
                  }}
                >
                  {line.status === "done" ? (
                    <span className="shrink-0 text-[11px]" style={{ color: "#4ECDC4" }}>
                      ✓
                    </span>
                  ) : active ? (
                    <Icon
                      icon="solar:spinner-bold"
                      width={12}
                      className="animate-spin shrink-0"
                      style={{ color: "#E8472A" }}
                    />
                  ) : (
                    <span className="shrink-0" style={{ color: "#C8C0AF" }}>
                      •
                    </span>
                  )}
                  <span
                    className={clsx(
                      "text-[13px] font-dm leading-snug truncate",
                      active && "font-medium"
                    )}
                    style={{ color: active ? "#0D0D0D" : "#6B6457" }}
                  >
                    {line.text}
                    {active && "…"}
                  </span>
                  {active && <span className="typewriter-caret" />}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {(hasReasoning || lines.length > 2) && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-center gap-1 py-1.5 text-[11px] font-bold font-space uppercase tracking-wide"
          style={{ color: "#9CA3AF", borderTop: "1.5px solid #EDE6D3", background: "#FBF7EF" }}
        >
          <Icon
            icon="solar:alt-arrow-down-bold"
            width={11}
            className={clsx("transition-transform duration-150", expanded && "rotate-180")}
          />
          {expanded ? "collapse" : "show steps"}
        </button>
      )}
    </div>
  );
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
  const running = phase.status === "running";

  // Thought-process feed lines: one per step. Tool steps use their friendly
  // label; thinking steps use the descriptive stage label from the backend.
  const lines = steps.map((s) => ({
    id: s.id,
    text: s.tool && s.tool !== "thinking" ? getToolDescription(s.tool).label : s.label,
    status: s.status,
  }));

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
          {/* Thought process — live, edge-faded reasoning feed kept below the steps. */}
          <div
            className="px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest font-space"
            style={{ background: "#F7F0E3", borderTop: "2px solid #0D0D0D", color: "#9CA3AF" }}
          >
            Thought process
          </div>
          <ReasoningFeed lines={lines} reasoning={phase.reasoning} running={running} />
        </>
      )}
    </div>
  );
}

function ApprovalGate({
  item,
  expired,
  onResolve,
  onAlwaysAllow,
}: {
  item: Extract<ChatItem, { type: "approval" }>;
  expired: boolean;
  onResolve: (id: string, d: "approved" | "rejected", response?: Record<string, unknown>) => void;
  onAlwaysAllow: (id: string) => void;
}) {
  const resolvedView = item.resolved || expired;
  return (
    <div className="msg-enter w-full max-w-xl">
      <div
        className="overflow-hidden"
        style={{
          background: "#FFFFFF",
          border: "2px solid #0D0D0D",
          boxShadow: "3px 3px 0 #0D0D0D",
          borderRadius: "8px",
        }}
      >
        {/* Permission header */}
        <div className="flex items-center gap-2 px-4 py-2" style={{ background: "#0D0D0D" }}>
          <Icon icon="solar:shield-keyhole-bold" width={14} style={{ color: "#E8472A" }} />
          <span
            className="text-[10px] font-bold uppercase tracking-widest font-space"
            style={{ color: "#FFFFFF" }}
          >
            Permission required
          </span>
        </div>

        {/* Body */}
        <div className="px-4 py-3">
          <p className="font-bold font-space text-sm mb-1" style={{ color: "#0D0D0D" }}>
            {item.title}
          </p>
          <p className="text-xs font-dm leading-relaxed" style={{ color: "#5A5A5A" }}>
            {item.description}
          </p>
          {item.items && item.items.length > 0 && (
            <ul className="space-y-1 mt-2">
              {item.items.map((it, i) => (
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

          {/* Options */}
          <div className="mt-3">
            {resolvedView ? (
              <div
                className="flex items-center gap-2 text-xs font-semibold font-space"
                style={{ color: item.resolved === "approved" ? "#4ECDC4" : "#9CA3AF" }}
              >
                <Icon
                  icon={
                    item.resolved === "approved"
                      ? "solar:check-circle-bold"
                      : expired
                        ? "solar:clock-circle-bold"
                        : "solar:close-circle-bold"
                  }
                  width={13}
                />
                {item.resolved === "approved"
                  ? "Approved"
                  : item.resolved === "rejected"
                    ? "Rejected"
                    : "Expired — no longer awaiting input"}
              </div>
            ) : typeof item.reviewContent === "string" ? (
              <ReviewGate
                initial={item.reviewContent}
                onApprove={(content) => onResolve(item.id, "approved", { content })}
                onReject={() => onResolve(item.id, "rejected")}
              />
            ) : item.kind === "choice" && item.options?.length ? (
              <div className="flex flex-col gap-1.5">
                {item.options.map((o) => (
                  <PermissionOption
                    key={o.id}
                    icon="solar:check-circle-bold"
                    label={o.label}
                    onClick={() =>
                      onResolve(item.id, "approved", { optionId: o.id, label: o.label })
                    }
                  />
                ))}
                <PermissionOption
                  icon="solar:close-circle-bold"
                  label="Cancel"
                  muted
                  onClick={() => onResolve(item.id, "rejected")}
                />
              </div>
            ) : item.kind === "input" ? (
              <HITLInput item={item} onResolve={onResolve} />
            ) : (
              <div className="flex flex-col gap-1.5">
                <PermissionOption
                  icon="solar:check-circle-bold"
                  label="Yes, allow"
                  description="Approve this action"
                  primary
                  onClick={() => onResolve(item.id, "approved")}
                />
                <PermissionOption
                  icon="solar:shield-check-bold"
                  label="Yes, and don't ask again"
                  description="Auto-approve future actions"
                  onClick={() => onAlwaysAllow(item.id)}
                />
                <PermissionOption
                  icon="solar:close-circle-bold"
                  label="No, reject"
                  description="Don't make this change"
                  muted
                  onClick={() => onResolve(item.id, "rejected")}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// A single selectable permission option (numbered, full-width) — mirrors the
// Claude-style permission prompt.
function PermissionOption({
  icon,
  label,
  description,
  onClick,
  primary,
  muted,
}: {
  icon: string;
  label: string;
  description?: string;
  onClick: () => void;
  primary?: boolean;
  muted?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2.5 text-left bouncy w-full"
      style={{
        background: primary ? "#4ECDC4" : "#FFFFFF",
        border: `1.5px solid ${primary ? "#0D0D0D" : "#C8C0AF"}`,
        borderRadius: "8px",
      }}
      onMouseEnter={(e) => {
        if (!primary) e.currentTarget.style.background = "#F7F0E3";
      }}
      onMouseLeave={(e) => {
        if (!primary) e.currentTarget.style.background = "#FFFFFF";
      }}
    >
      <Icon
        icon={icon}
        width={16}
        className="shrink-0"
        style={{ color: muted ? "#9CA3AF" : primary ? "#0D0D0D" : "#E8472A" }}
      />
      <span className="flex flex-col min-w-0">
        <span
          className="text-sm font-semibold font-space leading-tight"
          style={{ color: muted ? "#9CA3AF" : "#0D0D0D" }}
        >
          {label}
        </span>
        {description && (
          <span
            className="text-[11px] font-dm leading-tight mt-0.5"
            style={{ color: primary ? "rgba(13,13,13,0.65)" : "#9CA3AF" }}
          >
            {description}
          </span>
        )}
      </span>
    </button>
  );
}

// Result card shown after a write is approved — links to the saved item.
function ResultCard({
  item,
  onOpen,
}: {
  item: Extract<ChatItem, { type: "result" }>;
  onOpen: () => void;
}) {
  const icon =
    item.route === "/tracker"
      ? "solar:calendar-bold"
      : item.route === "/shortlist"
        ? "solar:star-bold"
        : "solar:document-text-bold";
  return (
    <div className="flex gap-3 msg-enter">
      <div
        className="w-7 h-7 shrink-0 flex items-center justify-center mt-0.5"
        style={{ background: "#EDE6D3", border: "2px solid #0D0D0D", borderRadius: "50%" }}
      >
        <span className="text-xs leading-none">🎓</span>
      </div>
      <div
        className="flex items-center gap-3 px-3 py-2.5 max-w-[88%] w-full"
        style={{
          background: "#FFFFFF",
          border: "2px solid #0D0D0D",
          boxShadow: "3px 3px 0 #0D0D0D",
          borderRadius: "8px",
        }}
      >
        <div
          className="w-9 h-9 shrink-0 flex items-center justify-center"
          style={{ background: "#F7F0E3", border: "1.5px solid #0D0D0D", borderRadius: "6px" }}
        >
          <Icon icon={icon} width={17} style={{ color: "#E8472A" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold font-space truncate" style={{ color: "#0D0D0D" }}>
            {item.title}
          </div>
          <div className="text-[11px] font-dm" style={{ color: "#9CA3AF" }}>
            {item.subtitle} · {item.label}
          </div>
        </div>
        <button onClick={onOpen} className="btn-black btn-sm text-xs shrink-0">
          Open in {item.label}
          <Icon icon="solar:arrow-right-up-bold" width={13} />
        </button>
      </div>
    </div>
  );
}

// Review-and-edit gate: the proposed draft/body is shown in an editable area;
// the user approves as-is or edits then approves. The (possibly edited) content
// is sent back so the backend saves exactly what was reviewed.
function ReviewGate({
  initial,
  onApprove,
  onReject,
}: {
  initial: string;
  onApprove: (content: string) => void;
  onReject: () => void;
}) {
  const [text, setText] = useState(initial);
  const edited = text !== initial;
  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex flex-col overflow-hidden"
        style={{
          background: "#FFFFFF",
          border: "2px solid #0D0D0D",
          borderRadius: "4px",
          maxHeight: "50vh",
          minHeight: 220,
        }}
      >
        <MarkdownCanvas initialMarkdown={initial} onChange={setText} className="flex-1 min-h-0" />
      </div>
      <div className="flex flex-col gap-1.5">
        <PermissionOption
          icon="solar:check-circle-bold"
          label={edited ? "Update & approve" : "Approve"}
          description={edited ? "Save your edited version" : "Save as drafted"}
          primary
          onClick={() => onApprove(text)}
        />
        <PermissionOption
          icon="solar:close-circle-bold"
          label="Reject"
          description="Don't save"
          muted
          onClick={onReject}
        />
      </div>
    </div>
  );
}

// HITL "input" kind: a schema-driven form when `schema.properties` is present,
// otherwise a freeform textarea. Submits the collected response object.
function HITLInput({
  item,
  onResolve,
}: {
  item: Extract<ChatItem, { type: "approval" }>;
  onResolve: (id: string, d: "approved" | "rejected", response?: Record<string, unknown>) => void;
}) {
  const schema = (item.schema ?? null) as {
    properties?: Record<
      string,
      { title?: string; type?: string; enum?: string[]; format?: string }
    >;
    required?: string[];
  } | null;
  const props =
    schema?.properties && typeof schema.properties === "object" ? schema.properties : null;
  const required = Array.isArray(schema?.required) ? schema!.required! : [];

  const [fields, setFields] = useState<Record<string, string>>({});
  const [text, setText] = useState("");

  const setField = (k: string, v: string) => setFields((f) => ({ ...f, [k]: v }));

  if (props) {
    const keys = Object.keys(props);
    const missing = required.some((k) => !(fields[k] ?? "").trim());
    const submit = () => {
      const out: Record<string, string> = {};
      for (const k of keys) if ((fields[k] ?? "").trim()) out[k] = fields[k].trim();
      onResolve(item.id, "approved", out);
    };
    return (
      <div className="flex flex-col gap-2">
        {keys.map((k) => {
          const spec = props[k] ?? {};
          const label = spec.title || k.replace(/_/g, " ");
          const isReq = required.includes(k);
          return (
            <div key={k}>
              <label
                className="block text-[10px] font-bold font-space uppercase tracking-wider mb-1"
                style={{ color: "#5A5A5A" }}
              >
                {label}
                {isReq && <span style={{ color: "#E8472A" }}> *</span>}
              </label>
              {spec.enum?.length ? (
                <select
                  value={fields[k] ?? ""}
                  onChange={(e) => setField(k, e.target.value)}
                  className="input-brutal w-full text-xs"
                >
                  <option value="">Select…</option>
                  {spec.enum.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : spec.format === "textarea" ? (
                <textarea
                  value={fields[k] ?? ""}
                  onChange={(e) => setField(k, e.target.value)}
                  rows={2}
                  className="input-brutal w-full text-xs resize-none"
                />
              ) : (
                <input
                  value={fields[k] ?? ""}
                  onChange={(e) => setField(k, e.target.value)}
                  className="input-brutal w-full text-xs"
                />
              )}
            </div>
          );
        })}
        <div className="flex gap-2 pt-0.5">
          <button
            onClick={submit}
            disabled={missing}
            className="btn-teal btn-sm gap-1.5 text-xs"
            style={missing ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
          >
            <Icon icon="solar:check-circle-bold" width={12} />
            Submit
          </button>
          <button
            onClick={() => onResolve(item.id, "rejected")}
            className="btn-white btn-sm gap-1.5 text-xs"
          >
            <Icon icon="solar:close-circle-bold" width={12} />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="Type your response…"
        className="input-brutal w-full text-xs resize-none"
      />
      <div className="flex gap-2">
        <button
          onClick={() => onResolve(item.id, "approved", { input: text.trim() })}
          disabled={!text.trim()}
          className="btn-teal btn-sm gap-1.5 text-xs"
          style={!text.trim() ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
        >
          <Icon icon="solar:check-circle-bold" width={12} />
          Submit
        </button>
        <button
          onClick={() => onResolve(item.id, "rejected")}
          className="btn-white btn-sm gap-1.5 text-xs"
        >
          <Icon icon="solar:close-circle-bold" width={12} />
          Cancel
        </button>
      </div>
    </div>
  );
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
        {!isUser && (
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
        )}
        <div className={clsx("flex flex-col gap-1 max-w-[88%]", isUser && "items-end")}>
          <div
            ref={boxRef}
            onPointerDown={spawnRipple}
            className="relative overflow-hidden px-5 py-3 text-[15px] font-dm leading-7"
            style={{
              background: isUser ? "#0D0D0D" : "#FFFFFF",
              color: isUser ? "#fff" : "#0D0D0D",
              border: "2px solid #0D0D0D",
              boxShadow: "3px 3px 0 #0D0D0D",
              borderRadius: "8px",
              minHeight: isStreaming ? "100px" : "auto",
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
  const [autoApprove, setAutoApprove] = useState(false);
  const [now, setNow] = useState(0);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const [queue, setQueue] = useState<{ id: string; content: string }[]>([]);
  const [running, setLocalRunning] = useState(false);
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
  const router = useRouter();

  const isAgentRunning = running;
  const runningStep = stream.find(
    (i): i is Extract<ChatItem, { type: "step" }> => i.type === "step" && i.status === "running"
  );
  const agentStatusText = runningStep?.tool
    ? `${getToolDescription(runningStep.tool).label}...`
    : "Working...";
  const pendingApproval = stream.some(
    (i) => i.type === "approval" && !i.resolved && !(i.expiresAt && Date.parse(i.expiresAt) < now)
  );
  const inputBlocked = isAgentRunning || pendingApproval;

  useEffect(() => {
    setRunning(isAgentRunning);
  }, [isAgentRunning, setRunning]);
  // Load the auto-approve preference once.
  useEffect(() => {
    import("../../lib/api")
      .then(({ usersApi }) => usersApi.getPreferences())
      .then((res) => setAutoApprove(!!res.data.auto_approve))
      .catch(() => {});
  }, []);

  // Clock for HITL expiry checks (set in callbacks, not the effect body).
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const initial = setTimeout(tick, 0);
    const interval = setInterval(tick, 15000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  async function toggleAutoApprove(value: boolean) {
    setAutoApprove(value);
    try {
      const { preferencesApi } = await import("../../lib/api");
      await preferencesApi.setAutoApprove(value);
    } catch {
      setAutoApprove(!value);
    }
  }
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [stream]);
  useEffect(
    () => () => {
      subscription.current?.unsubscribe();
    },
    []
  );

  // Process queue when agent finishes
  useEffect(() => {
    if (!isAgentRunning && queue.length > 0) {
      const [first, ...rest] = queue;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStream((p) => [
        ...p,
        { type: "user", id: first.id, content: first.content, timestamp: new Date() },
      ]);
      setQueue(rest);
      // sendToBackend is a hoisted function declaration; safe to call here.
      // eslint-disable-next-line react-hooks/immutability
      sendToBackend(first.content, first.id);
    }
  }, [isAgentRunning]); // eslint-disable-line react-hooks/exhaustive-deps

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
          // Restored runs are already finished → collapse their activity cards.
          setCollapsedPhases(new Set(items.filter((i) => i.type === "phase").map((i) => i.id)));
          agMessages.current = restored;
          // Re-surface a pending HITL gate if this session paused awaiting input.
          // eslint-disable-next-line react-hooks/immutability
          checkHITL();
        })
        .catch((err) => console.error("[chat] load session messages error", err))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    if (type === "HITL_REQUIRED") {
      // Instant gate (mid-stream) — the poll on `complete` is the fallback.
      const e = event as unknown as {
        hitlId?: string;
        kind?: "approval" | "choice" | "input";
        title?: string;
        description?: string;
        payload?: Record<string, unknown>;
        options?: { id: string; label: string }[];
        schema?: Record<string, unknown>;
        expiresAt?: string;
      };
      if (e.hitlId) {
        addApproval({
          id: e.hitlId,
          kind: e.kind,
          title: e.title,
          description: e.description,
          payload: e.payload,
          options: e.options,
          schema: e.schema,
          expiresAt: e.expiresAt,
        });
      }
    } else if (type === "RUN_STARTED") {
      setStream((p) => [
        ...p,
        { type: "phase", id: phaseId, label: "Thinking", status: "running" },
      ]);
      // Expanded while running; collapsed automatically on finish (see RUN_FINISHED).
    } else if (type === "TEXT_MESSAGE_START") {
      const e = event as unknown as { messageId: string };
      setStreamingMessageId(e.messageId);
      agMsgContent.current.set(e.messageId, "");
      setStream((p) => [
        // A new agent message means the previous ones in this run were reasoning
        // steps — fold them into "Thinking" immediately so only the latest bubble
        // shows, instead of waiting for RUN_FINISHED (delayed by the HITL gate,
        // which let every chain stage leak into the thread).
        ...p.map((item) =>
          item.type === "agent" && item.run === phaseId && !item.thinking
            ? { ...item, thinking: true }
            : item
        ),
        { type: "agent", id: e.messageId, content: "", timestamp: new Date(), run: phaseId },
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
      // transfer_to_agent is internal routing — skip it so the activity card
      // isn't full of consecutive duplicate "Thinking" steps.
      if (e.toolCallName === "transfer_to_agent") return;
      flushSync(() => {
        setStream((p) => {
          // Collapse consecutive duplicate tool calls (e.g. the agent listing
          // drafts repeatedly) into a single step.
          const lastStep = [...p].reverse().find((it) => it.type === "step");
          if (lastStep && lastStep.type === "step" && lastStep.tool === e.toolCallName) {
            return p;
          }
          return [
            ...p,
            {
              type: "step",
              id: e.toolCallId,
              label: e.toolCallName.replace(/_/g, " "),
              status: "running",
              tool: e.toolCallName,
              detail: e.toolCallName,
            },
          ];
        });
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
            type: "step",
            id: stepPhaseId,
            label: e.stepName.replace(/_/g, " "),
            status: "running",
            tool: "thinking",
          },
        ]);
      });
    } else if (type === "STEP_FINISHED") {
      const e = event as unknown as { stepName: string };
      const stepPhaseId = `step-${e.stepName}`;
      setStream((p) =>
        p.map((item) =>
          item.id === stepPhaseId && item.type === "step" ? { ...item, status: "done" } : item
        )
      );
    } else if (type === "REASONING_MESSAGE_CONTENT") {
      // Live model thought summary — append the delta to this run's phase so the
      // thought-process feed shows how the agent reached its result.
      const e = event as unknown as { delta?: string };
      if (e.delta) {
        setStream((p) =>
          p.map((item) =>
            item.type === "phase" && item.id === phaseId
              ? { ...item, reasoning: (item.reasoning ?? "") + e.delta }
              : item
          )
        );
      }
    } else if (type === "REASONING_MESSAGE_END") {
      // Separate consecutive thought blocks (e.g. across chain stages).
      setStream((p) =>
        p.map((item) =>
          item.type === "phase" && item.id === phaseId && item.reasoning
            ? { ...item, reasoning: item.reasoning.replace(/\n*$/, "") + "\n\n" }
            : item
        )
      );
    } else if (type === "RUN_FINISHED" || type === "RUN_ERROR") {
      const status = type === "RUN_FINISHED" ? "done" : "error";
      const phaseIds: string[] = [];
      setStream((p) => {
        // Compute the run's agent messages from the LATEST stream (p), not the
        // closure's `stream` — the event callback captures a stale snapshot, and
        // using it made collapseThinking false so reasoning leaked into the chat.
        // A multi-message run is a reasoning chain: collapse every agent message
        // EXCEPT the last into a "Thinking" dropdown; the last stays as the
        // visible answer. A single-message run stays fully visible.
        const runAgentIdxs = p
          .map((item, i) => (item.type === "agent" && item.run === phaseId ? i : -1))
          .filter((i) => i >= 0);
        const lastAgentIdx = runAgentIdxs[runAgentIdxs.length - 1] ?? -1;
        const collapseThinking = runAgentIdxs.length >= 2;
        phaseIds.length = 0;
        return p.map((item, i) => {
          if (item.type === "phase") {
            phaseIds.push(item.id);
            if (item.id === phaseId && item.status === "running") return { ...item, status };
          }
          if (item.type === "step" && item.status === "running") return { ...item, status: "done" };
          if (
            collapseThinking &&
            item.type === "agent" &&
            item.run === phaseId &&
            i !== lastAgentIdx
          ) {
            return { ...item, thinking: true };
          }
          return item;
        });
      });
      // Run finished → collapse every activity card so the thread stays tidy.
      setCollapsedPhases((prev) => {
        const next = new Set(prev);
        phaseIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  // Poll for a pending HITL gate (after a run finishes / interrupts, and on
  // session restore). The backend creates the record before ending the run, so
  // a pending result here means the run paused for human input.
  // Push a HITL gate into the stream (deduped by id). Shared by the live
  // HITL_REQUIRED event and the getPending poll/restore path.
  function addApproval(a: {
    id: string;
    kind?: "approval" | "choice" | "input";
    title?: string;
    description?: string;
    payload?: Record<string, unknown> | null;
    options?: { id: string; label: string }[] | null;
    schema?: Record<string, unknown> | null;
    expiresAt?: string | null;
  }) {
    if (!a.id) return;
    const payload = (a.payload && typeof a.payload === "object" ? a.payload : {}) as Record<
      string,
      unknown
    >;
    // A draft/body to review-and-edit before saving.
    const reviewContent =
      typeof payload.content === "string"
        ? payload.content
        : typeof payload.body === "string"
          ? payload.body
          : undefined;
    // Where the saved result lives, for the result-card link.
    const entity = typeof payload.entity === "string" ? payload.entity : undefined;
    const navTarget = entityNav(entity);
    // Build the readable summary list, hiding the bulky review content.
    const items = Object.entries(payload)
      .filter(([k]) => k !== "content" && k !== "body" && k !== "entity")
      .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
    setStream((p) =>
      p.some((i) => i.type === "approval" && i.id === a.id)
        ? p
        : [
            ...p,
            {
              type: "approval",
              id: a.id,
              kind: a.kind ?? "approval",
              title: a.title || "Approval required",
              description: a.description || "Review the proposed action below.",
              items: items.length ? items : undefined,
              options: a.options ?? undefined,
              schema: a.schema ?? undefined,
              reviewContent,
              navTarget,
              expiresAt: a.expiresAt ?? undefined,
            },
          ]
    );
  }

  async function checkHITL() {
    try {
      const { hitlApi } = await import("../../lib/api");
      const res = await hitlApi.getPending(threadId.current);
      const hitl = res.data;
      if (!hitl || (hitl.status && hitl.status !== "pending")) return;
      addApproval({
        id: hitl.id,
        kind: hitl.kind,
        title: hitl.title,
        description: hitl.description,
        payload: hitl.payload,
        options: hitl.options,
        schema: hitl.schema,
        expiresAt: hitl.expires_at,
      });
    } catch {}
  }

  async function resolveApproval(
    id: string,
    decision: "approved" | "rejected",
    response?: Record<string, unknown>
  ) {
    try {
      const { hitlApi } = await import("../../lib/api");
      await hitlApi.resolve(id, decision, response);
      // Flip the gate, and on approval drop a result card linking to the saved item.
      setStream((prev) => {
        const gate = prev.find((i) => i.id === id && i.type === "approval");
        const next = prev.map((item) =>
          item.id === id && item.type === "approval" ? { ...item, resolved: decision } : item
        );
        if (decision === "approved" && gate && gate.type === "approval" && gate.navTarget) {
          next.push({
            type: "result",
            id: `result-${id}`,
            title: gate.title,
            subtitle: "Saved",
            route: gate.navTarget.route,
            label: gate.navTarget.label,
          });
        }
        return next;
      });
      // Continue the same turn: resume the run with the human decision.
      resumeRun(id, decision, response);
    } catch (err) {
      console.error("[chat] resolve HITL error", err);
    }
  }

  // Resume a suspended turn after a HITL is resolved (same thread, new run,
  // resume marker in forwardedProps). Streams the continuation.
  function resumeRun(
    hitlId: string,
    decision: "approved" | "rejected",
    response?: Record<string, unknown>
  ) {
    subscription.current?.unsubscribe();
    setLocalRunning(true);
    const phaseId = `phase-${crypto.randomUUID()}`;
    import("../../lib/ag-ui")
      .then(async ({ createChatAgent }) => {
        const agent = await createChatAgent(agMessages.current, threadId.current);
        subscription.current = agent
          .run({
            messages: agMessages.current,
            threadId: threadId.current,
            runId: crypto.randomUUID(),
            tools: [],
            context: [],
            state: {},
            forwardedProps: { resume: { hitlId, decision, response } },
          })
          .subscribe({
            next: (event: BaseEvent) => handleEvent(event, phaseId),
            error: (err: unknown) => {
              console.error("[chat] resume error", err);
              setLocalRunning(false);
              checkHITL();
            },
            complete: () => {
              setLocalRunning(false);
              checkHITL();
            },
          });
      })
      .catch((err) => {
        console.error("[chat] resume setup error", err);
        setLocalRunning(false);
      });
  }

  async function sendToBackend(content: string, msgId: string) {
    subscription.current?.unsubscribe();
    setLocalRunning(true);

    const userMsg = { id: msgId, role: "user", content } as Message;
    agMessages.current = [...agMessages.current, userMsg];

    const phaseId = `phase-${crypto.randomUUID()}`;

    const pushError = (msg: string) => {
      setStream((p) => [
        ...p,
        {
          type: "agent",
          id: `err-${crypto.randomUUID()}`,
          content: `Error: ${msg}`,
          timestamp: new Date(),
        },
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
            // A custom HITL_REQUIRED event can trip the AG-UI parser; the gate
            // may still have been created server-side, so poll before erroring.
            checkHITL();
            pushError(err instanceof Error ? err.message : String(err));
          },
          complete: () => {
            setLocalRunning(false);
            checkHITL();
            // Assistant messages are saved by PersistentChatAgent.upsert_message on the backend.
            // User messages are saved before the agent runs. Nothing to do here.
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
    const id = `u${crypto.randomUUID()}`;
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
                      expired={!!item.expiresAt && Date.parse(item.expiresAt) < now}
                      onResolve={resolveApproval}
                      onAlwaysAllow={(id) => {
                        toggleAutoApprove(true);
                        resolveApproval(id, "approved");
                      }}
                    />
                  </div>
                );
              if (item.type === "result")
                return (
                  <div key={item.id} className="py-1">
                    <ResultCard item={item} onOpen={() => router.push(item.route)} />
                  </div>
                );
            }
            if (entry.kind === "thinking")
              return <ThinkingBlock key={entry.items[0].id} items={entry.items} />;
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
            borderRadius: "18px",
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
              <button
                onClick={() => toggleAutoApprove(!autoApprove)}
                className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold font-space bouncy"
                style={{
                  border: "1.5px solid #0D0D0D",
                  background: autoApprove ? "#4ECDC4" : "#F7F0E3",
                  color: autoApprove ? "#0D0D0D" : "#5A5A5A",
                  borderRadius: "4px",
                }}
                title={
                  autoApprove
                    ? "Agent acts without asking — click to require approval"
                    : "Agent asks before changes — click to always allow"
                }
              >
                <Icon
                  icon={autoApprove ? "solar:shield-check-bold" : "solar:shield-keyhole-bold"}
                  width={14}
                />
                {autoApprove ? "Always allow" : "Ask before changes"}
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
