"use client";

import type { ReactNode, ElementType, HTMLAttributes } from "react";

// Neobrutalist shared primitives — sharp corners, hard shadow, press affordance.

export function NeoButton({
  children,
  variant = "default",
  size = "md",
  className = "",
  as: As = "button",
  ...props
}: {
  children: ReactNode;
  variant?: "default" | "primary" | "ghost" | "teal" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
  as?: ElementType;
  href?: string;
  type?: "button" | "submit";
  disabled?: boolean;
} & HTMLAttributes<HTMLElement>) {
  const variants = {
    default: "bg-paper-2 text-ink",
    primary: "bg-accent-orange text-white",
    ghost: "bg-transparent text-ink hover:bg-paper-2",
    teal: "bg-accent-teal text-ink",
    danger: "bg-paper-2 text-accent-orange border-accent-orange",
  } as const;
  const sizes = {
    sm: "px-2.5 py-1 text-xs",
    md: "px-3.5 py-2 text-sm",
    lg: "px-5 py-2.5 text-base",
  } as const;
  return (
    <As
      className={`inline-flex items-center gap-2 font-bold border-2 border-ink neo-shadow-sm neo-press ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </As>
  );
}

export function StatusPill({
  tone = "ink",
  children,
}: {
  tone?: "ink" | "orange" | "teal" | "yellow" | "muted";
  children: ReactNode;
}) {
  const tones = {
    ink: "bg-ink text-paper",
    orange: "bg-accent-orange text-white",
    teal: "bg-accent-teal text-ink",
    yellow: "bg-accent-yellow text-ink",
    muted: "bg-paper text-muted-foreground",
  } as const;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-bold tracking-wide border-2 border-ink ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
