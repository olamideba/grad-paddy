"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Editable email canvas: recipient + subject + body, with a "Send via Gmail"
// action. Used both inside a chat approval gate (with an existing draft id) and
// from the tracker to email a recommender (composes a fresh draft, then sends).
export default function EmailCanvas({
  initialTo,
  initialSubject,
  initialBody,
  emailId,
  kind = "recommender",
  linkedApplicationId,
  refId,
  onSent,
  onCancel,
}: {
  initialTo: string;
  initialSubject: string;
  initialBody: string;
  emailId?: string | null;
  kind?: "faculty" | "recommender";
  linkedApplicationId?: string | null;
  refId?: string | null;
  onSent: (id: string) => void;
  onCancel?: () => void;
}) {
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // After a successful send we show a confirmation panel (and keep the id so
  // the host's onSent fires when the user dismisses it).
  const [sent, setSent] = useState<{ id: string } | null>(null);
  // Body shows a clean rendered preview by default (how it sends); toggle to
  // edit the markdown source.
  const [editingBody, setEditingBody] = useState(false);

  async function sendViaGmail() {
    if (!to.trim()) {
      setError("Add a recipient email address.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const { emailsApi, integrationsApi } = await import("../lib/api");
      const status = await integrationsApi.googleStatus();
      if (!status.data?.connected) {
        const url = await integrationsApi.googleAuthUrl();
        if (url.data?.url) window.open(url.data.url, "_blank", "noopener");
        setError("Connect your Gmail, then press Send again.");
        setSending(false);
        return;
      }
      let id = emailId ?? null;
      if (id) {
        await emailsApi.update(id, { to, subject, body_markdown: body });
      } else {
        const created = await emailsApi.create({
          to,
          subject,
          body_markdown: body,
          kind,
          ref_id: refId ?? null,
          linked_application_id: linkedApplicationId ?? null,
        });
        id = created.data.id;
      }
      await emailsApi.send(id);
      setSent({ id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send the email.");
    } finally {
      setSending(false);
    }
  }

  function copy() {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (sent) {
    return (
      <div
        className="msg-enter flex flex-col items-center text-center gap-3 px-6 py-8"
        style={{ background: "#FFFFFF", border: "2px solid #0D0D0D", borderRadius: "4px" }}
      >
        <div
          className="w-12 h-12 flex items-center justify-center"
          style={{ background: "#4ECDC4", border: "2px solid #0D0D0D", borderRadius: "50%" }}
        >
          <Icon icon="solar:check-read-bold" width={24} style={{ color: "#0D0D0D" }} />
        </div>
        <div>
          <p className="text-sm font-bold font-space" style={{ color: "#0D0D0D" }}>
            Email sent
          </p>
          <p className="text-xs font-dm mt-0.5" style={{ color: "#5A5A5A" }}>
            Delivered to {to} via Gmail.
          </p>
        </div>
        <button
          onClick={() => onSent(sent.id)}
          className="px-4 py-2 text-sm font-bold font-space"
          style={{ background: "#0D0D0D", color: "#FFFFFF", borderRadius: "4px" }}
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ background: "#FFFFFF", border: "2px solid #0D0D0D", borderRadius: "4px" }}
    >
      <label
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderBottom: "1.5px solid #EDE6D3" }}
      >
        <span
          className="text-[10px] font-bold uppercase tracking-widest font-space shrink-0 w-14"
          style={{ color: "#9CA3AF" }}
        >
          To
        </span>
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="recipient@email.com"
          className="flex-1 text-sm font-dm bg-transparent outline-none"
          style={{ color: "#0D0D0D" }}
        />
      </label>
      <label
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderBottom: "2px solid #0D0D0D" }}
      >
        <span
          className="text-[10px] font-bold uppercase tracking-widest font-space shrink-0 w-14"
          style={{ color: "#9CA3AF" }}
        >
          Subject
        </span>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          className="flex-1 text-sm font-dm font-semibold bg-transparent outline-none"
          style={{ color: "#0D0D0D" }}
        />
      </label>
      <div
        className="flex items-center justify-end gap-1 px-3 pt-2"
        style={{ background: "#FFFFFF" }}
      >
        {(["preview", "edit"] as const).map((mode) => {
          const active = (mode === "edit") === editingBody;
          return (
            <button
              key={mode}
              onClick={() => setEditingBody(mode === "edit")}
              className="text-[10px] font-bold uppercase tracking-widest font-space px-2 py-0.5"
              style={{
                color: active ? "#0D0D0D" : "#9CA3AF",
                background: active ? "#EDE6D3" : "transparent",
                borderRadius: "4px",
              }}
            >
              {mode}
            </button>
          );
        })}
      </div>
      {editingBody ? (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          autoFocus
          className="w-full px-3 py-3 text-[15px] font-dm leading-7 outline-none resize-none"
          style={{ color: "#0D0D0D", minHeight: 200, maxHeight: "45vh" }}
        />
      ) : (
        <div
          className="px-3 py-3 text-[15px] font-dm leading-7 overflow-y-auto"
          style={{ color: "#0D0D0D", minHeight: 200, maxHeight: "45vh" }}
          onDoubleClick={() => setEditingBody(true)}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="mb-3.5 last:mb-0">{children}</p>,
              ul: ({ children }) => (
                <ul className="list-disc pl-5 mb-3.5 space-y-1.5">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal pl-5 mb-3.5 space-y-1.5">{children}</ol>
              ),
              li: ({ children }) => <li>{children}</li>,
              strong: ({ children }) => (
                <strong className="font-bold" style={{ color: "#0D0D0D" }}>
                  {children}
                </strong>
              ),
              a: ({ href, children }) => (
                <a href={href} className="underline" style={{ color: "#E8472A" }}>
                  {children}
                </a>
              ),
            }}
          >
            {body}
          </ReactMarkdown>
        </div>
      )}
      {error && (
        <div
          className="px-3 py-1.5 text-xs font-dm"
          style={{ color: "#E8472A", background: "#FFF0ED", borderTop: "1.5px solid #EDE6D3" }}
        >
          {error}
        </div>
      )}
      <div
        className="flex items-center justify-between gap-2 px-3 py-2"
        style={{ borderTop: "2px solid #0D0D0D", background: "#F7F0E3" }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={copy}
            title="Copy email"
            className="flex items-center justify-center w-8 h-8"
            style={{ border: "1.5px solid #0D0D0D", borderRadius: "4px", background: "#FFFFFF" }}
          >
            <Icon
              icon={copied ? "solar:check-read-bold" : "solar:copy-bold"}
              width={14}
              style={{ color: "#0D0D0D" }}
            />
          </button>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-xs font-semibold font-space px-2 py-1"
              style={{ color: "#9CA3AF" }}
            >
              Cancel
            </button>
          )}
        </div>
        <button
          onClick={sendViaGmail}
          disabled={sending}
          className="flex items-center gap-2 px-3 py-2 text-sm font-bold font-space"
          style={{
            background: "#0D0D0D",
            color: "#FFFFFF",
            borderRadius: "4px",
            opacity: sending ? 0.6 : 1,
          }}
        >
          <Icon
            icon={sending ? "solar:spinner-bold" : "solar:letter-bold"}
            width={15}
            className={sending ? "animate-spin" : ""}
          />
          {sending ? "Sending…" : "Send via Gmail"}
        </button>
      </div>
    </div>
  );
}
