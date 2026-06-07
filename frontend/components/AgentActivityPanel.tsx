"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
  AlertTriangle,
  X,
  Search,
  Brain,
  Sparkles,
} from "lucide-react";
import clsx from "clsx";

export type StepStatus = "pending" | "running" | "done" | "error";

export type AgentStep = {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
  tool?: string;
  expandable?: boolean;
  children?: AgentStep[];
};

export type ApprovalRequest = {
  id: string;
  title: string;
  description: string;
  items?: string[];
  onApprove: () => void;
  onReject: () => void;
};

type PanelItem =
  | { type: "step"; data: AgentStep }
  | { type: "approval"; data: ApprovalRequest }
  | { type: "phase"; data: { label: string; status: StepStatus } };

// Map agent activities to human-readable descriptions and icons
const ACTIVITY_CONFIG: Record<string, { label: string; icon: string; description: string }> = {
  transfer_to_agent: { label: "Processing", icon: "⚡", description: "Connecting to agent..." },
  researcher_google_search_agent: {
    label: "Searching the web",
    icon: "🔍",
    description: "Searching for information...",
  },
  elite_search: {
    label: "Searching databases",
    icon: "📚",
    description: "Querying research databases...",
  },
  "platform.core.index_explorer": {
    label: "Inspecting Elastic indices",
    icon: "🔎",
    description: "Finding relevant Elasticsearch indices...",
  },
  "platform.core.list_indices": {
    label: "Listing Elastic indices",
    icon: "🗂️",
    description: "Checking accessible Elasticsearch data...",
  },
  "platform.core.get_index_mapping": {
    label: "Reading Elastic mappings",
    icon: "🧭",
    description: "Inspecting field structure...",
  },
  "platform.core.search": {
    label: "Elastic hybrid search",
    icon: "⚡",
    description: "Searching indexed admissions evidence...",
  },
  "platform.core.generate_esql": {
    label: "Generating ES|QL",
    icon: "🧠",
    description: "Translating the question into an ES|QL query...",
  },
  "platform.core.execute_esql": {
    label: "Running ES|QL scan",
    icon: "📊",
    description: "Analyzing admissions data in Elasticsearch...",
  },
  "platform.core.get_document_by_id": {
    label: "Opening Elastic evidence",
    icon: "📄",
    description: "Retrieving a source document...",
  },
  "platform.core.create_visualization": {
    label: "Creating Elastic visualization",
    icon: "📈",
    description: "Preparing a Kibana-ready view...",
  },
  hitl_approval: {
    label: "Requesting approval",
    icon: "👤",
    description: "Waiting for your input...",
  },
  default: { label: "Thinking", icon: "✨", description: "Processing..." },
};

function getActivityConfig(toolName?: string): {
  label: string;
  icon: string;
  description: string;
} {
  if (!toolName) return ACTIVITY_CONFIG.default;
  if (toolName in ACTIVITY_CONFIG) return ACTIVITY_CONFIG[toolName];

  const normalized = toolName.toLowerCase();
  if (normalized.includes("profile") || normalized.includes("preference")) {
    return {
      label: "Updating profile",
      icon: "👤",
      description: "Reading or editing user settings...",
    };
  }
  if (normalized.includes("session")) {
    return {
      label: "Managing sessions",
      icon: "💬",
      description: "Loading or updating chat sessions...",
    };
  }
  if (normalized.includes("group")) {
    return { label: "Managing groups", icon: "🗂️", description: "Organizing chat groups..." };
  }
  if (normalized.includes("shortlist")) {
    return {
      label: "Updating shortlist",
      icon: "📌",
      description: "Managing faculty shortlist entries...",
    };
  }
  if (normalized.includes("tracker") || normalized.includes("application")) {
    return {
      label: "Updating tracker",
      icon: "🧭",
      description: "Managing application tracking records...",
    };
  }
  if (normalized.includes("draft")) {
    return { label: "Editing drafts", icon: "📝", description: "Managing draft content..." };
  }
  if (normalized.includes("hitl") || normalized.includes("approval")) {
    return {
      label: "Requesting approval",
      icon: "👤",
      description: "Waiting for a user decision...",
    };
  }

  return {
    label: toolName.replace(/_/g, " "),
    icon: "⚙️",
    description: "Processing...",
  };
}

function StepStatusIcon({ status }: { status: StepStatus }) {
  if (status === "done")
    return <CheckCircle2 size={14} className="text-green-paddy flex-shrink-0" strokeWidth={2.5} />;
  if (status === "error")
    return <XCircle size={14} className="text-red-paddy flex-shrink-0" strokeWidth={2.5} />;
  if (status === "running")
    return (
      <Loader2
        size={14}
        className="text-yellow-dark flex-shrink-0 animate-spin"
        strokeWidth={2.5}
      />
    );
  return <Circle size={14} className="text-coal/30 flex-shrink-0" strokeWidth={2} />;
}

function AgentActivitySummary({
  step,
  isOpen,
  onToggle,
}: {
  step: AgentStep;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const config = getActivityConfig(step.tool);

  return (
    <div
      onClick={onToggle}
      className={clsx(
        "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all",
        "hover:bg-coal/5 border border-coal/10",
        step.status === "running" && "bg-yellow-paddy/5 border-yellow-paddy/30",
        step.status === "done" && "bg-green-paddy/5 border-green-paddy/30",
        step.status === "error" && "bg-red-paddy/5 border-red-paddy/30"
      )}
    >
      <div className="text-lg">{config.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-coal">{config.label}</div>
        <div className="text-xs text-coal/60">{config.description}</div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {step.status === "running" && (
          <Loader2 size={14} className="text-yellow-dark animate-spin" />
        )}
        {isOpen ? (
          <ChevronDown size={16} className="text-coal/40" />
        ) : (
          <ChevronRight size={16} className="text-coal/40" />
        )}
      </div>
    </div>
  );
}

function AgentStepRow({ step, depth = 0 }: { step: AgentStep; depth?: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="agent-step-enter">
      <div
        className={clsx(
          "flex items-start gap-2 py-1.5 px-2 rounded-none",
          depth > 0 && "ml-5 border-l-2 border-coal/20 pl-3",
          step.expandable && "cursor-pointer hover:bg-yellow-paddy/10",
          step.status === "running" && "bg-yellow-paddy/5"
        )}
        onClick={() => step.expandable && setOpen(!open)}
      >
        <div className="mt-0.5 flex-shrink-0">
          <StepStatusIcon status={step.status} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={clsx(
                "text-xs font-grotesk leading-tight",
                step.status === "done" && "text-coal/60",
                step.status === "running" && "font-bold text-coal",
                step.status === "pending" && "text-coal/40",
                step.status === "error" && "text-red-paddy font-bold"
              )}
            >
              {step.label}
            </span>
            {step.expandable &&
              (open ? (
                <ChevronDown size={11} className="text-coal/40 flex-shrink-0" />
              ) : (
                <ChevronRight size={11} className="text-coal/40 flex-shrink-0" />
              ))}
          </div>
          {step.detail && (
            <div className="text-xs font-mono text-coal/40 mt-0.5 truncate">{step.detail}</div>
          )}
        </div>
      </div>

      {open && step.children && (
        <div>
          {step.children.map((child) => (
            <AgentStepRow key={child.id} step={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function ApprovalGateCard({ request }: { request: ApprovalRequest }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      className="approval-gate border-3 border-coal bg-yellow-paddy mx-0 my-3"
      style={{ boxShadow: "4px 4px 0 #0A0A0A" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b-3 border-coal bg-coal">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-yellow-paddy" strokeWidth={2.5} />
          <span className="text-xs font-black uppercase tracking-widest text-yellow-paddy font-grotesk">
            Human Approval Required
          </span>
        </div>
        <button
          onClick={() => {
            request.onReject();
            setDismissed(true);
          }}
          className="text-cream/60 hover:text-cream transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="px-3 py-3">
        <p className="text-sm font-bold text-coal font-grotesk leading-snug mb-2">
          {request.title}
        </p>
        <p className="text-xs text-coal/70 font-grotesk mb-3 leading-relaxed">
          {request.description}
        </p>

        {request.items && request.items.length > 0 && (
          <ul className="mb-3 space-y-1">
            {request.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs font-grotesk text-coal">
                <span className="font-black text-coal flex-shrink-0">→</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => {
              request.onApprove();
              setDismissed(true);
            }}
            className="btn-brutal bg-green-paddy text-coal flex-1 justify-center text-sm py-2"
          >
            <CheckCircle2 size={14} strokeWidth={2.5} />
            Approve
          </button>
          <button
            onClick={() => {
              request.onReject();
              setDismissed(true);
            }}
            className="btn-brutal bg-red-paddy text-white flex-1 justify-center text-sm py-2"
          >
            <XCircle size={14} strokeWidth={2.5} />
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

type Props = {
  items: PanelItem[];
  className?: string;
};

export default function AgentActivityPanel({ items, className }: Props) {
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);

  // Separate steps from other items for better organization
  const steps = items.filter((item) => item.type === "step");
  const approvals = items.filter((item) => item.type === "approval");
  const phases = items.filter((item) => item.type === "phase");

  return (
    <div className={clsx("flex flex-col h-full border-l-3 border-coal bg-cream", className)}>
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b-3 border-coal bg-coal flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-paddy border border-green-paddy/50 animate-pulse" />
          <span className="text-xs font-black uppercase tracking-widest text-cream font-grotesk">
            Agent Activity
          </span>
        </div>
        <span className="text-xs font-mono text-cream/40">LIVE</span>
      </div>

      {/* Activity feed */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <Circle size={24} className="text-coal/20 mb-2" />
            <p className="text-xs font-grotesk text-coal/40">Agent activity will appear here</p>
          </div>
        ) : (
          <>
            {/* Render approval gates */}
            {approvals.map(
              (item) =>
                item.type === "approval" && (
                  <ApprovalGateCard key={item.data.id} request={item.data} />
                )
            )}

            {/* Render phase dividers */}
            {phases.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 py-2 mt-2 mb-1 first:mt-0">
                <div className="h-px flex-1 bg-coal/20" />
                <div className="flex items-center gap-1.5">
                  <StepStatusIcon status={item.data.status} />
                  <span className="text-xs font-black uppercase tracking-widest text-coal/50 font-grotesk">
                    {item.data.label}
                  </span>
                </div>
                <div className="h-px flex-1 bg-coal/20" />
              </div>
            ))}

            {/* Render steps with new summary style */}
            {steps.map((item) => {
              if (item.type !== "step") return null;
              const step = item.data;
              const isOpen = expandedStepId === step.id;

              return (
                <div key={step.id}>
                  <AgentActivitySummary
                    step={step}
                    isOpen={isOpen}
                    onToggle={() => setExpandedStepId(isOpen ? null : step.id)}
                  />

                  {/* Expanded details */}
                  {isOpen && step.children && (
                    <div className="mt-2 ml-3 border-l-2 border-coal/20 pl-3 space-y-1">
                      {step.children.map((child) => (
                        <AgentStepRow key={child.id} step={child} depth={1} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
