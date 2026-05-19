"use client";

import { useState, useRef, useEffect } from "react";
import { Icon } from "@iconify/react";
import clsx from "clsx";
import { useAgent } from "@/components/AgentProvider";

type StepStatus = "pending" | "running" | "done" | "error";

type ChatItem =
  | { type: "user";     id: string; content: string; timestamp: Date }
  | { type: "agent";    id: string; content: string; timestamp: Date }
  | {
      type: "step"; id: string; label: string; status: StepStatus;
      detail?: string; tool?: "elastic" | "search" | "scrape" | "llm";
      children?: { label: string; status: StepStatus; detail?: string }[];
    }
  | { type: "phase"; id: string; label: string; status: StepStatus }
  | {
      type: "approval"; id: string; title: string; description: string;
      items?: string[]; resolved?: "approved" | "rejected";
    };

const TOOL_META: Record<string, { label: string; icon: string }> = {
  elastic: { label: "Elastic MCP",  icon: "solar:database-bold" },
  search:  { label: "ES|QL Search", icon: "solar:magnifer-bold" },
  scrape:  { label: "Web Scraper",  icon: "solar:global-bold" },
  llm:     { label: "Gemini 3",     icon: "solar:cpu-bolt-bold" },
};

function StepIcon({ status }: { status: StepStatus }) {
  const base = "w-5 h-5 flex items-center justify-center shrink-0";
  if (status === "done")
    return (
      <div className={base} style={{ background: "#4ECDC4", border: "1.5px solid #0D0D0D", borderRadius: "3px" }}>
        <Icon icon="solar:check-bold" width={11} style={{ color: "#0D0D0D" }} />
      </div>
    );
  if (status === "error")
    return (
      <div className={base} style={{ background: "#E8472A", border: "1.5px solid #0D0D0D", borderRadius: "3px" }}>
        <Icon icon="solar:close-bold" width={11} style={{ color: "#FFFFFF" }} />
      </div>
    );
  if (status === "running")
    return (
      <div className={base} style={{ background: "#E8472A", border: "1.5px solid #0D0D0D", borderRadius: "3px" }}>
        <Icon icon="solar:spinner-bold" width={11} style={{ color: "#FFFFFF" }} className="animate-spin" />
      </div>
    );
  return (
    <div className={base} style={{ background: "#EDE6D3", border: "1.5px solid #B0A898", borderRadius: "3px" }}>
      <Icon icon="solar:circle-bold" width={11} style={{ color: "#B0A898" }} />
    </div>
  );
}

function AgentStep({ item }: { item: Extract<ChatItem, { type: "step" }> }) {
  const [open, setOpen] = useState(false);
  const meta = item.tool ? TOOL_META[item.tool] : null;
  const hasChildren = (item.children?.length ?? 0) > 0;

  return (
    <div className="msg-enter">
      <div
        className={clsx(
          "flex items-start gap-2 px-3 py-1.5",
          hasChildren && "cursor-pointer",
          item.status === "running" && "bg-[#FFF4F2]"
        )}
        style={item.status === "running" ? { borderLeft: "3px solid #E8472A" } : { borderLeft: "3px solid transparent" }}
        onClick={() => hasChildren && setOpen(!open)}
      >
        <div className="mt-0.5"><StepIcon status={item.status} /></div>
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          {meta && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold font-space px-2 py-0.5"
              style={{ background: "#EDE6D3", border: "1.5px solid #0D0D0D", color: "#5A5A5A", borderRadius: "4px" }}
            >
              <Icon icon={meta.icon} width={9} />
              {meta.label}
            </span>
          )}
          <span className={clsx(
            "text-xs font-dm",
            item.status === "done"    && "text-[#9CA3AF]",
            item.status === "running" && "font-semibold text-[#0D0D0D]",
            item.status === "pending" && "text-[#B0A898]",
            item.status === "error"   && "font-semibold text-[#E8472A]",
          )}>
            {item.label}
          </span>
          {item.detail && (
            <span className="text-[10px] font-mono text-[#B0A898] truncate max-w-[160px]">{item.detail}</span>
          )}
          {hasChildren && (
            <Icon icon="solar:alt-arrow-down-bold" width={10}
                  className={clsx("shrink-0 transition-transform", open && "rotate-180")}
                  style={{ color: "#B0A898" }} />
          )}
        </div>
      </div>
      {open && item.children && (
        <div className="ml-8 pl-3 py-1 space-y-1" style={{ borderLeft: "2px solid #0D0D0D" }}>
          {item.children.map((child, i) => (
            <div key={i} className="flex items-start gap-2 py-0.5">
              <div className="mt-0.5"><StepIcon status={child.status} /></div>
              <span className="text-xs font-dm text-[#9CA3AF]">{child.label}</span>
              {child.detail && <span className="text-[10px] font-mono text-[#B0A898]">{child.detail}</span>}
            </div>
          ))}
        </div>
      )}
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

function PhaseGroupCard({ group, collapsed, onToggle }: {
  group: PhaseGroup;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { phase, steps } = group;
  const doneCount   = steps.filter(s => s.status === "done").length;
  const runningStep = steps.find(s => s.status === "running");

  return (
    <div className="msg-enter" style={{ border: "2px solid #0D0D0D", boxShadow: "3px 3px 0 #0D0D0D", borderRadius: "4px" }}>
      {/* Header row — click to collapse/expand */}
      <div
        className="flex items-center justify-between px-3 py-2.5 cursor-pointer select-none bouncy"
        style={{
          background: "#EDE6D3",
          borderBottom: collapsed ? "none" : "2px solid #0D0D0D",
          borderRadius: "4px 4px 0 0",
        }}
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 min-w-0">
          <StepIcon status={phase.status} />
          <span className="text-xs font-semibold font-space uppercase tracking-wide truncate" style={{ color: "#0D0D0D" }}>
            {phase.label}
          </span>
          {runningStep && !collapsed && (
            <span className="text-[10px] font-dm truncate hidden sm:block" style={{ color: "#9CA3AF" }}>
              · {runningStep.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className="text-[10px] font-mono" style={{ color: "#9CA3AF" }}>
            {doneCount}/{steps.length}
          </span>
          <Icon
            icon="solar:alt-arrow-down-bold"
            width={11}
            className={clsx("shrink-0 transition-transform duration-150", collapsed && "-rotate-90")}
            style={{ color: "#5A5A5A" }}
          />
        </div>
      </div>

      {/* Steps — hidden when collapsed, scrollable fixed height */}
      {!collapsed && (
        <div style={{ background: "#FFFFFF", height: "160px", overflowY: "auto" }}>
          {steps.map(step => <AgentStep key={step.id} item={step} />)}
        </div>
      )}
    </div>
  );
}

function ApprovalGate({
  item, onResolve,
}: {
  item: Extract<ChatItem, { type: "approval" }>;
  onResolve: (id: string, d: "approved" | "rejected") => void;
}) {
  return (
    <div className="flex gap-3 msg-enter">
      <div
        className="w-7 h-7 shrink-0 flex items-center justify-center text-xs font-semibold mt-0.5"
        style={{ background: "#EDE6D3", color: "#5A5A5A", border: "2px solid #0D0D0D", borderRadius: "50%" }}
      >
        <span className="text-xs leading-none">🎓</span>
      </div>
      <div className="flex flex-col gap-3 max-w-[75%]">
        <div
          className="px-4 py-3 text-sm font-dm leading-relaxed"
          style={{ background: "#FFFFFF", color: "#0D0D0D", border: "2px solid #0D0D0D", boxShadow: "3px 3px 0 #0D0D0D", borderRadius: "8px" }}
        >
          <p className="font-semibold font-space mb-1" style={{ color: "#0D0D0D" }}>{item.title}</p>
          <p className="text-xs font-dm mb-3" style={{ color: "#5A5A5A" }}>{item.description}</p>
          {item.items && (
            <ul className="space-y-1 mb-1">
              {item.items.map((it, i) => (
                <li key={i} className="text-xs font-dm flex items-start gap-1.5" style={{ color: "#5A5A5A" }}>
                  <span className="shrink-0" style={{ color: "#B0A898" }}>–</span>{it}
                </li>
              ))}
            </ul>
          )}
        </div>
        {item.resolved ? (
          <div className="flex items-center gap-2 text-xs font-semibold font-space" style={{ color: item.resolved === "approved" ? "#4ECDC4" : "#9CA3AF" }}>
            <Icon icon={item.resolved === "approved" ? "solar:check-circle-bold" : "solar:close-circle-bold"} width={13} />
            {item.resolved === "approved" ? "Approved" : "Rejected"}
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => onResolve(item.id, "approved")}
              className="btn-teal btn-sm gap-1.5 text-xs"
            >
              <Icon icon="solar:check-circle-bold" width={12} />Yes, save
            </button>
            <button
              onClick={() => onResolve(item.id, "rejected")}
              className="btn-white btn-sm gap-1.5 text-xs"
            >
              <Icon icon="solar:close-circle-bold" width={12} />No, discard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ item }: { item: Extract<ChatItem, { type: "user" | "agent" }> }) {
  const isUser = item.type === "user";
  return (
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
        {isUser
          ? <Icon icon="solar:user-bold" width={13} />
          : <span className="text-xs leading-none">🎓</span>
        }
      </div>
      <div className={clsx("flex flex-col gap-1 max-w-[75%]", isUser && "items-end")}>
        <div
          className="px-4 py-3 text-sm font-dm leading-relaxed"
          style={{
            background: isUser ? "#0D0D0D" : "#FFFFFF",
            color: isUser ? "#fff" : "#0D0D0D",
            border: "2px solid #0D0D0D",
            boxShadow: "3px 3px 0 #0D0D0D",
            borderRadius: "8px",
          }}
        >
          {item.content.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
            part.startsWith("**") && part.endsWith("**")
              ? <strong key={i}>{part.slice(2, -2)}</strong>
              : <span key={i}>{part}</span>
          )}
        </div>
        <div className={clsx("text-[10px] font-mono text-[#B0A898]", isUser && "text-right")}
             suppressHydrationWarning>
          {item.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}

const INITIAL_STREAM: ChatItem[] = [
  {
    type: "user", id: "m1",
    content: "I'm interested in NLP and LLM alignment research. I want to apply to PhD programs at MIT, Stanford, and CMU. Here are the faculty pages:\n• https://csail.mit.edu/research/nlp\n• https://nlp.stanford.edu/people/\n• https://lti.cmu.edu/people/faculty/",
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
  },
  {
    type: "agent", id: "m2",
    content: "Starting faculty discovery for your NLP / LLM alignment interest. I'll scrape, index, and search all three program pages now.",
    timestamp: new Date(Date.now() - 4 * 60 * 1000),
  },
  { type: "phase", id: "ph1", label: "Program Discovery", status: "done" },
  { type: "step",  id: "s1",  label: "Input validated", status: "done", detail: "3 URLs queued" },
  {
    type: "step", id: "s2", label: "Scraping MIT CSAIL faculty page", status: "done", tool: "scrape",
    detail: "csail.mit.edu/research/nlp",
    children: [
      { label: "Fetched 142 faculty profiles", status: "done" },
      { label: "Chunked & embedded · 1,840 chunks", status: "done", detail: "text-embedding-004" },
    ],
  },
  { type: "step", id: "s3", label: "Indexed to Elasticsearch", status: "done", tool: "elastic", detail: "grad-paddy-faculty-v1" },
  { type: "step", id: "s4", label: "Hybrid search (ES|QL + vector)", status: "done", tool: "search", detail: "'NLP LLM alignment'" },
  { type: "step", id: "s5", label: "Ranked 8 matches · RRF score applied", status: "done" },
  {
    type: "approval", id: "a1",
    title: "Save top 3 faculty to your shortlist?",
    description: "8 matches found. Top 3 selected by research fit score against your NLP + LLM alignment interest.",
    items: [
      "Prof. Regina Barzilay (MIT CSAIL) — Clinical NLP, Cancer AI",
      "Prof. Christopher Manning (Stanford) — NLP, Deep Learning",
      "Prof. Graham Neubig (CMU LTI) — NLP, Low-resource, Code Gen",
    ],
  },
  { type: "phase", id: "ph2", label: "Faculty Deep Dive", status: "running" },
  { type: "step", id: "s6", label: "Fetching Google Scholar — Prof. Barzilay", status: "running", tool: "scrape", detail: "scholar.google.com/..." },
  { type: "step", id: "s7", label: "Indexing recent papers (2022–2025)", status: "pending", tool: "elastic" },
  { type: "step", id: "s8", label: "Generating fit analysis + conversation angles", status: "pending", tool: "llm" },
];


export default function ChatPage() {
  const [stream, setStream]             = useState<ChatItem[]>(INITIAL_STREAM);
  const [input, setInput]               = useState("");
  const [urls, setUrls]                 = useState<string[]>([]);
  const [urlInput, setUrlInput]         = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [showEvents, setShowEvents]     = useState(true);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const [queue, setQueue]               = useState<{ id: string; content: string }[]>([]);

  function togglePhase(id: string) {
    setCollapsedPhases(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  const bottomRef                       = useRef<HTMLDivElement>(null);
  const textareaRef                     = useRef<HTMLTextAreaElement>(null);

  const isAgentRunning  = stream.some(i => i.type === "step" && i.status === "running");
  const runningStep     = stream.find((i): i is Extract<ChatItem, { type: "step" }> => i.type === "step" && i.status === "running");
  const AGENT_STATUS: Record<string, string> = {
    scrape:  "Scraping web...",
    search:  "Searching...",
    elastic: "Querying index...",
    llm:     "Thinking...",
  };
  const agentStatusText = runningStep?.tool ? (AGENT_STATUS[runningStep.tool] ?? "Working...") : "Working...";
  const pendingApproval = stream.some(i => i.type === "approval" && !("resolved" in i && i.resolved));
  const inputBlocked    = isAgentRunning || pendingApproval;

  const { setRunning } = useAgent();
  useEffect(() => { setRunning(isAgentRunning); }, [isAgentRunning, setRunning]);

  useEffect(() => {
    if (!inputBlocked && queue.length > 0) {
      const [first, ...rest] = queue;
      setStream(p => [...p, { type: "user", id: first.id, content: first.content, timestamp: new Date() }]);
      setQueue(rest);
    }
  }, [inputBlocked, queue]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [stream]);

  function resolveApproval(id: string, decision: "approved" | "rejected") {
    setStream(prev => prev.map(item =>
      item.id === id && item.type === "approval" ? { ...item, resolved: decision } : item
    ));
  }

  function addUrl() {
    const t = urlInput.trim();
    if (t && !urls.includes(t)) setUrls(p => [...p, t]);
    setUrlInput("");
    setShowUrlInput(false);
  }

  function send() {
    const text = input.trim();
    if (!text && urls.length === 0) return;
    const content = text + (urls.length > 0 ? "\n" + urls.map(u => `• ${u}`).join("\n") : "");
    const id = `u${Date.now()}`;
    inputBlocked
      ? setQueue(p => [...p, { id, content }])
      : setStream(p => [...p, { type: "user", id, content, timestamp: new Date() }]);
    setInput("");
    setUrls([]);
    textareaRef.current?.focus();
  }

  return (
    <div className="flex flex-col h-full" style={{ background: "#F7F0E3" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 shrink-0"
        style={{ background: "#0D0D0D", borderBottom: "2px solid #0D0D0D" }}
      >
        <div>
          <h1 className="text-sm font-semibold font-space" style={{ color: "#FFFFFF" }}>Agent Chat</h1>
          <p className="text-xs font-dm mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>Faculty discovery · SOP generation · Outreach prep</p>
        </div>
      </div>

      {/* Stream */}
      <div className="flex-1 overflow-y-auto py-6">
        <div className="max-w-3xl mx-auto px-4 space-y-1">
          {groupStream(stream).map((entry) => {
            if (entry.kind === "standalone") {
              const item = entry.item;
              if (item.type === "user" || item.type === "agent")
                return <div key={item.id} className="py-1"><MessageBubble item={item} /></div>;
              if (item.type === "approval")
                return <div key={item.id} className="py-2"><ApprovalGate item={item} onResolve={resolveApproval} /></div>;
            }
            if (!showEvents) return null;
            if (entry.kind === "group")
              return (
                <PhaseGroupCard
                  key={entry.group.phase.id}
                  group={entry.group}
                  collapsed={collapsedPhases.has(entry.group.phase.id)}
                  onToggle={() => togglePhase(entry.group.phase.id)}
                />
              );
            if (entry.kind === "orphan")
              return <div key={entry.item.id} className="ml-10"><AgentStep item={entry.item} /></div>;
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
              <span className="text-xs font-dm" style={{ color: "#9CA3AF" }}>{agentStatusText}</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 pb-4 pt-2 max-w-3xl mx-auto w-full">
        {/* Queue */}
        {queue.length > 0 && (
          <div className="mb-2 overflow-hidden bg-white" style={{ border: "2px solid #0D0D0D", boxShadow: "3px 3px 0 #0D0D0D", borderRadius: "4px" }}>
            <div className="flex items-center gap-2 px-3 py-2" style={{ background: "#0D0D0D", borderBottom: "2px solid #0D0D0D", borderRadius: "4px 4px 0 0" }}>
              <Icon icon="solar:spinner-bold" width={11} className="animate-spin" style={{ color: "#9CA3AF" }} />
              <span className="text-xs font-semibold font-space tracking-wide text-white">
                {queue.length} queued — sends when agent finishes
              </span>
            </div>
            {queue.map(q => (
              <div key={q.id} className="flex items-center justify-between gap-3 px-3 py-2" style={{ borderBottom: "1px solid #EDE6D3" }}>
                <p className="text-xs font-dm truncate flex-1 min-w-0" style={{ color: "#5A5A5A" }}>{q.content}</p>
                <button onClick={() => setQueue(p => p.filter(m => m.id !== q.id))}
                        className="bouncy shrink-0" style={{ color: "#B0A898" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#E8472A")}
                        onMouseLeave={e => (e.currentTarget.style.color = "#B0A898")}>
                  <Icon icon="solar:close-circle-bold" width={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* URL chips */}
        {urls.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {urls.map((url, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 bg-white text-xs font-mono"
                   style={{ border: "1.5px solid #0D0D0D", color: "#5A5A5A", borderRadius: "4px" }}>
                <Icon icon="solar:link-bold" width={10} />
                <span className="truncate max-w-[180px]">{url}</span>
                <button onClick={() => setUrls(p => p.filter((_, j) => j !== i))} style={{ color: "#B0A898" }}>
                  <Icon icon="solar:close-circle-bold" width={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* URL input */}
        {showUrlInput && (
          <div className="mb-2 flex gap-2">
            <input autoFocus type="url" placeholder="https://example.edu/faculty"
                   value={urlInput} onChange={e => setUrlInput(e.target.value)}
                   onKeyDown={e => e.key === "Enter" && addUrl()}
                   className="input-brutal flex-1 text-sm" />
            <button onClick={addUrl} className="btn-black btn-sm text-xs">Add</button>
            <button onClick={() => setShowUrlInput(false)} className="btn-white btn-sm text-xs">
              <Icon icon="solar:close-circle-bold" width={13} />
            </button>
          </div>
        )}

        {/* Main input */}
        <div className="bg-white overflow-hidden"
             style={{ border: "2px solid #0D0D0D", boxShadow: "4px 4px 0 #0D0D0D", borderRadius: "4px" }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={inputBlocked ? "Type to queue — sends when agent finishes..." : "Ask Grad Paddy..."}
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
                onClick={() => setShowEvents(v => !v)}
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
                (input.trim() || urls.length > 0) ? "btn-coral" : "btn-cream"
              )}
              style={
                !(input.trim() || urls.length > 0)
                  ? { color: "#B0A898", cursor: "not-allowed" }
                  : undefined
              }
            >
              {inputBlocked
                ? <><Icon icon="solar:spinner-bold" width={13} className="animate-spin" />Queue</>
                : <><Icon icon="solar:arrow-right-up-bold" width={13} />Send</>
              }
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
