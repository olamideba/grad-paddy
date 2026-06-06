"use client";

import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";

export default function ConfirmModal({
  title,
  message,
  confirmLabel = "Delete",
  danger = true,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: "rgba(13,13,13,0.6)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-sm overflow-hidden"
        style={{
          background: "#FFFFFF",
          border: "2px solid #0D0D0D",
          boxShadow: "6px 6px 0 #0D0D0D",
          borderRadius: "4px",
        }}
      >
        <div
          className="px-4 py-3 flex items-center justify-between gap-2"
          style={{ background: "#0D0D0D", borderBottom: "2px solid #E8472A" }}
        >
          <span className="text-sm font-bold font-space text-white truncate">{title}</span>
          <button
            onClick={onClose}
            className="bouncy shrink-0"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            <Icon icon="solar:close-circle-bold" width={16} />
          </button>
        </div>
        <div className="p-4">
          <p className="text-sm font-dm mb-4" style={{ color: "#5A5A5A" }}>
            {message}
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="btn-white btn-sm text-xs">
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className={danger ? "btn-coral btn-sm text-xs" : "btn-teal btn-sm text-xs"}
            >
              {danger && <Icon icon="solar:trash-bin-trash-bold" width={13} />}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
