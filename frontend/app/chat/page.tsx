"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  Paperclip,
  X,
  User,
  Bot,
  Link2,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
  Database,
  Search,
  Globe,
  Cpu,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import clsx from "clsx";

type StepStatus = "pending" | "running" | "done" | "error";

type ChatItem =
  | { type: "user"; id: string; content: string; timestamp: Date }
  | { type: "agent"; id: string; content: string; timestamp: Date }
  | {
      type: "step";
      id: string;
      label: string;
      status: StepStatus;
      detail?: string;
      tool?: "elastic" | "search" | "scrape" | "llm";
      children?: { label: string; status: StepStatus; detail?: string }[];
    }
  | {
      type: "phase";
      id: string;
      label: string;
      status: StepStatus;
    }
  | {
      type: "approval";
      id: string;
      title: string;
      description: string;
      items?: string[];
      resolved?: "approved" | "rejected";
    };

const TOOL_LABEL: Record<string, string> = {
  elastic: "Elastic MCP",
  search: "ES|QL Search",
  scrape: "Web Scraper",
  llm: "Gemini 3",
};

const TOOL_ICON: Record<string, React.ElementType> = {
  elastic: Database,
  search: Search,
  scrape: Globe,
  llm: Cpu,
};

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done")
    return <CheckCircle2 size={13} className="text-green-paddy flex-shrink-0" strokeWidth={2.5} />;
  if (status === "error")
    return <XCircle size={13} className="text-red-paddy flex-shrink-0" strokeWidth={2.5} />;
  if (status === "running")
    return <Loader2 size={13} className="text-violet-light flex-shrink-0 animate-spin" strokeWidth={2.5} />;
  return <Circle size={13} className="text-fg-muted flex-shrink-0" strokeWidth={2} />;
}

function AgentStep({ item }: { item: Extract<ChatItem, { type: "step" }> }) {
  const [open, setOpen] = useState(false);
  const ToolIcon = item.tool ? TOOL_ICON[item.tool] : null;
  const hasChildren = item.children && item.children.length > 0;

  return (
    <div className="agent-step-enter">
      <div
        className={clsx(
          "flex items-start gap-2 px-3 py-1.5 ml-11",
          hasChildren && "cursor-pointer hover:bg-violet-paddy/10",
          item.status === "running" && "bg-violet-paddy/5"
        )}
        onClick={() => hasChildren && setOpen(!open)}
      >
        <div className="mt-0.5"><StepIcon status={item.status} /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {ToolIcon && item.tool && (
              <span className="badge-brutal text-xs py-0 px-1.5 bg-surface-2 text-fg border-border-bright">
                <ToolIcon size={9} className="inline mr-0.5" />
                {TOOL_LABEL[item.tool]}
              </span>
            )}
            <span
              className={clsx(
                "text-xs font-grotesk",
                item.status === "done" && "text-fg-muted",
                item.status === "running" && "font-bold text-fg",
                item.status === "pending" && "text-fg-muted",
                item.status === "error" && "text-red-paddy font-bold"
              )}
            >
              {item.label}
            </span>
            {hasChildren && (
              <ChevronDown
                size={10}
                className={clsx("text-fg-muted transition-transform", open && "rotate-180")}
              />
            )}
          </div>
          {item.detail && (
            <div className="text-xs font-mono text-fg-muted mt-0.5 truncate">{item.detail}</div>
          )}
        </div>
      </div>
      {open && item.children && (
        <div className="ml-16 border-l-2 border-border pl-3 pb-1">
          {item.children.map((child, i) => (
            <div key={i} className="flex items-start gap-2 py-1">
              <div className="mt-0.5"><StepIcon status={child.status} /></div>
              <div>
                <div className="text-xs font-grotesk text-fg-muted">{child.label}</div>
                {child.detail && (
                  <div className="text-xs font-mono text-fg-muted truncate">{child.detail}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PhaseMarker({ item }: { item: Extract<ChatItem, { type: "phase" }> }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 ml-11 agent-step-enter">
      <div className="h-px flex-1 bg-border" />
      <div className="flex items-center gap-1.5">
        <StepIcon status={item.status} />
        <span className="text-xs font-black uppercase tracking-widest text-fg-muted font-grotesk">
          {item.label}
        </span>
      </div>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function ApprovalGate({
  item,
  onResolve,
}: {
  item: Extract<ChatItem, { type: "approval" }>;
  onResolve: (id: string, decision: "approved" | "rejected") => void;
}) {
  if (item.resolved) {
    return (
      <div className="ml-11 mx-3 my-2 agent-step-enter">
        <div
          className={clsx(
            "flex items-center gap-2 px-3 py-2 border-2 border-border-bright text-xs font-bold font-grotesk",
            item.resolved === "approved" ? "bg-green-paddy text-midnight" : "bg-red-paddy/20"
          )}
        >
          {item.resolved === "approved"
            ? <><CheckCircle2 size={13} strokeWidth={2.5} /> Approved — shortlist saved</>
            : <><XCircle size={13} strokeWidth={2.5} /> Rejected — shortlist discarded</>
          }
        </div>
      </div>
    );
  }

  return (
    <div className="ml-11 mx-3 my-3 agent-step-enter">
      <div
        className="border-3 border-border-bright bg-violet-paddy/20"
        style={{ boxShadow: "4px 4px 0 #7C3AED" }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b-3 border-border-bright" style={{ background: "var(--surface-2)" }}>
          <AlertTriangle size={13} className="text-violet-light" strokeWidth={2.5} />
          <span className="text-xs font-black uppercase tracking-widest text-violet-light font-grotesk">
            Human Approval Required
          </span>
        </div>
        {/* Body */}
        <div className="px-4 py-3">
          <p className="text-sm font-black font-grotesk text-fg mb-1">{item.title}</p>
          <p className="text-xs font-grotesk text-fg-muted mb-3 leading-relaxed">{item.description}</p>
          {item.items && (
            <ul className="mb-3 space-y-1">
              {item.items.map((it, i) => (
                <li key={i} className="text-xs font-grotesk text-fg flex items-start gap-1.5">
                  <span className="font-black flex-shrink-0">→</span>
                  {it}
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => onResolve(item.id, "approved")}
              className="btn-brutal bg-green-paddy text-midnight flex-1 justify-center text-sm py-2"
            >
              <CheckCircle2 size={13} strokeWidth={2.5} />
              Approve
            </button>
            <button
              onClick={() => onResolve(item.id, "rejected")}
              className="btn-brutal bg-red-paddy text-white flex-1 justify-center text-sm py-2"
            >
              <XCircle size={13} strokeWidth={2.5} />
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ item }: { item: Extract<ChatItem, { type: "user" | "agent" }> }) {
  const isUser = item.type === "user";
  return (
    <div className={clsx("flex gap-3 px-3 py-1 agent-step-enter", isUser && "flex-row-reverse")}>
      <div
        className={clsx(
          "w-8 h-8 flex-shrink-0 border-3 border-border-bright flex items-center justify-center font-black text-xs mt-0.5",
          isUser ? "bg-violet-paddy text-white" : "bg-violet-paddy/20 text-fg"
        )}
        style={{ boxShadow: "2px 2px 0 #7C3AED" }}
      >
        {isUser ? <User size={14} strokeWidth={2.5} /> : <Bot size={14} strokeWidth={2.5} />}
      </div>
      <div className="flex flex-col gap-1 max-w-[70%]">
        <div
          className={clsx(
            "border-3 border-border-bright px-4 py-3",
            isUser ? "bg-violet-paddy/10" : "bg-surface-2"
          )}
          style={{ boxShadow: "3px 3px 0 #7C3AED" }}
        >
          <div className="text-sm font-grotesk leading-relaxed whitespace-pre-wrap">
            {item.content.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
              part.startsWith("**") && part.endsWith("**")
                ? <strong key={i}>{part.slice(2, -2)}</strong>
                : <span key={i}>{part}</span>
            )}
          </div>
        </div>
        <div
          className={clsx("text-xs font-mono text-fg-muted", isUser && "text-right")}
          suppressHydrationWarning
        >
          {item.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}

const INITIAL_STREAM: ChatItem[] = [
  {
    type: "user",
    id: "m1",
    content:
      "I'm interested in NLP and LLM alignment research. I want to apply to PhD programs at MIT, Stanford, and CMU. Here are the faculty pages:\n• https://csail.mit.edu/research/nlp\n• https://nlp.stanford.edu/people/\n• https://lti.cmu.edu/people/faculty/",
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
  },
  {
    type: "agent",
    id: "m2",
    content:
      "Starting faculty discovery for your NLP / LLM alignment interest. I'll scrape, index, and search all three program pages now.",
    timestamp: new Date(Date.now() - 4 * 60 * 1000),
  },
  {
    type: "phase",
    id: "ph1",
    label: "Program Discovery",
    status: "done",
  },
  {
    type: "step",
    id: "s1",
    label: "Input validated",
    status: "done",
    detail: "Research interest parsed · 3 URLs queued",
  },
  {
    type: "step",
    id: "s2",
    label: "Scraping MIT CSAIL faculty page",
    status: "done",
    tool: "scrape",
    detail: "csail.mit.edu/research/nlp",
    children: [
      { label: "Fetched 142 faculty profiles", status: "done" },
      { label: "Chunked & embedded · 1,840 chunks", status: "done", detail: "text-embedding-004" },
    ],
  },
  {
    type: "step",
    id: "s3",
    label: "Indexed to Elasticsearch",
    status: "done",
    tool: "elastic",
    detail: "Index: grad-paddy-faculty-v1",
  },
  {
    type: "step",
    id: "s4",
    label: "Hybrid search (ES|QL + vector)",
    status: "done",
    tool: "search",
    detail: "Query: 'NLP information retrieval LLM alignment'",
  },
  {
    type: "step",
    id: "s5",
    label: "Ranked 8 matches · RRF score applied",
    status: "done",
  },
  {
    type: "approval",
    id: "a1",
    title: "Save top 3 faculty to your shortlist?",
    description:
      "8 matches found. Top 3 selected by research fit score against your NLP + LLM alignment interest.",
    items: [
      "Prof. Regina Barzilay (MIT CSAIL) — Clinical NLP, Cancer AI",
      "Prof. Christopher Manning (Stanford) — NLP, Deep Learning",
      "Prof. Graham Neubig (CMU LTI) — NLP, Low-resource, Code Gen",
    ],
  },
  {
    type: "phase",
    id: "ph2",
    label: "Faculty Deep Dive",
    status: "running",
  },
  {
    type: "step",
    id: "s6",
    label: "Fetching Google Scholar — Prof. Barzilay",
    status: "running",
    tool: "scrape",
    detail: "scholar.google.com/...",
  },
  {
    type: "step",
    id: "s7",
    label: "Indexing recent papers (2022–2025)",
    status: "pending",
    tool: "elastic",
  },
  {
    type: "step",
    id: "s8",
    label: "Generating fit analysis + conversation angles",
    status: "pending",
    tool: "llm",
  },
];

export default function ChatPage() {
  const [stream, setStream] = useState<ChatItem[]>(INITIAL_STREAM);
  const [input, setInput] = useState("");
  const [urls, setUrls] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [queue, setQueue] = useState<{ id: string; content: string }[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isAgentRunning = stream.some(
    (item) => item.type === "step" && item.status === "running"
  );
  const pendingApproval = stream.some(
    (item) => item.type === "approval" && !("resolved" in item && item.resolved)
  );
  const inputBlocked = isAgentRunning || pendingApproval;

  // Drain queue when agent finishes
  useEffect(() => {
    if (!inputBlocked && queue.length > 0) {
      const [first, ...rest] = queue;
      setStream((p) => [
        ...p,
        { type: "user", id: first.id, content: first.content, timestamp: new Date() },
      ]);
      setQueue(rest);
    }
  }, [inputBlocked, queue]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [stream]);

  function resolveApproval(id: string, decision: "approved" | "rejected") {
    setStream((prev) =>
      prev.map((item) =>
        item.id === id && item.type === "approval"
          ? { ...item, resolved: decision }
          : item
      )
    );
  }

  function addUrl() {
    const t = urlInput.trim();
    if (t && !urls.includes(t)) setUrls((p) => [...p, t]);
    setUrlInput("");
    setShowUrlInput(false);
  }

  function send() {
    if (!input.trim() && urls.length === 0) return;
    const content =
      input.trim() + (urls.length > 0 ? "\n" + urls.map((u) => `• ${u}`).join("\n") : "");
    const id = `u${Date.now()}`;
    if (inputBlocked) {
      setQueue((p) => [...p, { id, content }]);
    } else {
      setStream((p) => [...p, { type: "user", id, content, timestamp: new Date() }]);
    }
    setInput("");
    setUrls([]);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b-3 border-border-bright flex-shrink-0" style={{ background: "var(--surface)" }}>
        <div>
          <h1 className="text-lg font-black uppercase tracking-tight font-grotesk">Agent Chat</h1>
          <p className="text-xs font-grotesk text-fg-muted">
            Faculty discovery · SOP generation · Outreach prep
          </p>
        </div>
        <div className="badge-brutal bg-green-paddy text-midnight flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-midnight" />
          Agent online
        </div>
      </div>

      {/* Stream */}
      <div className="flex-1 overflow-y-auto py-4 space-y-1">
        {/* Context banner */}
        <div className="flex items-center gap-3 mx-6 mb-3 px-3 py-2 border-2 border-border bg-surface-2">
          <div className="w-1 h-6 bg-violet-paddy flex-shrink-0" />
          <p className="text-xs font-grotesk text-fg-muted leading-relaxed">
            Grad Paddy answers only from <strong>indexed content</strong>. All writes require your approval.
          </p>
        </div>

        {stream.map((item) => {
          if (item.type === "user" || item.type === "agent")
            return <MessageBubble key={item.id} item={item} />;
          if (item.type === "phase")
            return <PhaseMarker key={item.id} item={item} />;
          if (item.type === "step")
            return <AgentStep key={item.id} item={item} />;
          if (item.type === "approval")
            return <ApprovalGate key={item.id} item={item} onResolve={resolveApproval} />;
          return null;
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t-3 border-border-bright flex-shrink-0" style={{ background: "var(--surface)" }}>
        {urls.length > 0 && (
          <div className="px-4 pt-3 flex flex-wrap gap-2">
            {urls.map((url, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 border-2 border-border-bright bg-surface-2 px-2 py-1"
                style={{ boxShadow: "2px 2px 0 #7C3AED" }}
              >
                <Link2 size={11} />
                <span className="text-xs font-mono truncate max-w-[200px]">{url}</span>
                <button
                  onClick={() => setUrls((p) => p.filter((_, j) => j !== i))}
                  className="text-fg-muted hover:text-red-paddy transition-colors"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        {showUrlInput && (
          <div className="px-4 pt-3 flex gap-2">
            <input
              autoFocus
              type="url"
              placeholder="https://example.edu/faculty"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addUrl()}
              className="input-brutal flex-1 text-sm py-2"
            />
            <button onClick={addUrl} className="btn-black text-sm px-3 py-2">Add</button>
            <button onClick={() => setShowUrlInput(false)} className="btn-white text-sm px-3 py-2">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Queue display */}
        {queue.length > 0 && (
          <div className="mx-4 mt-3 border-3 border-border-bright bg-surface-2">
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
              <Loader2 size={11} className="text-violet-light animate-spin flex-shrink-0" strokeWidth={2.5} />
              <span className="text-xs font-black uppercase tracking-widest text-violet-light font-grotesk">
                {queue.length} message{queue.length > 1 ? "s" : ""} queued — sends when agent finishes
              </span>
            </div>
            <div className="divide-y divide-border">
              {queue.map((q) => (
                <div key={q.id} className="flex items-start justify-between gap-3 px-3 py-2">
                  <p className="text-xs font-grotesk text-fg-muted truncate flex-1 min-w-0">{q.content}</p>
                  <button
                    onClick={() => setQueue((p) => p.filter((m) => m.id !== q.id))}
                    className="text-fg-muted hover:text-red-paddy transition-colors flex-shrink-0 mt-0.5"
                    title="Cancel queued message"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Agent running indicator (no queue yet) */}
        {inputBlocked && queue.length === 0 && (
          <div className="mx-4 mt-3 flex items-center gap-2 border-2 border-border bg-surface-2 px-3 py-2">
            <Loader2 size={11} className="text-fg-muted animate-spin flex-shrink-0" strokeWidth={2.5} />
            <span className="text-xs font-grotesk text-fg-muted">
              {pendingApproval && !isAgentRunning
                ? "Approve or reject above to continue — or type a message to queue it"
                : "Agent working — messages typed now will queue and send automatically"}
            </span>
          </div>
        )}

        <div className="p-4 flex gap-3 items-end">
          <button
            onClick={() => setShowUrlInput(!showUrlInput)}
            className={clsx("btn-brutal px-3 py-2 flex-shrink-0", showUrlInput ? "bg-violet-paddy" : "bg-surface-2")}
          >
            <Paperclip size={16} strokeWidth={2.5} />
          </button>
          <div
            className="flex-1 border-3 border-border-bright bg-surface-2"
            style={{ boxShadow: "inset 2px 2px 0 rgba(0,0,0,0.2)" }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={
                inputBlocked
                  ? "Type to queue — sends when agent finishes..."
                  : "Ask Grad Paddy... (e.g. 'Find NLP faculty at MIT and Stanford')"
              }
              rows={2}
              className="w-full px-4 py-3 text-sm font-grotesk bg-transparent resize-none outline-none placeholder-fg-muted"
            />
          </div>
          <button
            onClick={send}
            disabled={!input.trim() && urls.length === 0}
            className={clsx(
              "px-4 py-3 flex-shrink-0 btn-brutal flex items-center gap-2",
              inputBlocked ? "bg-violet-paddy text-white" : "bg-violet-paddy text-white"
            )}
          >
            {inputBlocked
              ? <><Loader2 size={14} className="animate-spin" strokeWidth={2.5} /><span className="text-sm font-bold">Queue</span></>
              : <><Send size={16} strokeWidth={2.5} /><span className="text-sm font-bold">Send</span></>
            }
          </button>
        </div>

        <div className="px-4 pb-3 flex gap-2 flex-wrap">
          {[
            "Find faculty for my research interest",
            "Write SOP paragraph for target lab",
            "Prep outreach for Prof. Barzilay",
            "What's due this week?",
          ].map((chip) => (
            <button
              key={chip}
              onClick={() => setInput(chip)}
              className="flex items-center gap-1 text-xs font-grotesk text-fg-muted border border-border px-2.5 py-1 hover:border-border-bright hover:bg-violet-paddy/20 hover:text-fg transition-all"
            >
              <ChevronRight size={11} />
              {chip}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
