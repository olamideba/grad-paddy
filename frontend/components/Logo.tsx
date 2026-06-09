"use client";

import { GraduationCap } from "lucide-react";
import clsx from "clsx";

// Brand mark: graduation cap in a coral tile + stacked Grad/Paddy wordmark.
// Neobrutalist — sharp corners, hard shadow, paper border. For dark backgrounds.
export default function Logo({
  size = "md",
  iconOnly = false,
}: {
  size?: "sm" | "md";
  iconOnly?: boolean;
}) {
  const box = size === "sm" ? "size-9" : "size-12";
  const iconW = size === "sm" ? 18 : 24;
  const text = size === "sm" ? "text-sm" : "text-lg";

  return (
    <div className="flex items-center gap-3">
      <div
        className={clsx(
          "grid place-items-center flex-shrink-0 bg-accent-orange border-2 border-paper neo-shadow-sm",
          box
        )}
      >
        <GraduationCap width={iconW} height={iconW} strokeWidth={2.5} className="text-paper" />
      </div>
      {!iconOnly && (
        <div className="leading-tight font-space">
          <span className={clsx("block font-bold tracking-tight text-paper", text)}>Grad</span>
          <span className={clsx("block font-bold tracking-tight text-accent-orange -mt-1", text)}>
            Paddy
          </span>
        </div>
      )}
    </div>
  );
}
