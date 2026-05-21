"use client";

import { useState } from "react";
import {
  ChevronDown,
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
  X,
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

const TOOL_ICONS: Record<string, React.ElementType> = {
  elastic: Database,
  search: Search,
  scrape: Globe,
  llm: Cpu,
  default: Cpu,
};

function StepStatusIcon({ status }: { status: StepStatus }) {
  if (status === "done")
    return <CheckCircle2 size={14} className="text-green-paddy flex-shrink-0" strokeWidth={2.5} />;
  if (status === "error")
    return <XCircle size={14} className="text-red-paddy flex-shrink-0" strokeWidth={2.5} />;
  if (status === "running")
    return <Loader2 size={14} className="text-yellow-dark flex-shrink-0 animate-spin" strokeWidth={2.5} />;
  return <Circle size={14} className="text-coal/30 flex-shrink-0" strokeWidth={2} />;
}

function AgentStepRow({ step, depth = 0 }: { step: AgentStep; depth?: number }) {
  const [open, setOpen] = useState(false);
  const ToolIcon = step.tool ? (TOOL_ICONS[step.tool] ?? TOOL_ICONS.default) : null;

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
            {ToolIcon && (
              <ToolIcon size={11} className="text-coal/40 flex-shrink-0" />
            )}
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
            {step.expandable && (
              open
                ? <ChevronDown size={11} className="text-coal/40 flex-shrink-0" />
                : <ChevronRight size={11} className="text-coal/40 flex-shrink-0" />
            )}
          </div>
          {step.detail && (
            <div className="text-xs font-mono text-coal/40 mt-0.5 truncate">
              {step.detail}
            </div>
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
          onClick={() => { request.onReject(); setDismissed(true); }}
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
            onClick={() => { request.onApprove(); setDismissed(true); }}
            className="btn-brutal bg-green-paddy text-coal flex-1 justify-center text-sm py-2"
          >
            <CheckCircle2 size={14} strokeWidth={2.5} />
            Approve
          </button>
          <button
            onClick={() => { request.onReject(); setDismissed(true); }}
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
  return (
    <div
      className={clsx(
        "flex flex-col h-full border-l-3 border-coal bg-cream",
        className
      )}
    >
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

      {/* Steps feed */}
      <div className="flex-1 overflow-y-auto p-3 space-y-0">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <Circle size={24} className="text-coal/20 mb-2" />
            <p className="text-xs font-grotesk text-coal/40">
              Agent activity will appear here
            </p>
          </div>
        ) : (
          items.map((item, idx) => {
            if (item.type === "phase") {
              return (
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
              );
            }
            if (item.type === "step") {
              return <AgentStepRow key={item.data.id} step={item.data} />;
            }
            if (item.type === "approval") {
              return <ApprovalGateCard key={item.data.id} request={item.data} />;
            }
            return null;
          })
        )}
      </div>
    </div>
  );
}
