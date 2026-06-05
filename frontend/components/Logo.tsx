"use client";

import { Icon } from "@iconify/react";
import clsx from "clsx";

// Brand mark: diploma icon in a coral box + stacked Grad/Paddy wordmark.
// Designed for dark backgrounds.
export default function Logo({
  size = "md",
  iconOnly = false,
}: {
  size?: "sm" | "md";
  iconOnly?: boolean;
}) {
  const box = size === "sm" ? "w-7 h-7" : "w-9 h-9";
  const iconW = size === "sm" ? 14 : 18;
  const text = size === "sm" ? "text-sm" : "text-base";

  return (
    <div className="flex items-center gap-3">
      <div
        className={clsx("flex items-center justify-center flex-shrink-0", box)}
        style={{ background: "#E8472A", border: "2px solid #FFFFFF", borderRadius: "4px" }}
      >
        <Icon icon="solar:diploma-bold" width={iconW} style={{ color: "#FFFFFF" }} />
      </div>
      {!iconOnly && (
        <div className="leading-none">
          <span
            className={clsx("block font-space font-bold tracking-tight", text)}
            style={{ color: "#FFFFFF" }}
          >
            Grad
          </span>
          <span
            className={clsx("block font-space font-bold tracking-tight", text)}
            style={{ color: "#E8472A" }}
          >
            Paddy
          </span>
        </div>
      )}
    </div>
  );
}
